import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardLayout from '../components/DashboardLayout';
import { 
  Users, 
  Search, 
  Plus, 
  MessageSquare, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  Sparkles, 
  Edit2, 
  Trash2, 
  X, 
  ExternalLink, 
  Download, 
  Award, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Check,
  Send,
  History,
  Tag,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, PurchaseRecord, FollowupRecord, BusinessProfileData } from '../types';
import { formatWhatsAppUrl, handleFirestoreError, formatDateTime, getRelativeTime } from '../lib/firestoreUtils';
import GmailEmailModal from '../components/GmailEmailModal';

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'VIP' | 'Inactive' | 'Recent' | 'Reengage'>('All');
  const [sortBy, setSortBy] = useState<'lastContact-desc' | 'lastContact-asc' | 'spend-desc' | 'name-asc'>('lastContact-desc');
  
  // Gmail Outreach Modal from Customer View
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [gmailModalProps, setGmailModalProps] = useState<{
    recipientEmail?: string;
    recipientName?: string;
    customerId?: string;
    defaultSubject?: string;
    defaultBody?: string;
    initialType?: 'follow_up' | 'promotional' | 'thank_you';
  }>({});
  
  // Selected Customer for detail modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailTab, setDetailTab] = useState<'history' | 'purchases' | 'reengage' | 'info'>('history');
  
  // Add / Edit Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    status: 'Active',
    notes: '',
    initialItem: '',
    initialAmount: ''
  });

  // Add Purchase Modal / Form state
  const [newPurchase, setNewPurchase] = useState({
    item: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [isAddingPurchase, setIsAddingPurchase] = useState(false);

  // Add Followup / Interaction state
  const [newFollowup, setNewFollowup] = useState({
    channel: 'WhatsApp',
    date: new Date().toISOString().split('T')[0],
    note: '',
    summary: ''
  });
  const [isAddingFollowup, setIsAddingFollowup] = useState(false);

  // AI Re-engagement Generator state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReengagement, setAiReengagement] = useState<{
    subject: string;
    message: string;
    whatsappText: string;
    callToAction: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Business profile for AI context
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileData | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Real-time Firestore subscription to customers collection
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    console.log(`[Customers] Subscribing to customers collection for userId: ${user.uid}`);

    const q = query(
      collection(db, 'customers'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Customer[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const purchaseHistory: PurchaseRecord[] = Array.isArray(data.purchaseHistory) ? data.purchaseHistory : [];
          const followupHistory: FollowupRecord[] = Array.isArray(data.followupHistory) ? data.followupHistory : [];
          
          const totalSpend = purchaseHistory.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

          return {
            id: docSnap.id,
            name: data.name || data.customerName || 'Customer',
            customerName: data.name || data.customerName || 'Customer',
            email: data.email || '',
            phone: data.phone || data.phoneNumber || '',
            phoneNumber: data.phone || data.phoneNumber || '',
            whatsappNumber: data.whatsappNumber || data.phone || data.phoneNumber || '',
            purchaseHistory,
            followupHistory,
            lastContactDate: data.lastContactDate || '',
            notes: data.notes || '',
            status: data.status || (purchaseHistory.length > 2 || totalSpend > 500 ? 'VIP' : 'Active'),
            tags: Array.isArray(data.tags) ? data.tags : [],
            totalPurchases: purchaseHistory.length,
            totalSpend,
            sourceLeadId: data.sourceLeadId || '',
            userId: data.userId || user.uid,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          };
        });

        console.log(`[Customers] Loaded ${items.length} customer records.`);
        setCustomers(items);
        
        // Update selected customer if open
        if (selectedCustomer) {
          const updated = items.find(c => c.id === selectedCustomer.id);
          if (updated) setSelectedCustomer(updated);
        }
        
        setLoading(false);
      },
      (error) => {
        const errorDetail = handleFirestoreError(error, 'Customers subscription');
        console.error('[Customers subscription error]:', error);
        showToast('error', errorDetail);
        setLoading(false);
      }
    );

    // Fetch Business Profile once
    getDoc(doc(db, 'business_profile', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          setBusinessProfile(snap.data() as BusinessProfileData);
        }
      })
      .catch((err) => handleFirestoreError(err, 'Customers business profile'));

    return () => unsubscribe();
  }, [user]);

  // Compute Metrics
  const totalCustomersCount = customers.length;
  const vipCount = customers.filter(c => c.status === 'VIP' || (c.totalSpend || 0) >= 500).length;
  const totalLifetimeRevenue = customers.reduce((acc, c) => acc + (c.totalSpend || 0), 0);
  const totalRecordedPurchases = customers.reduce((acc, c) => acc + (c.purchaseHistory?.length || 0), 0);

  // Filter & Search
  const filteredCustomers = customers.filter((customer) => {
    const term = searchQuery.toLowerCase().trim();
    const matchesSearch = !term || (
      customer.name.toLowerCase().includes(term) ||
      (customer.email && customer.email.toLowerCase().includes(term)) ||
      (customer.phone && customer.phone.toLowerCase().includes(term)) ||
      (customer.whatsappNumber && customer.whatsappNumber.includes(term)) ||
      (customer.purchaseHistory && customer.purchaseHistory.some(p => p.item.toLowerCase().includes(term)))
    );

    if (!matchesSearch) return false;

    if (statusFilter === 'All') return true;
    if (statusFilter === 'VIP') return customer.status === 'VIP' || (customer.totalSpend || 0) >= 500;
    if (statusFilter === 'Active') return customer.status === 'Active' || !customer.status;
    if (statusFilter === 'Inactive') return customer.status === 'Inactive';
    
    // Time based filters
    if (statusFilter === 'Recent') {
      if (!customer.lastContactDate) return false;
      const contactTime = new Date(customer.lastContactDate).getTime();
      const diffDays = (Date.now() - contactTime) / (1000 * 60 * 60 * 24);
      return diffDays <= 30;
    }

    if (statusFilter === 'Reengage') {
      if (!customer.lastContactDate) return true;
      const contactTime = new Date(customer.lastContactDate).getTime();
      const diffDays = (Date.now() - contactTime) / (1000 * 60 * 60 * 24);
      return diffDays > 60;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'lastContact-desc') {
      const timeA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
      const timeB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
      return timeB - timeA;
    }
    if (sortBy === 'lastContact-asc') {
      const timeA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
      const timeB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
      return timeA - timeB;
    }
    if (sortBy === 'spend-desc') {
      return (b.totalSpend || 0) - (a.totalSpend || 0);
    }
    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  // Save / Update Customer
  const handleSaveCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'customers', editingId), {
          name: formData.name.trim(),
          customerName: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          phoneNumber: formData.phone.trim(),
          whatsappNumber: formData.whatsappNumber.trim() || formData.phone.trim(),
          status: formData.status,
          notes: formData.notes.trim(),
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'activities'), {
          userId: user.uid,
          type: 'customer_updated',
          title: `Updated customer record: ${formData.name}`,
          createdAt: serverTimestamp()
        });

        showToast('success', `Customer "${formData.name}" updated.`);
      } else {
        const purchaseHistory: PurchaseRecord[] = [];
        if (formData.initialItem.trim()) {
          purchaseHistory.push({
            id: `purch-${Date.now()}`,
            item: formData.initialItem.trim(),
            amount: Number(formData.initialAmount) || 0,
            date: new Date().toISOString().split('T')[0],
            notes: 'Initial recorded transaction'
          });
        }

        const followupHistory: FollowupRecord[] = [
          {
            id: `init-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            channel: 'Direct Entry',
            note: formData.notes.trim() || 'Created customer profile in database',
            summary: 'Customer profile initialized'
          }
        ];

        const totalSpend = purchaseHistory.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

        await addDoc(collection(db, 'customers'), {
          userId: user.uid,
          name: formData.name.trim(),
          customerName: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          phoneNumber: formData.phone.trim(),
          whatsappNumber: formData.whatsappNumber.trim() || formData.phone.trim(),
          status: formData.status,
          notes: formData.notes.trim(),
          purchaseHistory,
          followupHistory,
          totalPurchases: purchaseHistory.length,
          totalSpend,
          lastContactDate: new Date().toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'activities'), {
          userId: user.uid,
          type: 'customer_created',
          title: `Added new customer: ${formData.name}`,
          createdAt: serverTimestamp()
        });

        showToast('success', `Customer "${formData.name}" added to database!`);
      }

      setIsFormModalOpen(false);
      resetForm();
    } catch (error) {
      const err = handleFirestoreError(error, 'Save customer');
      showToast('error', `Failed to save customer: ${err}`);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to permanently delete customer "${name}" and all associated purchase/followup history?`)) return;

    try {
      await deleteDoc(doc(db, 'customers', id));
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
      }

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        type: 'customer_deleted',
        title: `Deleted customer profile: ${name}`,
        createdAt: serverTimestamp()
      });

      showToast('success', `Customer "${name}" removed.`);
    } catch (error) {
      const err = handleFirestoreError(error, 'Delete customer');
      showToast('error', `Failed to delete customer: ${err}`);
    }
  };

  // Add Purchase Record to Customer
  const handleAddPurchase = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCustomer || !newPurchase.item.trim()) return;

    try {
      const purchaseEntry: PurchaseRecord = {
        id: `purch-${Date.now()}`,
        item: newPurchase.item.trim(),
        amount: Number(newPurchase.amount) || 0,
        date: newPurchase.date || new Date().toISOString().split('T')[0],
        notes: newPurchase.notes.trim()
      };

      const updatedPurchases = [...(selectedCustomer.purchaseHistory || []), purchaseEntry];
      const newTotalSpend = updatedPurchases.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        purchaseHistory: updatedPurchases,
        totalPurchases: updatedPurchases.length,
        totalSpend: newTotalSpend,
        lastContactDate: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      // Also log activity
      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        type: 'purchase_logged',
        title: `Logged purchase of "${purchaseEntry.item}" ($${purchaseEntry.amount}) for ${selectedCustomer.name}`,
        createdAt: serverTimestamp()
      });

      showToast('success', `Purchase recorded for ${selectedCustomer.name}!`);
      setNewPurchase({
        item: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setIsAddingPurchase(false);
    } catch (error) {
      const err = handleFirestoreError(error, 'Add purchase');
      showToast('error', `Failed to add purchase: ${err}`);
    }
  };

  // Log Followup / Interaction to Customer
  const handleAddFollowup = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCustomer || !newFollowup.note.trim()) return;

    try {
      const followupEntry: FollowupRecord = {
        id: `fu-${Date.now()}`,
        date: newFollowup.date || new Date().toISOString().split('T')[0],
        channel: newFollowup.channel || 'WhatsApp',
        note: newFollowup.note.trim(),
        summary: newFollowup.summary.trim() || `${newFollowup.channel} interaction`
      };

      const updatedFollowups = [followupEntry, ...(selectedCustomer.followupHistory || [])];

      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        followupHistory: updatedFollowups,
        lastContactDate: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        type: 'interaction_logged',
        title: `Logged ${newFollowup.channel} interaction with ${selectedCustomer.name}`,
        createdAt: serverTimestamp()
      });

      showToast('success', `Interaction logged for ${selectedCustomer.name}!`);
      setNewFollowup({
        channel: 'WhatsApp',
        date: new Date().toISOString().split('T')[0],
        note: '',
        summary: ''
      });
      setIsAddingFollowup(false);
    } catch (error) {
      const err = handleFirestoreError(error, 'Add interaction');
      showToast('error', `Failed to log interaction: ${err}`);
    }
  };

  // AI Re-engagement Message Generator
  const handleGenerateAIReengagement = async (customer: Customer) => {
    setIsGeneratingAI(true);
    setAiReengagement(null);

    try {
      const response = await fetch('/api/generate-customer-reengagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer.name,
          purchaseHistory: customer.purchaseHistory,
          lastContactDate: customer.lastContactDate ? formatDateTime(customer.lastContactDate) : 'Unknown',
          businessProfile: businessProfile || {
            businessName: 'Our Company',
            category: 'Services & Products'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Server returned an error generating re-engagement.');
      }

      const data = await response.json();
      setAiReengagement(data);
      setDetailTab('reengage');
      showToast('success', `Generated re-engagement strategy for ${customer.name}!`);
    } catch (err: any) {
      console.error('[Customers] AI Re-engagement error:', err);
      showToast('error', 'AI Generator temporarily unavailable. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const openCustomerWhatsApp = (customer: Customer, customText?: string) => {
    const target = customer.whatsappNumber || customer.phone;
    const defaultMsg = customText || `Hi ${customer.name}, we're checking in from ${businessProfile?.businessName || 'our team'}! How are things going with your past order?`;
    const url = formatWhatsAppUrl(target, defaultMsg);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openCustomerEmail = (customer: Customer, customSubject?: string, customBody?: string, type: 'follow_up' | 'promotional' | 'thank_you' = 'follow_up') => {
    if (!customer.email) {
      showToast('error', `No email on file for ${customer.name}`);
      return;
    }
    setGmailModalProps({
      recipientEmail: customer.email,
      recipientName: customer.name,
      customerId: customer.id,
      defaultSubject: customSubject || `Checking in from ${businessProfile?.businessName || 'our team'} - ${customer.name}`,
      defaultBody: customBody || `Hi ${customer.name},\n\nWe hope you are doing well! We wanted to reconnect and see if you need any assistance or have new requirements.\n\nBest regards,\n${businessProfile?.businessName || 'Our Team'}`,
      initialType: type
    });
    setGmailModalOpen(true);
  };

  const exportCSV = () => {
    if (customers.length === 0) {
      alert('No customers to export.');
      return;
    }

    const headers = ['Name', 'Phone', 'WhatsApp', 'Email', 'Status', 'Total Purchases', 'Total Spend ($)', 'Last Contact Date', 'Notes'];
    const rows = customers.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.whatsappNumber || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${c.status || 'Active'}"`,
      c.totalPurchases || 0,
      c.totalSpend || 0,
      `"${c.lastContactDate ? formatDateTime(c.lastContactDate) : ''}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customers_database_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      whatsappNumber: '',
      status: 'Active',
      notes: '',
      initialItem: '',
      initialAmount: ''
    });
  };

  const openEditModal = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || customer.phoneNumber || '',
      whatsappNumber: customer.whatsappNumber || customer.phone || '',
      status: customer.status || 'Active',
      notes: customer.notes || '',
      initialItem: '',
      initialAmount: ''
    });
    setIsFormModalOpen(true);
  };

  return (
    <DashboardLayout title="Customer Database">
      {/* Top Banner & Main Actions */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-gray-600 text-sm">
            Retain completed leads, maintain multi-year purchase & follow-up histories, and re-engage returning buyers.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium text-xs sm:text-sm transition flex items-center gap-2 shadow-2xs"
            title="Export CSV Database"
          >
            <Download className="h-4 w-4 text-gray-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => { resetForm(); setIsFormModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition flex items-center gap-2 shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm transition-all ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">{totalCustomersCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">VIP & Regulars</p>
              <p className="text-xl font-bold text-gray-900">{vipCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Revenue</p>
              <p className="text-xl font-bold text-gray-900">${totalLifetimeRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="bg-purple-50 p-2.5 rounded-xl text-purple-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchases Logged</p>
              <p className="text-xl font-bold text-gray-900">{totalRecordedPurchases}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, WhatsApp, email, or purchased product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none font-medium text-gray-700"
            >
              <option value="lastContact-desc">Last Contacted (Newest)</option>
              <option value="lastContact-asc">Last Contacted (Oldest)</option>
              <option value="spend-desc">Highest Total Spend</option>
              <option value="name-asc">Customer Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs sm:text-sm">
          {[
            { id: 'All', label: 'All Customers', count: customers.length },
            { id: 'Active', label: 'Active', count: customers.filter(c => c.status === 'Active').length },
            { id: 'VIP', label: 'VIP / High Value', count: vipCount },
            { id: 'Recent', label: 'Contacted (<30d)', count: customers.filter(c => {
              if (!c.lastContactDate) return false;
              return (Date.now() - new Date(c.lastContactDate).getTime()) / (1000 * 60 * 60 * 24) <= 30;
            }).length },
            { id: 'Reengage', label: 'Re-engage (>60d)', count: customers.filter(c => {
              if (!c.lastContactDate) return true;
              return (Date.now() - new Date(c.lastContactDate).getTime()) / (1000 * 60 * 60 * 24) > 60;
            }).length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${
                statusFilter === tab.id ? 'bg-indigo-700 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Customers List / Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-2xs">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {searchQuery || statusFilter !== 'All' ? 'No matching customers found' : 'No customers in database yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'All'
              ? 'Try changing your search keywords or filter criteria.'
              : 'When you complete leads on the Leads page, they will automatically be moved here with their full purchase and follow-up history saved forever.'}
          </p>
          <button
            onClick={() => { resetForm(); setIsFormModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-2xs inline-flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Add First Customer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCustomers.map((customer) => {
            const whatsappNumber = customer.whatsappNumber || customer.phone;
            const isVip = customer.status === 'VIP' || (customer.totalSpend || 0) >= 500;
            const purchasesCount = customer.purchaseHistory?.length || 0;
            const followupsCount = customer.followupHistory?.length || 0;
            const lastPurchase = customer.purchaseHistory && customer.purchaseHistory.length > 0
              ? customer.purchaseHistory[customer.purchaseHistory.length - 1]
              : null;

            return (
              <div
                key={customer.id}
                className="bg-white rounded-2xl border border-gray-200 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors">
                          {customer.name}
                        </h4>
                        {isVip && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Award className="h-3 w-3 text-amber-600" /> VIP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>Last Contact: </span>
                        <strong className="text-gray-700 font-semibold">{getRelativeTime(customer.lastContactDate)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(customer)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                        title="Edit Customer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete Record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Chips */}
                  <div className="space-y-1.5 my-3 text-xs">
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {whatsappNumber && (
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">WhatsApp: {whatsappNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Purchase Summary */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500 flex items-center gap-1 font-medium">
                        <ShoppingBag className="h-3.5 w-3.5 text-indigo-600" /> Purchase History:
                      </span>
                      <span className="font-bold text-gray-900">
                        {purchasesCount} {purchasesCount === 1 ? 'order' : 'orders'} (${(customer.totalSpend || 0).toLocaleString()})
                      </span>
                    </div>
                    {lastPurchase ? (
                      <p className="text-xs text-gray-600 truncate mt-1">
                        <span className="text-gray-400">Latest:</span> {lastPurchase.item} {lastPurchase.amount ? `($${lastPurchase.amount})` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No purchase item logged yet</p>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="bg-gray-50/70 border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp Action */}
                    {whatsappNumber && (
                      <button
                        onClick={() => openCustomerWhatsApp(customer)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition"
                        title="Open WhatsApp chat"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Chat</span>
                      </button>
                    )}

                    {/* Email Action */}
                    {customer.email && (
                      <button
                        onClick={() => openCustomerEmail(customer)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition"
                        title="Send Email"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>Email</span>
                      </button>
                    )}

                    {/* AI Re-engage */}
                    <button
                      onClick={() => { setSelectedCustomer(customer); handleGenerateAIReengagement(customer); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition"
                      title="AI Re-engagement Follow-up"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">AI Re-engage</span>
                    </button>
                  </div>

                  <button
                    onClick={() => { setSelectedCustomer(customer); setDetailTab('history'); }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                  >
                    <span>Full Profile</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-gray-900/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-200 my-auto max-h-[90vh] flex flex-col"
            >
              {/* Modal Top Header */}
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-indigo-50/40 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      selectedCustomer.status === 'VIP' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedCustomer.status || 'Active'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500 mt-2">
                    {selectedCustomer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-gray-400" /> {selectedCustomer.phone}
                      </span>
                    )}
                    {selectedCustomer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-gray-400" /> {selectedCustomer.email}
                      </span>
                    )}
                    {selectedCustomer.whatsappNumber && (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> {selectedCustomer.whatsappNumber}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-gray-400" /> Last Contact: {formatDateTime(selectedCustomer.lastContactDate)} ({getRelativeTime(selectedCustomer.lastContactDate)})
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="px-6 border-b border-gray-200 bg-white flex items-center gap-4 text-sm font-medium overflow-x-auto">
                <button
                  onClick={() => setDetailTab('history')}
                  className={`py-3.5 border-b-2 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                    detailTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>Follow-Up & Contact History ({selectedCustomer.followupHistory?.length || 0})</span>
                </button>

                <button
                  onClick={() => setDetailTab('purchases')}
                  className={`py-3.5 border-b-2 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                    detailTab === 'purchases' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Purchase History ({selectedCustomer.purchaseHistory?.length || 0})</span>
                </button>

                <button
                  onClick={() => setDetailTab('reengage')}
                  className={`py-3.5 border-b-2 font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                    detailTab === 'reengage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>AI Re-engagement</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* TAB 1: Follow-up & Contact History */}
                {detailTab === 'history' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Communication Timeline
                      </h4>
                      <button
                        onClick={() => setIsAddingFollowup(!isAddingFollowup)}
                        className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isAddingFollowup ? 'Cancel Log' : 'Log New Interaction'}</span>
                      </button>
                    </div>

                    {/* Quick Log Form */}
                    {isAddingFollowup && (
                      <form onSubmit={handleAddFollowup} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                        <h5 className="text-xs font-bold text-gray-700 uppercase">Log Contact or Conversation</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-2xs font-bold text-gray-600 uppercase mb-1">Channel</label>
                            <select
                              value={newFollowup.channel}
                              onChange={(e) => setNewFollowup({ ...newFollowup, channel: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-600"
                            >
                              <option value="WhatsApp">WhatsApp</option>
                              <option value="Email">Email</option>
                              <option value="Phone Call">Phone Call</option>
                              <option value="In-Person / Store">In-Person / Store</option>
                              <option value="Support / Other">Support / Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-2xs font-bold text-gray-600 uppercase mb-1">Date</label>
                            <input
                              type="date"
                              value={newFollowup.date}
                              onChange={(e) => setNewFollowup({ ...newFollowup, date: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-2xs font-bold text-gray-600 uppercase mb-1">Notes / Conversation Summary *</label>
                          <textarea
                            required
                            rows={2}
                            placeholder="What was discussed? (e.g. Sent invoice, answered pricing questions, customer requested quote in 2 weeks)..."
                            value={newFollowup.note}
                            onChange={(e) => setNewFollowup({ ...newFollowup, note: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingFollowup(false)}
                            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-2xs"
                          >
                            Save Log
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Timeline entries */}
                    {selectedCustomer.followupHistory && selectedCustomer.followupHistory.length > 0 ? (
                      <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-gray-200">
                        {selectedCustomer.followupHistory.map((entry, idx) => (
                          <div key={entry.id || idx} className="relative flex items-start gap-4 pl-8">
                            <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white shadow-2xs"></div>
                            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 flex-1">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-bold text-gray-900 flex items-center gap-1.5">
                                  <Tag className="h-3 w-3 text-indigo-500" />
                                  {entry.channel || 'Interaction'}
                                </span>
                                <span className="text-gray-400 font-medium">{formatDateTime(entry.date)}</span>
                              </div>
                              <p className="text-xs text-gray-700 whitespace-pre-line mt-1">{entry.note}</p>
                              {entry.summary && entry.summary !== entry.note && (
                                <p className="text-2xs text-gray-400 mt-1 italic">Summary: {entry.summary}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-4 text-center">
                        No previous follow-up history found. Click "Log New Interaction" to record contact notes.
                      </p>
                    )}
                  </div>
                )}

                {/* TAB 2: Purchase History */}
                {detailTab === 'purchases' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                          Lifetime Purchases (${(selectedCustomer.totalSpend || 0).toLocaleString()} Total)
                        </h4>
                      </div>
                      <button
                        onClick={() => setIsAddingPurchase(!isAddingPurchase)}
                        className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isAddingPurchase ? 'Cancel' : 'Record New Purchase'}</span>
                      </button>
                    </div>

                    {/* Add Purchase Form */}
                    {isAddingPurchase && (
                      <form onSubmit={handleAddPurchase} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                        <h5 className="text-xs font-bold text-gray-700 uppercase">Add Transaction Record</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-2xs font-bold text-gray-600 uppercase mb-1">Product / Service Item *</label>
                            <input
                              required
                              type="text"
                              placeholder="e.g. Annual Maintenance, Pro Suite License"
                              value={newPurchase.item}
                              onChange={(e) => setNewPurchase({ ...newPurchase, item: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                          </div>
                          <div>
                            <label className="block text-2xs font-bold text-gray-600 uppercase mb-1">Amount ($)</label>
                            <input
                              type="number"
                              placeholder="e.g. 250"
                              value={newPurchase.amount}
                              onChange={(e) => setNewPurchase({ ...newPurchase, amount: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-2xs font-bold text-gray-600 uppercase mb-1">Date</label>
                            <input
                              type="date"
                              value={newPurchase.date}
                              onChange={(e) => setNewPurchase({ ...newPurchase, date: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                          </div>
                          <div>
                            <label className="block text-2xs font-bold text-gray-600 uppercase mb-1">Invoice / Notes</label>
                            <input
                              type="text"
                              placeholder="Optional invoice # or reference"
                              value={newPurchase.notes}
                              onChange={(e) => setNewPurchase({ ...newPurchase, notes: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingPurchase(false)}
                            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-2xs"
                          >
                            Add to Purchase History
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Purchases Table / List */}
                    {selectedCustomer.purchaseHistory && selectedCustomer.purchaseHistory.length > 0 ? (
                      <div className="overflow-hidden border border-gray-200 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                            <tr>
                              <th className="p-3">Date</th>
                              <th className="p-3">Item / Service</th>
                              <th className="p-3 text-right">Amount</th>
                              <th className="p-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedCustomer.purchaseHistory.map((p, i) => (
                              <tr key={p.id || i} className="hover:bg-gray-50/80">
                                <td className="p-3 font-medium text-gray-500">{formatDateTime(p.date)}</td>
                                <td className="p-3 font-bold text-gray-900">{p.item}</td>
                                <td className="p-3 text-right font-bold text-emerald-600">
                                  ${(Number(p.amount) || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-gray-500">{p.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-4 text-center">
                        No purchase records logged yet. Click "Record New Purchase" above.
                      </p>
                    )}
                  </div>
                )}

                {/* TAB 3: AI Re-engagement Generator */}
                {detailTab === 'reengage' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          <span>Personalized Re-engagement Strategy</span>
                        </h4>
                        <p className="text-xs text-gray-500">
                          AI generates a targeted check-in message addressing their past purchase history.
                        </p>
                      </div>

                      <button
                        disabled={isGeneratingAI}
                        onClick={() => handleGenerateAIReengagement(selectedCustomer)}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-2xs"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{isGeneratingAI ? 'Crafting AI Copy...' : 'Regenerate'}</span>
                      </button>
                    </div>

                    {isGeneratingAI ? (
                      <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-8 text-center space-y-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="text-xs font-bold text-purple-900">Crafting tailored re-engagement copy...</p>
                        <p className="text-2xs text-purple-600">
                          Analyzing {selectedCustomer.name}'s purchase history and business offerings.
                        </p>
                      </div>
                    ) : aiReengagement ? (
                      <div className="space-y-4">
                        {/* Email draft */}
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-blue-600" /> Email Subject & Message
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyToClipboard(aiReengagement.message, 'email-msg')}
                                className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
                              >
                                {copiedKey === 'email-msg' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                <span>Copy</span>
                              </button>
                              {selectedCustomer.email && (
                                <button
                                  onClick={() => openCustomerEmail(selectedCustomer, aiReengagement.subject, aiReengagement.message)}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs"
                                >
                                  <Send className="h-3 w-3" /> Send Email
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-2xs font-bold text-gray-400 uppercase">Subject</span>
                            <p className="text-xs font-bold text-gray-900 bg-white p-2.5 rounded-lg border border-gray-200">
                              {aiReengagement.subject}
                            </p>
                          </div>
                          <div>
                            <span className="text-2xs font-bold text-gray-400 uppercase">Body</span>
                            <div className="text-xs text-gray-800 bg-white p-3 rounded-lg border border-gray-200 whitespace-pre-line leading-relaxed">
                              {aiReengagement.message}
                            </div>
                          </div>
                        </div>

                        {/* WhatsApp draft */}
                        <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp Message
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyToClipboard(aiReengagement.whatsappText, 'wa-msg')}
                                className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                              >
                                {copiedKey === 'wa-msg' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                <span>Copy</span>
                              </button>
                              {(selectedCustomer.whatsappNumber || selectedCustomer.phone) && (
                                <button
                                  onClick={() => openCustomerWhatsApp(selectedCustomer, aiReengagement.whatsappText)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs"
                                >
                                  <Send className="h-3 w-3" /> Open in WhatsApp
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-800 bg-white p-3 rounded-lg border border-emerald-200 whitespace-pre-line">
                            {aiReengagement.whatsappText}
                          </div>
                          {aiReengagement.callToAction && (
                            <div className="text-2xs text-emerald-800 bg-emerald-100/60 px-3 py-1.5 rounded-lg">
                              <strong>Recommended CTA:</strong> {aiReengagement.callToAction}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                        <Sparkles className="h-8 w-8 text-purple-500 mx-auto" />
                        <h5 className="text-sm font-bold text-gray-900">Ready to re-engage {selectedCustomer.name}?</h5>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto">
                          Click below to automatically generate customized communication based on their past orders and time elapsed.
                        </p>
                        <button
                          onClick={() => handleGenerateAIReengagement(selectedCustomer)}
                          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition inline-flex items-center gap-2 shadow-2xs"
                        >
                          <Sparkles className="h-4 w-4" /> Generate Re-engagement Outreach
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(selectedCustomer.whatsappNumber || selectedCustomer.phone) && (
                    <button
                      onClick={() => openCustomerWhatsApp(selectedCustomer)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Chat
                    </button>
                  )}
                  {selectedCustomer.email && (
                    <button
                      onClick={() => openCustomerEmail(selectedCustomer)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Customer Modal */}
      <AnimatePresence>
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-200"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingId ? 'Edit Customer Details' : 'Add Customer to Database'}
                </h3>
                <button onClick={() => setIsFormModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 max-h-[80vh] overflow-y-auto">
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Customer Name *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Alex Morgan"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900"
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
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder="+1 555-0188"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                      <span>WhatsApp Number</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 14155552671 (with country code)"
                      value={formData.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Customer Tier / Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none bg-white text-sm text-gray-900"
                    >
                      <option value="Active">Active</option>
                      <option value="VIP">VIP / Priority Buyer</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  {!editingId && (
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-3">
                      <p className="text-xs font-bold text-gray-700 uppercase">Initial Purchase Record (Optional)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <input
                            type="text"
                            placeholder="Purchased item/service"
                            value={formData.initialItem}
                            onChange={(e) => setFormData({ ...formData, initialItem: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            placeholder="Amount ($)"
                            value={formData.initialAmount}
                            onChange={(e) => setFormData({ ...formData, initialAmount: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Notes / Customer Details
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Special preferences, delivery address, reference details..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none resize-none text-sm text-gray-900"
                    />
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsFormModalOpen(false)}
                      className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-50 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg text-sm shadow-sm"
                    >
                      {editingId ? 'Update Customer' : 'Save to Database'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gmail Outreach Modal from Customers view */}
      <GmailEmailModal
        isOpen={gmailModalOpen}
        onClose={() => setGmailModalOpen(false)}
        customers={customers}
        {...gmailModalProps}
      />
    </DashboardLayout>
  );
}
