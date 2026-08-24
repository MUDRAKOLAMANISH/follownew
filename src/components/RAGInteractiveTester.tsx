import { useState, FormEvent } from 'react';
import { 
  Sparkles, 
  Search, 
  Bot, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  HelpCircle,
  Zap,
  BookOpen
} from 'lucide-react';
import { KnowledgeBaseDocument, RAGQueryResponse, RAGSourceCitation } from '../types';
import { queryRAGKnowledgeBase } from '../lib/knowledgeBaseService';

interface RAGInteractiveTesterProps {
  documents: KnowledgeBaseDocument[];
  initialQuery?: string;
  onOpenDocViewer?: (doc: KnowledgeBaseDocument) => void;
}

export default function RAGInteractiveTester({
  documents,
  initialQuery = '',
  onOpenDocViewer
}: RAGInteractiveTesterProps) {
  const [queryText, setQueryText] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<RAGQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    'What features does FollowFlow AI provide for lead management?',
    'How does automated Follow-Up and lead scoring (0-100) work?',
    'What messaging channels are supported (WhatsApp, Gmail, Email)?',
    'What are the pricing tiers, CRM features, and customer retention workflows?'
  ];

  const handleQuery = async (textToSearch?: string) => {
    const queryToRun = textToSearch || queryText;
    if (!queryToRun.trim()) return;

    setIsSearching(true);
    setError(null);
    try {
      const res = await queryRAGKnowledgeBase(queryToRun);
      setResult(res);
    } catch (err: any) {
      console.error('RAG search error:', err);
      setError(err?.message || 'Failed to query RAG system. Ensure documents are uploaded.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleQuery();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
      
      {/* Header */}
      <div className="p-5 border-b border-gray-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Sparkles className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              Live RAG Knowledge Base Query Engine
            </h3>
            <p className="text-xs text-gray-500">
              Test semantic retrieval against {documents.length} indexed document{documents.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Gemini 3.7 Flash RAG Active
          </span>
        </div>
      </div>

      {/* Query Form & Sample Chips */}
      <div className="p-5 border-b border-gray-100 space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Ask anything from your uploaded knowledge documents (e.g. 'What is the pricing structure?')..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !queryText.trim() || documents.length === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isSearching ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                <span>Retrieving...</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                <span>Ask Knowledge Base</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Sample Queries */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xs font-semibold text-gray-400 uppercase tracking-wider">
            Quick Queries:
          </span>
          {sampleQueries.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQueryText(q);
                handleQuery(q);
              }}
              className="text-2xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 transition-colors border border-gray-200"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Results Area */}
      <div className="p-5 bg-slate-50/40 min-h-[160px]">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Retrieval Notice</p>
              <p className="text-2xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {isSearching && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin"></div>
            <div>
              <p className="text-xs font-semibold text-gray-800">
                Searching vector chunks in {documents.length} document{documents.length === 1 ? '' : 's'}...
              </p>
              <p className="text-2xs text-gray-400 mt-0.5">
                Grounded generation via Gemini 3.7 Flash
              </p>
            </div>
          </div>
        )}

        {!isSearching && result && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Answer Box */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold text-gray-900">
                    Grounded RAG Response
                  </span>
                </div>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Model: {result.modelUsed || 'gemini-3.7-flash'}
                </span>
              </div>

              <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap font-sans bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                {result.answer}
              </div>
            </div>

            {/* Citations & Sources */}
            {result.sources && result.sources.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Retrieved Source Citations ({result.sources.length})</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {result.sources.map((source, sIdx) => {
                    const matchedDoc = documents.find(d => d.id === source.docId || d.fileName === source.fileName);
                    return (
                      <div
                        key={sIdx}
                        className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1.5 hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex items-center justify-between text-2xs">
                          <span className="font-bold text-gray-900 truncate max-w-[160px]">
                            📄 {source.fileName}
                          </span>
                          <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            {source.relevanceScore || 90}% match
                          </span>
                        </div>

                        <p className="text-2xs text-gray-600 line-clamp-3 bg-gray-50 p-1.5 rounded border border-gray-100 font-mono">
                          "{source.snippet}"
                        </p>

                        {matchedDoc && onOpenDocViewer && (
                          <button
                            type="button"
                            onClick={() => onOpenDocViewer(matchedDoc)}
                            className="text-2xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1"
                          >
                            <span>Inspect source document</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {!isSearching && !result && !error && (
          <div className="py-8 text-center text-gray-400 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 mx-auto flex items-center justify-center shadow-2xs">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-xs font-semibold text-gray-700">
              Query your knowledge base in natural language
            </p>
            <p className="text-2xs text-gray-400 max-w-sm mx-auto">
              FollowFlow AI will extract relevant snippets from your uploaded PDF, DOCX, TXT, and Markdown files and synthesize an answer.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
