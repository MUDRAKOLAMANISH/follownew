import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface ContactSubmissionData {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export interface UserSignupData {
  uid: string;
  email: string;
  displayName: string;
  provider?: string;
}

export interface EmailLogEntry {
  id?: string;
  recipient: string;
  type: 'contact_admin' | 'contact_user_confirmation' | 'signup_admin' | 'signup_user_welcome' | 'test_email' | 'other';
  subject: string;
  error: string | null;
  status: 'sent' | 'failed';
  createdAt: any;
  details?: Record<string, any>;
}

/**
 * Handle Contact Us form submission:
 * 1. Saves to Firestore `contactSubmissions`
 * 2. Calls backend API to send Admin Notification & User Confirmation emails
 * 3. Records logs to `emailLogs`
 */
export async function submitContactForm(data: ContactSubmissionData) {
  const createdAtIso = new Date().toISOString();
  const formattedTime = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // 1. Store in Firestore collection 'contactSubmissions'
  let submissionId = '';
  try {
    const docRef = await addDoc(collection(db, 'contactSubmissions'), {
      name: data.name,
      email: data.email,
      phone: data.phone || 'Not provided',
      subject: data.subject || 'General Inquiry',
      message: data.message,
      createdAt: serverTimestamp(),
      createdAtIso: createdAtIso
    });
    submissionId = docRef.id;
  } catch (err) {
    console.error('Failed to write to contactSubmissions in Firestore:', err);
  }

  // 2. Call backend email notification endpoint
  try {
    const response = await fetch('/api/notifications/contact-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        createdAt: formattedTime,
        submissionId
      })
    });

    const result = await response.json();

    // 3. Save logs to Firestore emailLogs
    if (result && Array.isArray(result.logs)) {
      for (const log of result.logs) {
        try {
          await addDoc(collection(db, 'emailLogs'), {
            recipient: log.recipient,
            type: log.type,
            subject: log.subject,
            error: log.error || null,
            status: log.status,
            createdAt: serverTimestamp(),
            submissionId
          });
        } catch (logErr) {
          console.warn('Could not record to emailLogs collection:', logErr);
        }
      }
    }

    return { success: true, submissionId, result };
  } catch (err: any) {
    console.error('Failed to trigger contact email notification backend:', err);
    // Log failure
    try {
      await addDoc(collection(db, 'emailLogs'), {
        recipient: data.email,
        type: 'contact_user_confirmation',
        subject: 'Thank you for contacting FollowFlow AI',
        error: err?.message || 'Network error triggering email dispatch',
        status: 'failed',
        createdAt: serverTimestamp(),
        submissionId
      });
    } catch (_) {}

    return { success: true, submissionId, warning: 'Emails queued' };
  }
}

/**
 * Handle User Signup notifications (Email or Google Auth):
 * 1. Checks if signup email was already sent (using localStorage / session cache)
 * 2. Calls backend API to send Admin Registration Notification & User Welcome Email
 * 3. Records logs to `emailLogs`
 */
export async function triggerUserSignupNotification(userData: UserSignupData) {
  if (!userData.email || !userData.uid) return;

  const cacheKey = `signup_notif_sent_${userData.uid}`;
  if (localStorage.getItem(cacheKey)) {
    // Already sent for this user
    return;
  }

  const formattedTime = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  try {
    const response = await fetch('/api/notifications/user-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || userData.email.split('@')[0] || 'User',
        provider: userData.provider || 'password',
        createdAt: formattedTime
      })
    });

    const result = await response.json();
    localStorage.setItem(cacheKey, 'true');

    // Save to Firestore emailLogs
    if (result && Array.isArray(result.logs)) {
      for (const log of result.logs) {
        try {
          await addDoc(collection(db, 'emailLogs'), {
            recipient: log.recipient,
            type: log.type,
            subject: log.subject,
            error: log.error || null,
            status: log.status,
            createdAt: serverTimestamp(),
            uid: userData.uid
          });
        } catch (logErr) {
          console.warn('Could not record to emailLogs collection:', logErr);
        }
      }
    }

    return result;
  } catch (err: any) {
    console.error('Failed to trigger signup notification backend:', err);
    try {
      await addDoc(collection(db, 'emailLogs'), {
        recipient: userData.email,
        type: 'signup_user_welcome',
        subject: 'Welcome to FollowFlow AI 🚀',
        error: err?.message || 'Failed to dispatch email',
        status: 'failed',
        createdAt: serverTimestamp(),
        uid: userData.uid
      });
    } catch (_) {}
  }
}
