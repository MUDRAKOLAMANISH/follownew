import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Users, MessageCircle, Settings, Target, Zap, Briefcase, Bot, ChartBar, Sparkles } from 'lucide-react';

export default function DemoFeatures() {
  const [demoResponse, setDemoResponse] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const simulateGeneration = (type: 'reply' | 'followup') => {
    setIsGenerating(true);
    setDemoResponse(null);
    
    setTimeout(() => {
      setIsGenerating(false);
      setDemoResponse(
        type === 'reply' 
          ? "Hi Ravi, yes we have the iPhone 16 in stock. The pricing starts at $799. Would you like me to hold one for you?"
          : "Hi Ravi! Just checking if you're still interested in the iPhone 16. We currently have stock available and would be happy to assist you."
      );
    }, 1500);
  };

  const features = [
    { icon: <Target className="h-6 w-6 text-indigo-500" />, title: "AI Lead Scoring", desc: "Automatically identifies high-intent customers based on conversational cues." },
    { icon: <Zap className="h-6 w-6 text-amber-500" />, title: "AI Follow-Up Generator", desc: "Creates personalized follow-up messages tailored to each customer." },
    { icon: <Bot className="h-6 w-6 text-violet-500" />, title: "Smart Reply Assistant", desc: "Generates professional responses instantly to answer common queries." },
    { icon: <Users className="h-6 w-6 text-blue-500" />, title: "Lead Tracking", desc: "Track customer interest, status, and last contact date effortlessly." },
    { icon: <Briefcase className="h-6 w-6 text-cyan-500" />, title: "Business Knowledge Base", desc: "Uses your uploaded products and services to answer accurately." },
    { icon: <ChartBar className="h-6 w-6 text-emerald-500" />, title: "Sales Insights", desc: "Highlights opportunities and trends based on customer behavior." }
  ];

  return (
    <div className="py-24 bg-[#FAFBFF]" id="demo">
      {/* Product Demo Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">See FollowFlow AI in Action</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">An intuitive dashboard that puts your hottest leads front and center.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col md:flex-row max-w-5xl mx-auto"
        >
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-2 relative pointer-events-none select-none">
            <div className="absolute top-4 right-4 bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Demo Preview</div>
            <div className="flex items-center gap-2 mb-6 px-2 pt-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">F</div>
              <span className="font-bold text-gray-900">FollowFlow</span>
            </div>
            
            <nav className="space-y-1 opacity-70">
              <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-600">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700">
                <Users className="h-4 w-4" /> Leads
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-600">
                <MessageCircle className="h-4 w-4" /> Follow-Ups
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-600">
                <Bot className="h-4 w-4" /> AI Assistant
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-gray-600">
                <Settings className="h-4 w-4" /> Business Profile
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 md:p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-gray-900">Lead Profile</h3>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  Online
                </span>
              </div>
            </div>

            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-6 mb-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 flex items-center justify-center text-xl font-bold text-indigo-700">R</div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Ravi</h4>
                      <p className="text-sm text-gray-500">Interested in iPhone 16</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-500">Status</span>
                      <span className="text-sm font-medium text-gray-900">Interested</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-500">Priority</span>
                      <span className="text-sm font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">High</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-500">Last Contact</span>
                      <span className="text-sm font-medium text-gray-900">3 Days Ago</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Bot className="h-4 w-4 text-indigo-500" /> AI Insights
                    </h5>
                    <div className="mb-6 text-center">
                      <div className="text-4xl font-black text-indigo-600 mb-1">92<span className="text-lg text-gray-400">/100</span></div>
                      <p className="text-xs text-gray-500 font-medium">Lead Score</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-indigo-100 mb-4 shadow-sm">
                      <p className="text-xs text-gray-500 mb-1">Recommended Action:</p>
                      <p className="text-sm font-semibold text-indigo-900">Follow-Up Today</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 relative z-10">
                    <button 
                      onClick={() => simulateGeneration('reply')}
                      disabled={isGenerating}
                      className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Generate Reply
                    </button>
                    <button 
                      onClick={() => simulateGeneration('followup')}
                      disabled={isGenerating}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors shadow-sm shadow-indigo-200 disabled:opacity-50"
                    >
                      Generate Follow-Up
                    </button>
                  </div>
                </div>
              </div>
              
              <AnimatePresence>
                {(isGenerating || demoResponse) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-indigo-500" />
                        <h4 className="text-sm font-bold text-gray-900">AI Generated Draft</h4>
                      </div>
                      
                      {isGenerating ? (
                        <div className="flex items-center gap-2 text-indigo-600 text-sm py-4">
                          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 bg-indigo-600 rounded-full" />
                          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-2 h-2 bg-indigo-600 rounded-full" />
                          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-2 h-2 bg-indigo-600 rounded-full" />
                          <span className="ml-2 font-medium">Generating response...</span>
                        </div>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm text-gray-700 bg-white p-4 rounded-lg border border-indigo-50 italic"
                        >
                          "{demoResponse}"
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything You Need to Close Deals</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Powerful AI features designed specifically for small businesses and sales teams.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                {feature.icon}
              </div>
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-6 border border-gray-100">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
