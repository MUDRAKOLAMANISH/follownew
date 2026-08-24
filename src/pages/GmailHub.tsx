import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  Sparkles, 
  User, 
  Calendar, 
  ShieldCheck, 
  Plus,
  Trash2,
  Unlink,
  Check,
  TrendingUp,
  AlertTriangle,
  FileText,
  Clock,
  Gift,
  Heart,
  MessageSquare,
  Users,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  connectGmailAccount, 
  disconnectGmailAccount,
  getStoredGmailConnection,
  getCachedGmailToken, 
  GmailProfile 
} from '../lib/gmailService';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs,
  deleteDoc,
  doc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, Lead, EmailOutreachLog, GmailConnection } from '../types';
import GmailEmailModal from '../components/GmailEmailModal';
import { formatDateTime, getRelativeTime } from '../lib/firestoreUtils';

export default function GmailHub() {
  const { user } = useAuth();
  
  // Connection states
  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [isTokenActive, setIsTokenActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  
  // Outreach Logs state (real-time from emailOutreachLogs)
  const [logs, setLogs] = useState<EmailOutreachLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedLog, setSelectedLog] = useState<EmailOutreachLog | null>(null);
  
  // Customers and leads for quick outreach
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  
  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Modal states
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeProps, setComposeProps] = useState<{
    recipientEmail?: string;
    recipientName?: string;
    customerId?: string;
    leadId?: string;
    defaultSubject?: string;
    defaultBody?: string;
    initialType?: 'follow_up' | 'promotional' | 'thank_you';
  }>({});

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Real-time listener for Gmail Connection & Outreach Logs
  useEffect(() => {
    if (!user) return;

    // Check in-memory token state
    setIsTokenActive(!!getCachedGmailToken());

    // 1. Listen to Gmail connection doc in Firestore: gmailConnections/{userId}
    const unsubConnection = onSnapshot(doc(db, 'gmailConnections', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as GmailConnection;
        setConnection(data);
        if (data.status === 'connected' && getCachedGmailToken()) {
          setIsTokenActive(true);
        } else if (data.status === 'disconnected' || data.status === 'expired') {
          setIsTokenActive(false);
        }
      } else {
        setConnection(null);
        setIsTokenActive(false);
      }
    });

    // 2. Real-time listener for emailOutreachLogs
    const logsQuery = query(
      collection(db, 'emailOutreachLogs'),
      where('userId', '==', user.uid),
      orderBy('sentAt', 'desc')
    );

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const fetched: EmailOutreachLog[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as EmailOutreachLog));
      setLogs(fetched);
      setLoadingLogs(false);
    }, (error) => {
      console.error('Error listening to emailOutreachLogs:', error);
      setLoadingLogs(false);
    });

    // 3. Fetch Customers
    const fetchCustomers = async () => {
      try {
        const custSnap = await getDocs(query(collection(db, 'customers'), where('userId', '==', user.uid)));
        const custList: Customer[] = custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
        setCustomers(custList);
      } catch (e) {
        console.error('Error fetching customers:', e);
      } finally {
        setLoadingCustomers(false);
      }
    };

    // 4. Fetch Leads
    const fetchLeads = async () => {
      try {
        const leadSnap = await getDocs(query(collection(db, 'leads'), where('userId', '==', user.uid)));
        const leadList: Lead[] = leadSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lead));
        setLeads(leadList.filter(l => l.email));
      } catch (e) {
        console.error('Error fetching leads:', e);
      }
    };

    fetchCustomers();
    fetchLeads();

    return () => {
      unsubConnection();
      unsubLogs();
    };
  }, [user]);

  // Connect Google OAuth Flow
  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    setNotification(null);
    try {
      const { profile } = await connectGmailAccount(user.uid);
      setIsTokenActive(true);
      setNotification({
        type: 'success',
        text: `Connected successfully to Gmail (${profile.emailAddress})`
      });
    } catch (err: any) {
      console.error('Error connecting to Gmail:', err);
      setNotification({
        type: 'error',
        text: err.message || 'Google authorization failed. Please try again.'
      });
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect Flow
  const handleDisconnect = async () => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to disconnect your Gmail account from FollowFlow AI?')) return;
    setDisconnecting(true);
    try {
      await disconnectGmailAccount(user.uid);
      setIsTokenActive(false);
      setNotification({
        type: 'success',
        text: 'Gmail account disconnected successfully.'
      });
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      setNotification({
        type: 'error',
        text: 'Failed to disconnect Gmail.'
      });
    } finally {
      setDisconnecting(false);
    }
  };

  // Quick Open Modal helpers
  const handleOpenCompose = (initialType: 'follow_up' | 'promotional' | 'thank_you' = 'follow_up') => {
    setComposeProps({ initialType });
    setIsComposeOpen(true);
  };

  const handleComposeForCustomer = (customer: Customer, initialType: 'follow_up' | 'promotional' | 'thank_you' = 'follow_up') => {
    setComposeProps({
      recipientEmail: customer.email || '',
      recipientName: customer.name || customer.customerName || '',
      customerId: customer.id,
      initialType,
      defaultSubject: initialType === 'thank_you' 
        ? `Thank you for choosing us, ${customer.name || ''}!`
        : initialType === 'promotional'
        ? `Special VIP Offer for ${customer.name || 'you'}`
        : `Following up on your inquiry with FollowFlow`
    });
    setIsComposeOpen(true);
  };

  const handleComposeForLead = (lead: Lead) => {
    setComposeProps({
      recipientEmail: lead.email || '',
      recipientName: lead.customerName || lead.name || '',
      leadId: lead.id,
      initialType: 'follow_up',
      defaultSubject: `Follow-up on your interest in ${lead.productInterest || 'our offerings'}`
    });
    setIsComposeOpen(true);
  };

  // Metrics Calculations
  const totalEmailsSent = logs.filter(l => l.status === 'sent' || l.status === 'delivered').length;
  const failedEmails = logs.filter(l => l.status === 'failed').length;
  const totalAttempts = logs.length;
  const successRate = totalAttempts > 0 ? Math.round((totalEmailsSent / totalAttempts) * 100) : 100;
  const isConnected = connection?.status === 'connected';

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.recipientEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.message || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' ? true : log.status === statusFilter;
    const matchesType = typeFilter === 'all' ? true : (log.emailType || 'follow_up') === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <DashboardLayout title="Gmail Outreach & Automation">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        
        {/* Header Hero Card */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-2xl shadow-xl border border-red-500/30 p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute right-1/3 -bottom-10 w-48 h-48 rounded-full bg-rose-400/20 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-xs mb-3">
                <Mail className="h-3.5 w-3.5" />
                <span>Direct Gmail API Integration</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Gmail Customer Outreach & Pipeline
              </h1>
              <p className="mt-2 text-sm sm:text-base text-red-100 leading-relaxed">
                Send authentic, high-converting follow-up emails, promotional offers, and thank-you notes directly from your authorized Gmail account with automated tracking in Firestore.
              </p>
            </div>

            {/* Connection Actions */}
            <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {!isConnected || !isTokenActive ? (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-gray-900 text-sm font-bold rounded-xl shadow-lg hover:bg-gray-50 transition transform active:scale-95 disabled:opacity-60"
                >
                  <img className="h-5 w-5" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" />
                  <span>{connecting ? 'Authorizing Google...' : isConnected ? 'Re-Authorize Gmail' : 'Connect Gmail Account'}</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => handleOpenCompose('follow_up')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-red-700 text-sm font-bold rounded-xl shadow-md hover:bg-red-50 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Send Outreach Email</span>
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="p-3 bg-white/15 hover:bg-white/25 text-white rounded-xl backdrop-blur-xs transition text-xs font-semibold flex items-center gap-1.5"
                    title="Disconnect Gmail Account"
                  >
                    <Unlink className="h-4 w-4" />
                    <span className="hidden sm:inline">{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Connection Status Sub-bar */}
          <div className="mt-6 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between text-xs text-red-100 gap-4">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${isConnected && isTokenActive ? 'bg-emerald-400 animate-pulse' : isConnected ? 'bg-amber-300' : 'bg-gray-300'}`} />
              <span>
                Status:{' '}
                <strong className="text-white font-semibold">
                  {isConnected && isTokenActive ? 'Connected & Active' : isConnected ? 'Connected (Re-auth required for new session)' : 'Not Connected'}
                </strong>
                {connection?.emailAddress && (
                  <span className="ml-2 px-2 py-0.5 rounded-md bg-white/10 text-white font-mono">
                    {connection.emailAddress}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="bg-white/15 text-white px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-white/20">
                Scopes: gmail.send, userinfo
              </span>
              <span className="text-red-200">
                DB: <code className="font-mono text-white">gmailConnections/{user?.uid?.slice(0, 6)}...</code>
              </span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`p-4 rounded-xl text-sm flex items-center justify-between gap-3 border ${
            notification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-red-50 text-red-900 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              )}
              <span>{notification.text}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600 text-xs font-semibold">
              Dismiss
            </button>
          </div>
        )}

        {/* 8. Dashboard Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-red-200 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Emails Sent</span>
              <div className="p-2 bg-red-50 rounded-xl text-red-600">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{totalEmailsSent}</p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">Live in Firestore</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-red-200 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Connected Accounts</span>
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{isConnected ? 1 : 0}</p>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {connection?.emailAddress || 'No Gmail account linked'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-red-200 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Failed Emails</span>
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{failedEmails}</p>
            <p className="text-xs text-gray-500 mt-1">
              {failedEmails === 0 ? 'All outreach emails delivered' : 'Requires review'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-red-200 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Success Rate</span>
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2">{successRate}%</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">
              Gmail API Delivery
            </p>
          </div>
        </div>

        {/* Quick Outreach Shortcuts: AI Generators & Customer Select */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick AI Email Generator Cards */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-100 rounded-lg text-purple-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">AI Email Generator</h2>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Generate high-converting email drafts customized for leads and VIP customers in 1 click.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleOpenCompose('follow_up')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">Follow-Up Email</h3>
                    <p className="text-[11px] text-gray-500">Re-engage leads after quotes or inquiries</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition" />
              </button>

              <button
                onClick={() => handleOpenCompose('promotional')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-rose-300 hover:bg-rose-50/50 text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 transition">
                    <Gift className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">Promotional Offer</h3>
                    <p className="text-[11px] text-gray-500">Share discounts, stock updates, VIP deals</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-rose-600 transition" />
              </button>

              <button
                onClick={() => handleOpenCompose('thank_you')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition">
                    <Heart className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">Thank You Note</h3>
                    <p className="text-[11px] text-gray-500">Nurture loyalty after orders & purchases</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-emerald-600 transition" />
              </button>
            </div>
          </div>

          {/* Quick Customer Outreach Picker */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-100 rounded-lg text-red-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">Select Customer for Direct Outreach</h2>
                </div>
                <span className="text-xs text-gray-500">{customers.length} registered customers</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Click any customer to instantly prepare an AI personalized email with their purchase background.
              </p>

              {loadingCustomers ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading customers...</div>
              ) : customers.length === 0 ? (
                <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 p-4">
                  <p className="text-xs text-gray-500">No customers found in your database.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {customers.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-gray-50 hover:bg-red-50/50 border border-gray-200 hover:border-red-200 rounded-xl transition flex items-center justify-between group"
                    >
                      <div className="truncate mr-2">
                        <p className="text-xs font-bold text-gray-900 truncate">{c.name || c.customerName}</p>
                        <p className="text-[11px] text-gray-500 truncate">{c.email || 'No email registered'}</p>
                      </div>

                      {c.email ? (
                        <button
                          onClick={() => handleComposeForCustomer(c, 'follow_up')}
                          className="shrink-0 p-2 bg-white group-hover:bg-red-600 text-gray-700 group-hover:text-white rounded-lg border border-gray-200 group-hover:border-red-600 shadow-2xs transition"
                          title="Send Gmail"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400">No email</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Leads Strip */}
            {leads.length > 0 && (
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Or reach out to new leads:</span>
                <div className="flex gap-2 overflow-x-auto max-w-[60%]">
                  {leads.slice(0, 3).map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => handleComposeForLead(lead)}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-red-50 hover:text-red-700 rounded-lg text-gray-700 text-[11px] font-semibold truncate transition"
                    >
                      {lead.customerName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. Email Logs Section (Real-time from emailOutreachLogs) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Section Header with Search and Filters */}
          <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-600" />
                <h2 className="text-base font-bold text-gray-900">Email Outreach Logs</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold">
                  {filteredLogs.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Real-time audit log of all emails dispatched via Gmail API stored in <code className="font-mono text-gray-700">emailOutreachLogs</code>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search logs..."
                  className="pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 w-44 sm:w-56"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center rounded-xl bg-gray-100 p-1 border border-gray-200 text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${statusFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('sent')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${statusFilter === 'sent' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Sent
                </button>
                <button
                  onClick={() => setStatusFilter('failed')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${statusFilter === 'failed' ? 'bg-white text-red-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Failed
                </button>
              </div>
            </div>
          </div>

          {/* Table / List View */}
          {loadingLogs ? (
            <div className="py-16 text-center text-xs text-gray-400">Loading email logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <Mail className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-gray-900">No email outreach logs yet</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Connect your Gmail account and send your first AI-assisted follow-up or promotional email to see logs here.
              </p>
              <button
                onClick={() => handleOpenCompose('follow_up')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Send First Email</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 text-gray-500 uppercase tracking-wider font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3.5">Recipient & Customer</th>
                    <th className="px-6 py-3.5">Subject & Content</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Sent Time</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">
                          {log.customerName || log.recipientEmail}
                        </div>
                        <div className="text-gray-500 font-mono text-[11px]">
                          {log.recipientEmail}
                        </div>
                      </td>

                      <td className="px-6 py-4 max-w-xs">
                        <div className="font-semibold text-gray-900 truncate">
                          {log.subject}
                        </div>
                        <div className="text-gray-500 truncate text-[11px] mt-0.5">
                          {log.message}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          log.emailType === 'promotional' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : log.emailType === 'thank_you'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {log.emailType === 'promotional' ? 'Promo' : log.emailType === 'thank_you' ? 'Thank You' : 'Follow Up'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.status === 'sent' || log.status === 'delivered' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Sent via Gmail
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 cursor-help"
                            title={log.errorMessage || 'Failed to dispatch'}
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            Failed
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        <div>{formatDateTime(log.sentAt)}</div>
                        <div className="text-[10px] text-gray-400">{getRelativeTime(log.sentAt)}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 font-semibold rounded-lg text-gray-700 transition"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Log Detail Drawer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-red-600" />
                <h3 className="font-bold text-gray-900 text-sm">Outreach Log Details</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">
                Close
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Recipient:</span>
                <span className="font-bold text-gray-900">{selectedLog.customerName || 'Customer'} &lt;{selectedLog.recipientEmail}&gt;</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Subject:</span>
                <span className="font-bold text-gray-900">{selectedLog.subject}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Status:</span>
                <span className={`font-bold ${selectedLog.status === 'sent' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {selectedLog.status.toUpperCase()}
                </span>
              </div>
              {selectedLog.gmailMessageId && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Gmail Message ID:</span>
                  <span className="font-mono text-gray-700">{selectedLog.gmailMessageId}</span>
                </div>
              )}
              {selectedLog.errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                  <strong>Error details:</strong> {selectedLog.errorMessage}
                </div>
              )}
              <div className="mt-3">
                <span className="text-gray-500 font-medium block mb-1">Message Content:</span>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {selectedLog.message}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Gmail Outreach Modal */}
      <GmailEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        customers={customers}
        {...composeProps}
      />
    </DashboardLayout>
  );
}
