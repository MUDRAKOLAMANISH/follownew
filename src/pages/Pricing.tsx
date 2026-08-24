import { motion } from 'motion/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FollowBuddyChat from '../components/FollowBuddyChat';
import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "₹0",
      description: "Perfect for testing the waters and small personal projects.",
      features: [
        "20 Leads Monthly",
        "Basic AI analysis",
        "Standard support",
        "1 Team Member",
        "7-day history"
      ],
      limitations: [
        "No custom prompts",
        "No API access",
        "No white-labeling"
      ],
      cta: "Get Started Free",
      href: "/signup",
      popular: false
    },
    {
      name: "Starter",
      price: "₹499",
      period: "/month",
      description: "For small businesses starting to scale their sales.",
      features: [
        "200 Leads Monthly",
        "Advanced AI intent scoring",
        "Priority email support",
        "3 Team Members",
        "30-day history",
        "Basic integrations"
      ],
      limitations: [
        "No API access",
        "No white-labeling"
      ],
      cta: "Start Starter Plan",
      href: "/signup",
      popular: false
    },
    {
      name: "Pro",
      price: "₹1499",
      period: "/month",
      description: "For growing businesses that need complete pipeline automation.",
      features: [
        "Unlimited Leads",
        "Custom AI prompts",
        "24/7 Priority support",
        "Unlimited Team Members",
        "Unlimited history",
        "Advanced integrations",
        "API access",
        "Remove FollowFlow branding"
      ],
      limitations: [],
      cta: "Start Pro Plan",
      href: "/signup",
      popular: true
    }
  ];

  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight"
            >
              Simple, transparent pricing
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-gray-600 leading-relaxed"
            >
              No hidden fees. No surprise charges. Choose the plan that best fits your business needs.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + (i * 0.1) }}
                className={`relative bg-white rounded-3xl p-8 border ${plan.popular ? 'border-indigo-600 shadow-xl shadow-indigo-100 scale-105 z-10' : 'border-gray-200 shadow-sm'} flex flex-col`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-500 mb-6 min-h-[48px]">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="text-gray-500 font-medium">{plan.period}</span>}
                </div>
                
                <Link 
                  to={plan.href}
                  className={`w-full py-3 px-4 rounded-xl font-medium text-center transition-all mb-8 ${plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                >
                  {plan.cta}
                </Link>

                <div className="space-y-4 flex-1">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-indigo-600 shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                  {plan.limitations.map((limitation, idx) => (
                    <div key={idx} className="flex items-start gap-3 opacity-50">
                      <X className="h-5 w-5 text-gray-400 shrink-0" />
                      <span className="text-gray-500">{limitation}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <FollowBuddyChat />
    </>
  );
}
