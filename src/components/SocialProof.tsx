import { motion } from 'motion/react';
import { Star, CheckCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function SocialProof() {
  const testimonials = [
    {
      name: "Priya S.",
      role: "Retail Store Owner",
      quote: "Before FollowFlow, I was losing track of DMs and WhatsApp messages. Now, the AI tells me exactly who to follow up with. Sales have increased by 30%.",
      initials: "PS",
      color: "from-blue-400 to-indigo-500"
    },
    {
      name: "Rahul M.",
      role: "Mobile Shop Owner",
      quote: "The lead scoring is magic. It instantly highlights customers asking about high-end phones and drafts the perfect reply for me. Incredible time saver.",
      initials: "RM",
      color: "from-purple-400 to-pink-500"
    },
    {
      name: "Ananya K.",
      role: "Salon Owner",
      quote: "We get a lot of pricing inquiries that go nowhere. FollowFlow reminds me to check in with them a few days later, and that gentle nudge works wonders.",
      initials: "AK",
      color: "from-emerald-400 to-teal-500"
    }
  ];

  const pricing = [
    {
      name: "Free",
      price: "₹0",
      desc: "Perfect for testing the waters.",
      features: ["20 Leads Monthly", "Basic AI Suggestions", "Email Support"]
    },
    {
      name: "Starter",
      price: "₹499",
      period: "/month",
      desc: "For small businesses ready to grow.",
      features: ["Lead Scoring", "Follow-Up Generation", "Unlimited Products", "Priority Support"],
      highlight: true
    },
    {
      name: "Pro",
      price: "₹1499",
      period: "/month",
      desc: "For high-volume sales teams.",
      features: ["Advanced AI", "Custom Brand Voice", "Analytics Dashboard", "Future WhatsApp Integration"]
    }
  ];

  const faqs = [
    {
      q: "How does FollowFlow AI work?",
      a: "FollowFlow analyzes your customer conversations, identifies the products they are interested in, scores their buying intent, and automatically drafts personalized follow-up messages for you."
    },
    {
      q: "Can it work for any business?",
      a: "Yes! You can upload your own products, services, and FAQs into your Business Profile, and the AI will tailor its analysis and responses specifically for your business type."
    },
    {
      q: "Do I need technical skills?",
      a: "Not at all. The dashboard is designed to be intuitive. If you can use email or WhatsApp, you can use FollowFlow AI."
    },
    {
      q: "Will WhatsApp integration be available?",
      a: "Yes, direct WhatsApp Business integration is currently in development and will be available exclusively on the Pro plan soon."
    }
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="py-24 bg-[#FAFBFF]">
      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Loved by Small Businesses</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">See how FollowFlow is changing the way businesses interact with customers.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((test, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm"
            >
              <div className="flex gap-1 mb-6">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 italic mb-8">"{test.quote}"</p>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${test.color} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                  {test.initials}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{test.name}</p>
                  <p className="text-xs text-gray-500">{test.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Choose the plan that fits your business needs.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
          {pricing.map((plan, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-3xl p-8 ${plan.highlight ? 'bg-indigo-900 text-white shadow-2xl md:scale-105 relative z-10' : 'bg-white text-gray-900 border border-gray-200'}`}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-400 to-cyan-400 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                  Most Popular
                </div>
              )}
              <h3 className={`text-xl font-bold mb-2 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
              <p className={`text-sm mb-6 ${plan.highlight ? 'text-indigo-200' : 'text-gray-500'}`}>{plan.desc}</p>
              <div className="mb-8 flex items-end gap-1">
                <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                {plan.period && <span className={`text-sm pb-1 ${plan.highlight ? 'text-indigo-200' : 'text-gray-500'}`}>{plan.period}</span>}
              </div>
              
              <ul className="space-y-4 mb-8">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className={`h-5 w-5 shrink-0 ${plan.highlight ? 'text-cyan-400' : 'text-indigo-500'}`} />
                    <span className={`text-sm ${plan.highlight ? 'text-indigo-50' : 'text-gray-700'}`}>{feat}</span>
                  </li>
                ))}
              </ul>
              
              <button className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${plan.highlight ? 'bg-cyan-500 hover:bg-cyan-400 text-gray-900 shadow-lg shadow-cyan-500/30' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'}`}>
                Get Started
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <button 
                className="w-full px-6 py-4 flex justify-between items-center text-left focus:outline-none"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span className="font-semibold text-gray-900">{faq.q}</span>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-4 pt-0">
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
