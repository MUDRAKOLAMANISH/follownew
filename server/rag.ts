import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PRIMARY_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

export const NOT_FOUND_RESPONSE = "I couldn't find that information in the FollowFlow AI knowledge base.";

export interface DocPayload {
  id: string;
  fileName: string;
  fileType: string;
  extractedText: string;
  fileUrl?: string;
}

export interface ChunkWithScore {
  docId: string;
  fileName: string;
  fileType: string;
  fileUrl?: string;
  chunkText: string;
  score: number;
}

// Built-in Central Product Specification as baseline knowledge
export const DEFAULT_PRODUCT_DOCUMENT: DocPayload = {
  id: "default-followflow-guide",
  fileName: "FollowFlow_AI_Official_Guide.md",
  fileType: "md",
  extractedText: `# FollowFlow AI - Official Product Documentation & Knowledge Base

## 1. Product Overview
FollowFlow AI (formerly LeadPilot AI) is an intelligent customer follow-up, sales pipeline, and CRM automation platform designed for retail stores, jewelry shops, clothing boutiques, service businesses, and local shops.

## 2. Core Capabilities & Features
- **Smart Lead Management**: Real-time intake of inquiries from website, WhatsApp, phone, and walk-ins.
- **AI Lead Scoring (0-100)**: Automatically calculates purchase intent and urgency (High, Medium, Low priority) to prioritize hot prospects.
- **Automated Follow-Up Engine**: Generates customized follow-up reminders, WhatsApp scripts, and Gmail email messages tailored to customer intent.
- **WhatsApp Integration**: Fast one-click WhatsApp message generation and direct dispatch with localized templates.
- **Gmail & Email Outreach**: Automated re-engagement campaigns and transactional email sequences for pending inquiries.
- **Permanent Customer Database**: Converted leads are securely preserved with full purchase history, past inquiries, preferences, and lifetime value tracking.
- **Customer Re-Engagement**: Automated alerts when existing customers have not purchased for 30, 60, or 90 days.
- **Multi-Role Access Control (RBAC)**: Business Owner, Sales Manager, and Super Admin roles with isolated permissions.
- **Central Product Knowledge Base**: Super Admin managed RAG vector store for document indexing and intelligent query retrieval.

## 3. Sales Pipeline Stages
The pipeline organizes customer deals into 7 distinct stages:
1. New Inquiry
2. Interested
3. Follow Up Needed
4. Price Shared
5. Waiting For Stock
6. Order Confirmed
7. Customer Purchased

## 4. Target Audience & Business Types
Tailored specifically for:
- Jewelry shops and luxury goods stores
- Fashion and clothing boutiques
- Local retail stores and wholesale distributors
- Professional service businesses (salons, clinics, consulting)
- Small and medium business sales teams

## 5. Follow Buddy AI Assistant
Follow Buddy is the built-in guide grounded directly in the central knowledge base to answer questions about FollowFlow AI workflows, features, and documentation.`
};

const STOP_WORDS = new Set([
  "the", "and", "is", "a", "an", "for", "to", "in", "of", "on", "with", 
  "what", "how", "can", "do", "i", "you", "my", "our", "are", "it", "this", 
  "that", "does", "from", "about", "who", "which", "there", "their", "will", "would"
]);

/**
 * Score relevance of a document chunk against a query using token overlap and phrase matching
 */
export function scoreChunkRelevance(query: string, chunk: string): number {
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const queryTerms = cleanQuery.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  
  if (queryTerms.length === 0) {
    // If only generic words, check simple substring match
    return chunk.toLowerCase().includes(query.toLowerCase().trim()) ? 5 : 0;
  }

  const lowerChunk = chunk.toLowerCase();
  let matches = 0;
  let phraseBonus = 0;

  // Exact phrase match bonus
  if (lowerChunk.includes(cleanQuery)) {
    phraseBonus = 15;
  }

  for (const term of queryTerms) {
    // Count occurrences
    const regex = new RegExp(`\\b${term}`, "gi");
    const count = (lowerChunk.match(regex) || []).length;
    if (count > 0) {
      matches += Math.min(count, 3);
    }
  }

  if (matches === 0 && phraseBonus === 0) {
    return 0;
  }

  const matchRatio = matches / queryTerms.length;
  return matchRatio * 10 + phraseBonus;
}

/**
 * Extract relevant context chunks from knowledge documents
 */
export function retrieveRelevantContext(
  query: string, 
  documents: DocPayload[], 
  topK = 4,
  minScore = 1.5
): ChunkWithScore[] {
  const allChunks: ChunkWithScore[] = [];
  
  // Combine custom documents with default product guide if not already included
  const allDocs = [...documents];
  if (!allDocs.some(d => d.fileName === DEFAULT_PRODUCT_DOCUMENT.fileName)) {
    allDocs.push(DEFAULT_PRODUCT_DOCUMENT);
  }

  for (const doc of allDocs) {
    const text = doc.extractedText || '';
    if (!text.trim()) continue;

    // Split text into semantic chunks of ~500 chars with 100 char overlap
    const chunkSize = 500;
    const overlap = 100;
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end).trim();

      if (chunk.length > 25) {
        const score = scoreChunkRelevance(query, chunk);
        if (score >= minScore) {
          allChunks.push({
            docId: doc.id,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileUrl: doc.fileUrl,
            chunkText: chunk,
            score
          });
        }
      }

      start += chunkSize - overlap;
      if (start >= text.length - overlap) break;
    }
  }

  // Sort by score descending and return top K
  allChunks.sort((a, b) => b.score - a.score);
  return allChunks.slice(0, topK);
}

/**
 * Strict RAG Query Generator for Follow Buddy
 */
