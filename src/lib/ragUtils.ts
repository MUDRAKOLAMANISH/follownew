import mammoth from 'mammoth';
import { KnowledgeFileType } from '../types';

export interface DocumentChunk {
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
}

/**
 * Format raw byte size into human readable string (e.g. 1.2 MB, 340 KB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'MB'}`;
}

/**
 * Identify file type from file name or MIME
 */
export function getKnowledgeFileType(fileName: string, mimeType?: string): KnowledgeFileType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc' || mimeType?.includes('word')) return 'docx';
  if (ext === 'md' || ext === 'markdown' || mimeType === 'text/markdown') return 'md';
  if (ext === 'txt' || mimeType === 'text/plain') return 'txt';
  return 'other';
}

/**
 * Extract text from TXT or Markdown File
 */
export async function extractTextFromPlainFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

/**
 * Extract text from DOCX file using mammoth
 */
export async function extractTextFromDocxFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  } catch (error) {
    console.error('Error extracting text from DOCX via mammoth:', error);
    // Fallback attempt via server
    return extractTextViaServer(file);
  }
}

/**
 * Helper to convert a File or Blob into base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1] || result;
      resolve(base64Data);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Fast client-side PDF text stream extractor (regex-based for uncompressed strings)
 */
export async function extractTextFromPdfClient(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('latin1');
    const textContent = decoder.decode(bytes);

    // Look for text in PDF stream blocks: BT ... ET
    const matches = textContent.match(/BT[\s\S]*?ET/g);
    if (matches && matches.length > 0) {
      const extractedStrings: string[] = [];
      for (const block of matches) {
        // Extract strings enclosed in parentheses (e.g., (Hello World) Tj)
        const strMatches = block.match(/\((.*?)\)/g);
        if (strMatches) {
          const blockText = strMatches
            .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'))
            .filter((s) => s.length > 1 && !/^[\x00-\x1F]+$/.test(s))
            .join(' ');
          if (blockText.trim()) {
            extractedStrings.push(blockText);
          }
        }
      }
      if (extractedStrings.length > 0) {
        return extractedStrings.join('\n');
      }
    }
  } catch (err) {
    console.warn('[PDF Client Extractor] Notice:', err);
  }
  return '';
}

/**
 * Extract text from PDF or complex files via Server Gemini/Parser
 */
export async function extractTextViaServer(file: File): Promise<string> {
  try {
    const fileType = getKnowledgeFileType(file.name, file.type);
    const base64Data = await fileToBase64(file);

    const response = await fetch('/api/rag/extract-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType,
        rawContentBase64: base64Data
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text || '';
  } catch (err: any) {
    console.warn('Server text extraction fallback triggered:', err?.message || err);
    // Try client-side extraction as fallback
    const clientText = await extractTextFromPdfClient(file);
    if (clientText && clientText.trim()) {
      return clientText;
    }
    return `[Document: ${file.name}]\nDocument indexed for FollowFlow AI central knowledge base.`;
  }
}

/**
 * Unified text extractor for PDF, DOCX, TXT, MD
 */
export async function extractDocumentText(file: File): Promise<string> {
  const fileType = getKnowledgeFileType(file.name, file.type);
  
  if (fileType === 'txt' || fileType === 'md') {
    return extractTextFromPlainFile(file);
  }

  if (fileType === 'docx') {
    try {
      const docxText = await extractTextFromDocxFile(file);
      if (docxText && docxText.trim().length > 0) {
        return docxText;
      }
    } catch (e) {
      console.warn('Docx extraction fallback:', e);
    }
    return extractTextViaServer(file);
  }

  if (fileType === 'pdf') {
    const serverResult = await extractTextViaServer(file);
    if (serverResult && serverResult.trim()) {
      return serverResult;
    }
    const clientResult = await extractTextFromPdfClient(file);
    if (clientResult && clientResult.trim()) {
      return clientResult;
    }
    return `Document: ${file.name}\nIndexed in FollowFlow AI Knowledge Base.`;
  }

  // Generic fallback
  return extractTextViaServer(file);
}

/**
 * Chunk text into overlapping segments for RAG retrieval
 */
export function chunkDocumentText(text: string, chunkSize = 800, overlap = 150): DocumentChunk[] {
  if (!text || !text.trim()) return [];

  const chunks: DocumentChunk[] = [];
  const cleanText = text.replace(/\r\n/g, '\n').trim();
  
  let start = 0;
  let chunkIndex = 0;

  while (start < cleanText.length) {
    let end = start + chunkSize;
    
    // Try to break at a paragraph or sentence boundary if possible
    if (end < cleanText.length) {
      const nextNewline = cleanText.indexOf('\n\n', end - 100);
      if (nextNewline !== -1 && nextNewline < end + 100) {
        end = nextNewline;
      } else {
        const nextPeriod = cleanText.indexOf('. ', end - 60);
        if (nextPeriod !== -1 && nextPeriod < end + 60) {
          end = nextPeriod + 1;
        }
      }
    } else {
      end = cleanText.length;
    }

    const chunkContent = cleanText.slice(start, end).trim();
    if (chunkContent.length > 20) {
      chunks.push({
        chunkIndex,
        text: chunkContent,
        charStart: start,
        charEnd: end
      });
      chunkIndex++;
    }

    start = end - overlap;
    if (start >= cleanText.length - overlap) break;
  }

  return chunks;
}
