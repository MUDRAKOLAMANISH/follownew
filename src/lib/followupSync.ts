import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Lead, FollowUp, BusinessLeadStatus } from '../types';

export const FOLLOWUP_TRIGGER_STATUSES: BusinessLeadStatus[] = [
  'Follow Up Needed',
  'Waiting For Stock',
  'Price Shared'
];

export const FOLLOWUP_REVERSE_STATUSES: string[] = [
  'Customer Purchased',
  'Not Interested',
  'Order Confirmed',
  'New Inquiry',
  'Interested',
  'Completed',
  'Closed'
];

/**
 * Checks if status triggers an automatic Follow-Up creation/update
 */
export function isFollowupTriggerStatus(status?: string): boolean {
  if (!status) return false;
  const s = status.trim();
  return (
    s === 'Follow Up Needed' || 
    s === 'Waiting For Stock' || 
    s === 'Price Shared'
  );
}

/**
 * Checks if status triggers reverse sync (marking active follow-up completed/removed)
 */
export function isFollowupRemoveStatus(status?: string): boolean {
  if (!status) return false;
  const s = status.trim();
  return (
    s === 'Customer Purchased' || 
    s === 'Not Interested' || 
    s === 'Order Confirmed' ||
    s === 'Completed' ||
    s === 'Closed'
  );
}

/**
 * Automatically creates, updates, or reverse-syncs follow-up records in Firestore
 * when a Lead status changes.
 * 
 * Collection: followups
 * Fields conform to specification:
 * {
 *   followupId,
 *   leadId,
 *   customerName,
 *   phone,
 *   email,
 *   customerMessage,
 *   productInterest,
 *   leadScore,
 *   status: "Pending" | "Completed",
 *   sourceStatus,
 *   createdAt,
 *   dueDate,
 *   userId
 * }
 */