export async function executeFollowBuddyRAG(
  message: string,
  documents: DocPayload[]
): Promise<{ reply: string; sources: string[]; foundInKnowledgeBase: boolean }> {
  const trimmed = message.trim();

  // Check for simple greetings
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy|greetings)[\s!.]*$/i.test(trimmed)) {
    return {
      reply: "Hello! I'm Follow Buddy, your AI guide for FollowFlow AI. Ask me anything about our features, lead management, WhatsApp follow-ups, or customer workflows.",
      sources: [],
      foundInKnowledgeBase: true
    };
  }

  // Retrieve relevant chunks from Central Knowledge Base
  const relevantChunks = retrieveRelevantContext(trimmed, documents, 4, 1.2);

  if (relevantChunks.length === 0) {
    console.log(`[Follow Buddy RAG] No relevant chunks found for query: "${trimmed}"`);
    return {
      reply: NOT_FOUND_RESPONSE,
      sources: [],
      foundInKnowledgeBase: false
    };
  }

  // Deduplicate source document names
  const sourceDocNames = Array.from(new Set(relevantChunks.map(c => c.fileName)));

  const contextBlock = relevantChunks
    .map((c, i) => `[Document: ${c.fileName}]\n${c.chunkText}`)
    .join("\n\n---\n\n");

  const prompt = `You are "Follow Buddy", the official AI assistant for FollowFlow AI.
Answer the user's question strictly and accurately using ONLY the knowledge chunks provided below.

CRITICAL RULES:
1. STRICT GROUNDING: Use ONLY the provided knowledge chunks below.
2. NO HALLUCINATIONS: Do not assume, fabricate, or extrapolate any details not explicitly present in the chunks.
3. NO EXTERNAL KNOWLEDGE: Do not use outside knowledge to answer product or business questions.
4. UNKNOWN INFO: If the provided chunks do not contain the answer, you MUST respond EXACTLY with:
"${NOT_FOUND_RESPONSE}"
5. TONE & LENGTH: Clear, friendly, and concise (1-3 sentences or clean bullet points).

=== RETRIEVED KNOWLEDGE BASE CHUNKS ===
${contextBlock}
=======================================

User Question: "${trimmed}"`;

  try {
    console.log(`[Follow Buddy RAG] Generating strictly grounded answer using ${relevantChunks.length} chunks from:`, sourceDocNames);
    
    let answer = "";
    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: prompt
      });
      answer = response.text?.trim() || "";
    } catch (primaryErr) {
      console.warn(`[Follow Buddy RAG] Primary model retry with fallback...`);
      const fallbackRes = await ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents: prompt
      });
      answer = fallbackRes.text?.trim() || "";
    }

    if (!answer || answer.includes(NOT_FOUND_RESPONSE)) {
      return {
        reply: NOT_FOUND_RESPONSE,
        sources: [],
        foundInKnowledgeBase: false
      };
    }

    return {
      reply: answer,
      sources: sourceDocNames,
      foundInKnowledgeBase: true
    };
  } catch (err: any) {
    console.error("[Follow Buddy RAG Error]:", err?.message || err);
    return {
      reply: NOT_FOUND_RESPONSE,
      sources: [],
      foundInKnowledgeBase: false
    };
  }
}

/**
 * Perform RAG generation with Gemini for Knowledge Base Query Sandbox
 */
export async function executeRAGQuery(queryText: string, documents: DocPayload[]) {
  const relevantChunks = retrieveRelevantContext(queryText, documents, 6, 0.5);
  const hasContext = relevantChunks.length > 0;

  let contextString = "";
  if (hasContext) {
    contextString = relevantChunks
      .map((c, i) => `[Source ${i + 1}: ${c.fileName}]\n${c.chunkText}`)
      .join("\n\n---\n\n");
  } else if (documents.length > 0) {
    contextString = documents
      .map(d => `[Document: ${d.fileName} (${d.fileType})]\n${d.extractedText.slice(0, 1000)}`)
      .join("\n\n---\n\n");
  }

  const prompt = `You are FollowFlow AI's Knowledge Base RAG Assistant. 
Answer the user's question accurately using ONLY the retrieved knowledge documents provided below.
If the information is not present in the provided context, state clearly what is missing and provide helpful guidance based on the available materials.

=== KNOWLEDGE BASE RETRIEVED CONTEXT ===
${contextString || "No matching documents found in knowledge base."}
========================================

User Question: "${queryText}"

Instructions:
1. Provide a direct, well-formatted, professional answer.
2. Explicitly cite source document names when referencing facts (e.g. "According to [Document Name]...").
3. Use bullet points or numbered lists where appropriate for readability.`;

  let answerText = "";
  let modelUsed = PRIMARY_MODEL;

  try {
    console.log(`[RAG Server Sandbox] Executing RAG query with model ${PRIMARY_MODEL}`);
    const res = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt
    });
    answerText = res.text?.trim() || "";
  } catch (err: any) {
    console.error(`[RAG Server Sandbox] Primary model failed:`, err?.message || err);
    modelUsed = FALLBACK_MODEL;
    const fallbackRes = await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: prompt
    });
    answerText = fallbackRes.text?.trim() || "";
  }

  const sources = relevantChunks.map(c => ({
    docId: c.docId,
    fileName: c.fileName,
    fileType: c.fileType,
    snippet: c.chunkText.length > 200 ? c.chunkText.slice(0, 200) + "..." : c.chunkText,
    relevanceScore: Math.min(100, Math.round(c.score * 10)),
    fileUrl: c.fileUrl
  }));

  return {
    answer: answerText,
    sources,
    query: queryText,
    modelUsed,
    contextFound: hasContext
  };
}

