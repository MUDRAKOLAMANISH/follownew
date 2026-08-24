import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      const profileData = {
        userId: user.uid,
        businessName: businessName.trim(),
        category,
        whatsappNumber: phone.trim(),
        contactInformation: location.trim(),
        products: '',
        services: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Save to both business_profile and businessProfiles documents for the user
      await setDoc(doc(db, 'business_profile', user.uid), profileData, { merge: true });
      await setDoc(doc(db, 'businessProfiles', user.uid), profileData, { merge: true });
    } catch (err) {
      console.warn('[Onboarding] Error saving profile:', err);
    } finally {
      setIsSubmitting(false);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFF] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2 mb-6">
          <Rocket className="text-indigo-600 h-8 w-8" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 mb-2">
          Let's set up your business
        </h2>
        <p className="text-center text-gray-600 mb-8">Tell us a bit about your company to get started.</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Business Name</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="e.g. Acme Corp"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Business Category</label>
              <div className="mt-1">
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                >
                  <option value="" disabled>Select a category</option>
                  <option value="retail">Retail Store</option>
                  <option value="electronics">Electronics Shop</option>
                  <option value="salon">Salon / Spa</option>
                  <option value="restaurant">Restaurant / Cafe</option>
                  <option value="medical">Medical Store</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <div className="mt-1">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="City, Country"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Continue to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
