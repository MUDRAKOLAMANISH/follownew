import { useState } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  Database, 
  Layers, 
  Clock, 
  User, 
  HardDrive, 
  FileCode, 
  Sparkles,
  Info
} from 'lucide-react';
import { KnowledgeBaseDocument } from '../types';
import { formatBytes, chunkDocumentText } from '../lib/ragUtils';

interface DocumentViewerModalProps {
  document: KnowledgeBaseDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onTestQuery?: (query: string) => void;
}

export default function DocumentViewerModal({
  document,
  isOpen,
  onClose,
  onTestQuery
}: DocumentViewerModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'chunks' | 'metadata'>('text');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !document) return null;

  const chunks = chunkDocumentText(document.extractedText || '');

  const handleCopyText = () => {
    if (!document.extractedText) return;
    navigator.clipboard.writeText(document.extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFormatBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return { label: 'PDF', bg: 'bg-red-50 text-red-700 border-red-200', icon: '📄' };
      case 'docx':
      case 'doc':
        return { label: 'DOCX', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: '📝' };
      case 'md':
      case 'markdown':
        return { label: 'Markdown', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: '📑' };
      case 'txt':
        return { label: 'TXT', bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: '📃' };
      default:
        return { label: type.toUpperCase(), bg: 'bg-gray-50 text-gray-700 border-gray-200', icon: '📄' };
    }
  };

  const badge = getFormatBadge(document.fileType);
  const formattedDate = document.uploadedAt instanceof Date 
    ? document.uploadedAt.toLocaleString() 
    : document.uploadedAt?.toDate 
      ? document.uploadedAt.toDate().toLocaleString() 
      : 'Recently';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="text-2xl">{badge.icon}</span>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-base truncate max-w-md">
                  {document.fileName}
                </h3>
                <span className={`text-2xs font-semibold px-2 py-0.5 rounded border ${badge.bg}`}>
                  {badge.label}
                </span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {document.status === 'ready' ? 'Indexed & Ready' : document.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                <span>{formatBytes(document.fileSize)}</span>
                <span>•</span>
                <span>Uploaded {formattedDate}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {document.fileUrl && (
              <a
                href={document.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-2xs"
                title="Download original file from Firebase Storage"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="px-6 border-b border-gray-200 bg-white flex items-center gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('text')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'text'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Extracted Text ({document.extractedText?.length || 0} chars)</span>
          </button>

          <button
            onClick={() => setActiveTab('chunks')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'chunks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>RAG Chunks ({chunks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('metadata')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'metadata'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Info className="h-4 w-4" />
            <span>Storage & Metadata</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50">
          
          {/* TAB 1: Extracted Text */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  This text was extracted and indexed in Firestore for FollowFlow AI RAG semantic search.
                </p>
                <button
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-md border border-gray-200 shadow-2xs transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Full Text</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200 text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed max-h-[460px] overflow-y-auto shadow-2xs selection:bg-indigo-100">
                {document.extractedText || 'No extracted text available for this document.'}
              </div>
            </div>
          )}

          {/* TAB 2: Chunks Inspector */}
          {activeTab === 'chunks' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                The document is segmented into {chunks.length} overlapping vector chunks used for retrieval scoring when users ask questions.
              </p>
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {chunks.map((chunk, idx) => (
                  <div key={idx} className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-2xs">
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-mono">
                        Chunk #{chunk.chunkIndex + 1}
                      </span>
                      <span className="text-gray-400 font-mono">
                        Chars {chunk.charStart} – {chunk.charEnd} ({chunk.text.length} chars)
                      </span>
                    </div>
                    <p className="text-xs text-gray-800 leading-relaxed font-sans bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      {chunk.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Metadata */}
          {activeTab === 'metadata' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-2xs">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Document Technical Specifications
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-2xs text-gray-500 block font-medium">Firestore Document ID</span>
                  <span className="font-mono font-bold text-gray-900 break-all">{document.id}</span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-2xs text-gray-500 block font-medium">Firestore Collection</span>
                  <span className="font-mono font-bold text-indigo-600">knowledge_base</span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-2xs text-gray-500 block font-medium">Firebase Storage Bucket</span>
                  <span className="font-mono font-bold text-gray-900 break-all">aiknowledgeassistant05.firebasestorage.app</span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-2xs text-gray-500 block font-medium">Storage Path</span>
                  <span className="font-mono font-bold text-gray-900 break-all">{document.storagePath || 'N/A'}</span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-2xs text-gray-500 block font-medium">Uploaded By</span>
                  <span className="font-semibold text-gray-900">{document.uploadedBy}</span>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-2xs text-gray-500 block font-medium">File Size</span>
                  <span className="font-semibold text-gray-900">{formatBytes(document.fileSize)} ({document.fileSize} bytes)</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Ready for Gemini RAG retrieval</span>
          </div>

          <div className="flex items-center gap-2">
            {onTestQuery && (
              <button
                onClick={() => {
                  onClose();
                  onTestQuery(`What are the key points in ${document.fileName}?`);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                Test in RAG Sandbox
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
