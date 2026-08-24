import { useState, useEffect, FormEvent } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Bot, Sparkles, Copy, Check, AlertCircle, Plus, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BusinessProfileData } from '../types';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError } from '../lib/firestoreUtils';

export default function AIAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customerMessage, setCustomerMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileData | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'business_profile', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          setBusinessProfile(snap.data() as BusinessProfileData);
        }
      })
      .catch((err) => handleFirestoreError(err, 'AIAssistant profile fetch'));
  }, [user]);

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerMessage.trim()) return;
    
    setIsAnalyzing(true);
    setError('');
    setResult(null);
    setCopied(false);
    
    try {
      const response = await fetch('/api/analyze-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: customerMessage,
          businessProfile: businessProfile ? {
            businessName: businessProfile.businessName,
            category: businessProfile.category,
            products: businessProfile.products,
            services: businessProfile.services,
            whatsappNumber: businessProfile.whatsappNumber,
            contactInformation: businessProfile.contactInformation
          } : undefined
        })
      });
      
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        console.error('[AI Assistant Client] API returned error:', data?.error || response.statusText);
        throw new Error(data?.error || 'AI service temporarily unavailable. Please try again.');
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error('AI service temporarily unavailable. Please try again.');
      }

      setResult(data);
    } catch (err: any) {
      console.error('[AI Assistant Client] Error analyzing message:', err);
      setError('AI service temporarily unavailable. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyReply = () => {
    if (!result?.suggestedReply) return;
    navigator.clipboard.writeText(result.suggestedReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateLeadFromAnalysis = async () => {
    if (!user || !result) return;
    setCreatingLead(true);
    try {
      const priority = result.priority || (result.leadScore >= 75 ? 'High' : 'Normal');
      const isHigh = priority.toLowerCase() === 'high' || result.leadScore >= 75;

      const leadDoc = await addDoc(collection(db, 'leads'), {
        customerName: 'New Analyzed Lead',
        message: customerMessage,
        notes: customerMessage,
        leadScore: Number(result.leadScore) || 60,
        priority: isHigh ? 'High' : 'Normal',
        status: 'New',
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      console.log(`[Leads] Lead Created from AI Assistant: ${leadDoc.id}`);

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        type: 'lead_created',
        title: `Captured lead from AI Assistant`,
        createdAt: serverTimestamp()
      });

      if (isHigh) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await addDoc(collection(db, 'followups'), {
          leadId: leadDoc.id,
          customerName: 'New Analyzed Lead',
          message: customerMessage,
          task: `Follow up with analyzed customer`,
          status: 'pending',
          followUpDate: tomorrow.toISOString().split('T')[0],
          priority: 'High',
          leadScore: Number(result.leadScore) || 75,
          generatedMessage: result.suggestedReply || '',
          callToAction: result.suggestedFollowUp || '',
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      }

      navigate('/leads');
    } catch (error) {
      handleFirestoreError(error, 'Create lead from AI Assistant');
    } finally {
      setCreatingLead(false);
    }
  };

  return (
    <DashboardLayout title="AI Assistant">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Input Section */}
        <div className="flex flex-col h-full">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col flex-1 min-h-[440px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 text-sm">Customer Inquiry Analyzer</h3>
              </div>
              {businessProfile?.businessName && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                  {businessProfile.businessName}
                </span>
              )}
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                Paste any customer message, email, or chat snippet below. The AI will evaluate purchase intent, assign a score, and draft an instant professional response.
              </p>
              
              <form onSubmit={handleAnalyze} className="flex flex-col flex-1">
                <textarea
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                  placeholder="e.g. Hi there, we are interested in getting a demo for your team of 15 members. Does your product support WhatsApp integration and custom billing?"
                  className="flex-1 w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none resize-none mb-4 min-h-[220px] text-gray-900 text-sm leading-relaxed"
                ></textarea>
                
                {error && (
                  <div className="mb-4 text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={isAnalyzing || !customerMessage.trim()}
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                      <span>Analyzing customer message...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> <span>Analyze Message</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="flex flex-col h-full">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col flex-1 min-h-[440px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-gray-900 text-sm">AI Analysis & Intelligence</h3>
              </div>
              {result && (
                <button
                  type="button"
                  onClick={handleCreateLeadFromAnalysis}
                  disabled={creatingLead}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save as Lead</span>
                </button>
              )}
            </div>

            <div className="p-6 flex-1 bg-gray-50/40 flex flex-col justify-center">
              {result ? (
                <div className="space-y-4 h-full flex flex-col justify-between">
                  {/* Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                      <p className="text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Intent</p>
                      <p className={`font-bold text-sm ${result.intent?.toLowerCase() === 'high' ? 'text-emerald-600' : result.intent?.toLowerCase() === 'medium' ? 'text-amber-600' : 'text-gray-700'}`}>
                        {result.intent || 'Normal'}
                      </p>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                      <p className="text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Lead Score</p>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-base text-gray-900">{result.leadScore ?? 0}</span>
                        <span className="text-2xs text-gray-400">/ 100</span>
                      </div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                      <p className="text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Priority</p>
                      <p className={`font-bold text-sm ${result.priority?.toLowerCase() === 'high' ? 'text-red-600' : result.priority?.toLowerCase() === 'medium' ? 'text-amber-600' : 'text-gray-700'}`}>
                        {result.priority || 'Normal'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Suggested Follow-Up Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                    <div className="bg-amber-50/80 px-4 py-2 border-b border-amber-100 flex items-center justify-between">
                      <span className="text-2xs font-bold text-amber-900 uppercase tracking-wider">Suggested Follow-Up Action</span>
                    </div>
                    <div className="p-3.5 text-xs text-gray-800 leading-relaxed font-medium">
                      👉 {result.suggestedFollowUp || 'Schedule a follow-up conversation.'}
                    </div>
                  </div>

                  {/* Professional Reply Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex-1 flex flex-col">
                    <div className="bg-indigo-50/80 px-4 py-2 border-b border-indigo-100 flex items-center justify-between">
                      <span className="text-2xs font-bold text-indigo-900 uppercase tracking-wider">Professional Suggested Reply</span>
                      <button 
                        type="button"
                        onClick={handleCopyReply}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3.5 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed flex-1 bg-white font-normal">
                      {result.suggestedReply || 'No reply generated.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-gray-400 py-12">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-gray-200 shadow-2xs mb-3">
                    <Bot className="h-7 w-7 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No message analyzed yet</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                    Enter any incoming customer query on the left to extract intent metrics and generate smart sales responses.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
