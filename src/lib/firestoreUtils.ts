import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Lead, Customer, PurchaseRecord, FollowupRecord, BusinessLeadStatus, StatusHistoryRecord } from '../types';

import { calculateDynamicLeadScore, LeadScoreBreakdown, LeadTemperature } from './leadScoring';

export const BUSINESS_LEAD_STATUSES: BusinessLeadStatus[] = [
  'New Inquiry',
  'Interested',
  'Follow Up Needed',
  'Waiting For Stock',
  'Price Shared',
  'Order Confirmed',
  'Customer Purchased',
  'Not Interested'
];

/**
 * Normalizes phone numbers to standard digit strings for duplicate checking
 */
export function normalizePhone(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

/**
 * Computes automatic business lead score (0-100), temperature (Cold/Warm/Hot), and business status
 * using the dynamic AI lead scoring engine rules:
 * - Phone Present: +20
 * - WhatsApp Present: +10
 * - Email Present: +15
 * - Product/Service Present: +15
 * - Message > 20 Chars: +20
 * - Buying Intent Keywords: +20
 */
export function computeAutoLeadScoreAndStatus(
  inputOrMessage?: string | {
    phone?: string;
    phoneNumber?: string;
    whatsappNumber?: string;
    email?: string;
    productInterest?: string;
    serviceInterest?: string;
    message?: string;
    customerMessage?: string;
    notes?: string;
  },
  productInterestParam?: string,
  extraParams?: { phone?: string; whatsappNumber?: string; email?: string }
): { 
  aiScore: number; 
  leadScore: number;
  leadTemperature: LeadTemperature;
  aiStatus: BusinessLeadStatus; 
  priority: 'High' | 'Normal' | 'Low'; 
  rationale: string;
  breakdown: LeadScoreBreakdown;
} {
  let scoringInput: {
    phone?: string;
    phoneNumber?: string;
    whatsappNumber?: string;
    email?: string;
    productInterest?: string;
    serviceInterest?: string;
    message?: string;
    customerMessage?: string;
    notes?: string;
  };

  if (typeof inputOrMessage === 'object' && inputOrMessage !== null) {
    scoringInput = inputOrMessage;
  } else {
    const msgString = typeof inputOrMessage === 'string' ? inputOrMessage : '';
    scoringInput = {
      message: msgString,
      productInterest: productInterestParam || '',
      phone: extraParams?.phone || '',
      whatsappNumber: extraParams?.whatsappNumber || '',
      email: extraParams?.email || ''
    };
  }

  const breakdown = calculateDynamicLeadScore(scoringInput);
  const text = `${scoringInput.message || scoringInput.customerMessage || scoringInput.notes || ''} ${scoringInput.productInterest || ''}`.toLowerCase().trim();

  let aiStatus: BusinessLeadStatus = 'New Inquiry';

  // 1. Check for Completed Purchase
  if (
    text.includes('purchased') ||
    text.includes('already paid') ||
    text.includes('payment completed') ||
    text.includes('payment done') ||
    text.includes('transferred money') ||
    text.includes('bought this')
  ) {
    aiStatus = 'Customer Purchased';
  }
  // 2. Check for Order Confirmed / Ready to Buy
  else if (
    text.includes('order placed') ||
    text.includes('placed order') ||
    text.includes('confirmed order') ||
    text.includes('confirm order') ||
    text.includes('send invoice') ||
    text.includes('ready to pay') ||
    text.includes('i want to buy today') ||
    text.includes('buy today') ||
    text.includes('book my order') ||
    text.includes('send bank details') ||
    text.includes('send payment link') ||
    text.includes('deliver to')
  ) {
    aiStatus = 'Order Confirmed';
  }
  // 3. Check for Stock Unavailable
  else if (
    text.includes('stock unavailable') ||
    text.includes('out of stock') ||
    text.includes('no stock') ||
    text.includes('when will it arrive') ||
    text.includes('when back in stock') ||
    text.includes('when available') ||
    text.includes('notify when in stock') ||
    text.includes('restock')
  ) {
    aiStatus = 'Waiting For Stock';
  }
  // 4. Check for Not Interested / Cancellation
  else if (
    text.includes('not interested') ||
    text.includes('no thanks') ||
    text.includes('cancel') ||
    text.includes('dont call') ||
    text.includes("don't call") ||
    text.includes('too expensive') ||
    text.includes('wrong number') ||
    text.includes('stop messaging')
  ) {
    aiStatus = 'Not Interested';
  }
  // 5. Check for Follow Up Needed
  else if (
    text.includes('buy tomorrow') ||
    text.includes('will buy tomorrow') ||
    text.includes('call me tomorrow') ||
    text.includes('call tomorrow') ||
    text.includes('call later') ||
    text.includes('call me later') ||
    text.includes('next week') ||
    text.includes('contact next week') ||
    text.includes('remind me') ||
    text.includes('deciding') ||
    text.includes('discussing with partner') ||
    text.includes('follow up')
  ) {
    aiStatus = 'Follow Up Needed';
  }
  // 6. Check for Price Shared
  else if (
    text.includes('price shared') ||
    text.includes('quote sent') ||
    text.includes('quotation sent')
  ) {
    aiStatus = 'Price Shared';
  }
  // 7. Check for High Interest / Inquiring
  else if (
    text.includes('need price') ||
    text.includes('price details') ||
    text.includes('how much') ||
    text.includes('cost') ||
    text.includes('rate') ||
    text.includes('quote') ||
    text.includes('quotation') ||
    text.includes('discount') ||
    text.includes('offer') ||
    text.includes('price list') ||
    text.includes('catalog') ||
    text.includes('brochure') ||
    text.includes('features') ||
    text.includes('specs') ||
    breakdown.hasBuyingIntent
  ) {
    aiStatus = 'Interested';
  }

  return {
    aiScore: breakdown.totalScore,
    leadScore: breakdown.totalScore,
    leadTemperature: breakdown.temperature,
    aiStatus,
    priority: breakdown.priority,
    rationale: breakdown.rationale,
    breakdown
  };
}

/**
 * Searches Firestore for duplicate leads or customers before creating a new lead
 */
export async function checkDuplicateLeadOrCustomer(
  userId: string,
  phone?: string,
  email?: string,
  name?: string
): Promise<{
  isDuplicate: boolean;
  type?: 'lead' | 'customer';
  matchedRecord?: Lead | Customer;
  matchField?: 'phone' | 'email' | 'name';
}> {
  const normPhone = normalizePhone(phone);
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim().toLowerCase();

  if (!userId || (!normPhone && !cleanEmail && !cleanName)) {
    return { isDuplicate: false };
  }

  // 1. Search in leads collection
  try {
    const qLeads = query(
      collection(db, 'leads'),
      where('userId', '==', userId)
    );
    const snapLeads = await getDocs(qLeads);
    for (const d of snapLeads.docs) {
      const data = d.data();
      const leadObj: Lead = { id: d.id, ...data } as Lead;
      
      const leadPhone = normalizePhone(data.phone || data.phoneNumber || data.whatsappNumber);
      if (normPhone && leadPhone) {
        if (normPhone === leadPhone || (normPhone.length >= 7 && leadPhone.endsWith(normPhone.slice(-7)))) {
          return { isDuplicate: true, type: 'lead', matchedRecord: leadObj, matchField: 'phone' };
        }
      }

      if (cleanEmail && data.email && data.email.trim().toLowerCase() === cleanEmail) {
        return { isDuplicate: true, type: 'lead', matchedRecord: leadObj, matchField: 'email' };
      }

      const leadName = (data.customerName || data.name || '').trim().toLowerCase();
      if (cleanName && cleanName.length >= 3 && leadName === cleanName) {
        return { isDuplicate: true, type: 'lead', matchedRecord: leadObj, matchField: 'name' };
      }
    }
  } catch (err) {
    console.warn('[checkDuplicate] Error checking leads:', err);
  }

  // 2. Search in customers collection
  try {
    const qCustomers = query(
      collection(db, 'customers'),
      where('userId', '==', userId)
    );
    const snapCust = await getDocs(qCustomers);
    for (const d of snapCust.docs) {
      const data = d.data();
      const custObj: Customer = { id: d.id, ...data } as Customer;

      const custPhone = normalizePhone(data.phone || data.phoneNumber || data.whatsappNumber);
      if (normPhone && custPhone) {
        if (normPhone === custPhone || (normPhone.length >= 7 && custPhone.endsWith(normPhone.slice(-7)))) {
          return { isDuplicate: true, type: 'customer', matchedRecord: custObj, matchField: 'phone' };
        }
      }

      if (cleanEmail && data.email && data.email.trim().toLowerCase() === cleanEmail) {
        return { isDuplicate: true, type: 'customer', matchedRecord: custObj, matchField: 'email' };
      }

      const custName = (data.name || data.customerName || '').trim().toLowerCase();
      if (cleanName && cleanName.length >= 3 && custName === cleanName) {
        return { isDuplicate: true, type: 'customer', matchedRecord: custObj, matchField: 'name' };
      }
    }
  } catch (err) {
    console.warn('[checkDuplicate] Error checking customers:', err);
  }

  return { isDuplicate: false };
}

export function formatWhatsAppUrl(phoneNumber?: string, text?: string): string {
  const cleanNumber = (phoneNumber || '').replace(/\D/g, '');
  const encodedText = text ? encodeURIComponent(text) : '';
  if (cleanNumber) {
    return `https://wa.me/${cleanNumber}${encodedText ? `?text=${encodedText}` : ''}`;
  }
  return `https://wa.me/${encodedText ? `?text=${encodedText}` : ''}`;
}

export function openWhatsApp(phoneNumber?: string, text?: string) {
  const url = formatWhatsAppUrl(phoneNumber, text);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function handleFirestoreError(error: any, context: string): string {
  const code = error?.code || 'unknown';
  const rawMsg = error?.message || String(error || 'Unknown error');
  console.error(`[Firestore Error - ${context}] (${code}):`, rawMsg);

  if (code === 'permission-denied') {
    return `Permission Denied (${code}): Security rules prevented ${context}. Please ensure you are logged in.`;
  }
  if (code === 'failed-precondition') {
    return `Precondition Failed (${code}): Query may require an index or database is initializing (${rawMsg}).`;
  }
  if (code === 'unavailable') {
    return `Service Unavailable (${code}): Network connection lost or Firestore service is temporarily unreachable.`;
  }
  if (code === 'unauthenticated') {
    return `Unauthenticated (${code}): User session expired. Please log in again.`;
  }
  if (code === 'not-found') {
    return `Not Found (${code}): Requested Firestore document or collection does not exist.`;
  }

  return rawMsg || `Database error during ${context} (code: ${code})`;
}

export function formatDateTime(dateVal: any): string {
  if (!dateVal) return 'N/A';
  try {
    if (typeof dateVal === 'object' && 'seconds' in dateVal) {
      return new Date(dateVal.seconds * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return String(dateVal);
  } catch {
    return String(dateVal);
  }
}

export function getRelativeTime(dateVal: any): string {
  if (!dateVal) return 'Never';
  try {
    let d: Date;
    if (typeof dateVal === 'object' && 'seconds' in dateVal) {
      d = new Date(dateVal.seconds * 1000);
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
  } catch {
    return 'Recently';
  }
}

/**
 * Returns badge styling classes for the 8 simple business statuses
 */
export function getBusinessStatusStyle(status?: string): {
  bg: string;
  text: string;
  border: string;
  badge: string;
  label: string;
} {
  const s = (status || 'New Inquiry').trim();
  switch (s) {
    case 'Interested':
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        label: 'Interested'
      };
    case 'Follow Up Needed':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        label: 'Follow Up Needed'
      };
    case 'Waiting For Stock':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        badge: 'bg-rose-100 text-rose-800 border-rose-200',
        label: 'Waiting For Stock'
      };
    case 'Price Shared':
      return {
        bg: 'bg-cyan-50',
        text: 'text-cyan-700',
        border: 'border-cyan-200',
        badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        label: 'Price Shared'
      };
    case 'Order Confirmed':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        label: 'Order Confirmed'
      };
    case 'Customer Purchased':
    case 'Completed':
    case 'Closed':
      return {
        bg: 'bg-green-50',
        text: 'text-green-800',
        border: 'border-green-300',
        badge: 'bg-green-100 text-green-800 border-green-300 font-bold',
        label: 'Customer Purchased'
      };
    case 'Not Interested':
      return {
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        label: 'Not Interested'
      };
    case 'New Inquiry':
    case 'New':
    case 'Contacted':
    case 'Hot':
    default:
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        label: s === 'Hot' ? 'Interested' : s === 'Contacted' ? 'Follow Up Needed' : 'New Inquiry'
      };
  }
}

