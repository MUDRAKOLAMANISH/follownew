import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FollowBuddyChat from '../components/FollowBuddyChat';
import { Mail, MapPin, Clock, Phone, CheckCircle, Loader2, AlertCircle, Send } from 'lucide-react';

const N8N_WEBHOOK_URL = 'https://manish0150.app.n8n.cloud/webhook/followflow-contact';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    businessName: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Please enter your name.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Please enter your phone number.');
      return false;
    }
    if (!formData.message.trim()) {
      setError('Please enter your message.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      businessName: formData.businessName.trim(),
      message: formData.message.trim()
    };

    console.log('[Contact Form] Submitting inquiry to n8n webhook:', N8N_WEBHOOK_URL);
    console.log('[Contact Form] Payload:', payload);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second network timeout

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('[Contact Form] Webhook HTTP response status:', response.status, response.statusText);

      let responseBody: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      console.log('[Contact Form] Webhook response body:', responseBody);

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status} ${response.statusText}`);
      }

      // Success
      setIsSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        businessName: '',
        message: ''
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[Contact Form] Webhook submission error:', err);

      if (err.name === 'AbortError') {
        setError('Submission failed. Request timed out, please try again.');
      } else {
        setError('Submission failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    { q: "How fast do you respond?", a: "We aim to respond to all inquiries within 24 hours during business days." },
    { q: "Do you offer custom pricing?", a: "Yes, for enterprise teams we offer custom pricing and SLAs. Contact us for details." },
    { q: "Can I get technical support here?", a: "For existing customers, please use the support widget inside your dashboard for faster routing." }
  ];

  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight"
            >
              Get in Touch
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-gray-600 leading-relaxed"
            >
              Have questions about FollowFlow AI? We're here to help. Send us a message and our team will get back to you promptly.
            </motion.p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 mb-24">
            {/* Contact Form */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Send a Message</h2>
                  <p className="text-sm text-gray-500 mt-1">Our team will get back to you as soon as possible.</p>
                </div>
              </div>

              {isSuccess ? (
                <div className="bg-green-50 text-green-800 p-8 rounded-2xl text-center border border-green-100 animate-fade-in">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-green-900">Inquiry Received!</h3>
                  <p className="text-green-800 font-medium max-w-md mx-auto mb-6 text-sm sm:text-base leading-relaxed">
                    Thank you for contacting FollowFlow AI. We have received your inquiry.
                  </p>
                  <button 
                    onClick={() => setIsSuccess(false)} 
                    className="inline-flex items-center justify-center px-6 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors shadow-xs"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3.5 rounded-xl border border-red-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>{error}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isSubmitting}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none text-sm transition-all disabled:bg-gray-50"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        disabled={isSubmitting}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none text-sm transition-all disabled:bg-gray-50"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        disabled={isSubmitting}
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none text-sm transition-all disabled:bg-gray-50"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                        Business Name
                      </label>
                      <input
                        type="text"
                        disabled={isSubmitting}
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none text-sm transition-all disabled:bg-gray-50"
                        placeholder="Boutique / Store Name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      disabled={isSubmitting}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none text-sm transition-all resize-none disabled:bg-gray-50"
                      placeholder="How can we help your business grow?"
                    ></textarea>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md shadow-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Send Message</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>

            {/* Office Info */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-12"
            >
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 mt-1">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Email Us</h4>
                      <p className="text-gray-600 mt-1">support@followflow.ai</p>
                      <p className="text-gray-600">sales@followflow.ai</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 mt-1">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Call Us</h4>
                      <p className="text-gray-600 mt-1">+1 (555) 123-4567</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 mt-1">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Office</h4>
                      <p className="text-gray-600 mt-1">100 Innovation Drive<br/>San Francisco, CA 94103</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 mt-1">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Business Hours</h4>
                      <p className="text-gray-600 mt-1">Monday - Friday: 9am to 6pm PST<br/>Weekend: Closed</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">FAQ</h2>
                <div className="space-y-6">
                  {faqs.map((faq, idx) => (
                    <div key={idx}>
                      <h4 className="font-bold text-gray-900">{faq.q}</h4>
                      <p className="text-gray-600 mt-1">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
      <FollowBuddyChat />
    </>
  );
}
