import nodemailer from 'nodemailer';

export interface EmailLog {
  id: string;
  recipient: string;
  type: 'contact_admin' | 'contact_user_confirmation' | 'signup_admin' | 'signup_user_welcome' | 'test_email';
  subject: string;
  error: string | null;
  status: 'sent' | 'failed';
  createdAt: string;
  details?: Record<string, any>;
}

// In-memory buffer for logs
const inMemoryLogs: EmailLog[] = [];

export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || 'admin@followflow.ai';
}

/**
 * Creates or retrieves a nodemailer transporter
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  // Fallback: JSON transport that logs outgoing mail cleanly without failing
  return nodemailer.createTransport({
    jsonTransport: true
  });
}

/**
 * Low-level send email function that catches errors, writes logs, and never throws
 */
export async function sendEmailSafely(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  type: EmailLog['type'];
  details?: Record<string, any>;
}): Promise<EmailLog> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fromAddress = process.env.SMTP_FROM || `FollowFlow AI <no-reply@followflow.ai>`;
  const createdAt = new Date().toISOString();

  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br/>')
    });

    console.log(`[Email Notification] Sent [${options.type}] to ${options.to} (Subject: "${options.subject}")`);

    const logEntry: EmailLog = {
      id: logId,
      recipient: options.to,
      type: options.type,
      subject: options.subject,
      error: null,
      status: 'sent',
      createdAt,
      details: {
        messageId: info.messageId,
        ...options.details
      }
    };

    inMemoryLogs.unshift(logEntry);
    if (inMemoryLogs.length > 200) inMemoryLogs.pop();

    return logEntry;
  } catch (err: any) {
    console.error(`[Email Notification Error] Failed to send to ${options.to}:`, err?.message || err);

    const logEntry: EmailLog = {
      id: logId,
      recipient: options.to,
      type: options.type,
      subject: options.subject,
      error: err?.message || 'Unknown email sending failure',
      status: 'failed',
      createdAt,
      details: options.details
    };

    inMemoryLogs.unshift(logEntry);
    if (inMemoryLogs.length > 200) inMemoryLogs.pop();

    return logEntry;
  }
}

/**
 * 1. CONTACT US NOTIFICATIONS (Sends 2 emails)
 */
export async function handleContactFormEmails(data: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  createdAt?: string;
}) {
  const adminEmail = getAdminEmail();
  const name = data.name || 'Anonymous';
  const email = data.email;
  const phone = data.phone || 'Not provided';
  const subject = data.subject || 'General Inquiry';
  const message = data.message || '';
  const submittedAt = data.createdAt || new Date().toLocaleString('en-US');

  // EMAIL #1 → ADMIN NOTIFICATION
  const adminSubject = `🔔 New Contact Form Submission`;
  const adminText = `A new contact request has been received.

Name: ${name}
Email: ${email}
Phone: ${phone}
Subject: ${subject}

Message:
${message}

Submitted At:
${submittedAt}`;

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #4f46e5; margin-top: 0;">🔔 New Contact Form Submission</h2>
      <p style="color: #374151; font-size: 15px;">A new contact request has been received from the website.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 120px;">Name:</td><td style="color: #111827;">${name}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Email:</td><td style="color: #111827;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Phone:</td><td style="color: #111827;">${phone}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Subject:</td><td style="color: #111827;">${subject}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold; vertical-align: top;">Message:</td><td style="color: #111827; background: #f9fafb; padding: 12px; border-radius: 8px;">${message.replace(/\n/g, '<br/>')}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Submitted At:</td><td style="color: #111827;">${submittedAt}</td></tr>
      </table>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
        FollowFlow AI Notification System
      </div>
    </div>
  `;

  // EMAIL #2 → USER CONFIRMATION
  const userSubject = `Thank you for contacting FollowFlow AI`;
  const userText = `Hi ${name},

Thank you for contacting FollowFlow AI.

We have received your inquiry and our team will review it shortly.

Our support team will get back to you as soon as possible.

Regards,
FollowFlow AI Team`;

  const userHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #4f46e5; margin-top: 0;">Thank You for Contacting Us</h2>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">Thank you for contacting <strong>FollowFlow AI</strong>.</p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">We have received your inquiry and our team will review it shortly.</p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">Our support team will get back to you as soon as possible.</p>
      <div style="margin: 28px 0 16px 0; padding: 16px; background: #f8faff; border-radius: 8px; border-left: 4px solid #4f46e5;">
        <p style="margin: 0; font-size: 14px; color: #4338ca; font-weight: bold;">Your Submitted Message:</p>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #4b5563;">"${message}"</p>
      </div>
      <p style="color: #374151; font-size: 15px; margin-top: 24px;">Regards,<br/><strong>FollowFlow AI Team</strong></p>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
        FollowFlow AI • Automated Sales & Follow-Up Platform
      </div>
    </div>
  `;

  const [adminLog, userLog] = await Promise.all([
    sendEmailSafely({
      to: adminEmail,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
      type: 'contact_admin',
      details: { name, email, phone, subject }
    }),
    sendEmailSafely({
      to: email,
      subject: userSubject,
      text: userText,
      html: userHtml,
      type: 'contact_user_confirmation',
      details: { name }
    })
  ]);

  return [adminLog, userLog];
}

