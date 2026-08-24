import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  addDoc, 
  setDoc,
  updateDoc, 
  doc, 
  getDoc,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardLayout from '../components/DashboardLayout';
import { 
  Plus, 
  Sparkles, 
  Mail, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  X, 
  Calendar, 
  AlertCircle, 
  Copy, 
  Check, 
  Send,
  MessageSquare,
  RefreshCw,
  User,
  ExternalLink,
  Phone,
  Flame,
  Zap,
  Snowflake,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FollowUp, BusinessProfileData, BusinessLeadStatus } from '../types';
import { formatWhatsAppUrl, handleFirestoreError } from '../lib/firestoreUtils';
import { calculateDynamicLeadScore, getLeadTemperatureStyle, getLeadTemperatureFromScore } from '../lib/leadScoring';
import { 
  markFollowupCompletedInFirestore, 
  deleteFollowupFromFirestore, 
  runExistingLeadsFollowupMigration 
} from '../lib/followupSync';
import { useNavigate } from 'react-router-dom';
import GmailEmailModal from '../components/GmailEmailModal';

export default function FollowUps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Pending' | 'Completed'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileData | null>(null);

  // Gmail Modal State
  const [gmailModal, setGmailModal] = useState<{
    isOpen: boolean;
    email: string;
    name: string;
    subject: string;
    body: string;
    leadId?: string;
    followupId?: string;
  }>({
    isOpen: false,
    email: '',
    name: '',
    subject: '',
    body: ''
  });

  // Form State
  const [formData, setFormData] = useState({
    customerName: '',
    message: '',
    email: '',
    phone: '',
    leadScore: 75,
    status: 'Follow Up Needed' as BusinessLeadStatus,
    priority: 'High',
    followUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
  });

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Real-time Firestore subscription listening to followups for current user
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const parseDoc = (d: any): FollowUp => {
      const data = d.data();
      const rawCompleted = data.completed === true || data.status === 'Completed' || data.status === 'completed' || data.status === 'Done';
      const status = data.status || (rawCompleted ? 'Completed' : 'Pending');
      const sourceStatus = data.sourceStatus || (status !== 'Pending' && status !== 'Completed' ? status : 'Follow Up Needed');

      const phoneClean = data.phone || data.phoneNumber || data.whatsappNumber || '';
      const whatsappClean = data.whatsappNumber || data.phone || data.phoneNumber || '';
      const msgClean = data.customerMessage || data.message || data.task || '';

      const dynamicScoreResult = calculateDynamicLeadScore({
        phone: phoneClean,
        whatsappNumber: whatsappClean,
        email: data.email || '',
        productInterest: data.productInterest || '',
        message: msgClean
      });

      const finalLeadScore = typeof data.leadScore === 'number' ? data.leadScore : dynamicScoreResult.leadScore;
      const finalTemperature = data.leadTemperature || dynamicScoreResult.leadTemperature;

      return {
        id: d.id,
        followupId: data.followupId || d.id,
        leadId: data.leadId || '',
        customerName: data.customerName || data.name || 'Customer',
        customerMessage: msgClean || 'Customer inquiry',
        message: msgClean || 'Customer inquiry',
        productInterest: data.productInterest || '',
        email: data.email || '',
        phone: phoneClean,
        phoneNumber: data.phoneNumber || phoneClean,
        whatsappNumber: whatsappClean,
        leadScore: finalLeadScore,
        leadTemperature: finalTemperature,
        priority: data.priority || (finalLeadScore >= 70 ? 'High' : 'Normal'),
        followUpDate: data.dueDate || data.followUpDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        dueDate: data.dueDate || data.followUpDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        status: status,
        sourceStatus: sourceStatus,
        completed: rawCompleted,
        generatedSubject: data.generatedSubject || '',
        generatedMessage: data.generatedMessage || '',
        callToAction: data.callToAction || data.generatedCallToAction || '',
        generatedCallToAction: data.callToAction || data.generatedCallToAction || '',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        userId: data.userId || user.uid
      };
    };

    // Listen to followups collection for the current user
    const followupsQuery = query(
      collection(db, 'followups'), 
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(
      followupsQuery,
      (snap) => {
        const itemsList = snap.docs.map(d => parseDoc(d));
        itemsList.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.followUpDate || 0).getTime();
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.followUpDate || 0).getTime();
          return timeB - timeA;
        });
        console.log(`[FollowUps] Loaded ${itemsList.length} follow-up records for user: ${user.uid}`);
        setItems(itemsList);
        setLoading(false);
      },
      (err) => {
        const errorDetail = handleFirestoreError(err, 'Followups query listener');
        console.error('[Followups query listener error]:', err);
        showToast('error', errorDetail);
        setLoading(false);
      }
    );

    // Fetch business profile once for AI context
    getDoc(doc(db, 'business_profile', user.uid))
      .then((docSnap) => {
        if (docSnap.exists()) {
          setBusinessProfile(docSnap.data() as BusinessProfileData);
        }
      })
      .catch((err) => handleFirestoreError(err, 'FollowUps profile fetch'));

    // Run migration for existing leads to ensure all pending leads have follow-up records
    runExistingLeadsFollowupMigration(user.uid).catch(err => {
      console.warn('[FollowUps] Migration check:', err);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Mark Follow-Up Complete
  const handleMarkComplete = async (item: FollowUp) => {
    if (!user) return;
    try {
      const newCompleted = !item.completed;
      await markFollowupCompletedInFirestore(user.uid, item.id, item.customerName, newCompleted);
      
      // Update local state immediately for instant feedback
      setItems(prev => prev.map(f => f.id === item.id ? { 
        ...f, 
        completed: newCompleted, 
        status: newCompleted ? 'Completed' : 'Pending' 
      } : f));

      showToast('success', newCompleted ? `Marked follow-up for "${item.customerName}" as completed!` : `Reopened follow-up for "${item.customerName}"`);
    } catch (error) {
      const err = handleFirestoreError(error, 'Followup mark complete');
      showToast('error', `Failed to update: ${err}`);
    }
  };

  // Delete Follow-Up from Firestore
  const handleDelete = async (id: string, customerName: string) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to delete the follow-up for "${customerName}"?`)) return;

    try {
      // Remove from UI immediately
      setItems(prev => prev.filter(f => f.id !== id));

      await deleteFollowupFromFirestore(user.uid, id, customerName);
      showToast('success', `Follow-up for "${customerName}" deleted.`);
    } catch (error) {
      const err = handleFirestoreError(error, 'Followup delete');
      showToast('error', `Failed to delete: ${err}`);
    }
  };

  // AI Follow-Up Generation
  const handleGenerateFollowUp = async (item: FollowUp) => {
    if (!user) return;
    setGeneratingId(item.id);

    try {
      const response = await fetch('/api/generate-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: item.customerName,
          customerMessage: item.message || item.customerMessage,
          leadScore: item.leadScore || 75,
          priority: item.priority || 'High',
          businessName: businessProfile?.businessName || '',
          businessCategory: businessProfile?.category || '',
          products: businessProfile?.products || '',
          services: businessProfile?.services || '',
          whatsappNumber: businessProfile?.whatsappNumber || ''
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(data?.error || 'AI service temporarily unavailable. Please try again.');
      }

      const updateData = {
        generatedSubject: data.subject || '',
        generatedMessage: data.message || '',
        callToAction: data.callToAction || '',
        generatedCallToAction: data.callToAction || '',
        updatedAt: serverTimestamp()
      };

      // Update in subcollection and root
      const subRef = doc(db, 'users', user.uid, 'followups', item.id);
      const rootRef = doc(db, 'followups', item.id);

      await Promise.allSettled([
        updateDoc(subRef, updateData),
        updateDoc(rootRef, updateData)
      ]);

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        type: 'followup_generated',
        title: `AI follow-up generated for: ${item.customerName}`,
        createdAt: serverTimestamp()
      });

      showToast('success', `AI Follow-up generated for ${item.customerName}!`);
    } catch (err: any) {
      console.error("[FollowUps] Generation error:", err);
      showToast('error', "AI service temporarily unavailable. Please try again.");
    } finally {
      setGeneratingId(null);
    }
  };

  // Send WhatsApp Action
  const handleSendWhatsApp = (item: FollowUp) => {
    const targetNumber = item.whatsappNumber || item.phone || item.phoneNumber;
    const bodyText = item.generatedMessage 
      ? `${item.generatedMessage}\n\n👉 ${item.callToAction || item.generatedCallToAction || ''}`.trim()
      : `Hi ${item.customerName}, following up regarding your inquiry: "${item.message || item.customerMessage || 'our offerings'}". How can we best assist you today?`;

    const url = formatWhatsAppUrl(targetNumber, bodyText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Send Email Action (mailto fallback)
  const handleSendEmail = (item: FollowUp) => {
    const subject = encodeURIComponent(item.generatedSubject || `Follow-up: Special Offer for ${item.customerName}`);
    const body = encodeURIComponent(
      item.generatedMessage 
        ? `${item.generatedMessage}\n\n${item.callToAction || item.generatedCallToAction || ''}` 
        : `Hi ${item.customerName},\n\nFollowing up on your inquiry: "${item.message || item.customerMessage || 'our offerings'}".\n\nPlease let us know if you have any questions!\n\nBest regards,\n${businessProfile?.businessName || 'Our Team'}`
    );
    const emailTo = item.email || '';
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
  };

  // Direct Gmail Outreach Modal with AI copy autofill
  const handleOpenGmail = (item: FollowUp) => {
    const subject = item.generatedSubject || `Follow-up on your inquiry with ${businessProfile?.businessName || 'FollowFlow'}`;
    const body = item.generatedMessage 
      ? `${item.generatedMessage}\n\n👉 ${item.callToAction || item.generatedCallToAction || ''}`.trim()
      : `Hi ${item.customerName},\n\nFollowing up regarding your inquiry with us.\n\nPlease let us know if you have any questions or would like to proceed.\n\nBest regards,\n${businessProfile?.businessName || user?.displayName || 'Our Team'}`;

    setGmailModal({
      isOpen: true,
      email: item.email || '',
      name: item.customerName,
      subject,
      body,
      leadId: item.leadId,
      followupId: item.id
    });
  };

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Submit Manual Follow-up
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !formData.customerName.trim()) return;

    try {
      const newDocRef = doc(collection(db, 'followups'));
      const newId = newDocRef.id;
      const dueDateVal = formData.followUpDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const newFollowup = {
        followupId: newId,
        id: newId,
        leadId: '',
        customerName: formData.customerName.trim(),
        message: formData.message.trim() || 'Direct customer inquiry',
        customerMessage: formData.message.trim() || 'Direct customer inquiry',
        productInterest: '',
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        phoneNumber: formData.phone.trim(),
        whatsappNumber: formData.phone.trim(),
        leadScore: Number(formData.leadScore) || 75,
        priority: formData.priority,
        status: 'Pending',
        sourceStatus: formData.status || 'Follow Up Needed',
        dueDate: dueDateVal,
        followUpDate: dueDateVal,
        completed: false,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Write with identical ID to root followups and users/{userId}/followups
      await setDoc(newDocRef, newFollowup);
      await setDoc(doc(db, 'users', user.uid, 'followups', newId), newFollowup).catch(() => {});

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        type: 'followup_created',
        title: `Manual follow-up added for: ${formData.customerName}`,
        createdAt: serverTimestamp()
      });

      showToast('success', `Created follow-up for ${formData.customerName}`);
      setIsModalOpen(false);
      setFormData({
        customerName: '',
        message: '',
        email: '',
        phone: '',
        leadScore: 75,
        status: 'Follow Up Needed',
        priority: 'High',
        followUpDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
      });
    } catch (error) {
      const err = handleFirestoreError(error, 'Followup create');
      showToast('error', `Failed to create follow-up: ${err}`);
    }
  };

  // Open linked lead
  const handleOpenLead = (leadId?: string) => {
    if (leadId) {
      navigate(`/leads?leadId=${leadId}`);
    } else {
      navigate('/leads');
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const isCompleted = item.completed === true || item.status === 'Completed' || item.status === 'completed';
    
    // Tab filter
    if (activeFilter === 'Pending' && isCompleted) return false;
    if (activeFilter === 'Completed' && !isCompleted) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      const matchName = item.customerName?.toLowerCase().includes(queryLower);
      const matchPhone = item.phone?.toLowerCase().includes(queryLower) || item.whatsappNumber?.toLowerCase().includes(queryLower);
      const matchEmail = item.email?.toLowerCase().includes(queryLower);
      const matchMsg = item.message?.toLowerCase().includes(queryLower) || item.customerMessage?.toLowerCase().includes(queryLower);
      const matchStatus = String(item.status || '').toLowerCase().includes(queryLower);
      return matchName || matchPhone || matchEmail || matchMsg || matchStatus;
    }

    return true;
  });

  const pendingCount = items.filter(i => !i.completed && i.status !== 'Completed' && i.status !== 'completed').length;
  const completedCount = items.filter(i => i.completed || i.status === 'Completed' || i.status === 'completed').length;
  const highPriorityCount = items.filter(i => !i.completed && (Number(i.leadScore) > 75 || i.priority === 'High')).length;

  return (
    <DashboardLayout title="Follow-Ups">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-gray-600 text-sm">
            Automated customer outreach, instant lead synchronization, and 1-click WhatsApp and email actions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            id="btn-add-followup-modal"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Follow-Up
          </button>
        </div>
      </div>

      {/* Toast Banner */}
      {feedbackMessage && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Follow-Ups</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">High Priority (&gt;75 Score)</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{highPriorityCount}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-600">
            <Flame className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed Outreach</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          {(['Pending', 'All', 'Completed'] as const).map(tab => (
            <button
              key={tab}
              id={`tab-filter-${tab.toLowerCase()}`}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                activeFilter === tab 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeFilter === tab ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-700'
              }`}>
                {tab === 'All' ? items.length : tab === 'Pending' ? pendingCount : completedCount}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            id="input-search-followups"
            placeholder="Search by name, phone, message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3.5 pr-8 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-gray-900 bg-white"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <CheckCircle2 className="h-8 w-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {activeFilter === 'Completed' ? 'No completed follow-ups yet' : 'No follow-ups found'}
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            {activeFilter === 'Completed'
              ? 'Mark active follow-ups complete to archive them here.'
              : 'Follow-ups are automatically created whenever a lead status is changed to "Follow Up Needed", "Waiting For Stock", or "Price Shared".'}
          </p>
          {activeFilter !== 'Completed' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Create Follow-Up
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(item => {
            const isCompleted = item.completed === true || item.status === 'Completed' || item.status === 'completed';
            const isGeneratingThis = generatingId === item.id;
            const phoneVal = item.phone || item.whatsappNumber || item.phoneNumber;
            const scoreVal = typeof item.leadScore === 'number' ? item.leadScore : 0;
            const tempVal = item.leadTemperature || getLeadTemperatureFromScore(scoreVal);
            const tempStyle = getLeadTemperatureStyle(tempVal);
            const isHighScore = scoreVal >= 70;

            return (
              <div 
                key={item.id} 
                id={`followup-card-${item.id}`}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                  isCompleted 
                    ? 'border-gray-200 bg-gray-50/50 opacity-80' 
                    : isHighScore
                    ? 'border-rose-200/90 hover:border-rose-300 hover:shadow-sm' 
                    : 'border-gray-200 hover:border-indigo-200 hover:shadow-sm'
                }`}
              >
                {/* Primary Card Details */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    
                    {/* Customer & Message Info */}
                    <div className="flex items-start gap-3.5 flex-1">
                      <button
                        onClick={() => handleMarkComplete(item)}
                        id={`btn-toggle-complete-${item.id}`}
                        className="mt-0.5 text-gray-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                        title={isCompleted ? "Reopen as Pending" : "Mark Complete"}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-600 fill-emerald-50" />
                        ) : (
                          <Circle className="h-6 w-6 hover:text-indigo-600" />
                        )}
                      </button>

                      <div className="flex-1">
                        {/* Customer Name & Status Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h4 className={`text-base font-bold ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {item.customerName}
                          </h4>

                          {/* Follow-Up Status Badge */}
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : (item.sourceStatus || item.status) === 'Waiting For Stock'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : (item.sourceStatus || item.status) === 'Price Shared'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {isCompleted ? 'Completed' : (item.sourceStatus || item.status || 'Follow Up Needed')}
                          </span>

                          {/* Product Interest Badge if available */}
                          {item.productInterest && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {item.productInterest}
                            </span>
                          )}

                          {/* Lead Temperature & Score Badge */}
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${tempStyle.badge}`}>
                            {tempVal === 'Hot Lead' ? (
                              <Flame className="h-3.5 w-3.5 text-rose-600" />
                            ) : tempVal === 'Warm Lead' ? (
                              <Zap className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <Snowflake className="h-3.5 w-3.5 text-slate-500" />
                            )}
                            <span>{scoreVal}/100</span>
                            <span className="opacity-70 font-normal">({tempVal})</span>
                          </span>

                          {/* Linked Lead Button */}
                          {item.leadId && (
                            <button
                              onClick={() => handleOpenLead(item.leadId)}
                              id={`btn-open-lead-${item.id}`}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
                              title="Open linked Lead details"
                            >
                              <span>View Linked Lead</span>
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Customer Message Box */}
                        <div className="mt-2 bg-gray-50 rounded-xl p-3 border border-gray-100 text-sm text-gray-700">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <p className="leading-relaxed font-normal">
                              <strong className="text-gray-900 font-semibold">Customer Message:</strong> "{item.message || item.customerMessage || 'Customer inquiry'}"
                            </p>
                          </div>
                        </div>

                        {/* Metadata: Phone, Email, Follow-Up Date */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            <span>Follow-Up Date: <strong className="text-gray-800">{item.followUpDate || item.dueDate || 'Tomorrow'}</strong></span>
                          </div>

                          {phoneVal && (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                              <Phone className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{phoneVal}</span>
                              <button 
                                onClick={() => handleCopy(phoneVal, `phone-${item.id}`)}
                                className="text-gray-400 hover:text-emerald-700 ml-0.5"
                                title="Copy phone"
                              >
                                {copiedField === `phone-${item.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}

                          {item.email && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <Mail className="h-3.5 w-3.5 text-gray-400" />
                              <span>{item.email}</span>
                              <button 
                                onClick={() => handleCopy(item.email, `email-${item.id}`)}
                                className="text-gray-400 hover:text-indigo-600 ml-0.5"
                                title="Copy email"
                              >
                                {copiedField === `email-${item.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 self-end lg:self-start">
                      {/* Generate AI Follow-Up Button */}
                      <button
                        onClick={() => handleGenerateFollowUp(item)}
                        disabled={isGeneratingThis || isCompleted}
                        id={`btn-generate-ai-${item.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        {isGeneratingThis ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                            <span>{item.generatedMessage ? 'Regenerate' : 'AI Follow-Up'}</span>
                          </>
                        )}
                      </button>

                      {/* Send WhatsApp Button */}
                      <button
                        onClick={() => handleSendWhatsApp(item)}
                        disabled={isCompleted}
                        id={`btn-whatsapp-${item.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </button>

                      {/* Send via Gmail Button */}
                      <button
                        onClick={() => handleOpenGmail(item)}
                        disabled={isCompleted}
                        id={`btn-gmail-${item.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                        title="Send directly from your connected Gmail"
                      >
                        <Mail className="h-3.5 w-3.5 text-red-600" />
                        <span>Gmail</span>
                      </button>

                      {/* Mark Complete Toggle */}
                      <button
                        onClick={() => handleMarkComplete(item)}
                        id={`btn-mark-complete-${item.id}`}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors ${
                          isCompleted 
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{isCompleted ? 'Reopen' : 'Mark Complete'}</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(item.id, item.customerName)}
                        id={`btn-delete-followup-${item.id}`}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete follow-up"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* AI Generated Follow-Up Box */}
                  {item.generatedMessage && (
                    <motion.div 
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 pt-4 border-t border-gray-100 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white rounded-xl p-4 border border-indigo-100 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-indigo-100/60">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-indigo-600" />
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                            AI Generated Outreach Copy
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(`${item.generatedSubject ? `Subject: ${item.generatedSubject}\n\n` : ''}${item.generatedMessage}\n\nCall To Action: ${item.callToAction || item.generatedCallToAction}`, `full-${item.id}`)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            {copiedField === `full-${item.id}` ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-600">Copied Full Copy</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy All</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleSendWhatsApp(item)}
                            className="inline-flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors shadow-2xs"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            onClick={() => handleOpenGmail(item)}
                            className="inline-flex items-center gap-1 bg-red-600 text-white px-2.5 py-1 rounded-md text-xs font-medium hover:bg-red-700 transition-colors shadow-2xs"
                            title="Send via Gmail"
                          >
                            <Mail className="h-3 w-3" />
                            <span>Send via Gmail</span>
                          </button>
                        </div>
                      </div>

                      {/* Subject */}
                      {item.generatedSubject && (
                        <div className="mb-2.5">
                          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold mb-1">
                            <span>SUBJECT:</span>
                            <button 
                              onClick={() => handleCopy(item.generatedSubject || '', `subj-${item.id}`)}
                              className="text-gray-400 hover:text-indigo-600 text-2xs"
                            >
                              {copiedField === `subj-${item.id}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 bg-white/80 p-2.5 rounded-lg border border-indigo-50">
                            {item.generatedSubject}
                          </p>
                        </div>
                      )}

                      {/* Message Body */}
                      <div className="mb-2.5">
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold mb-1">
                          <span>MESSAGE:</span>
                          <button 
                            onClick={() => handleCopy(item.generatedMessage || '', `msg-${item.id}`)}
                            className="text-gray-400 hover:text-indigo-600 text-2xs"
                          >
                            {copiedField === `msg-${item.id}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="text-sm text-gray-800 bg-white/80 p-3 rounded-lg border border-indigo-50 whitespace-pre-wrap leading-relaxed">
                          {item.generatedMessage}
                        </div>
                      </div>

                      {/* Call to Action */}
                      {(item.callToAction || item.generatedCallToAction) && (
                        <div>
                          <div className="text-xs text-indigo-900 font-semibold mb-1">
                            CALL TO ACTION:
                          </div>
                          <div className="text-xs font-medium text-indigo-800 bg-indigo-100/60 px-3 py-2 rounded-lg border border-indigo-200/50">
                            👉 {item.callToAction || item.generatedCallToAction}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Add Follow-Up Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-200"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-900">Create Follow-Up</h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Customer Name *
                    </label>
                    <input 
                      autoFocus
                      required 
                      type="text" 
                      placeholder="e.g. Alex Henderson"
                      value={formData.customerName} 
                      onChange={e => setFormData({ ...formData, customerName: e.target.value })} 
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Customer Message / Inquiry *
                    </label>
                    <textarea 
                      required
                      rows={3} 
                      placeholder="e.g. Inquired about enterprise tier pricing and demo availability."
                      value={formData.message} 
                      onChange={e => setFormData({ ...formData, message: e.target.value })} 
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900 resize-none" 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <input 
                        type="email" 
                        placeholder="alex@example.com"
                        value={formData.email} 
                        onChange={e => setFormData({ ...formData, email: e.target.value })} 
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Phone / WhatsApp Number</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g. +14155552671"
                        value={formData.phone} 
                        onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none text-sm text-gray-900" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Follow-Up Date
                      </label>
                      <input 
                        type="date" 
                        value={formData.followUpDate} 
                        onChange={e => setFormData({ ...formData, followUpDate: e.target.value })} 
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value as BusinessLeadStatus })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900 bg-white"
                      >
                        <option value="Follow Up Needed">Follow Up Needed</option>
                        <option value="Waiting For Stock">Waiting For Stock</option>
                        <option value="Price Shared">Price Shared</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Lead Score ({formData.leadScore}/100)
                    </label>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={formData.leadScore} 
                      onChange={e => setFormData({ ...formData, leadScore: Number(e.target.value) })} 
                      className="w-full accent-indigo-600 mt-2" 
                    />
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)} 
                      className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-50 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg text-sm shadow-sm transition-colors"
                    >
                      Save Follow-Up
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Direct Gmail Outreach Modal */}
      <GmailEmailModal
        isOpen={gmailModal.isOpen}
        onClose={() => setGmailModal(prev => ({ ...prev, isOpen: false }))}
        recipientEmail={gmailModal.email}
        recipientName={gmailModal.name}
        defaultSubject={gmailModal.subject}
        defaultBody={gmailModal.body}
        leadId={gmailModal.leadId}
        followupId={gmailModal.followupId}
        onEmailSent={() => {
          showToast('success', `Gmail follow-up sent to ${gmailModal.email}!`);
        }}
      />
    </DashboardLayout>
  );
}
