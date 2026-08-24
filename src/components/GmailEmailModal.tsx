import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Mail, 
  User, 
  FileEdit,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Gift,
  Heart,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  sendGmailOutreachEmail, 
  getCachedGmailToken, 
  connectGmailAccount, 
  GmailProfile,
  getStoredGmailConnection
} from '../lib/gmailService';
import { useAuth } from '../context/AuthContext';
import { Customer } from '../types';

interface GmailEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientEmail?: string;
  recipientName?: string;
  customerId?: string;
  leadId?: string;
  followupId?: string;
  defaultSubject?: string;
  defaultBody?: string;
  initialType?: 'follow_up' | 'promotional' | 'thank_you';
  customers?: Customer[];
  onEmailSent?: () => void;
}

export default function GmailEmailModal({
  isOpen,
  onClose,
  recipientEmail = '',
  recipientName = '',
  customerId,
  leadId,
  followupId,
  defaultSubject = '',
  defaultBody = '',
  initialType = 'follow_up',
  customers = [],
  onEmailSent
}: GmailEmailModalProps) {
  const { user } = useAuth();
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId || '');
  const [toEmail, setToEmail] = useState(recipientEmail);
  const [toName, setToName] = useState(recipientName);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [emailType, setEmailType] = useState<'follow_up' | 'promotional' | 'thank_you' | 'custom'>(initialType);
  
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedEmail, setConnectedEmail] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  
  // AI Generator state inside modal
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  
  // Explicit Confirmation Dialog step (Google Workspace Safety Guard)
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync props when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedCustomerId(customerId || '');
      setToEmail(recipientEmail);
      setToName(recipientName);
      setSubject(defaultSubject || (recipientName ? `Following up with ${recipientName}` : 'Special update from our team'));
      setBody(defaultBody);
      setEmailType(initialType);
      setShowConfirmation(false);
      setStatusMessage(null);
      checkConnection();
    }
  }, [isOpen, recipientEmail, defaultSubject, defaultBody, recipientName, customerId, initialType]);

  const checkConnection = async () => {
    if (!user) return;
    const token = getCachedGmailToken();
    if (token) {
      setIsConnected(true);
      const conn = await getStoredGmailConnection(user.uid);
      if (conn?.emailAddress) setConnectedEmail(conn.emailAddress);
    } else {
      const conn = await getStoredGmailConnection(user.uid);
      if (conn && conn.status === 'connected') {
        setIsConnected(false); // Needs token re-auth in this session
        setConnectedEmail(conn.emailAddress);
      } else {
        setIsConnected(false);
        setConnectedEmail('');
      }
    }
  };

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    const found = customers.find(c => c.id === id);
    if (found) {
      if (found.email) setToEmail(found.email);
      setToName(found.name || found.customerName || '');
    }
  };

  const handleConnectGmail = async () => {
    if (!user) return;
    setConnecting(true);
    setStatusMessage(null);
    try {
      const { profile } = await connectGmailAccount(user.uid);
      setIsConnected(true);
      setConnectedEmail(profile.emailAddress);
      setStatusMessage({ type: 'success', text: `Connected as ${profile.emailAddress}` });
    } catch (err: any) {
      console.error('Failed to connect Gmail:', err);
      setStatusMessage({ 
        type: 'error', 
        text: err.message || 'Failed to authenticate with Google. Please try again.' 
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleGenerateAIEmail = async (type: 'follow_up' | 'promotional' | 'thank_you') => {
    setIsGeneratingAI(true);
    setStatusMessage(null);
    setEmailType(type);
    try {
      const res = await fetch('/api/generate-outreach-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          customerName: toName || 'Valued Customer',
          customerEmail: toEmail,
          productInterest: 'FollowFlow AI & Sales Automation',
          discountOffer: discountInput || (type === 'promotional' ? '15% Off Your Next Order' : undefined),
          businessName: 'FollowFlow AI',
          businessCategory: 'Customer Relationship & Sales Software'
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate AI email template');
      }

      const data = await res.json();
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
    } catch (err: any) {
      console.error('AI Email generation failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Could not generate AI template. You can type your message manually.'
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const validateForm = (): boolean => {
    if (!toEmail.trim() || !toEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please provide a valid recipient email address.' });
      return false;
    }
    if (!subject.trim()) {
      setStatusMessage({ type: 'error', text: 'Email subject is required.' });
      return false;
    }
    if (!body.trim()) {
      setStatusMessage({ type: 'error', text: 'Email content is required.' });
      return false;
    }
    return true;
  };

  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setStatusMessage(null);
    setShowConfirmation(true);
  };

  const handleExecuteSend = async () => {
    if (!user) return;
    setSending(true);
    setStatusMessage(null);

    try {
      await sendGmailOutreachEmail({
        userId: user.uid,
        to: toEmail.trim(),
        subject: subject.trim(),
        message: body.trim(),
        customerId: selectedCustomerId || undefined,
        customerName: toName.trim() || undefined,
        leadId: leadId || undefined,
        emailType
      });

      setStatusMessage({
        type: 'success',
        text: `Email sent successfully via Gmail to ${toEmail}!`
      });
      
      setShowConfirmation(false);
      
      if (onEmailSent) {
        onEmailSent();
      }

      setTimeout(() => {
        onClose();
      }, 1400);

    } catch (err: any) {
      console.error('Error sending outreach email:', err);
      setShowConfirmation(false);
      
      if (err.message?.includes('expired') || err.message?.includes('401')) {
        setIsConnected(false);
        setStatusMessage({
          type: 'error',
          text: 'Gmail session expired. Please click "Connect Gmail" to re-authorize.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: err.message || 'Failed to send email via Gmail API.'
        });
      }
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-gray-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">New Gmail Outreach</h2>
                <p className="text-xs text-red-100">Send real email directly via your authorized Gmail account</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Connection Status Banner */}
          <div className="bg-red-50/70 border-b border-red-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-medium text-gray-700">
                {isConnected ? (
                  <>Connected: <strong className="text-gray-900 font-bold">{connectedEmail || user?.email}</strong></>
                ) : connectedEmail ? (
                  <>Gmail Account Saved: <strong className="text-gray-900">{connectedEmail}</strong> (Session re-auth required)</>
                ) : (
                  'Gmail Not Connected'
                )}
              </span>
            </div>

            {!isConnected && (
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={connecting}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-red-50 text-red-700 font-bold rounded-lg border border-red-200 shadow-2xs transition disabled:opacity-50"
              >
                <img className="h-3.5 w-3.5" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                <span>{connecting ? 'Connecting...' : 'Authorize Gmail'}</span>
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Status alerts */}
            {statusMessage && (
              <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}>
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* AI Generator Quick Actions */}
            <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-100 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>AI Email Templates</span>
                </div>
                {isGeneratingAI && <span className="text-[11px] text-purple-700 font-medium animate-pulse">Drafting with Gemini AI...</span>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateAIEmail('follow_up')}
                  disabled={isGeneratingAI}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                    emailType === 'follow_up' 
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Follow-Up</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateAIEmail('promotional')}
                  disabled={isGeneratingAI}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                    emailType === 'promotional' 
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  <Gift className="h-3.5 w-3.5" />
                  <span>Promo Offer</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateAIEmail('thank_you')}
                  disabled={isGeneratingAI}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                    emailType === 'thank_you' 
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  <Heart className="h-3.5 w-3.5" />
                  <span>Thank You</span>
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <form id="gmail-compose-form" onSubmit={handleInitiateSend} className="space-y-4">
              {/* Customer Selector if available */}
              {customers.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Select Customer from Database (Optional)
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">-- Choose customer to autofill details --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.customerName} {c.email ? `(${c.email})` : '(No email)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={toName}
                    onChange={(e) => setToName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Recipient Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Subject Line <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Compelling subject line..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={7}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email body here or use an AI template above..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {!isConnected ? (
                <button
                  type="button"
                  onClick={handleConnectGmail}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-red-700 transition disabled:opacity-50"
                >
                  <img className="h-4 w-4" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                  <span>{connecting ? 'Connecting...' : 'Authorize & Send'}</span>
                </button>
              ) : (
                <button
                  type="submit"
                  form="gmail-compose-form"
                  disabled={sending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold rounded-xl shadow-md hover:from-red-700 hover:to-rose-700 transition transform active:scale-95 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>Review & Send Email</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <ShieldCheck className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Confirm Email Outreach</h3>
                  <p className="text-xs text-gray-500">Sent directly from your connected Gmail</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 text-xs space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">From:</span>
                  <span className="font-semibold text-gray-900">{connectedEmail || user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">To:</span>
                  <span className="font-semibold text-gray-900">{toEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Subject:</span>
                  <span className="font-semibold text-gray-900 truncate max-w-[220px]">{subject}</span>
                </div>
              </div>

              <p className="text-xs text-gray-600 mb-5 leading-relaxed">
                This will send an official email via the Gmail API on behalf of your Google account and log the action in your outreach history.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  disabled={sending}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Edit Email
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSend}
                  disabled={sending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition disabled:opacity-60"
                >
                  {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>{sending ? 'Sending via Gmail...' : 'Send Now'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