/**
 * 2. USER SIGNUP NOTIFICATIONS (Sends 2 emails)
 */
export async function handleUserSignupEmails(data: {
  uid: string;
  email: string;
  displayName: string;
  provider?: string;
  createdAt?: string;
}) {
  const adminEmail = getAdminEmail();
  const displayName = data.displayName || data.email?.split('@')[0] || 'User';
  const email = data.email;
  const uid = data.uid;
  const signupTime = data.createdAt || new Date().toLocaleString('en-US');

  // EMAIL #1 → ADMIN
  const adminSubject = `🎉 New User Registration`;
  const adminText = `A new user has registered.

Name: ${displayName}
Email: ${email}
UID: ${uid}
Signup Time: ${signupTime}`;

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #10b981; margin-top: 0;">🎉 New User Registration</h2>
      <p style="color: #374151; font-size: 15px;">A new user has created an account on FollowFlow AI.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 120px;">Name:</td><td style="color: #111827;">${displayName}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Email:</td><td style="color: #111827;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">UID:</td><td style="color: #6b7280; font-family: monospace; font-size: 13px;">${uid}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Provider:</td><td style="color: #111827;">${data.provider || 'Password / Google'}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Signup Time:</td><td style="color: #111827;">${signupTime}</td></tr>
      </table>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
        FollowFlow AI Admin Monitor
      </div>
    </div>
  `;

  // EMAIL #2 → USER
  const userSubject = `Welcome to FollowFlow AI 🚀`;
  const userText = `Hi ${displayName},

Welcome to FollowFlow AI.

Your account has been created successfully.

You can now:

✅ Manage Leads
✅ Track Customers
✅ Create Follow-Ups
✅ Use AI Assistant
✅ Grow your business

Login and start managing your customer relationships today.

Regards,
FollowFlow AI Team`;

  const userHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #4f46e5; margin-top: 0;">Welcome to FollowFlow AI 🚀</h2>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi <strong>${displayName}</strong>,</p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">Welcome to FollowFlow AI. Your account has been created successfully.</p>
      
      <div style="margin: 20px 0; padding: 20px; background: #f8faff; border-radius: 10px; border: 1px solid #e0e7ff;">
        <p style="margin: 0 0 12px 0; font-weight: bold; color: #3730a3;">You can now:</p>
        <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.8;">
          <li>✅ Manage Leads</li>
          <li>✅ Track Customers</li>
          <li>✅ Create Follow-Ups</li>
          <li>✅ Use AI Assistant</li>
          <li>✅ Grow your business</li>
        </ul>
      </div>

      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Login and start managing your customer relationships today.
      </p>

      <p style="color: #374151; font-size: 15px; margin-top: 24px;">
        Regards,<br/>
        <strong>FollowFlow AI Team</strong>
      </p>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
        FollowFlow AI • Automated Sales & Follow-Up Platform
      </div>
    </div>
  `;

  const [adminLog, userLog] = await Promise.all([
    sendEmailSafely({
      to: adminEmail,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
      type: 'signup_admin',
      details: { uid, displayName, email }
    }),
    sendEmailSafely({
      to: email,
      subject: userSubject,
      text: userText,
      html: userHtml,
      type: 'signup_user_welcome',
      details: { uid, displayName }
    })
  ]);

  return [adminLog, userLog];
}

export function getRecentEmailLogs(): EmailLog[] {
  return inMemoryLogs;
}
