import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  BookOpen, 
  ShieldCheck, 
  Layers, 
  Terminal, 
  Check, 
  Copy, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SUGGESTED_QUESTIONS 
} from '../lib/followBuddyKnowledge';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../lib/adminAuth';
import { RAGChunkMatch, RAGDiagnosticReport } from '../types';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
  suggestedQuestions?: string[];
  isOffTopic?: boolean;
  sources?: string[];
  foundInKnowledgeBase?: boolean;
  debugInfo?: {
    matchedChunks?: RAGChunkMatch[];
    topScore?: number;
    queryTerms?: string[];
    finalPrompt?: string;
    reasonIfEmpty?: string;
    diagnosticReport?: RAGDiagnosticReport;
  };
}

const INITIAL_WELCOME = `👋 Hi! I'm Follow Buddy.

I can help you understand how FollowFlow AI works, explore pricing plans, automate WhatsApp follow-ups, and convert leads into repeat customers.

Ask me anything (e.g., "What are the price details of FollowFlow AI?")!`;

export default function FollowBuddyChat() {
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user);

  const [isOpen, setIsOpen] = useState(false);
  const [showAdminDebugModal, setShowAdminDebugModal] = useState(false);
  const [selectedDebugMessage, setSelectedDebugMessage] = useState<Message | null>(null);
  const [expandedChunkMsgId, setExpandedChunkMsgId] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      sender: 'bot',
      text: INITIAL_WELCOME,
      timestamp: new Date(),
      suggestedQuestions: [
        'What are the price details of FollowFlow AI?',
        'How does AI lead scoring (0-100) work?',
        'Can I use WhatsApp for follow-ups?',
        'What are the 7 sales pipeline stages?'
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || isTyping) return;

    setHasInteracted(true);
    const userMsgId = `user-${Date.now()}`;
    const newMessages: Message[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: queryText,
        timestamp: new Date()
      }
    ];

    setMessages(newMessages);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      let knowledgeDocs: any[] = [];
      try {
        const snap = await getDocs(query(collection(db, 'knowledge_base'), limit(50)));
        knowledgeDocs = snap.docs.map(d => {
          const data = d.data() as any;
          return {
            id: d.id,
            fileName: data.fileName || 'Product Document',
            fileType: data.fileType || 'pdf',
            extractedText: data.extractedText || '',
            fileUrl: data.fileUrl || ''
          };
        });
      } catch (docErr) {
        console.log('[Follow Buddy] Knowledge base fetch notice:', docErr);
      }

      const response = await fetch('/api/chat-follow-buddy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          knowledgeDocuments: knowledgeDocs,
          conversationHistory: newMessages.slice(-4).map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            content: m.text
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Chat service error');
      }

      const data = await response.json();
      const botReply = data.reply || "I couldn't find that information in the FollowFlow AI knowledge base.";

      setMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: botReply,
          timestamp: new Date(),
          sources: data.sources || [],
          foundInKnowledgeBase: data.foundInKnowledgeBase ?? true,
          suggestedQuestions: data.suggestedQuestions || [
            'What are the price details of FollowFlow AI?',
            'How does AI lead scoring work?',
            'Can I use WhatsApp?'
          ],
          debugInfo: data.debugInfo
        }
      ]);
    } catch (err) {
      console.error('[Follow Buddy Chat Error]:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: "I couldn't find that information in the FollowFlow AI knowledge base.",
          timestamp: new Date(),
          sources: [],
          foundInKnowledgeBase: false,
          suggestedQuestions: [
            'What is FollowFlow AI?',
            'What are the price details of FollowFlow AI?',
            'How does Follow-Up work?'
          ]
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        text: INITIAL_WELCOME,
        timestamp: new Date(),
        suggestedQuestions: [
          'What are the price details of FollowFlow AI?',
          'How does AI lead scoring (0-100) work?',
          'Can I use WhatsApp for follow-ups?'
        ]
      }
    ]);
  };

  const handleCopyPrompt = (promptText: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {!isOpen && !hasInteracted && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.2, duration: 0.4 }}
            className="mb-3 hidden sm:flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-purple-200/80 text-gray-800 text-xs font-medium cursor-pointer hover:border-purple-300 transition-all hover:scale-105"
            onClick={() => setIsOpen(true)}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-600"></span>
            </span>
            <span>Need help? Ask <strong className="text-purple-700 font-semibold">Follow Buddy</strong>!</span>
          </motion.div>
        )}

        <button
          id="follow-buddy-trigger-btn"
          onClick={() => setIsOpen(prev => !prev)}
          className={`group relative flex items-center gap-2.5 px-4 py-3.5 rounded-full font-semibold shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300 ${
            isOpen
              ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/30'
              : 'bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/35 hover:shadow-purple-600/50 hover:scale-105'
          }`}
          aria-label="Toggle Follow Buddy AI Assistant"
        >
          {!isOpen && (
            <>
              <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 opacity-40 blur-sm animate-pulse group-hover:opacity-75 transition duration-1000" />
              <span className="absolute top-0 right-0 flex h-3.5 w-3.5 -mt-0.5 -mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
              </span>
            </>
          )}

          <div className="relative flex items-center justify-center">
            {isOpen ? (
              <X className="h-5 w-5 text-white" />
            ) : (
              <Bot className="h-5 w-5 text-white" />
            )}
          </div>

          <span className="relative text-sm font-semibold tracking-wide text-white">
            {isOpen ? 'Close Chat' : 'Follow Buddy'}
          </span>
        </button>
      </div>

      {/* Floating Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="follow-buddy-chat-modal"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[440px] max-h-[640px] h-[85vh] bg-white rounded-2xl shadow-2xl border border-purple-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-800 p-4 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 border border-white/20 shadow-inner">
                  <Bot className="h-6 w-6 text-purple-200" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-400 rounded-full border-2 border-purple-800" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-white tracking-tight flex items-center gap-1.5">
                      <span>🤖 Follow Buddy</span>
                    </h3>
                    {isSuper && (
                      <span className="bg-amber-400 text-slate-900 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-amber-300">
                        Admin Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-purple-200 font-medium">
                    Central Knowledge Base Grounded
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetChat}
                  className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition"
                  title="Reset conversation"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition"
                  title="Close chat"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Knowledge Base Status Header */}
            <div className="bg-purple-50 border-b border-purple-100 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-purple-800">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="h-3 w-3 text-purple-600" />
                <span>Grounded RAG Pipeline (Gemini 3.7 Flash)</span>
              </span>
              <span className="text-emerald-700 font-semibold text-[10px] bg-emerald-100/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Active
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg) => {
                const chunks = msg.debugInfo?.matchedChunks || [];
                const isExpanded = expandedChunkMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-2xs ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs'
                          : msg.isOffTopic
                          ? 'bg-amber-50/90 text-amber-950 border border-amber-200/70 rounded-bl-xs'
                          : 'bg-white text-gray-800 border border-gray-200/70 rounded-bl-xs'
                      }`}
                    >
                      <div>{msg.text}</div>

                      {/* Top Retrieved Chunks & Sources Section */}
                      {msg.sender === 'bot' && (chunks.length > 0 || (msg.sources && msg.sources.length > 0)) && (
                        <div className="mt-2.5 pt-2 border-t border-purple-100/80 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandedChunkMsgId(isExpanded ? null : msg.id)}
                              className="text-[10px] font-bold text-purple-900 hover:text-purple-700 flex items-center gap-1 transition"
                            >
                              <BookOpen className="h-3 w-3 text-purple-600 shrink-0" />
                              <span>
                                Retrieved Chunks & Citations ({chunks.length || msg.sources?.length})
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3 text-purple-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-purple-500" />
                              )}
                            </button>

                            {/* Super Admin RAG Inspector Button */}
                            {isSuper && msg.debugInfo && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDebugMessage(msg);
                                  setShowAdminDebugModal(true);
                                }}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1 transition"
                              >
                                <ShieldCheck className="h-3 w-3 text-amber-600" />
                                <span>RAG Inspector</span>
                              </button>
                            )}
                          </div>

                          {/* Collapsed Citations Pills */}
                          {!isExpanded && (
                            <div className="flex flex-wrap items-center gap-1">
                              {(chunks.length > 0 ? chunks : (msg.sources || []).map(s => ({ fileName: s, relevancePercentage: 90 }))).map((item: any, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-medium"
                                >
                                  <span>📄 {item.fileName}</span>
                                  {item.relevancePercentage && (
                                    <span className="text-emerald-700 font-bold">({item.relevancePercentage}%)</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Expanded Chunk Details */}
                          {isExpanded && (
                            <div className="space-y-1.5 pt-1">
                              {chunks.map((chunk, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-mono space-y-1"
                                >
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-gray-900 truncate max-w-[200px]">
                                      📄 {chunk.fileName} (Chunk #{chunk.chunkIndex ? chunk.chunkIndex + 1 : cIdx + 1})
                                    </span>
                                    <span className="text-emerald-700 font-bold px-1 rounded bg-emerald-50 border border-emerald-200">
                                      {chunk.relevancePercentage}% Match ({chunk.score} pts)
                                    </span>
                                  </div>
                                  <p className="text-gray-700 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                    "{chunk.chunkText}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Suggested questions under bot response */}
                    {msg.sender === 'bot' && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-2.5 w-full flex flex-wrap gap-1.5">
                        {msg.suggestedQuestions.map((q, idx) => (
                          <button
                            key={`${msg.id}-sug-${idx}`}
                            onClick={() => handleSendMessage(q)}
                            className="text-left text-[11px] font-medium bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-900 border border-purple-200 hover:border-purple-300 rounded-xl px-2.5 py-1.5 transition shadow-2xs flex items-center gap-1.5 group"
                          >
                            <MessageSquare className="h-3 w-3 text-purple-500 group-hover:scale-110 transition-transform" />
                            <span>{q}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-center gap-2 text-gray-400 text-xs py-1">
                  <div className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-2 rounded-2xl shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]" />
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium">Follow Buddy is retrieving context...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-gray-100 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about FollowFlow AI, pricing details, workflows..."
                className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition flex items-center justify-center shrink-0"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUPER ADMIN LIVE RAG INSPECTOR MODAL */}
      <AnimatePresence>
        {showAdminDebugModal && selectedDebugMessage && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Live RAG Prompt & Chunk Inspector</span>
                      <span className="text-2xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                        Super Admin Only
                      </span>
                    </h3>
                    <p className="text-2xs text-slate-400">
                      Query grounded with {selectedDebugMessage.debugInfo?.matchedChunks?.length || 0} retrieved chunks
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAdminDebugModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
                {/* 1. Matched Chunks */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      <span>Retrieved Chunks & Relevance Scores</span>
                    </h4>
                    <span className="text-2xs text-gray-500">
                      Threshold: 1.0 score
                    </span>
                  </div>

                  {selectedDebugMessage.debugInfo?.matchedChunks && selectedDebugMessage.debugInfo.matchedChunks.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDebugMessage.debugInfo.matchedChunks.map((chunk, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-900">📄 {chunk.fileName}</span>
                            <span className="text-2xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Score: {chunk.score} pts ({chunk.relevancePercentage}%)
                            </span>
                          </div>
                          <div className="p-2.5 bg-gray-50 rounded-lg text-xs font-mono text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {chunk.chunkText}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                      <p className="font-bold">No chunks matched.</p>
                      <p className="text-2xs mt-0.5">
                        Reason: {selectedDebugMessage.debugInfo?.reasonIfEmpty || "Query did not hit matching terms above threshold."}
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Final Prompt Sent to Gemini */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Terminal className="h-4 w-4 text-indigo-600" />
                      <span>Final Grounded Prompt Sent to Gemini</span>
                    </h4>
                    {selectedDebugMessage.debugInfo?.finalPrompt && (
                      <button
                        onClick={() => handleCopyPrompt(selectedDebugMessage.debugInfo?.finalPrompt || '')}
                        className="text-2xs font-semibold px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg flex items-center gap-1 transition"
                      >
                        {copiedPrompt ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl text-slate-200 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-800">
                    {selectedDebugMessage.debugInfo?.finalPrompt || "No prompt recorded."}
                  </div>
                </div>

                {/* 3. Generated Answer */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Bot className="h-4 w-4 text-purple-600" />
                    <span>Gemini Grounded Answer</span>
                  </h4>
                  <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl text-xs text-gray-900 whitespace-pre-wrap">
                    {selectedDebugMessage.text}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowAdminDebugModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
