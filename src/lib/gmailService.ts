import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { EmailOutreachLog, GmailConnection } from '../types';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export const gmailProvider = new GoogleAuthProvider();
GMAIL_SCOPES.forEach(scope => {
  gmailProvider.addScope(scope);
});
gmailProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

// IN-MEMORY TOKEN CACHE
let cachedAccessToken: string | null = null;
let cachedGmailProfile: GmailProfile | null = null;

// Clear cached token on sign-out
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
    cachedGmailProfile = null;
  }
});

export interface GmailProfile {
  emailAddress: string;
  displayName?: string;
  photoUrl?: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

export interface SendGmailOutreachParams {
  userId: string;
  to: string;
  subject: string;
  message: string;
  customerId?: string;
  customerName?: string;
  leadId?: string;
  emailType?: 'follow_up' | 'promotional' | 'thank_you' | 'custom' | string;
}

export const getCachedGmailToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedGmailToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Connect user's Gmail account via Google OAuth popup and persist connection in Firestore
 * at gmailConnections/{userId}
 */
export async function connectGmailAccount(userId: string): Promise<{ accessToken: string; profile: GmailProfile }> {
  try {
    const result = await signInWithPopup(auth, gmailProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No OAuth access token returned by Google authentication.');
    }

    cachedAccessToken = credential.accessToken;
    
    // Fetch profile info from Google UserInfo endpoint
    let emailAddress = result.user.email || '';
    let displayName = result.user.displayName || '';
    let photoUrl = result.user.photoURL || '';

    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${cachedAccessToken}` }
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        if (userInfo.email) emailAddress = userInfo.email;
        if (userInfo.name) displayName = userInfo.name;
        if (userInfo.picture) photoUrl = userInfo.picture;
      }
    } catch (e) {
      console.warn('[GmailService] UserInfo fetch warning:', e);
    }

    const profile: GmailProfile = {
      emailAddress,
      displayName,
      photoUrl
    };

    cachedGmailProfile = profile;

    // Save connection to Firestore under gmailConnections/{userId}
    const connectionRef = doc(db, 'gmailConnections', userId);
    await setDoc(connectionRef, {
      userId,
      emailAddress,
      displayName,
      photoUrl,
      status: 'connected',
      connectedAt: serverTimestamp(),
      lastUsedAt: serverTimestamp()
    }, { merge: true });

    return { accessToken: cachedAccessToken, profile };
  } catch (error: any) {
    console.error('[GmailService] Error connecting Gmail:', error);
    throw error;
  }
}

/**
 * Check if the user has a stored Gmail connection in Firestore
 */
export async function getStoredGmailConnection(userId: string): Promise<GmailConnection | null> {
  try {
    const connectionRef = doc(db, 'gmailConnections', userId);
    const snap = await getDoc(connectionRef);
    if (snap.exists()) {
      return snap.data() as GmailConnection;
    }
    return null;
  } catch (err) {
    console.error('[GmailService] Error fetching stored Gmail connection:', err);
    return null;
  }
}

/**
 * Disconnect user's Gmail account by updating Firestore and clearing in-memory token
 */
export async function disconnectGmailAccount(userId: string): Promise<void> {
  cachedAccessToken = null;
  cachedGmailProfile = null;
  try {
    const connectionRef = doc(db, 'gmailConnections', userId);
    await setDoc(connectionRef, {
      status: 'disconnected',
      disconnectedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error('[GmailService] Error disconnecting Gmail:', err);
    throw err;
  }
}

/**
 * Encode an RFC 2822 MIME email into URL-safe Base64 format as required by the Gmail API.
 */
function buildMimeMessage({
  to,
  from,
  subject,
  body
}: {
  to: string;
  from?: string;
  subject: string;
  body: string;
}): string {
  const cleanSubject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  
  // Format body with HTML paragraphs and clean styling
  const formattedHtml = body
    .split('\n')
    .map(p => p.trim() ? `<p style="margin: 0 0 14px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937;">${escapeHtml(p)}</p>` : '<br/>')
    .join('');

  const lines = [
    `To: ${to}`,
    from ? `From: ${from}` : '',
    `Subject: ${cleanSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    `<!DOCTYPE html><html><body style="margin: 0; padding: 16px; font-family: sans-serif; background-color: #ffffff;">${formattedHtml}</body></html>`
  ].filter(Boolean);

  const rawMessage = lines.join('\r\n');

  // Convert to Base64URL string (RFC 4648 §5)
  return btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Send an email directly using the official Gmail API (POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send)
 * and persist an outreach record in emailOutreachLogs
 */
export async function sendGmailOutreachEmail(params: SendGmailOutreachParams): Promise<{ id: string; threadId: string }> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Gmail is not connected. Please click "Connect Gmail" to authorize your account.');
  }

  if (!params.to || !params.to.includes('@')) {
    throw new Error('Please enter a valid recipient email address.');
  }

  if (!params.subject?.trim()) {
    throw new Error('Email subject cannot be empty.');
  }

  if (!params.message?.trim()) {
    throw new Error('Email content cannot be empty.');
  }

  const raw = buildMimeMessage({
    to: params.to.trim(),
    subject: params.subject.trim(),
    body: params.message.trim()
  });

  let response: Response;
  try {
    response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });
  } catch (networkErr: any) {
    // Log failed email attempt to Firestore emailOutreachLogs
    await recordEmailLog({
      userId: params.userId,
      customerId: params.customerId,
      customerName: params.customerName,
      leadId: params.leadId,
      recipientEmail: params.to.trim(),
      subject: params.subject.trim(),
      message: params.message.trim(),
      status: 'failed',
      errorMessage: networkErr?.message || 'Network request failed',
      sentAt: serverTimestamp(),
      emailType: params.emailType || 'follow_up'
    });
    throw new Error(`Network failure sending Gmail: ${networkErr.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let parsedErr = errorText;
    try {
      const j = JSON.parse(errorText);
      parsedErr = j.error?.message || errorText;
    } catch (_) {}

    const isTokenExpired = response.status === 401;
    if (isTokenExpired) {
      cachedAccessToken = null;
      // Mark connection expired in Firestore
      try {
        await updateDoc(doc(db, 'gmailConnections', params.userId), {
          status: 'expired'
        });
      } catch (_) {}
    }

    // Log failed attempt to emailOutreachLogs
    await recordEmailLog({
      userId: params.userId,
      customerId: params.customerId,
      customerName: params.customerName,
      leadId: params.leadId,
      recipientEmail: params.to.trim(),
      subject: params.subject.trim(),
      message: params.message.trim(),
      status: 'failed',
      errorMessage: isTokenExpired ? 'Gmail OAuth token expired. Please reconnect your Gmail account.' : parsedErr,
      sentAt: serverTimestamp(),
      emailType: params.emailType || 'follow_up'
    });

    if (isTokenExpired) {
      throw new Error('Gmail authorization expired. Please reconnect your Google account to send emails.');
    }

    throw new Error(`Gmail API error (${response.status}): ${parsedErr}`);
  }

  const result = await response.json();

  // Log successful outreach email in emailOutreachLogs
  await recordEmailLog({
    userId: params.userId,
    customerId: params.customerId,
    customerName: params.customerName,
    leadId: params.leadId,
    recipientEmail: params.to.trim(),
    subject: params.subject.trim(),
    message: params.message.trim(),
    status: 'sent',
    gmailMessageId: result.id,
    gmailThreadId: result.threadId,
    sentAt: serverTimestamp(),
    emailType: params.emailType || 'follow_up'
  });

  // Update lastUsedAt in gmailConnections
  try {
    await updateDoc(doc(db, 'gmailConnections', params.userId), {
      lastUsedAt: serverTimestamp()
    });
  } catch (_) {}

  // Also log activity stream
  try {
    await addDoc(collection(db, 'activities'), {
      userId: params.userId,
      type: 'GMAIL_OUTREACH_SENT',
      title: `Sent Gmail outreach to ${params.customerName || params.to}`,
      createdAt: serverTimestamp()
    });
  } catch (_) {}

  return result;
}

/**
 * Record an entry into emailOutreachLogs collection
 */
async function recordEmailLog(log: Omit<EmailOutreachLog, 'id'>) {
  try {
    await addDoc(collection(db, 'emailOutreachLogs'), log);
  } catch (err) {
    console.error('[GmailService] Error logging to emailOutreachLogs:', err);
  }
}
