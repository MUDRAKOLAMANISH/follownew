import { useEffect, useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, MessageCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const openTryDemoModal = () => window.dispatchEvent(new Event('open-try-demo'));
export const openRequestDemoModal = () => window.dispatchEvent(new Event('open-request-demo'));

export default function DemoModals() {
  const [isTryDemoOpen, setIsTryDemoOpen] = useState(false);
  const [isRequestDemoOpen, setIsRequestDemoOpen] = useState(false);

  // Request Demo Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessName: '',
    phoneNumber: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleTryDemo = () => setIsTryDemoOpen(true);
    const handleRequestDemo = () => setIsRequestDemoOpen(true);

    window.addEventListener('open-try-demo', handleTryDemo);
    window.addEventListener('open-request-demo', handleRequestDemo);

    return () => {
      window.removeEventListener('open-try-demo', handleTryDemo);
      window.removeEventListener('open-request-demo', handleRequestDemo);
    };
  }, []);

  const handleRequestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'demo_requests'), {
        ...formData,
        createdAt: serverTimestamp()
      });
      setIsSuccess(true);
      setFormData({ name: '', email: '', businessName: '', phoneNumber: '', message: '' });
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Try Demo Modal */}
      <AnimatePresence>
        {isTryDemoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-900">Try FollowFlow AI Demo</h2>
                <button onClick={() => setIsTryDemoOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0 flex items-center justify-center text-white font-semibold">C</div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Customer</p>
                      <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm">
                        "Do you have Samsung S25?"
                      </div>
                    </div>
                  </div>

                  <div className="relative pl-14">
                    <div className="absolute left-6 top-0 bottom-0 w-px bg-indigo-100"></div>
                    <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl px-4 py-4 relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">AI Analysis</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-white rounded-lg p-2 border border-indigo-50 shadow-sm">
                          <p className="text-[10px] text-gray-500 font-medium uppercase">Intent</p>
                          <p className="text-sm font-semibold text-gray-900">High</p>
                        </div>
                        <div className="bg-white rounded-lg p-2 border border-indigo-50 shadow-sm">
                          <p className="text-[10px] text-gray-500 font-medium uppercase">Lead Score</p>
                          <p className="text-sm font-semibold text-emerald-600">95/100</p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Generated Follow-Up:</p>
                        <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-indigo-50 italic">
                          "Hi there! Yes, we have the Samsung S25 in stock. Let me know if you'd like more details on pricing and availability."
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsTryDemoOpen(false)}
                  className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all"
                >
                  Close Demo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Demo Modal */}
      <AnimatePresence>
        {isRequestDemoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
                <h2 className="text-xl font-bold text-gray-900">Request a Demo</h2>
                <button onClick={() => {setIsRequestDemoOpen(false); setIsSuccess(false);}} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                {isSuccess ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Request Received!</h3>
                    <p className="text-gray-600">Our team will be in touch shortly to schedule your personalized demo.</p>
                    <button onClick={() => setIsRequestDemoOpen(false)} className="mt-8 bg-indigo-600 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-700">Done</button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestSubmit} className="space-y-4">
                    {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-md">{error}</div>}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                      <input required type="text" value={formData.businessName} onChange={(e) => setFormData({...formData, businessName: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input required type="tel" value={formData.phoneNumber} onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                      <textarea rows={3} value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 outline-none resize-none"></textarea>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all shadow-md shadow-indigo-200 mt-4 disabled:opacity-70">
                      {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
