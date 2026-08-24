import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Sparkles, MessageSquare, ChevronDown, RefreshCw, ArrowRight, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getLocalFollowBuddyAnswer, 
  SUGGESTED_QUESTIONS, 
  UNRELATED_REFUSAL 
} from '../lib/followBuddyKnowledge';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
  suggestedQuestions?: string[];
  isOffTopic?: boolean;
  sources?: string[];
  foundInKnowledgeBase?: boolean;
}

const INITIAL_WELCOME = `👋 Hi! I'm Follow Buddy.

I can help you understand how FollowFlow AI works, how customer follow-ups are automated, and how your business can increase sales.

Ask me anything!`;

export default function FollowBuddyChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      sender: 'bot',
      text: INITIAL_WELCOME,
      timestamp: new Date(),
      suggestedQuestions: SUGGESTED_QUESTIONS
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat when messages change
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
    const query = (textToSend || input).trim();
    if (!query || isTyping) return;

    setHasInteracted(true);
    const userMsgId = `user-${Date.now()}`;
    const newMessages: Message[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: query,
        timestamp: new Date()
      }
    ];

    setMessages(newMessages);
    if (!textToSend) setInput('');
    setIsTyping(true);

    // Search the knowledge_base collection and query RAG-powered Follow Buddy
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
          message: query,
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
          suggestedQuestions: data.suggestedQuestions || SUGGESTED_QUESTIONS.slice(0, 3)
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
          suggestedQuestions: SUGGESTED_QUESTIONS.slice(0, 3)
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
        suggestedQuestions: SUGGESTED_QUESTIONS
      }
    ]);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Pulsing notification bubble when not open and not interacted yet */}
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
          {/* Gentle Pulse Glow Animation when closed on Home Page */}
          {!isOpen && (
            <>
              <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 opacity-40 blur-sm animate-pulse group-hover:opacity-75 transition duration-1000" />
              {/* Soft Blinking Indicator Dot */}
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
              <div className="relative flex items-center justify-center">
                <Bot className="h-5 w-5 text-white animate-bounce-short" />
              </div>
            )}
          </div>

          <span className="relative text-sm font-semibold tracking-wide text-white">
            {isOpen ? 'Close Chat' : 'Follow Buddy'}
          </span>
        </button>
      </div>

      {/* Floating Chat Modal / Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="follow-buddy-chat-modal"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[410px] max-h-[620px] h-[82vh] bg-white rounded-2xl shadow-2xl border border-purple-100 flex flex-col overflow-hidden"
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
                    <span className="bg-purple-500/40 text-purple-100 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-purple-300/30">
                      AI Assistant
                    </span>
                  </div>
                  <p className="text-xs text-purple-200 font-medium">
                    Your AI Sales Assistant
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

            {/* Knowledge Base Badge */}
            <div className="bg-purple-50 border-b border-purple-100 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-purple-800">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="h-3 w-3 text-purple-600" />
                <span>FollowFlow AI Official Knowledge Base</span>
              </span>
              <span className="text-purple-600 font-semibold text-[10px] bg-purple-200/60 px-1.5 py-0.5 rounded">
                Instant Answers
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs'
                        : msg.isOffTopic
                        ? 'bg-amber-50/90 text-amber-950 border border-amber-200/70 rounded-bl-xs'
                        : 'bg-white text-gray-800 border border-gray-200/70 rounded-bl-xs'
                    }`}
                  >
                    <div>{msg.text}</div>

                    {/* Source Document Citations */}
                    {msg.sender === 'bot' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-purple-100/80 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-purple-900 flex items-center gap-1">
                          <BookOpen className="h-3 w-3 text-purple-600 shrink-0" />
                          Source:
                        </span>
                        {msg.sources.map((src, idx) => (
                          <span
                            key={`${msg.id}-src-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-medium transition-colors"
                            title={src}
                          >
                            <span className="truncate max-w-[180px]">{src}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-gray-400 mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Suggested questions rendered underneath bot response if available */}
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
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex items-center gap-2 text-gray-400 text-xs py-1">
                  <div className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-2 rounded-2xl shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]" />
                    <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium">Follow Buddy is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggested Questions Bar (if messages length is small) */}
            {messages.length <= 2 && (
              <div className="px-3.5 py-2 bg-purple-50/70 border-t border-purple-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider shrink-0">
                  Quick Topics:
                </span>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={`quick-${i}`}
                    onClick={() => handleSendMessage(q)}
                    className="shrink-0 text-[11px] bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-1 rounded-lg font-medium transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

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
                placeholder="Ask about FollowFlow AI, follow-ups, WhatsApp..."
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
    </>
  );
}
