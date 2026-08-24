import { motion } from 'motion/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FollowBuddyChat from '../components/FollowBuddyChat';
import { Target, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">Our Story</h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              We started FollowFlow AI to solve a problem we faced every day: losing customers simply because we couldn't keep up with our inboxes.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12 mb-32">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Our Mission</h3>
              <p className="text-gray-600">To give every small business an AI sales assistant that never sleeps, ensuring no opportunity is ever missed.</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Our Vision</h3>
              <p className="text-gray-600">A world where founders can focus on creating great products, while AI seamlessly handles the customer pipeline.</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm"
            >
              <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center mb-6">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Why We Exist</h3>
              <p className="text-gray-600">Because managing DMs across WhatsApp, Instagram, and Email shouldn't require a full-time sales team.</p>
            </motion.div>
          </div>

          {/* Team Section (Demo Content) */}
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Meet the Team</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-12">The builders behind FollowFlow AI.</p>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { name: "Sarah Chen", role: "CEO & Co-founder", initials: "SC" },
                { name: "Marcus Johnson", role: "CTO", initials: "MJ" },
                { name: "Elena Rodriguez", role: "Head of Product", initials: "ER" }
              ].map((member, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-3xl font-bold text-indigo-700 mb-4 shadow-sm border border-white">
                    {member.initials}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{member.name}</h3>
                  <p className="text-indigo-600 font-medium">{member.role}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-3xl p-12 text-center mt-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 mix-blend-overlay"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to scale your sales?</h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">Join thousands of small businesses that are already using FollowFlow AI to double their close rates.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/contact" className="bg-white text-gray-900 hover:bg-gray-50 px-8 py-4 rounded-full text-lg font-medium transition-colors">
                  Contact Us
                </Link>
                <Link to="/signup" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-full text-lg font-medium transition-colors">
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FollowBuddyChat />
    </>
  );
}