export async function syncLeadFollowup(userId: string, lead: Lead): Promise<void> {
  if (!userId || !lead || !lead.id) return;

  const currentStatus = String(lead.status || lead.aiStatus || 'New Inquiry').trim();
  const phone = lead.phone || lead.phoneNumber || lead.whatsappNumber || '';
  const customerName = lead.customerName || lead.name || 'Valued Customer';
  const email = lead.email || '';
  const customerMessage = lead.message || lead.notes || lead.customerMessage || lead.productInterest || 'Follow up on customer inquiry';
  const productInterest = lead.productInterest || '';
  const leadScore = typeof lead.leadScore === 'number' 
    ? lead.leadScore 
    : (typeof lead.aiScore === 'number' ? lead.aiScore : 75);
  const priority = leadScore > 75 ? 'High' : (lead.priority || 'Normal');
  const defaultDueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dueDate = lead.lastContactDate || defaultDueDate;

  console.log(`[FollowUpSync] Processing lead ${lead.id} (${customerName}) -> status: "${currentStatus}"`);

  // 1. AUTOMATIC FOLLOW-UP CREATION / UPDATE
  if (isFollowupTriggerStatus(currentStatus)) {
    try {
      // Check for existing active/pending follow-up for this lead to PREVENT DUPLICATES
      const rootQuery = query(
        collection(db, 'followups'),
        where('userId', '==', userId),
        where('leadId', '==', lead.id)
      );
      const rootSnap = await getDocs(rootQuery);

      let existingPendingDocId: string | null = null;
      let existingAnyDocId: string | null = null;

      rootSnap.forEach((d) => {
        const data = d.data();
        existingAnyDocId = d.id;
        const isCompleted = data.completed === true || data.status === 'Completed' || data.status === 'completed';
        if (!isCompleted) {
          existingPendingDocId = d.id;
        }
      });

      // Also check subcollection for backwards compatibility
      const subQuery = query(
        collection(db, 'users', userId, 'followups'),
        where('leadId', '==', lead.id)
      );
      const subSnap = await getDocs(subQuery).catch(() => ({ docs: [] as any[], forEach: () => {} }));
      let subPendingDocId: string | null = null;
      subSnap.forEach((d: any) => {
        const data = d.data();
        const isCompleted = data.completed === true || data.status === 'Completed' || data.status === 'completed';
        if (!isCompleted) {
          subPendingDocId = d.id;
        }
      });

      const targetDocId = existingPendingDocId || subPendingDocId || existingAnyDocId;

      if (targetDocId) {
        // UPDATE EXISTING FOLLOW-UP INSTEAD OF CREATING DUPLICATE
        console.log(`[FollowUpSync] Found existing follow-up (${targetDocId}), updating in-place.`);
        
        const updatePayload = {
          followupId: targetDocId,
          leadId: lead.id,
          customerName,
          phone,
          phoneNumber: phone,
          whatsappNumber: phone,
          email,
          customerMessage,
          message: customerMessage,
          productInterest,
          leadScore,
          priority,
          status: 'Pending',
          sourceStatus: currentStatus,
          dueDate,
          followUpDate: dueDate,
          completed: false,
          userId,
          updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, 'followups', targetDocId), updatePayload, { merge: true });
        
        // Mirror in subcollection
        await setDoc(doc(db, 'users', userId, 'followups', targetDocId), {
          ...updatePayload,
          id: targetDocId
        }, { merge: true }).catch(() => {});

      } else {
        // CREATE NEW FOLLOW-UP DOCUMENT IN FIRESTORE
        const newDocRef = doc(collection(db, 'followups'));
        const newId = newDocRef.id;
        console.log(`[FollowUpSync] Creating new follow-up document in followups collection: ${newId}`);

        const createPayload = {
          followupId: newId,
          id: newId,
          leadId: lead.id,
          customerName,
          phone,
          phoneNumber: phone,
          whatsappNumber: phone,
          email,
          customerMessage,
          message: customerMessage,
          productInterest,
          leadScore,
          priority,
          status: 'Pending',
          sourceStatus: currentStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          dueDate,
          followUpDate: dueDate,
          completed: false,
          userId
        };

        await setDoc(newDocRef, createPayload);

        // Mirror in subcollection for backward compatibility
        await setDoc(doc(db, 'users', userId, 'followups', newId), createPayload).catch(() => {});

        // Log system activity
        try {
          await addDoc(collection(db, 'activities'), {
            userId,
            type: 'followup_created',
            title: `Follow-up auto-created for ${customerName} (${currentStatus})`,
            createdAt: serverTimestamp()
          });
        } catch (actErr) {
          console.warn('[FollowUpSync] Activity note:', actErr);
        }
      }
    } catch (err) {
      console.error('[FollowUpSync] Error syncing follow-up on trigger status:', err);
    }
  }

  // 2. REVERSE SYNC (Status changes to Customer Purchased, Not Interested, Order Confirmed, etc.)
  else if (isFollowupRemoveStatus(currentStatus)) {
    try {
      console.log(`[FollowUpSync] Reverse sync: closing active follow-ups for lead ${lead.id} due to status "${currentStatus}"`);

      // Query root collection
      const rootQuery = query(
        collection(db, 'followups'),
        where('userId', '==', userId),
        where('leadId', '==', lead.id)
      );
      const rootSnap = await getDocs(rootQuery);

      const updatePromises: Promise<any>[] = [];

      rootSnap.forEach((d) => {
        const data = d.data();
        const isCompleted = data.completed === true || data.status === 'Completed' || data.status === 'completed';
        if (!isCompleted) {
          updatePromises.push(
            updateDoc(doc(db, 'followups', d.id), {
              status: 'Completed',
              completed: true,
              closedReason: currentStatus,
              updatedAt: serverTimestamp()
            })
          );
        }
      });

      // Query user subcollection
      const subQuery = query(
        collection(db, 'users', userId, 'followups'),
        where('leadId', '==', lead.id)
      );
      const subSnap = await getDocs(subQuery).catch(() => ({ docs: [] as any[], forEach: () => {} }));
      subSnap.forEach((d: any) => {
        const data = d.data();
        const isCompleted = data.completed === true || data.status === 'Completed' || data.status === 'completed';
        if (!isCompleted) {
          updatePromises.push(
            updateDoc(doc(db, 'users', userId, 'followups', d.id), {
              status: 'Completed',
              completed: true,
              closedReason: currentStatus,
              updatedAt: serverTimestamp()
            }).catch(() => {})
          );
        }
      });

      await Promise.all(updatePromises);
      console.log(`[FollowUpSync] Reverse sync completed: closed ${updatePromises.length} follow-ups.`);
    } catch (err) {
      console.error('[FollowUpSync] Error in reverse sync:', err);
    }
  }
}

/**
 * Migration function: Scans all existing leads for the user.
 * If any lead has status "Follow Up Needed", "Waiting For Stock", or "Price Shared"
 * but has no active pending follow-up, automatically creates the follow-up record.
 */
