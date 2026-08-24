import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardLayout from '../components/DashboardLayout';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Users, 
  MessageSquare, 
  Mail, 
  Phone, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  UserCheck,
  ShoppingBag,
  ArrowRight,
  Filter,
  Search,
  Clock,
  ChevronRight,
  AlertTriangle,
  History,
  Calendar,
  Send,
  RefreshCw,
  Eye,
  Info,
  Check,
  Flame,
  Zap,
  Snowflake
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, Customer, BusinessLeadStatus, StatusHistoryRecord, FollowupRecord } from '../types';
import { 
  BUSINESS_LEAD_STATUSES,
  computeAutoLeadScoreAndStatus,
  checkDuplicateLeadOrCustomer,
  getBusinessStatusStyle,
  formatWhatsAppUrl, 
  handleFirestoreError, 
  formatDateTime,
  getRelativeTime,
  moveLeadToCustomers 
} from '../lib/firestoreUtils';
import { 
  calculateDynamicLeadScore, 
  getLeadTemperatureFromScore, 
  getLeadTemperatureStyle, 
  LeadTemperature 
} from '../lib/leadScoring';
import LeadScoreCard from '../components/LeadScoreCard';
import { syncLeadFollowup, runExistingLeadsFollowupMigration } from '../lib/followupSync';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import FirebaseDiagnosticModal from '../components/FirebaseDiagnosticModal';
import GmailEmailModal from '../components/GmailEmailModal';
import { ShieldCheck, Database } from 'lucide-react';

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('All');
  const [activeTemperatureFilter, setActiveTemperatureFilter] = useState<string>('All');
  
  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLeadForTimeline, setSelectedLeadForTimeline] = useState<Lead | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string; actionUrl?: string; actionLabel?: string } | null>(null);

  // Gmail Modal State
  const [gmailModal, setGmailModal] = useState<{
    isOpen: boolean;
    email: string;
    name: string;
    subject: string;
    body: string;
    leadId?: string;
  }>({
    isOpen: false,
    email: '',
    name: '',
    subject: '',
    body: ''
  });
  
  // Duplicate check modal state
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isOpen: boolean;
    type?: 'lead' | 'customer';
    matchedRecord?: Lead | Customer;
    matchField?: 'phone' | 'email' | 'name';
    pendingFormData?: any;
  } | null>(null);

  // Diagnostic modal state
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);

  // Convert to Customer Modal State
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertData, setConvertData] = useState({
    item: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [isConverting, setIsConverting] = useState(false);

  // Quick Note / Timeline update inside details modal
  const [newTimelineNote, setNewTimelineNote] = useState('');
  const [newTimelineStatus, setNewTimelineStatus] = useState<string>('');
  const [isSubmittingTimelineNote, setIsSubmittingTimelineNote] = useState(false);

  // Simplified Form State (Manual score & status inputs removed!)
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    whatsappNumber: '',
    email: '',
    productInterest: '',
    message: ''
  });
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Real-time calculated live score & status preview
  const liveAiPrediction = useMemo(() => {
    return computeAutoLeadScoreAndStatus({
      phone: formData.phone,
      whatsappNumber: formData.whatsappNumber,
      email: formData.email,
      productInterest: formData.productInterest,
      message: formData.message
    });
  }, [formData.phone, formData.whatsappNumber, formData.email, formData.productInterest, formData.message]);

  // Real-time listener for leads
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const q = query(
      collection(db, 'leads'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Lead[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const phoneVal = data.phone || data.phoneNumber || '';
          const whatsappVal = data.whatsappNumber || data.phone || data.phoneNumber || '';
          const emailVal = data.email || '';
          const messageVal = data.message || data.notes || '';
          const productVal = data.productInterest || '';

          // Compute score and temperature dynamically if missing
          const dynamicScoreCalc = calculateDynamicLeadScore({
            phone: phoneVal,
            whatsappNumber: whatsappVal,
            email: emailVal,
            productInterest: productVal,
            message: messageVal
          });

          const leadScore = typeof data.leadScore === 'number' 
            ? data.leadScore 
            : (typeof data.aiScore === 'number' ? data.aiScore : dynamicScoreCalc.totalScore);
          
          const leadTemperature = data.leadTemperature || getLeadTemperatureFromScore(leadScore);

          return {
            id: docSnap.id,
            customerName: data.customerName || data.name || 'Unnamed Prospect',
            name: data.name || data.customerName || '',
            email: emailVal,
            phone: phoneVal,
            phoneNumber: phoneVal,
            whatsappNumber: whatsappVal,
            message: messageVal,
            notes: data.notes || messageVal,
            productInterest: productVal,
            leadScore: leadScore,
            aiScore: leadScore,
            leadTemperature: leadTemperature,
            priority: data.priority || dynamicScoreCalc.priority,
            status: data.status || data.aiStatus || 'New Inquiry',
            aiStatus: data.aiStatus || data.status || 'New Inquiry',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            lastContactAt: data.lastContactAt || data.updatedAt || data.createdAt,
            lastContactDate: data.lastContactDate,
            statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
            followUpHistory: Array.isArray(data.followUpHistory) ? data.followUpHistory : [],
            purchaseHistory: Array.isArray(data.purchaseHistory) ? data.purchaseHistory : [],
            userId: data.userId || user.uid
          };
        });

        // Sort by updatedAt or createdAt desc
        items.sort((a, b) => {
          const timeA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });

        setLeads(items);
        setLoading(false);

        // If URL has leadId query param, auto-open timeline for that lead
        const urlLeadId = searchParams.get('leadId') || searchParams.get('id');
        if (urlLeadId) {
          const match = items.find(l => l.id === urlLeadId);
          if (match) {
            setSelectedLeadForTimeline(match);
          }
        } else if (selectedLeadForTimeline) {
          // Update active timeline lead if currently viewed
          const updated = items.find(l => l.id === selectedLeadForTimeline.id);
          if (updated) setSelectedLeadForTimeline(updated);
        }
      },
      (error) => {
        const errorDetail = handleFirestoreError(error, 'Leads listener');
        console.error('[Leads snapshot error]:', error);
        showToast('error', errorDetail);
        setLoading(false);
      }
    );

    // Run migration for existing leads missing follow-ups
    runExistingLeadsFollowupMigration(user.uid).catch(err => {
      console.warn('[Leads] Auto-migration note:', err);
    });

    return () => unsubscribe();
  }, [user, searchParams]);

  const showToast = (type: 'success' | 'error', text: string, actionUrl?: string, actionLabel?: string) => {
    setFeedbackMessage({ type, text, actionUrl, actionLabel });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Open Add Lead Modal
  const openCreateModal = () => {
    setEditingLead(null);
    setFormData({
      customerName: '',
      phone: '',
      whatsappNumber: '',
      email: '',
      productInterest: '',
      message: ''
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Lead Modal
  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      customerName: lead.customerName || '',
      phone: lead.phone || lead.phoneNumber || '',
      whatsappNumber: lead.whatsappNumber || lead.phone || '',
      email: lead.email || '',
      productInterest: lead.productInterest || '',
      message: lead.message || lead.notes || ''
    });
    setIsFormModalOpen(true);
  };

  // Form Submit with Duplicate Check & AI Auto-Scoring
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !formData.customerName.trim()) return;

    // If creating new lead (not editing), perform duplicate check first
    if (!editingLead) {
      const duplicateResult = await checkDuplicateLeadOrCustomer(
        user.uid,
        formData.phone || formData.whatsappNumber,
        formData.email,
        formData.customerName
      );

      if (duplicateResult.isDuplicate) {
        setDuplicateWarning({
          isOpen: true,
          type: duplicateResult.type,
          matchedRecord: duplicateResult.matchedRecord,
          matchField: duplicateResult.matchField,
          pendingFormData: { ...formData }
        });
        return;
      }
    }

    await saveLeadToFirestore(formData, editingLead);
  };

  // Core Save Routine
  const saveLeadToFirestore = async (data: typeof formData, existingLead?: Lead | null) => {
    if (!user) return;
    setIsAiAnalyzing(true);

    try {
      // 1. Calculate automated AI Score & Status using the dynamic rule engine
      const phoneClean = data.phone.trim();
      const whatsappClean = (data.whatsappNumber.trim() || phoneClean);
      const dynamicResult = computeAutoLeadScoreAndStatus({
        phone: phoneClean,
        whatsappNumber: whatsappClean,
        email: data.email.trim(),
        productInterest: data.productInterest.trim(),
        message: data.message.trim()
      });

      let finalScore = dynamicResult.leadScore;
      let finalTemperature = dynamicResult.leadTemperature;
      let finalStatus: BusinessLeadStatus = dynamicResult.aiStatus;
      let finalPriority = dynamicResult.priority;

      const nowIso = new Date().toISOString();

      if (existingLead) {
        // UPDATE EXISTING LEAD
        const existingStatusHistory: StatusHistoryRecord[] = Array.isArray(existingLead.statusHistory) 
          ? [...existingLead.statusHistory] 
          : [];

        if (existingLead.status !== finalStatus) {
          existingStatusHistory.unshift({
            id: `status-${Date.now()}`,
            status: finalStatus,
            timestamp: nowIso,
            note: `Auto-updated by AI from conversation message (${finalScore}/100 - ${finalTemperature})`
          });
        }

        const updatePayload: Partial<Lead> = {
          customerName: data.customerName.trim(),
          name: data.customerName.trim(),
          email: data.email.trim(),
          phone: phoneClean,
          phoneNumber: phoneClean,
          whatsappNumber: whatsappClean,
          productInterest: data.productInterest.trim(),
          message: data.message.trim(),
          notes: data.message.trim(),
          status: finalStatus,
          aiStatus: finalStatus,
          leadScore: finalScore,
          leadTemperature: finalTemperature,
          aiScore: finalScore,
          priority: finalPriority,
          statusHistory: existingStatusHistory,
          updatedAt: serverTimestamp(),
          lastContactAt: serverTimestamp(),
          lastContactDate: new Date().toISOString().split('T')[0]
        };

        await updateDoc(doc(db, 'leads', existingLead.id), updatePayload);

        // Sync Follow-Up in Firestore (automatic creation, update, or removal)
        await syncLeadFollowup(user.uid, {
          ...existingLead,
          ...updatePayload,
          id: existingLead.id,
          userId: user.uid
        } as Lead);

        await addDoc(collection(db, 'activities'), {
          userId: user.uid,
          type: 'lead_updated',
          title: `Updated lead: ${data.customerName.trim()} (${finalTemperature}, ${finalScore}/100)`,
          createdAt: serverTimestamp()
        });

        showToast('success', `Lead "${data.customerName}" updated with AI Score ${finalScore}/100 (${finalTemperature})!`);
      } else {
        // CREATE NEW LEAD
        const initialStatusHistory: StatusHistoryRecord[] = [
          {
            id: `status-${Date.now()}`,
            status: finalStatus,
            timestamp: nowIso,
            note: `Initial lead creation with AI score ${finalScore}/100 (${finalTemperature})`
          }
        ];

        const initialFollowUp: FollowupRecord[] = data.message ? [
          {
            id: `msg-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            channel: 'Initial Inquiry',
            note: data.message.trim(),
            summary: data.productInterest ? `Interested in ${data.productInterest}` : 'Initial message'
          }
        ] : [];

        const newLeadPayload = {
          customerName: data.customerName.trim(),
          name: data.customerName.trim(),
          email: data.email.trim(),
          phone: phoneClean,
          phoneNumber: phoneClean,
          whatsappNumber: whatsappClean,
          productInterest: data.productInterest.trim(),
          message: data.message.trim(),
          notes: data.message.trim(),
          status: finalStatus,
          aiStatus: finalStatus,
          leadScore: finalScore,
          leadTemperature: finalTemperature,
          aiScore: finalScore,
          priority: finalPriority,
          statusHistory: initialStatusHistory,
          followUpHistory: initialFollowUp,
          purchaseHistory: [],
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastContactAt: serverTimestamp(),
          lastContactDate: new Date().toISOString().split('T')[0]
        };

        const docRef = await addDoc(collection(db, 'leads'), newLeadPayload);

        // Sync Follow-Up in Firestore (automatic creation for Follow Up Needed, Waiting For Stock, Price Shared)
        await syncLeadFollowup(user.uid, {
          ...newLeadPayload,
          id: docRef.id
        } as Lead);

        await addDoc(collection(db, 'activities'), {
          userId: user.uid,
          type: 'lead_created',
          title: `New lead added: ${data.customerName.trim()} (${finalTemperature}, ${finalScore}/100)`,
          createdAt: serverTimestamp()
        });

        showToast('success', `Lead "${data.customerName}" added as ${finalTemperature} (${finalScore}/100)!`);
      }

      setIsFormModalOpen(false);
      setDuplicateWarning(null);
    } catch (err) {
      const msg = handleFirestoreError(err, 'Save lead');
      showToast('error', `Failed to save lead: ${msg}`);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Handle Quick Status Change from row or details
  const handleQuickStatusChange = async (lead: Lead, newStatus: BusinessLeadStatus) => {
    if (!user) return;
    try {
      const nowIso = new Date().toISOString();
      const currentHistory: StatusHistoryRecord[] = Array.isArray(lead.statusHistory) 
        ? [...lead.statusHistory] 
        : [];

      currentHistory.unshift({
        id: `status-${Date.now()}`,
        status: newStatus,
        timestamp: nowIso,
        note: `Status updated to ${newStatus}`
      });

      await updateDoc(doc(db, 'leads', lead.id), {
        status: newStatus,
        aiStatus: newStatus,
        statusHistory: currentHistory,
        updatedAt: serverTimestamp(),
        lastContactAt: serverTimestamp()
      });

      // Synchronize follow-up status automatically
      await syncLeadFollowup(user.uid, {
        ...lead,
        status: newStatus,
        aiStatus: newStatus,
        statusHistory: currentHistory
      });

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        type: 'lead_status_changed',
        title: `${lead.customerName} status changed to ${newStatus}`,
        createdAt: serverTimestamp()
      });

      showToast('success', `Updated "${lead.customerName}" status to "${newStatus}"`);

      // If status changed to Customer Purchased, prompt moving to customer database
      if (newStatus === 'Customer Purchased') {
        openConvertModal(lead);
      }
    } catch (err) {
      handleFirestoreError(err, 'Status change');
      showToast('error', 'Failed to update status');
    }
  };

  // Handle Delete Lead
  const handleDeleteLead = async (leadId: string, leadName: string) => {
    if (!user) return;
    if (!window.confirm(`Are you sure you want to delete lead "${leadName}"?`)) return;

    try {
      await deleteDoc(doc(db, 'leads', leadId));
      showToast('success', `Lead "${leadName}" deleted successfully`);
    } catch (err) {
      const msg = handleFirestoreError(err, 'Delete lead');
      showToast('error', `Failed to delete lead: ${msg}`);
    }
  };

  // Add timeline note inside Lead Details Modal
  const handleAddTimelineNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !selectedLeadForTimeline || !newTimelineNote.trim()) return;

    setIsSubmittingTimelineNote(true);
    try {
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split('T')[0];

      const currentFollowUps: FollowupRecord[] = Array.isArray(selectedLeadForTimeline.followUpHistory)
        ? [...selectedLeadForTimeline.followUpHistory]
        : [];

      currentFollowUps.unshift({
        id: `note-${Date.now()}`,
        date: todayStr,
        channel: 'Note / Interaction',
        note: newTimelineNote.trim(),
        summary: newTimelineStatus ? `Status: ${newTimelineStatus}` : 'Interaction logged'
      });

      const updateData: any = {
        followUpHistory: currentFollowUps,
        updatedAt: serverTimestamp(),
        lastContactAt: serverTimestamp(),
        lastContactDate: todayStr
      };

      if (newTimelineStatus && newTimelineStatus !== selectedLeadForTimeline.status) {
        updateData.status = newTimelineStatus;
        updateData.aiStatus = newTimelineStatus;
        
        const currentStatusHistory: StatusHistoryRecord[] = Array.isArray(selectedLeadForTimeline.statusHistory)
          ? [...selectedLeadForTimeline.statusHistory]
          : [];
        
        currentStatusHistory.unshift({
          id: `status-${Date.now()}`,
          status: newTimelineStatus,
          timestamp: nowIso,
          note: newTimelineNote.trim()
        });
        updateData.statusHistory = currentStatusHistory;
      }

      await updateDoc(doc(db, 'leads', selectedLeadForTimeline.id), updateData);

      // Sync follow-up status if timeline status was updated
      if (newTimelineStatus) {
        await syncLeadFollowup(user.uid, {
          ...selectedLeadForTimeline,
          status: newTimelineStatus,
          aiStatus: newTimelineStatus
        });
      }

      setNewTimelineNote('');
      setNewTimelineStatus('');
      showToast('success', 'Timeline note recorded successfully!');
    } catch (err) {
      handleFirestoreError(err, 'Add timeline note');
      showToast('error', 'Failed to add note');
    } finally {
      setIsSubmittingTimelineNote(false);
    }
  };

  // Delete Lead
  const handleDelete = async (id: string, name: string) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to delete lead "${name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'leads', id));
      
      // Clean up any active follow-up for this lead
      await syncLeadFollowup(user.uid, { id, status: 'Not Interested' } as Lead);

      if (selectedLeadForTimeline?.id === id) {
        setSelectedLeadForTimeline(null);
      }
      showToast('success', `Lead "${name}" deleted.`);
    } catch (error) {
      const err = handleFirestoreError(error, 'Lead delete');
      showToast('error', `Failed to delete lead: ${err}`);
    }
  };

  // Convert to Customer Database
  const openConvertModal = (lead: Lead) => {
    setConvertingLead(lead);
    setConvertData({
      item: lead.productInterest || lead.message || 'Purchased Product / Service',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: lead.notes || lead.message || 'Deal closed from Leads pipeline'
    });
  };

  const handleExecuteConversion = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !convertingLead) return;

    setIsConverting(true);
    try {
      const purchaseInfo = convertData.item.trim() ? {
        item: convertData.item.trim(),
        amount: Number(convertData.amount) || 0,
        date: convertData.date || new Date().toISOString().split('T')[0],
        notes: convertData.notes.trim()
      } : undefined;

      const customerId = await moveLeadToCustomers(user.uid, convertingLead, purchaseInfo);
      
      // Update the lead status to Customer Purchased in leads collection
      await handleQuickStatusChange(convertingLead, 'Customer Purchased');

      showToast(
        'success', 
        `"${convertingLead.customerName}" successfully moved into Customer Database!`,
        '/customers',
        'Open Customer Database'
      );
      setConvertingLead(null);
    } catch (error) {
      const err = handleFirestoreError(error, 'Move lead to customer');
      showToast('error', `Failed to move lead to customer database: ${err}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleSendWhatsApp = (lead: Lead) => {
    const targetNumber = lead.whatsappNumber || lead.phone || lead.phoneNumber;
    const defaultText = `Hi ${lead.customerName}, thanks for reaching out! Regarding ${lead.productInterest || lead.message || 'your inquiry'}, how can we assist you today?`;
    const url = formatWhatsAppUrl(targetNumber, defaultText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmail = (lead: Lead) => {
    if (!lead.email) return;
    const subject = encodeURIComponent(`Regarding your inquiry - ${lead.customerName}`);
    const body = encodeURIComponent(`Hi ${lead.customerName},\n\nThank you for getting in touch with us regarding ${lead.productInterest || lead.message || 'our products & services'}.\n\nBest regards,\nOur Team`);
    window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`;
  };

  const handleOpenGmail = (lead: Lead) => {
    if (!lead.email) {
      showToast('error', 'This lead does not have an email address recorded.');
      return;
    }
    const subject = `Regarding your inquiry - ${lead.customerName}`;
    const body = `Hi ${lead.customerName},\n\nThank you for getting in touch with us regarding ${lead.productInterest || lead.message || 'our products & services'}.\n\nHow can we best assist you further?\n\nBest regards,\n${user?.displayName || 'FollowFlow Team'}`;
    
    setGmailModal({
      isOpen: true,
      email: lead.email,
      name: lead.customerName,
      subject,
      body,
      leadId: lead.id
    });
  };

  // Filtered Leads based on Search, Status Tab & Temperature Tab
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // Status Filter
      if (activeStatusFilter !== 'All') {
        if (l.status !== activeStatusFilter) return false;
      }

      // Temperature Filter
      if (activeTemperatureFilter !== 'All') {
        const score = typeof l.leadScore === 'number' ? l.leadScore : 0;
        const temp = l.leadTemperature || getLeadTemperatureFromScore(score);
        if (temp !== activeTemperatureFilter) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (l.customerName || l.name || '').toLowerCase().includes(q);
        const phoneMatch = (l.phone || l.phoneNumber || l.whatsappNumber || '').toLowerCase().includes(q);
        const emailMatch = (l.email || '').toLowerCase().includes(q);
        const interestMatch = (l.productInterest || '').toLowerCase().includes(q);
        const msgMatch = (l.message || l.notes || '').toLowerCase().includes(q);
        const statusMatch = (l.status || '').toLowerCase().includes(q);
        const tempMatch = (l.leadTemperature || '').toLowerCase().includes(q);

        if (!nameMatch && !phoneMatch && !emailMatch && !interestMatch && !msgMatch && !statusMatch && !tempMatch) {
          return false;
        }
      }

      return true;
    });
  }, [leads, activeStatusFilter, activeTemperatureFilter, searchQuery]);

  // Counts for each business status tab
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = { All: leads.length };
    BUSINESS_LEAD_STATUSES.forEach(s => { map[s] = 0; });
    leads.forEach(l => {
      const s = l.status || 'New Inquiry';
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [leads]);

  // Counts for temperature tabs
  const temperatureCounts = useMemo(() => {
    const map: Record<string, number> = {
      All: leads.length,
      'Hot Lead': 0,
      'Warm Lead': 0,
      'Cold Lead': 0
    };
    leads.forEach(l => {
      const score = typeof l.leadScore === 'number' ? l.leadScore : 0;
      const temp = l.leadTemperature || getLeadTemperatureFromScore(score);
      if (map[temp] !== undefined) {
        map[temp]++;
      }
    });
    return map;
  }, [leads]);

  return (
    <DashboardLayout title="Leads Management">
      {/* Top Header & Actions */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-gray-600 text-sm">
            Dynamic AI lead scoring engine (0–100), automated Hot/Warm/Cold classification, instant AI status detection, and full communication history.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className="px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 font-medium text-xs sm:text-sm transition flex items-center gap-1.5 shadow-2xs"
            title="Run Firestore diagnostic"
          >
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span className="hidden sm:inline">Diagnostic</span>
          </button>
          <Link
            to="/customers"
            className="px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium text-xs sm:text-sm transition flex items-center gap-2 shadow-2xs"
          >
            <Users className="h-4 w-4 text-emerald-600" />
            <span>Customer Database</span>
          </Link>
          <button 
            id="add-lead-main-btn"
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium transition flex items-center gap-2 shadow-sm text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          {feedbackMessage.actionUrl && (
            <Link
              to={feedbackMessage.actionUrl}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1"
            >
              <span>{feedbackMessage.actionLabel || 'View'}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* Search Bar & Status + Temperature Filters */}
      <div className="space-y-3 mb-6">
        {/* Global Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            id="leads-global-search-input"
            type="text"
            placeholder="Search leads by name, phone, email, product interest, temperature, message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none shadow-2xs transition"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Lead Temperature Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-2xs font-bold uppercase tracking-wider text-gray-400 shrink-0 mr-1 flex items-center gap-1">
            <Flame className="h-3 w-3 text-rose-500" /> Temperature:
          </span>

          <button
            onClick={() => setActiveTemperatureFilter('All')}
            className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTemperatureFilter === 'All'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>All Temperatures</span>
            <span className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${
              activeTemperatureFilter === 'All' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {temperatureCounts['All'] || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTemperatureFilter('Hot Lead')}
            className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
              activeTemperatureFilter === 'Hot Lead'
                ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-500/20'
                : 'bg-white border-gray-200 text-rose-700 hover:bg-rose-50/50'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-rose-600" />
            <span>Hot Leads (70-100)</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              {temperatureCounts['Hot Lead'] || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTemperatureFilter('Warm Lead')}
            className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
              activeTemperatureFilter === 'Warm Lead'
                ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-500/20'
                : 'bg-white border-gray-200 text-amber-800 hover:bg-amber-50/50'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-600" />
            <span>Warm Leads (40-69)</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              {temperatureCounts['Warm Lead'] || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTemperatureFilter('Cold Lead')}
            className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
              activeTemperatureFilter === 'Cold Lead'
                ? 'bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-slate-400/20'
                : 'bg-white border-gray-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Snowflake className="h-3.5 w-3.5 text-slate-500" />
            <span>Cold Leads (0-39)</span>
            <span className="px-1.5 py-0.2 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {temperatureCounts['Cold Lead'] || 0}
            </span>
          </button>
        </div>

        {/* Business Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setActiveStatusFilter('All')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeStatusFilter === 'All'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>All Statuses</span>
            <span className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${
              activeStatusFilter === 'All' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {statusCounts['All'] || 0}
            </span>
          </button>

          {BUSINESS_LEAD_STATUSES.map((status) => {
            const style = getBusinessStatusStyle(status);
            const isSelected = activeStatusFilter === status;
            const count = statusCounts[status] || 0;

            return (
              <button
                key={status}
                onClick={() => setActiveStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
                  isSelected
                    ? `${style.bg} ${style.text} ${style.border} ring-2 ring-indigo-500/20 font-bold`
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{status}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${
                  isSelected ? `${style.badge}` : 'bg-gray-100 text-gray-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Leads List & Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {searchQuery || activeTemperatureFilter !== 'All' || activeStatusFilter !== 'All' 
              ? 'No leads matched your search or filters' 
              : 'No leads in this category'}
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            {searchQuery || activeTemperatureFilter !== 'All' || activeStatusFilter !== 'All'
              ? `Try clearing temperature or status filters to view all leads.`
              : `Create a new lead to automatically score intent, determine temperature, and track history.`}
          </p>
          {(searchQuery || activeTemperatureFilter !== 'All' || activeStatusFilter !== 'All') ? (
            <button 
              onClick={() => { setSearchQuery(''); setActiveStatusFilter('All'); setActiveTemperatureFilter('All'); }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              Clear All Filters
            </button>
          ) : (
            <button 
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-sm inline-flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" /> Add Lead
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Customer & Interest</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5">Automated Status</th>
                  <th className="px-5 py-3.5">Lead Score & Temperature</th>
                  <th className="px-5 py-3.5">Last Activity</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredLeads.map((lead) => {
                  const statusStyle = getBusinessStatusStyle(lead.status);
                  const whatsappTarget = lead.whatsappNumber || lead.phone;
                  const isPurchased = lead.status === 'Customer Purchased';
                  const leadScoreVal = typeof lead.leadScore === 'number' ? lead.leadScore : 0;
                  const leadTempVal = lead.leadTemperature || getLeadTemperatureFromScore(leadScoreVal);
                  const tempBadgeStyle = getLeadTemperatureStyle(leadTempVal);

                  return (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                      onClick={(e) => {
                        // If user didn't click an action button or link, open timeline modal
                        const target = e.target as HTMLElement;
                        if (!target.closest('button') && !target.closest('a') && !target.closest('select')) {
                          setSelectedLeadForTimeline(lead);
                        }
                      }}
                    >
                      {/* Customer Name & Interest */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 hover:text-indigo-600 transition-colors">
                            {lead.customerName}
                          </span>
                          {isPurchased && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Purchased
                            </span>
                          )}
                        </div>
                        {lead.productInterest && (
                          <div className="text-xs text-indigo-600 font-medium mt-0.5 flex items-center gap-1">
                            <span>Interest: {lead.productInterest}</span>
                          </div>
                        )}
                        {lead.message && lead.message !== lead.productInterest && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs" title={lead.message}>
                            "{lead.message}"
                          </div>
                        )}
                      </td>

                      {/* Contact Info */}
                      <td className="px-5 py-4">
                        {lead.phone && (
                          <div className="text-gray-900 text-xs font-medium flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        {lead.email && (
                          <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <Mail className="h-3.5 w-3.5 text-gray-400" />
                            <span className="truncate max-w-[140px]">{lead.email}</span>
                          </div>
                        )}
                        {!lead.phone && !lead.email && (
                          <span className="text-xs text-gray-400">No direct contact</span>
                        )}
                      </td>

                      {/* Status Dropdown & Auto classification */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2">
                          <select
                            value={lead.status || 'New Inquiry'}
                            onChange={(e) => handleQuickStatusChange(lead, e.target.value as BusinessLeadStatus)}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs font-bold rounded-lg px-2.5 py-1 border outline-none cursor-pointer transition-shadow shadow-2xs ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                          >
                            {BUSINESS_LEAD_STATUSES.map((st) => (
                              <option key={st} value={st} className="bg-white text-gray-900 font-normal">
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Lead Score & Temperature */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  leadScoreVal >= 70 
                                    ? 'bg-rose-500' 
                                    : leadScoreVal >= 40 
                                      ? 'bg-amber-500' 
                                      : 'bg-slate-400'
                                }`} 
                                style={{ width: `${Math.min(100, Math.max(0, leadScoreVal))}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-gray-900">
                              {leadScoreVal}/100
                            </span>
                          </div>
                          <div>
                            <span className={`inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md font-bold border ${tempBadgeStyle.badge}`}>
                              {leadTempVal === 'Hot Lead' ? (
                                <Flame className="h-3 w-3 text-rose-600" />
                              ) : leadTempVal === 'Warm Lead' ? (
                                <Zap className="h-3 w-3 text-amber-600" />
                              ) : (
                                <Snowflake className="h-3 w-3 text-slate-500" />
                              )}
                              <span>{leadTempVal}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td className="px-5 py-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span>{getRelativeTime(lead.lastContactAt || lead.updatedAt || lead.createdAt)}</span>
                        </div>
                      </td>

                      {/* Quick Action Buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* View Timeline Button */}
                          <button
                            onClick={() => setSelectedLeadForTimeline(lead)}
                            title="View Full Lead Timeline & Breakdown"
                            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          {/* 1-Click Move to Customer Database */}
                          <button
                            onClick={() => openConvertModal(lead)}
                            title="Complete & Move to Customer Database"
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 border border-emerald-200 text-xs font-semibold px-2"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Move to Customers</span>
                          </button>

                          {/* WhatsApp */}
                          {whatsappTarget && (
                            <button 
                              onClick={() => handleSendWhatsApp(lead)}
                              title="Send WhatsApp Message"
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          )}

                          {/* Gmail */}
                          {lead.email && (
                            <button
                              onClick={() => handleOpenGmail(lead)}
                              title="Send Gmail Email"
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                          )}

                          {/* Edit */}
                          <button 
                            onClick={() => openEditModal(lead)}
                            title="Edit Lead"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Delete */}
                          <button 
                            onClick={() => handleDeleteLead(lead.id, lead.customerName)}
                            title="Delete Lead"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duplicate Customer / Lead Detection Modal */}
      <AnimatePresence>
        {duplicateWarning?.isOpen && duplicateWarning.matchedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-amber-200"
            >
              <div className="p-6 bg-amber-50/80 border-b border-amber-200 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Existing Customer Detected
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    We found a matching {duplicateWarning.type === 'customer' ? 'Customer Database record' : 'Lead'} with identical {duplicateWarning.matchField}.
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Matched Details */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Record Type:</span>
                    <span className="font-bold uppercase tracking-wider text-indigo-700">
                      {duplicateWarning.type === 'customer' ? 'Customer Database' : 'Active Lead'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Name:</span>
                    <span className="font-bold text-gray-900">
                      {duplicateWarning.matchedRecord.name || duplicateWarning.matchedRecord.customerName}
                    </span>
                  </div>
                  {(duplicateWarning.matchedRecord.phone || duplicateWarning.matchedRecord.phoneNumber) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Phone:</span>
                      <span className="text-gray-900 font-mono">
                        {duplicateWarning.matchedRecord.phone || duplicateWarning.matchedRecord.phoneNumber}
                      </span>
                    </div>
                  )}
                  {duplicateWarning.matchedRecord.email && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Email:</span>
                      <span className="text-gray-900">{duplicateWarning.matchedRecord.email}</span>
                    </div>
                  )}
                </div>

                {/* 3 Explicit Choices requested by user */}
                <div className="space-y-2 pt-2">
                  {/* Choice 1: Open Existing */}
                  <button
                    onClick={() => {
                      const rec = duplicateWarning.matchedRecord;
                      setDuplicateWarning(null);
                      setIsFormModalOpen(false);
                      if (duplicateWarning.type === 'customer') {
                        navigate('/customers');
                      } else if (rec) {
                        setSelectedLeadForTimeline(rec as Lead);
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Open Existing {duplicateWarning.type === 'customer' ? 'Customer' : 'Lead'}</span>
                  </button>

                  {/* Choice 2: Update Existing */}
                  <button
                    onClick={async () => {
                      const rec = duplicateWarning.matchedRecord;
                      const pending = duplicateWarning.pendingFormData;
                      setDuplicateWarning(null);
                      setIsFormModalOpen(false);

                      if (duplicateWarning.type === 'lead' && rec) {
                        await saveLeadToFirestore(pending, rec as Lead);
                      } else {
                        // Redirect to customers or update
                        showToast('success', 'Customer record updated.');
                        navigate('/customers');
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className="h-4 w-4 text-gray-600" />
                    <span>Update Existing Record with New Message</span>
                  </button>

                  {/* Choice 3: Create New Anyway */}
                  <button
                    onClick={async () => {
                      const pending = duplicateWarning.pendingFormData;
                      setDuplicateWarning(null);
                      await saveLeadToFirestore(pending, null);
                    }}
                    className="w-full py-2 px-4 rounded-xl text-gray-500 hover:text-gray-700 text-xs font-medium text-center transition"
                  >
                    Create New Lead Anyway
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart Lead Creation & Edit Modal (No manual score/status inputs!) */}
      <AnimatePresence>
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 my-auto"
            >
              {/* 1. Fixed Header */}
              <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-gray-50/90 shrink-0">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>{editingLead ? 'Edit Lead Details' : 'Add New Customer Lead'}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    AI will automatically determine purchase intent score and classify business status.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsFormModalOpen(false)} 
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form wrapping scrollable body and sticky footer */}
              <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* 2. Scrollable Body */}
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Customer Name *
                    </label>
                    <input 
                      required 
                      type="text" 
                      placeholder="e.g. Michael Harris"
                      value={formData.customerName} 
                      onChange={e => setFormData({...formData, customerName: e.target.value})} 
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900 shadow-2xs" 
                    />
                  </div>

                  {/* Phone & WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Phone Number *
                      </label>
                      <input 
                        type="text" 
                        placeholder="+1 555 0192"
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900 shadow-2xs" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        <span>WhatsApp Number</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="Same as phone"
                        value={formData.whatsappNumber} 
                        onChange={e => setFormData({...formData, whatsappNumber: e.target.value})} 
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm text-gray-900 shadow-2xs" 
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Email Address (Optional)
                    </label>
                    <input 
                      type="email" 
                      placeholder="michael@example.com"
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900 shadow-2xs" 
                    />
                  </div>

                  {/* Product / Service Interest */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Product / Service Interest
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Leather Jacket Size M, Web Design Package"
                      value={formData.productInterest} 
                      onChange={e => setFormData({...formData, productInterest: e.target.value})} 
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900 shadow-2xs" 
                    />
                  </div>

                  {/* Customer Message / Inquiry */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Customer Message / Inquiry
                    </label>
                    <textarea 
                      rows={3} 
                      placeholder="e.g. 'I want to buy today, can you send the price details?' or 'Is this stock unavailable?'"
                      value={formData.message} 
                      onChange={e => setFormData({...formData, message: e.target.value})} 
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none resize-none text-sm text-gray-900 shadow-2xs"
                    ></textarea>
                  </div>

                  {/* Dynamic AI Lead Score Card (Compact with View Details Accordion) */}
                  <LeadScoreCard
                    input={{
                      phone: formData.phone,
                      whatsappNumber: formData.whatsappNumber,
                      email: formData.email,
                      productInterest: formData.productInterest,
                      message: formData.message
                    }}
                    defaultExpanded={false}
                  />
                </div>

                {/* 3. Sticky / Fixed Footer (Always visible) */}
                <div className="p-4 sm:p-5 border-t border-gray-200/80 bg-gray-50/90 shrink-0 flex items-center justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsFormModalOpen(false)} 
                    className="px-4 py-2.5 text-gray-700 font-semibold hover:bg-gray-100 border border-gray-300 bg-white rounded-xl text-sm transition shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isAiAnalyzing}
                    className="px-5 py-2.5 bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 rounded-xl text-sm shadow-sm flex items-center gap-2 transition"
                  >
                    {isAiAnalyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Analyzing & Saving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>{editingLead ? 'Update Lead' : 'Save & Classify Lead'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lead Timeline & Full History Details Modal */}
      <AnimatePresence>
        {selectedLeadForTimeline && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 bg-gray-50/80 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedLeadForTimeline.customerName}
                    </h3>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${getBusinessStatusStyle(selectedLeadForTimeline.status).badge}`}>
                      {selectedLeadForTimeline.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                    {(selectedLeadForTimeline.phone || selectedLeadForTimeline.whatsappNumber) && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {selectedLeadForTimeline.whatsappNumber || selectedLeadForTimeline.phone}
                      </span>
                    )}
                    {selectedLeadForTimeline.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        {selectedLeadForTimeline.email}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedLeadForTimeline(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content Scroll Area */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Score & Quick Actions Bar */}
                <div className="space-y-3">
                  <LeadScoreCard
                    input={{
                      phone: selectedLeadForTimeline.phone || selectedLeadForTimeline.phoneNumber || '',
                      whatsappNumber: selectedLeadForTimeline.whatsappNumber || '',
                      email: selectedLeadForTimeline.email || '',
                      productInterest: selectedLeadForTimeline.productInterest || '',
                      message: selectedLeadForTimeline.message || selectedLeadForTimeline.notes || ''
                    }}
                    defaultExpanded={false}
                  />

                  <div className="flex items-center justify-end gap-2">
                    {selectedLeadForTimeline.whatsappNumber && (
                      <button
                        onClick={() => handleSendWhatsApp(selectedLeadForTimeline)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Send WhatsApp</span>
                      </button>
                    )}
                    {selectedLeadForTimeline.email && (
                      <button
                        onClick={() => handleOpenGmail(selectedLeadForTimeline)}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                      >
                        <Mail className="h-4 w-4" />
                        <span>Send Email</span>
                      </button>
                    )}
                    <button
                      onClick={() => openConvertModal(selectedLeadForTimeline)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Convert to Customer</span>
                    </button>
                  </div>
                </div>

                {/* Add Timeline Note / Update Status Form */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Log Customer Interaction or Update Status</span>
                  </h4>
                  <form onSubmit={handleAddTimelineNote} className="space-y-3">
                    <textarea
                      rows={2}
                      placeholder="e.g. Called customer, shared price quotation of $120. Customer requested callback on Friday."
                      value={newTimelineNote}
                      onChange={(e) => setNewTimelineNote(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 bg-white outline-none focus:ring-2 focus:ring-indigo-600"
                    ></textarea>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 font-medium">Update Status to:</span>
                        <select
                          value={newTimelineStatus}
                          onChange={(e) => setNewTimelineStatus(e.target.value)}
                          className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 font-medium outline-none"
                        >
                          <option value="">Keep current ({selectedLeadForTimeline.status})</option>
                          {BUSINESS_LEAD_STATUSES.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingTimelineNote || !newTimelineNote.trim()}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition"
                      >
                        {isSubmittingTimelineNote ? 'Saving...' : 'Add Note to Timeline'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Chronological Timeline History */}
                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <History className="h-4 w-4 text-indigo-600" />
                    <span>Full Activity & Communication History</span>
                  </h4>

                  <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {/* Status Changes */}
                    {selectedLeadForTimeline.statusHistory && selectedLeadForTimeline.statusHistory.length > 0 && selectedLeadForTimeline.statusHistory.map((item, idx) => (
                      <div key={item.id || idx} className="relative flex items-start gap-3">
                        <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-indigo-100 border-2 border-indigo-600 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200 flex-1 shadow-2xs">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-gray-900">Status Changed to {item.status}</span>
                            <span className="text-gray-400">{formatDateTime(item.timestamp)}</span>
                          </div>
                          {item.note && (
                            <p className="text-xs text-gray-600">{item.note}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Follow-Ups & Inquiries */}
                    {selectedLeadForTimeline.followUpHistory && selectedLeadForTimeline.followUpHistory.map((item, idx) => (
                      <div key={item.id || idx} className="relative flex items-start gap-3">
                        <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-100 border-2 border-emerald-600 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-200 flex-1 shadow-2xs">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-emerald-800">{item.channel || 'Outreach / Note'}</span>
                            <span className="text-gray-400">{item.date}</span>
                          </div>
                          <p className="text-xs text-gray-700 font-medium mb-0.5">{item.summary}</p>
                          <p className="text-xs text-gray-500 whitespace-pre-wrap">{item.note}</p>
                        </div>
                      </div>
                    ))}

                    {/* Lead Creation Event */}
                    <div className="relative flex items-start gap-3">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-gray-100 border-2 border-gray-400 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-gray-900">Lead Created in System</span>
                          <span className="text-gray-400">{formatDateTime(selectedLeadForTimeline.createdAt)}</span>
                        </div>
                        {selectedLeadForTimeline.productInterest && (
                          <p className="text-xs text-gray-600">Product Interest: {selectedLeadForTimeline.productInterest}</p>
                        )}
                        {selectedLeadForTimeline.message && (
                          <p className="text-xs text-gray-500 italic mt-1">"{selectedLeadForTimeline.message}"</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Convert to Customer Database Modal */}
      <AnimatePresence>
        {convertingLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-200"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-emerald-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Move Lead to Customer Database
                    </h3>
                    <p className="text-xs text-gray-500">
                      Retain {convertingLead.customerName}'s records and past follow-ups forever.
                    </p>
                  </div>
                </div>
                <button onClick={() => setConvertingLead(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleExecuteConversion} className="p-6 space-y-4">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs space-y-1">
                  <p className="font-semibold text-gray-900">Customer: {convertingLead.customerName}</p>
                  <p className="text-gray-500">Phone/WhatsApp: {convertingLead.whatsappNumber || convertingLead.phone || 'N/A'}</p>
                  <p className="text-gray-500">Email: {convertingLead.email || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ShoppingBag className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Purchased Product or Service</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Leather Jacket, Premium Package"
                    value={convertData.item}
                    onChange={(e) => setConvertData({ ...convertData, item: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Deal Amount ($)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 250"
                      value={convertData.amount}
                      onChange={(e) => setConvertData({ ...convertData, amount: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      value={convertData.date}
                      onChange={(e) => setConvertData({ ...convertData, date: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Closing Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Agreement details, customer preferences..."
                    value={convertData.notes}
                    onChange={(e) => setConvertData({ ...convertData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none text-sm text-gray-900 resize-none"
                  />
                </div>

                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-2xs text-emerald-800 leading-relaxed">
                  ✓ Automatically updates lead status to <strong>Customer Purchased</strong>.<br />
                  ✓ Saves customer permanently into <strong>Customers</strong> database collection.<br />
                  ✓ Retains full timeline of follow-ups and messages.
                </div>

                <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setConvertingLead(null)}
                    className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isConverting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm shadow-sm flex items-center gap-1.5"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>{isConverting ? 'Moving to Customers...' : 'Confirm & Move to Database'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Firebase Diagnostic Modal */}
      <FirebaseDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
      />

      {/* Gmail Outreach Modal */}
      <GmailEmailModal
        isOpen={gmailModal.isOpen}
        onClose={() => setGmailModal(prev => ({ ...prev, isOpen: false }))}
        recipientEmail={gmailModal.email}
        recipientName={gmailModal.name}
        defaultSubject={gmailModal.subject}
        defaultBody={gmailModal.body}
        leadId={gmailModal.leadId}
        onEmailSent={() => {
          showToast('success', `Email sent via Gmail to ${gmailModal.email}!`);
        }}
      />
    </DashboardLayout>
  );
}
