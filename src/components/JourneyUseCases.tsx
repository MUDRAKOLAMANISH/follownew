import { motion } from 'motion/react';
import { Package, MessageSquare, Brain, Target, Send, CheckCircle2, ShoppingBag, Laptop, Scissors, Shirt, Utensils, Stethoscope } from 'lucide-react';

export default function JourneyUseCases() {
  const steps = [
    { icon: <Package className="h-5 w-5" />, title: "Business adds products & services." },
    { icon: <MessageSquare className="h-5 w-5" />, title: "Customers ask questions." },
    { icon: <Brain className="h-5 w-5" />, title: "AI analyzes conversations." },
    { icon: <Target className="h-5 w-5" />, title: "AI identifies hot leads." },
    { icon: <Send className="h-5 w-5" />, title: "AI recommends follow-ups." },
    { icon: <CheckCircle2 className="h-5 w-5" />, title: "Business closes more sales." }
  ];

  const useCases = [
    { icon: <ShoppingBag className="h-6 w-6 text-pink-500" />, title: "Retail Stores", desc: "Keep track of inventory inquiries and notify customers when restocked." },
    { icon: <Laptop className="h-6 w-6 text-blue-500" />, title: "Electronics Shops", desc: "Follow up on high-ticket items like laptops and phones automatically." },
    { icon: <Scissors className="h-6 w-6 text-purple-500" />, title: "Salons", desc: "Re-engage clients who asked about services but haven't booked yet." },
    { icon: <Shirt className="h-6 w-6 text-amber-500" />, title: "Boutiques", desc: "Send personalized styling suggestions based on previous inquiries." },
    { icon: <Utensils className="h-6 w-6 text-orange-500" />, title: "Restaurants", desc: "Follow up on large catering or event booking inquiries." },
    { icon: <Stethoscope className="h-6 w-6 text-teal-500" />, title: "Medical Stores", desc: "Remind customers about recurring prescriptions and supplement refills." }
  ];

  return (
    <div className="py-24 bg-white">
      {/* Customer Journey */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How FollowFlow Works</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">A seamless process from the first hello to the final sale.</p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Vertical line for mobile */}
          <div className="absolute left-8 md:hidden top-0 bottom-0 w-px bg-indigo-100"></div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative flex md:block items-center gap-6"
              >
                <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm md:mb-6 shrink-0 mx-auto md:mx-0">
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {idx + 1}
                  </div>
                  {step.icon}
                </div>
                
                {/* Horizontal line connecting on desktop */}
                {idx % 3 !== 2 && idx !== steps.length -1 && (
                  <div className="hidden lg:block absolute top-8 left-20 right-0 w-[calc(100%-4rem)] h-px bg-indigo-100 -z-10"></div>
                )}
                {idx % 2 === 0 && idx !== steps.length -1 && (
                  <div className="hidden md:block lg:hidden absolute top-8 left-20 right-0 w-[calc(100%-4rem)] h-px bg-indigo-100 -z-10"></div>
                )}

                <div>
                  <p className="font-semibold text-gray-900 md:text-lg">{step.title}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Built for Every Business</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">No matter what you sell, FollowFlow adapts to your specific customer conversations.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:bg-white hover:shadow-xl hover:border-indigo-100 transition-all cursor-default group"
            >
              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {useCase.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{useCase.title}</h3>
              <p className="text-sm text-gray-600">{useCase.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