export async function runExistingLeadsFollowupMigration(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const leadsQuery = query(collection(db, 'leads'), where('userId', '==', userId));
    const leadsSnap = await getDocs(leadsQuery);

    if (leadsSnap.empty) return 0;

    // Fetch existing follow-ups
    const rootFollowupsQuery = query(collection(db, 'followups'), where('userId', '==', userId));
    const rootSnap = await getDocs(rootFollowupsQuery).catch(() => ({ docs: [] as any[] }));

    const existingLeadIdsWithPendingFollowup = new Set<string>();

    rootSnap.docs.forEach((d: any) => {
      const data = d.data();
      const isCompleted = data.completed === true || data.status === 'Completed' || data.status === 'completed';
      if (data.leadId && !isCompleted) {
        existingLeadIdsWithPendingFollowup.add(data.leadId);
      }
    });

    let createdCount = 0;

    for (const d of leadsSnap.docs) {
      const leadData = d.data();
      const leadId = d.id;
      const status = String(leadData.status || leadData.aiStatus || '').trim();

      if (isFollowupTriggerStatus(status) && !existingLeadIdsWithPendingFollowup.has(leadId)) {
        const leadObj: Lead = {
          id: leadId,
          ...leadData,
          customerName: leadData.customerName || leadData.name || 'Valued Lead',
          leadScore: Number(leadData.leadScore ?? leadData.aiScore ?? 75),
          priority: leadData.priority || 'Normal',
          status: status as BusinessLeadStatus,
          userId
        } as Lead;

        await syncLeadFollowup(userId, leadObj);
        existingLeadIdsWithPendingFollowup.add(leadId);
        createdCount++;
      }
    }

    if (createdCount > 0) {
      console.log(`[FollowUpSync] Migration backfilled ${createdCount} follow-up records.`);
    }
    return createdCount;
  } catch (err) {
    console.error('[FollowUpSync] Migration error:', err);
    return 0;
  }
}

/**
 * Marks a follow-up as complete (or reopens as pending) in Firestore
 */
export async function markFollowupCompletedInFirestore(
  userId: string, 
  followupId: string, 
  customerName?: string,
  completed: boolean = true
): Promise<void> {
  if (!userId || !followupId) return;

  const updateData = {
    completed: completed,
    status: completed ? 'Completed' : 'Pending',
    updatedAt: serverTimestamp()
  };

  const tasks: Promise<any>[] = [];

  // Update root collection
  tasks.push(
    updateDoc(doc(db, 'followups', followupId), updateData).catch(err => {
      console.warn('[markFollowupComplete] Root doc update:', err.message);
    })
  );

  // Update user subcollection
  tasks.push(
    updateDoc(doc(db, 'users', userId, 'followups', followupId), updateData).catch(err => {
      console.warn('[markFollowupComplete] Sub doc update:', err.message);
    })
  );

  await Promise.all(tasks);

  // Log activity
  try {
    await addDoc(collection(db, 'activities'), {
      userId,
      type: completed ? 'followup_completed' : 'followup_reopened',
      title: `${completed ? 'Completed' : 'Reopened'} follow-up for: ${customerName || 'Customer'}`,
      createdAt: serverTimestamp()
    });
  } catch (actErr) {
    console.warn('[markFollowupComplete] Activity note:', actErr);
  }
}

/**
 * Deletes a follow-up document from Firestore
 */
export async function deleteFollowupFromFirestore(
  userId: string,
  followupId: string,
  customerName?: string
): Promise<void> {
  if (!userId || !followupId) return;

  const tasks: Promise<any>[] = [];

  tasks.push(
    deleteDoc(doc(db, 'followups', followupId)).catch(err => {
      console.warn('[deleteFollowup] Root doc delete:', err.message);
    })
  );

  tasks.push(
    deleteDoc(doc(db, 'users', userId, 'followups', followupId)).catch(err => {
      console.warn('[deleteFollowup] Sub doc delete:', err.message);
    })
  );

  await Promise.all(tasks);

  try {
    await addDoc(collection(db, 'activities'), {
      userId,
      type: 'followup_deleted',
      title: `Deleted follow-up for: ${customerName || 'Customer'}`,
      createdAt: serverTimestamp()
    });
  } catch (actErr) {
    console.warn('[deleteFollowup] Activity note:', actErr);
  }
}
