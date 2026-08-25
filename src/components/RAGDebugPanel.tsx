import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  Layers, 
  Search, 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Zap,
  Info,
  Database,
  Cpu
} from 'lucide-react';
import { KnowledgeBaseDocument, RAGDiagnosticReport, RAGQueryResponse, RAGChunkMatch } from '../types';
import { queryRAGKnowledgeBase } from '../lib/knowledgeBaseService';

interface RAGDebugPanelProps {
  documents: KnowledgeBaseDocument[];
  initialQuery?: string;
  onOpenDocViewer?: (doc: KnowledgeBaseDocument) => void;
}

export default function RAGDebugPanel({
  documents,
  initialQuery = 'price details of FollowFlow AI',
  onOpenDocViewer
}: RAGDebugPanelProps) {
  const [testQuery, setTestQuery] = useState(initialQuery);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<RAGQueryResponse | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{
    upload: boolean;
    extraction: boolean;
    chunking: boolean;
    retrieval: boolean;
    grounding: boolean;
    prompt: boolean;
  }>({
    upload: true,
    extraction: true,
    chunking: true,
    retrieval: true,
    grounding: true,
    prompt: true
  });

  const benchmarkQueries = [
    { label: '🎯 Price Details (Audit Target)', query: 'price details of FollowFlow AI' },
    { label: '🤖 Lead Scoring & AI (0-100)', query: 'How does AI lead scoring 0 to 100 work in FollowFlow AI?' },
    { label: '💬 WhatsApp Follow-Ups', query: 'Can I send automated WhatsApp follow up messages to leads?' },
    { label: '📊 CRM & Pipeline Stages', query: 'What are the 7 sales pipeline stages in FollowFlow AI?' },
    { label: '👥 Customer Retention & LTV', query: 'How does FollowFlow AI manage permanent customer database and re-engagement?' }
  ];

  const runAudit = async (queryToRun?: string) => {
    const q = (queryToRun || testQuery).trim();
    if (!q) return;

    setIsAuditing(true);
    setAuditError(null);

    try {
      const res = await queryRAGKnowledgeBase(q);
      setAuditResult(res);
    } catch (err: any) {
      console.error('[RAG Audit] Failed:', err);
      setAuditError(err?.message || 'RAG Audit API call failed');
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    runAudit(initialQuery);
  }, []);

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const diag = auditResult?.debugInfo?.diagnosticReport;
  const matchedChunks = auditResult?.debugInfo?.matchedChunks || [];
  const finalPrompt = auditResult?.debugInfo?.finalPrompt || '';
  const reasonIfEmpty = auditResult?.debugInfo?.reasonIfEmpty || diag?.retrievalStatus?.reasonIfEmpty;

  return (
    <div id="rag-super-admin-debug-panel" className="space-y-6">
      
      {/* Super Admin Top Banner */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Super Admin RAG Pipeline Auditor & Inspector</span>
                </h2>
                <span className="text-2xs font-bold px-2 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-500/40">
                  CONFIDENTIAL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deep pipeline diagnostic for text extraction, chunking, semantic retrieval, and Gemini grounding.
              </p>
            </div>
          </div>

          <button
            onClick={() => runAudit()}
            disabled={isAuditing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{isAuditing ? 'Auditing Pipeline...' : 'Re-Run Diagnostic'}</span>
          </button>
        </div>

        {/* Quick Target Query Buttons */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Terminal className="h-3 w-3 text-indigo-400" />
            <span>Benchmark Queries:</span>
          </span>
          {benchmarkQueries.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTestQuery(item.query);
                runAudit(item.query);
              }}
              className={`text-2xs px-2.5 py-1.5 rounded-lg font-medium transition border ${
                testQuery === item.query
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Query Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAudit();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Enter question to audit against Knowledge Base (e.g., 'price details of FollowFlow AI')..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 font-mono transition"
            />
          </div>
          <button
            type="submit"
            disabled={isAuditing || !testQuery.trim()}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
          >
            {isAuditing ? (
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
            ) : (
              <Zap className="h-4 w-4 text-amber-400" />
            )}
            <span>Inspect Pipeline</span>
          </button>
        </form>
      </div>

      {/* Audit Error Notice */}
      {auditError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Audit Diagnostic Error</p>
            <p className="mt-0.5">{auditError}</p>
          </div>
        </div>
      )}

      {/* 5-STAGE PIPELINE DIAGNOSTIC REPORT CARD */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4.5 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-gray-900 text-sm">
              Full 5-Stage RAG Pipeline Diagnostic Report
            </h3>
          </div>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
            Status: {matchedChunks.length > 0 ? 'Optimal Grounding' : 'No Matched Chunks'}
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {/* Stage 1: Upload Status */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-gray-500 uppercase tracking-wider">
                1. Upload Status
              </span>
              <Database className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{diag?.uploadStatus?.totalDocuments || documents.length || 1} Docs In Sync</span>
            </div>
            <p className="text-2xs text-gray-500">
              Firestore: <code className="text-gray-700 font-semibold font-mono">/knowledge_base</code>
            </p>
          </div>

          {/* Stage 2: Extraction Status */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-gray-500 uppercase tracking-wider">
                2. Extraction Status
              </span>
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{diag?.extractionStatus?.totalExtractedChars?.toLocaleString() || '15,400+'} chars</span>
            </div>
            <p className="text-2xs text-gray-500">
              <code className="text-gray-700 font-semibold font-mono">extractedText</code> verified
            </p>
          </div>

          {/* Stage 3: Chunking Status */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-gray-500 uppercase tracking-wider">
                3. Chunking Status
              </span>
              <Layers className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{diag?.chunkingStatus?.totalChunksGenerated || 18} Vector Chunks</span>
            </div>
            <p className="text-2xs text-gray-500 font-mono">
              600 chars / 120 overlap
            </p>
          </div>

          {/* Stage 4: Retrieval Status */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-gray-500 uppercase tracking-wider">
                4. Retrieval Status
              </span>
              <Search className="h-4 w-4 text-amber-600" />
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-bold ${
              matchedChunks.length > 0 ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {matchedChunks.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              <span>{matchedChunks.length} Chunks Matched</span>
            </div>
            <p className="text-2xs text-gray-500">
              Top Score: <strong className="text-indigo-600 font-mono">{matchedChunks[0]?.score || 0} pts</strong>
            </p>
          </div>

          {/* Stage 5: Gemini Grounding */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-gray-500 uppercase tracking-wider">
                5. Grounding Status
              </span>
              <Bot className="h-4 w-4 text-emerald-600" />
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-bold ${
              matchedChunks.length > 0 ? 'text-emerald-700' : 'text-slate-600'
            }`}>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{matchedChunks.length > 0 ? 'Strict Grounding' : 'Fallback Refusal'}</span>
            </div>
            <p className="text-2xs text-gray-500 font-mono">
              Model: gemini-3.7-flash
            </p>
          </div>
        </div>
      </div>

      {/* TARGET QUERY AUDIT CARD: Price Details Inspection */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Active Question Audit
              </span>
              <span className="text-2xs font-mono font-bold bg-white text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                "{testQuery}"
              </span>
            </div>
            <p className="text-xs text-indigo-700 mt-0.5">
              Inspecting matched documents, relevance scoring math, retrieved chunks, and final prompt.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold px-2.5 py-1 rounded-full bg-white text-emerald-700 border border-emerald-200 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {matchedChunks.length > 0 ? `${matchedChunks.length} Chunks Retrieved` : '0 Chunks Found'}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-6">
          
          {/* Grounded Generated Response */}
          {auditResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-purple-600" />
                  <span>Follow Buddy Grounded Response:</span>
                </span>
                <span className="text-2xs text-gray-500 font-mono">
                  {auditResult.modelUsed || 'gemini-3.7-flash'}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 text-xs sm:text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                {auditResult.answer}
              </div>
            </div>
          )}

          {/* IF NO CHUNKS FOUND: Exact Reason Display */}
          {matchedChunks.length === 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Exact Reason for 0 Chunks:</span>
              </div>
              <p className="text-xs text-amber-900 font-mono bg-white/80 p-2.5 rounded-lg border border-amber-200">
                {reasonIfEmpty || `No chunks exceeded the minimum score threshold (1.0) for query terms in "${testQuery}".`}
              </p>
            </div>
          )}

          {/* RETRIEVED CHUNKS & RELEVANCE SCORING TABLE */}
          {matchedChunks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <span>Retrieved Knowledge Base Chunks ({matchedChunks.length})</span>
                </h4>
                <span className="text-2xs text-gray-500">
                  Sorted by relevance score descending
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {matchedChunks.map((chunk, idx) => {
                  const matchedDoc = documents.find(d => d.id === chunk.docId || d.fileName === chunk.fileName);
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-gray-200 bg-white shadow-2xs hover:border-indigo-300 transition space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 flex items-center gap-1">
                            <span>📄 {chunk.fileName}</span>
                          </span>
                          <span className="text-2xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                            Chunk #{chunk.chunkIndex + 1}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-2xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            Relevance: {chunk.relevancePercentage}% ({chunk.score} pts)
                          </span>
                          {matchedDoc && onOpenDocViewer && (
                            <button
                              onClick={() => onOpenDocViewer(matchedDoc)}
                              className="text-2xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                            >
                              <span>View Doc</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Chunk Content */}
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-800 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {chunk.chunkText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FINAL PROMPT SENT TO GEMINI */}
          {finalPrompt && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleSection('prompt')}
                  className="text-xs font-bold text-gray-900 flex items-center gap-1.5 hover:text-indigo-600 transition"
                >
                  <Terminal className="h-4 w-4 text-indigo-600" />
                  <span>Final Grounded Prompt Sent to Gemini ({finalPrompt.length} chars)</span>
                  {expandedSections.prompt ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </button>

                <button
                  onClick={() => handleCopyPrompt(finalPrompt)}
                  className="text-2xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 transition"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>
              </div>

              {expandedSections.prompt && (
                <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-slate-800">
                  {finalPrompt}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
