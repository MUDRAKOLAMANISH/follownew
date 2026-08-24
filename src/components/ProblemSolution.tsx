import { motion } from 'motion/react';
import { Clock, UserX, MessageSquareOff, TrendingDown, Target, Brain, ArrowRightCircle, BarChart3 } from 'lucide-react';

export default function ProblemSolution() {
  const problems = [
    {
      icon: <Clock className="h-6 w-6 text-red-500" />,
      title: "Slow Responses",
      desc: "Customer asks a question and receives a reply hours later."
    },
    {
      icon: <UserX className="h-6 w-6 text-orange-500" />,
      title: "Forgotten Follow-Ups",
      desc: "Interested customers are never contacted again."
    },
    {
      icon: <MessageSquareOff className="h-6 w-6 text-yellow-500" />,
      title: "Too Many Conversations",
      desc: "Business owners struggle to track everyone."
    },
    {
      icon: <TrendingDown className="h-6 w-6 text-gray-500" />,
      title: "Missed Opportunities",
      desc: "Potential sales disappear without action."
    }
  ];

  const steps = [
    { title: "Customer Inquiry", icon: <MessageSquareOff className="h-5 w-5" /> },
    { title: "AI Understands Intent", icon: <Brain className="h-5 w-5" /> },
    { title: "Lead Score Generated", icon: <Target className="h-5 w-5" /> },
    { title: "Follow-Up Recommendation", icon: <ArrowRightCircle className="h-5 w-5" /> },
    { title: "More Sales", icon: <BarChart3 className="h-5 w-5" /> }
  ];

  return (
    <div className="py-24 bg-white relative">
      {/* Problem Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Businesses Lose Customers Every Day</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Without a system in place, managing multiple inquiries across platforms leads to dropped balls and lost revenue.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((prob, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm mb-4 border border-gray-100">
                {prob.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{prob.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{prob.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Solution Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-indigo-900 rounded-3xl overflow-hidden relative">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          
          <div className="px-6 py-16 md:py-24 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Meet Your AI Sales Assistant</h2>
            <p className="text-indigo-200 max-w-2xl mx-auto mb-16 text-lg">FollowFlow transforms chaotic inboxes into a streamlined sales pipeline, automatically identifying who is ready to buy.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {steps.map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.3 }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-center flex flex-col items-center gap-4 relative z-10 transition-all hover:bg-white/15"
                >
                  <div className={`p-4 rounded-xl ${idx === steps.length - 1 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'}`}>
                    {step.icon}
                  </div>
                  <span className="text-sm font-semibold text-white tracking-wide">{step.title}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