/**
 * Moves/converts a lead into the Customers collection without losing history
 */
export async function moveLeadToCustomers(
  userId: string,
  lead: Lead,
  customPurchase?: { item: string; amount: number; notes?: string }
): Promise<string> {
  const todayStr = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  // 1. Fetch any existing follow-ups from the followups collection for this lead
  const followupHistory: FollowupRecord[] = [];
  try {
    const qFollowups = query(
      collection(db, 'followups'),
      where('userId', '==', userId),
      where('leadId', '==', lead.id)
    );
    const followupSnap = await getDocs(qFollowups);
    followupSnap.forEach((docSnap) => {
      const data = docSnap.data();
      followupHistory.push({
        id: docSnap.id,
        date: data.followUpDate || data.dueDate || todayStr,
        channel: data.whatsappNumber ? 'WhatsApp' : data.email ? 'Email' : 'Direct',
        note: data.generatedMessage || data.message || 'Follow-up interaction',
        summary: data.generatedSubject || data.task || `Status: ${data.status}`
      });
    });
  } catch (err) {
    console.warn('[moveLeadToCustomers] Error fetching lead followups:', err);
  }

  // Also include the original lead inquiry as an initial interaction note if no followups existed
  if (followupHistory.length === 0 && (lead.message || lead.notes || lead.productInterest)) {
    followupHistory.push({
      id: `init-${Date.now()}`,
      date: todayStr,
      channel: 'Lead Conversion',
      note: lead.message || lead.notes || `Inquired about ${lead.productInterest || 'services'}`,
      summary: 'Initial lead conversion to customer database'
    });
  }

  // 2. Build initial purchase history
  const purchaseItemName = customPurchase?.item || lead.productInterest || 'Initial Service / Order';
  const purchaseAmount = Number(customPurchase?.amount) || (lead.leadScore ? lead.leadScore * 10 : 100);
  const purchaseHistory: PurchaseRecord[] = [
    {
      id: `purch-${Date.now()}`,
      item: purchaseItemName,
      amount: purchaseAmount,
      date: todayStr,
      notes: customPurchase?.notes || lead.notes || 'Deal closed & converted from Lead'
    }
  ];

  // 3. Check if customer already exists for this user (by phone or email or exact name)
  let existingCustomerDocId: string | null = null;
  let existingCustomerData: any = null;

  try {
    const qCust = query(
      collection(db, 'customers'),
      where('userId', '==', userId)
    );
    const custSnap = await getDocs(qCust);
    custSnap.forEach((docSnap) => {
      const c = docSnap.data();
      const matchPhone = lead.phone && (c.phone === lead.phone || c.whatsappNumber === lead.phone || c.phone === lead.phoneNumber);
      const matchEmail = lead.email && c.email && c.email.toLowerCase() === lead.email.toLowerCase();
      const matchName = lead.customerName && c.name && c.name.toLowerCase() === lead.customerName.toLowerCase();
      
      if (matchPhone || matchEmail || matchName) {
        existingCustomerDocId = docSnap.id;
        existingCustomerData = c;
      }
    });
  } catch (err) {
    console.warn('[moveLeadToCustomers] Error checking existing customer:', err);
  }

  let customerId = '';

  if (existingCustomerDocId && existingCustomerData) {
    // Append to existing customer history
    const mergedPurchases = [
      ...(Array.isArray(existingCustomerData.purchaseHistory) ? existingCustomerData.purchaseHistory : []),
      ...purchaseHistory
    ];
    const mergedFollowups = [
      ...(Array.isArray(existingCustomerData.followupHistory) ? existingCustomerData.followupHistory : []),
      ...followupHistory
    ];
    const totalSpend = mergedPurchases.reduce((acc: number, p: PurchaseRecord) => acc + (Number(p.amount) || 0), 0);

    await updateDoc(doc(db, 'customers', existingCustomerDocId), {
      name: lead.customerName || existingCustomerData.name,
      phone: lead.phone || existingCustomerData.phone || '',
      phoneNumber: lead.phone || existingCustomerData.phone || '',
      whatsappNumber: lead.whatsappNumber || lead.phone || existingCustomerData.whatsappNumber || '',
      email: lead.email || existingCustomerData.email || '',
      purchaseHistory: mergedPurchases,
      followupHistory: mergedFollowups,
      totalPurchases: mergedPurchases.length,
      totalSpend: totalSpend,
      lastContactDate: nowIso,
      status: 'Active',
      updatedAt: serverTimestamp()
    });
    customerId = existingCustomerDocId;
  } else {
    // Create new customer document
    const newDoc = await addDoc(collection(db, 'customers'), {
      userId,
      name: lead.customerName,
      customerName: lead.customerName,
      phone: lead.phone || lead.phoneNumber || '',
      phoneNumber: lead.phone || lead.phoneNumber || '',
      whatsappNumber: lead.whatsappNumber || lead.phone || lead.phoneNumber || '',
      email: lead.email || '',
      purchaseHistory,
      followupHistory,
      totalPurchases: purchaseHistory.length,
      totalSpend: purchaseAmount,
      lastContactDate: nowIso,
      status: 'Active',
      sourceLeadId: lead.id,
      notes: lead.notes || lead.message || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    customerId = newDoc.id;
  }

  // 4. Update Lead status to Completed in leads collection
  await updateDoc(doc(db, 'leads', lead.id), {
    status: 'Completed',
    updatedAt: serverTimestamp()
  });

  // 5. Add Activity log
  await addDoc(collection(db, 'activities'), {
    userId,
    type: 'lead_converted',
    title: `Moved completed lead "${lead.customerName}" into Customers collection`,
    createdAt: serverTimestamp()
  });

  return customerId;
}
