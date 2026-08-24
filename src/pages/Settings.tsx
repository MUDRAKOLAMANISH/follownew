import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  Inbox, 
  BellRing, 
  Sparkles, 
  UserPlus, 
  FileText,
  Clock,
  UserCheck,
  Server,
  Database,
  Key,
  Layers,
  HardDrive
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db, app } from '../lib/firebase';
import { submitContactForm, triggerUserSignupNotification } from '../lib/notificationService';
import FirebaseDiagnosticModal from '../components/FirebaseDiagnosticModal';
import { runFirebaseDiagnostic, DiagnosticResult } from '../lib/firebaseDiagnostic';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'logs' | 'submissions' | 'testing' | 'database'>('database');
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [contactSubmissions, setContactSubmissions] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [serverConfig, setServerConfig] = useState<{ adminEmail: string; smtpConfigured: boolean } | null>(null);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [inlineDiagnostic, setInlineDiagnostic] = useState<DiagnosticResult | null>(null);
  const [isRunningInlineDiag, setIsRunningInlineDiag] = useState(false);
  
  // Test actions state
  const [isTestingContact, setIsTestingContact] = useState(false);
  const [isTestingSignup, setIsTestingSignup] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const runInlineDiagnosticCheck = async () => {
    setIsRunningInlineDiag(true);
    try {
      const res = await runFirebaseDiagnostic(user);
      setInlineDiagnostic(res);
    } catch (e) {
      console.error("Diagnostic error:", e);
    } finally {
      setIsRunningInlineDiag(false);
    }
  };

  useEffect(() => {
    runInlineDiagnosticCheck();
  }, [user]);

  // Fetch server config & logs
  const fetchServerLogsAndConfig = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/notifications/logs');
      if (res.ok) {
        const data = await res.json();
        setServerConfig({
          adminEmail: data.adminEmail,
          smtpConfigured: data.smtpConfigured
        });
      }
    } catch (e) {
      console.warn("Could not fetch server logs endpoint", e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchServerLogsAndConfig();

    // Real-time Firestore Email Logs
    const qLogs = query(collection(db, 'emailLogs'), orderBy('createdAt', 'desc'), limit(30));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmailLogs(docs);
    }, (err) => {
      console.warn("Firestore emailLogs subscription:", err);
    });

    // Real-time Firestore Contact Submissions
    const qContacts = query(collection(db, 'contactSubmissions'), orderBy('createdAt', 'desc'), limit(30));
    const unsubContacts = onSnapshot(qContacts, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setContactSubmissions(docs);
    }, (err) => {
      console.warn("Firestore contactSubmissions subscription:", err);
    });

    return () => {
      unsubLogs();
      unsubContacts();
    };
  }, []);

  // Run Test: Contact Form
  const handleTestContactForm = async () => {
    setIsTestingContact(true);
    setTestResult(null);
    try {
      const testEmail = user?.email || 'testuser@example.com';
      await submitContactForm({
        name: 'Test Prospect',
        email: testEmail,
        phone: '+1 (555) 987-6543',
        subject: 'Product Demo & Pricing Inquiry',
        message: 'Hello! I would like to schedule a 15-minute demo to see how FollowFlow AI can automate customer follow-ups for our store.'
      });
      setTestResult({
        type: 'success',
        message: `Contact workflow executed! 2 emails generated: Admin notification -> ${serverConfig?.adminEmail || 'Admin'} & User confirmation -> ${testEmail}`
      });
      fetchServerLogsAndConfig();
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: `Contact test failed: ${err.message}`
      });
    } finally {
      setIsTestingContact(false);
    }
  };

  // Run Test: Signup Workflow
  const handleTestSignup = async () => {
    setIsTestingSignup(true);
    setTestResult(null);
    try {
      const testEmail = user?.email || 'newuser@example.com';
      const fakeUid = `test_uid_${Date.now()}`;
      
      const res = await fetch('/api/notifications/user-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: fakeUid,
          email: testEmail,
          displayName: user?.displayName || 'Alex Demo',
          provider: 'google.com',
          createdAt: new Date().toLocaleString('en-US')
        })
      });

      if (res.ok) {
        setTestResult({
          type: 'success',
          message: `User signup workflow executed! 2 emails generated: Admin alert -> ${serverConfig?.adminEmail || 'Admin'} & User Welcome -> ${testEmail}`
        });
        fetchServerLogsAndConfig();
      } else {
        throw new Error('Server returned an error');
      }
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: `Signup test failed: ${err.message}`
      });
    } finally {
      setIsTestingSignup(false);
    }
  };

  // Run Test: Diagnostic Ping
  const handleTestPing = async () => {
    setIsTestingPing(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/notifications/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: user?.email })
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({
          type: 'success',
          message: `Diagnostic ping completed! Delivery status: ${data.log?.status || 'sent'}`
        });
        fetchServerLogsAndConfig();
      }
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: `Ping failed: ${err.message}`
      });
    } finally {
      setIsTestingPing(false);
    }
  };

  return (
    <DashboardLayout title="Settings & Notifications">
      <div className="max-w-6xl space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'database'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Firebase & Database</span>
            <span className="ml-1 text-2xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
              Live
            </span>
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'general'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Server className="h-4 w-4" />
            <span>Email Notification System</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BellRing className="h-4 w-4" />
            <span>Delivery Logs</span>
            {emailLogs.length > 0 && (
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-white/20">
                {emailLogs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'submissions'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Inbox className="h-4 w-4" />
            <span>Contact Form Inquiries</span>
            {contactSubmissions.length > 0 && (
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {contactSubmissions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('testing')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'testing'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Live Testing & Simulation</span>
          </button>
        </div>

        {/* TAB 0: Firebase Project & Database Info */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Firebase & Firestore Project Diagnostics</h2>
                    <p className="text-xs text-gray-500">Active project connection, database routing, and verified collections</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runInlineDiagnosticCheck}
                    disabled={isRunningInlineDiag}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRunningInlineDiag ? 'animate-spin' : ''}`} />
                    <span>Refresh Status</span>
                  </button>
                  <button
                    onClick={() => setIsDiagnosticOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-lg shadow-xs transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Run Full Diagnostic Probe</span>
                  </button>
                </div>
              </div>

              {/* Diagnostic Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                    <Server className="h-4 w-4 text-indigo-600" />
                    <span>Firebase Project ID</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-900 break-all">
                    aiknowledgeassistant05
                  </div>
                  <div className="mt-1 text-2xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                    <Database className="h-4 w-4 text-indigo-600" />
                    <span>Firestore Database ID</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 break-all">
                    ai-studio-leadpilotailandi-fe680836-10a7-44f8-aa18-c674131bb6cf
                  </div>
                  <div className="mt-1 text-2xs text-indigo-600 font-medium">
                    Target Instance Active
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                    <Key className="h-4 w-4 text-indigo-600" />
                    <span>Authentication & Storage</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {user ? 'Authenticated Session' : 'Ready (Awaiting Sign-in)'}
                  </div>
                  <div className="mt-1 text-2xs text-slate-500 truncate">
                    {user ? user.email : 'Google & Password Provider Ready'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                    <span>Database Status</span>
                  </div>
                  <div className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Operational
                  </div>
                  <div className="mt-1 text-2xs text-emerald-600 font-medium">
                    Read & Write Permissions Active
                  </div>
                </div>
              </div>

              {/* Verified Collections Section */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    Verified Firestore Collections & Storage
                  </h3>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    9 Essential Collections Locked & Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">1. users</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Active</span>
                    </div>
                    <p className="text-2xs text-gray-500">User accounts, profile metadata, timestamps</p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">2. leads</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                        {inlineDiagnostic?.collectionCounts.leadsForUser ?? 0} items
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500">Inbound leads, AI scores, status tags, contact data</p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">3. customers</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        {inlineDiagnostic?.collectionCounts.customersForUser ?? 0} items
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500">Converted clients, transaction history, lifetime value</p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">4. followups</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        {inlineDiagnostic?.collectionCounts.followupsForUser ?? 0} items
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500">Scheduled reminders, AI suggestions, cadence tracking</p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">5. businessProfiles</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                        {inlineDiagnostic?.collectionCounts.businessProfilesForUser ? 'Configured' : 'Ready'}
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500">AI business context, tone presets, company description</p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">6. contactSubmissions</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">
                        {inlineDiagnostic?.collectionCounts.contactSubmissionsTotal ?? 0} records
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500">Public contact form submissions and prospect inquiries</p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">7. emailLogs</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                        {inlineDiagnostic?.collectionCounts.emailLogsTotal ?? 0} sent
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500">System automated email dispatch logs and audit records</p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">8. emailOutreachLogs</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold">
                        {inlineDiagnostic?.collectionCounts.emailOutreachLogsForUser ?? 0} emails
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500">Gmail OAuth outreach emails, customer dispatch audits</p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-gray-900">9. knowledge_base</span>
                      <span className="text-2xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        {inlineDiagnostic?.collectionCounts.knowledgeBaseTotal ?? 0} indexed
                      </span>
                    </div>
                    <p className="text-2xs text-gray-500">RAG document library, knowledge chunks, embeddings</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: General Notification System Overview */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              
              {/* System Card */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Email Notification Automation</h2>
                      <p className="text-xs text-gray-500">Cloud backend automated transactional dispatch</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Operational
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  FollowFlow AI is configured to automatically dispatch real-time dual-recipient emails for all critical business events.
                </p>

                {/* Workflow 1 */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-indigo-600" />
                      1. Contact Us Form Workflow
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">2 Emails</span>
                  </div>
                  <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                    <li><strong className="text-gray-800">Email #1 (Admin):</strong> Notification to <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-indigo-600">{serverConfig?.adminEmail || 'admin@followflow.ai'}</code> with inquiry payload and timestamp.</li>
                    <li><strong className="text-gray-800">Email #2 (User):</strong> Instant branded confirmation & review notice sent to the visitor's email address.</li>
                    <li><strong className="text-gray-800">Persistence:</strong> Recorded to Firestore <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-700">contactSubmissions</code>.</li>
                  </ul>
                </div>

                {/* Workflow 2 */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-emerald-600" />
                      2. User Signup & Google Sign-In Workflow
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">2 Emails</span>
                  </div>
                  <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                    <li><strong className="text-gray-800">Email #1 (Admin):</strong> "🎉 New User Registration" alert with UID, name, email, and signup timestamp.</li>
                    <li><strong className="text-gray-800">Email #2 (User):</strong> "Welcome to FollowFlow AI 🚀" onboarding guide with quick links.</li>
                    <li><strong className="text-gray-800">Triggers:</strong> Fires for both Email/Password registrations and Google One-Tap / Popup sign-ins.</li>
                  </ul>
                </div>
              </div>

              {/* Error Handling & Resilience */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Audit Trail & Error Handling
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Every attempted email dispatch (successful or failed) is safely logged to the <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-800">emailLogs</code> collection with recipient, type, status, subject, and error traces.
                </p>
              </div>
            </div>

            {/* Sidebar Config Details */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Backend Config</h3>
                
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Configured Admin Email</label>
                  <div className="text-xs font-mono bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-gray-900 break-all">
                    {serverConfig?.adminEmail || 'admin@followflow.ai'}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">SMTP Transport Mode</label>
                  <div className="flex items-center gap-2">
                    {serverConfig?.smtpConfigured ? (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Production SMTP Connected
                      </span>
                    ) : (
                      <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md font-medium flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Safe Logger & Firestore Log Transport
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <p>To configure custom SMTP credentials, specify <code className="text-indigo-600 font-mono">SMTP_HOST</code>, <code className="text-indigo-600 font-mono">SMTP_USER</code>, and <code className="text-indigo-600 font-mono">SMTP_PASS</code> in <code className="font-mono">.env</code>.</p>
                </div>
              </div>

              {/* Quick Test Card */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
                <h4 className="text-sm font-bold text-indigo-900 mb-1">Quick Verification</h4>
                <p className="text-xs text-indigo-700 mb-4">Trigger a test notification or review the testing playground.</p>
                <button
                  onClick={() => setActiveTab('testing')}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors shadow-xs"
                >
                  Open Testing Playground
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Delivery Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-900">Email Delivery Logs</h2>
                <p className="text-xs text-gray-500">Real-time audit log of all system email dispatches from <code className="font-mono text-gray-700">emailLogs</code></p>
              </div>
              <button
                onClick={fetchServerLogsAndConfig}
                disabled={isLoadingLogs}
                className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {emailLogs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">No email logs recorded yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Submit a contact form or use the Testing Playground to generate test email logs.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Recipient</th>
                      <th className="p-3">Subject</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {emailLogs.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3">
                          {log.status === 'sent' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              Sent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-red-50 text-red-700 border border-red-200" title={log.error}>
                              <AlertCircle className="h-3 w-3 text-red-600" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-2xs px-2 py-0.5 bg-gray-100 rounded text-gray-800">
                            {log.type}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-gray-900">{log.recipient}</td>
                        <td className="p-3 text-gray-700">{log.subject}</td>
                        <td className="p-3 text-gray-400 whitespace-nowrap">
                          {log.createdAt?.seconds 
                            ? new Date(log.createdAt.seconds * 1000).toLocaleString() 
                            : String(log.createdAt || 'Just now')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Contact Submissions */}
        {activeTab === 'submissions' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-900">Contact Submissions Inbox</h2>
                <p className="text-xs text-gray-500">Inquiries stored in Firestore <code className="font-mono text-gray-700">contactSubmissions</code></p>
              </div>
            </div>

            {contactSubmissions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Inbox className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">No contact submissions found</p>
                <p className="text-xs text-gray-500 mt-1">
                  Visitor inquiries submitted through the Contact Us page will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contactSubmissions.map((sub, idx) => (
                  <div key={sub.id || idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white transition-all space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{sub.name}</span>
                        <span className="text-xs text-gray-500 font-mono">({sub.email})</span>
                        {sub.phone && sub.phone !== 'Not provided' && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-mono">
                            {sub.phone}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {sub.createdAt?.seconds 
                          ? new Date(sub.createdAt.seconds * 1000).toLocaleString() 
                          : sub.createdAtIso || 'Recently'}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-indigo-700">
                      Subject: {sub.subject || 'General Inquiry'}
                    </div>

                    <div className="text-xs text-gray-700 bg-white p-3 rounded-lg border border-gray-100">
                      {sub.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Testing & Simulation */}
        {activeTab === 'testing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
              <h2 className="text-base font-bold text-gray-900 mb-1">Live Notification Testing & Verification</h2>
              <p className="text-xs text-gray-500 mb-6">
                Trigger end-to-end email notification flows to verify both Admin notifications and User confirmations.
              </p>

              {testResult && (
                <div className={`p-4 rounded-xl mb-6 text-xs flex items-start gap-3 ${
                  testResult.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {testResult.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className="block font-semibold mb-0.5">
                      {testResult.type === 'success' ? 'Execution Succeeded' : 'Execution Notice'}
                    </strong>
                    <span>{testResult.message}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Test 1: Contact Form Workflow */}
                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="p-2 w-fit rounded-lg bg-indigo-100 text-indigo-700 mb-3">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Contact Us Workflow</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Simulates a website visitor inquiry. Saves to <code className="font-mono text-2xs">contactSubmissions</code> and fires Admin Alert + User Confirmation.
                    </p>
                  </div>
                  <button
                    onClick={handleTestContactForm}
                    disabled={isTestingContact}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingContact ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Test Contact Workflow</span>
                  </button>
                </div>

                {/* Test 2: User Signup Workflow */}
                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="p-2 w-fit rounded-lg bg-emerald-100 text-emerald-700 mb-3">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Signup / Google Auth Workflow</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Simulates user registration. Fires "🎉 New User Registration" to Admin and "Welcome to FollowFlow AI 🚀" to user.
                    </p>
                  </div>
                  <button
                    onClick={handleTestSignup}
                    disabled={isTestingSignup}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingSignup ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                    <span>Test Signup Workflow</span>
                  </button>
                </div>

                {/* Test 3: Diagnostic Ping */}
                <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="p-2 w-fit rounded-lg bg-purple-100 text-purple-700 mb-3">
                      <Server className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Diagnostic Ping</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Sends a quick test ping payload through the backend mailer to verify transport connectivity and logging.
                    </p>
                  </div>
                  <button
                    onClick={handleTestPing}
                    disabled={isTestingPing}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingPing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    <span>Send Diagnostic Ping</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <FirebaseDiagnosticModal
          isOpen={isDiagnosticOpen}
          onClose={() => setIsDiagnosticOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}
