import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { setDoc, doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardLayout from '../components/DashboardLayout';
import { Building2, Save, MessageSquare, Check, Phone } from 'lucide-react';
import { handleFirestoreError } from '../lib/firestoreUtils';

export default function BusinessProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    businessName: '',
    category: '',
    products: '',
    services: '',
    whatsappNumber: '',
    contactInformation: ''
  });

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        console.log(`[BusinessProfile] Fetching profile for user: ${user.uid}`);
        let snap = await getDoc(doc(db, 'business_profile', user.uid));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'businessProfiles', user.uid));
        }

        if (isMounted && snap.exists()) {
          const data = snap.data();
          console.log(`[BusinessProfile] Profile loaded successfully from Firestore.`);
          setFormData({
            businessName: data.businessName || '',
            category: data.category || '',
            products: data.products || '',
            services: data.services || '',
            whatsappNumber: data.whatsappNumber || '',
            contactInformation: data.contactInformation || ''
          });
        }
      } catch (error) {
        const errorDetail = handleFirestoreError(error, 'BusinessProfile fetch');
        console.error('[BusinessProfile] Fetch error:', error);
        if (isMounted) {
          setMessage({ type: 'error', text: errorDetail });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    
    try {
      console.log(`[BusinessProfile] Saving profile for user: ${user.uid}`);
      const payload = {
        ...formData,
        userId: user.uid,
        updatedAt: serverTimestamp()
      };

      // Save to business_profile and businessProfiles
      await setDoc(doc(db, 'business_profile', user.uid), payload, { merge: true });
      await setDoc(doc(db, 'businessProfiles', user.uid), payload, { merge: true });

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        type: 'profile_updated',
        title: `Business profile updated: ${formData.businessName || 'Company details'}`,
        createdAt: serverTimestamp()
      }).catch(() => {});

      console.log(`[BusinessProfile] Saved successfully.`);
      setMessage({ type: 'success', text: 'Business profile saved successfully to Firestore!' });
    } catch (error) {
      const errorDetail = handleFirestoreError(error, 'BusinessProfile save');
      console.error('[BusinessProfile] Save error:', error);
      setMessage({ type: 'error', text: errorDetail });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <DashboardLayout title="Business Profile">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <p className="text-gray-600">
            Define your company identity, offerings, and WhatsApp contact details. The AI Assistant and Follow-Up generators will use this profile to craft contextual customer outreach.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6">
              
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100">
                  <Building2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Company Information</h3>
                  <p className="text-sm text-gray-500">Provide core identity and industry classification.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                  <input 
                    required
                    type="text" 
                    value={formData.businessName}
                    onChange={e => setFormData({...formData, businessName: e.target.value})}
                    placeholder="e.g. LeadPilot AI Solutions"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow text-gray-900" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Category / Industry</label>
                  <input 
                    type="text" 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    placeholder="e.g. B2B SaaS, Retail Electronics"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow text-gray-900" 
                  />
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Offerings & WhatsApp Channel</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Products (comma separated)</label>
                  <input 
                    type="text" 
                    value={formData.products}
                    onChange={e => setFormData({...formData, products: e.target.value})}
                    placeholder="e.g. Lead Pilot Pro, Smart CRM Extension, Follow-Up Engine"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow text-gray-900" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Services Offered</label>
                  <input 
                    type="text" 
                    value={formData.services}
                    onChange={e => setFormData({...formData, services: e.target.value})}
                    placeholder="e.g. Custom AI Setup, 24/7 Priority Support, Onboarding Strategy"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow text-gray-900" 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-emerald-600" />
                      <span>WhatsApp Business Number</span>
                    </label>
                    <input 
                      type="text" 
                      value={formData.whatsappNumber}
                      onChange={e => setFormData({...formData, whatsappNumber: e.target.value})}
                      placeholder="e.g. +14155552671 or 14155552671"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none transition-shadow text-gray-900" 
                    />
                    <p className="text-xs text-gray-500 mt-1">Used for 1-click wa.me customer links.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>General Contact Information</span>
                    </label>
                    <input 
                      type="text" 
                      value={formData.contactInformation}
                      onChange={e => setFormData({...formData, contactInformation: e.target.value})}
                      placeholder="e.g. support@leadpilot.ai | Mon-Fri 9-5"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-shadow text-gray-900" 
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm font-medium">
                {message && (
                  <div className={`flex items-center gap-1.5 ${message.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {message.type === 'success' ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                    <span>{message.text}</span>
                  </div>
                )}
              </div>
              <button 
                type="submit" 
                disabled={saving}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm disabled:opacity-70"
              >
                {saving ? (
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Profile
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
