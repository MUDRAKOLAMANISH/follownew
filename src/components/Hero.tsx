import { motion } from 'motion/react';
import { ArrowRight, Sparkles, MessageCircle, Zap, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Hero() {
  const { user } = useAuth();
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] max-w-7xl">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse duration-1000"></div>
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-violet-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse duration-2000 delay-700"></div>
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-cyan-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse duration-3000 delay-1000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium mb-6"
          >
            <Sparkles className="h-4 w-4" />
            <span>Never Miss a Sales Opportunity.</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 mb-8"
          >
            Turn Customer Inquiries <br className="hidden md:block" />
            Into <span className="text-gradient">Sales</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            FollowFlow AI helps businesses understand customer intent, prioritize leads, and generate smart follow-ups so no opportunity gets forgotten.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            {user ? (
              <Link 
                to="/dashboard"
                id="hero-go-to-dashboard-btn"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-full font-semibold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <LayoutDashboard className="h-5 w-5" />
                Open Dashboard
                <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <button 
                onClick={() => window.dispatchEvent(new Event('open-try-demo'))}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-full font-medium transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                Try Demo
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
            <a 
              href="#demo"
              className="w-full sm:w-auto bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 px-8 py-3.5 rounded-full font-medium transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              See How It Works
            </a>
          </motion.div>
        </div>

        {/* Hero Visual */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-20 max-w-4xl mx-auto relative"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAFBFF] via-transparent to-transparent z-20 h-full pointer-events-none rounded-2xl"></div>
          
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-2xl overflow-hidden glass-card relative z-10">
            <div className="h-12 bg-gray-50/80 border-b border-gray-100 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="mx-auto bg-white border border-gray-200 rounded-md px-4 py-1 text-xs text-gray-500 font-medium flex items-center gap-2 shadow-sm">
                <Zap className="h-3 w-3 text-indigo-500" /> followflow.ai/dashboard
              </div>
            </div>
            
            <div className="p-6 md:p-10 grid md:grid-cols-2 gap-8">
              {/* Conversation */}
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0 flex items-center justify-center text-white font-semibold">C</div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Customer • 10:42 AM</p>
                    <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm">
                      "Hi, do you have iPhone 16 available?"
                    </div>
                  </div>
                </div>
                
                <div className="relative pl-14">
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-indigo-100"></div>
                  <div className="bg-indigo-50/80 backdrop-blur-sm border border-indigo-100 rounded-2xl px-4 py-4 relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">AI Analysis</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-2 border border-indigo-50 shadow-sm">
                        <p className="text-[10px] text-gray-500 font-medium uppercase">Product Interest</p>
                        <p className="text-sm font-semibold text-gray-900">iPhone 16</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-indigo-50 shadow-sm">
                        <p className="text-[10px] text-gray-500 font-medium uppercase">Lead Score</p>
                        <div className="flex items-end gap-1">
                          <p className="text-sm font-semibold text-emerald-600">92/100</p>
                          <p className="text-[10px] text-gray-400 mb-0.5">High Intent</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-indigo-50 shadow-sm flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-indigo-500" />
                      <span className="text-xs font-semibold text-gray-700 uppercase">Suggested Action:</span>
                      <span className="text-sm font-semibold text-indigo-600">Follow Up Today</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Generated Response */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm h-fit">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-50 pb-4">
                  <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Generated by AI</h3>
                    <p className="text-xs text-gray-500">Demo Preview</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl italic">
                  "Hi Ravi! Just checking if you're still interested in the iPhone 16. We currently have stock available and would be happy to assist you."
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
