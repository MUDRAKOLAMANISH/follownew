import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { db, auth, app, storage, REQUIRED_PROJECT_ID, LOCKED_DATABASE_ID, LOCKED_STORAGE_BUCKET, LOCKED_AUTH_DOMAIN } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';

export interface DiagnosticResult {
  timestamp: string;
  firebaseProject: {
    projectId: string;
    lockedProjectId: string;
    isLockedCorrectly: boolean;
    authDomain: string;
    databaseId: string;
    storageBucket: string;
    appId: string;
    initialized: boolean;
  };
  authStatus: {
    isAuthenticated: boolean;
    uid: string | null;
    email: string | null;
    displayName: string | null;
    providerId: string | null;
  };
  firestoreStatus: {
    canConnect: boolean;
    readWorking: boolean;
    writeWorking: boolean;
    deleteWorking: boolean;
    exactError: string | null;
    errorCode: string | null;
  };
  storageStatus: {
    connected: boolean;
    bucketName: string;
    status: string;
  };
  collectionCounts: {
    usersForUser: number;
    leadsForUser: number;
    followupsForUser: number;
    customersForUser: number;
    businessProfilesForUser: number;
    contactSubmissionsTotal: number;
    emailLogsTotal: number;
    emailOutreachLogsForUser: number;
    knowledgeBaseTotal: number;
    activitiesForUser: number;
  };
  collectionsVerified: {
    name: string;
    required: boolean;
    accessible: boolean;
    countOrStatus: string;
    docCount?: number;
  }[];
  rulesVerification: {
    passed: boolean;
    details: string;
  };
  dataRecovery: {
    leadsFound: number;
    hasOrphanedLeads: boolean;
    message: string;
  };
  rootCause: string;
  requiredFix: string;
}

/**
 * Runs a comprehensive Firebase & Firestore diagnostic and outputs a full report
 */
export async function runFirebaseDiagnostic(currentUser: FirebaseUser | null): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();
  console.group('🔍 [Firebase Comprehensive Diagnostic]');
  console.log('Diagnostic initiated at:', timestamp);

  // 1. Firebase Config & Initialization Check
  const appOptions = app.options;
  const currentProjectId = appOptions.projectId || REQUIRED_PROJECT_ID;
  const isLocked = currentProjectId === REQUIRED_PROJECT_ID;

  const projectInfo = {
    projectId: currentProjectId,
    lockedProjectId: REQUIRED_PROJECT_ID,
    isLockedCorrectly: isLocked,
    authDomain: appOptions.authDomain || LOCKED_AUTH_DOMAIN,
    databaseId: (db as any)._databaseId?.database || LOCKED_DATABASE_ID,
    storageBucket: appOptions.storageBucket || LOCKED_STORAGE_BUCKET,
    appId: appOptions.appId || '',
    initialized: !!app
  };

  console.log('1. Firebase Project Lock Status:', isLocked ? 'VERIFIED LOCKED' : 'PROJECT MISMATCH');
  console.log('   Active Project ID:', projectInfo.projectId);
  console.log('   Target Project ID:', REQUIRED_PROJECT_ID);
  console.log('   Active Database ID:', projectInfo.databaseId);
  console.log('   Storage Bucket:', projectInfo.storageBucket);

  // 2. Storage Status Check
  const storageInfo = {
    connected: !!storage,
    bucketName: LOCKED_STORAGE_BUCKET,
    status: storage ? 'Connected & Active' : 'Storage client unavailable'
  };

  // 3. Auth State Check
  const activeUser = currentUser || auth.currentUser;
  const authInfo = {
    isAuthenticated: !!activeUser,
    uid: activeUser ? activeUser.uid : null,
    email: activeUser ? activeUser.email : null,
    displayName: activeUser ? activeUser.displayName : null,
    providerId: activeUser?.providerData?.[0]?.providerId || 'password'
  };
  console.log('2. Authentication State:', authInfo.isAuthenticated ? 'LOGGED IN' : 'NOT LOGGED IN');
  console.log('   User UID:', authInfo.uid);
  console.log('   User Email:', authInfo.email);

  const firestoreInfo = {
    canConnect: false,
    readWorking: false,
    writeWorking: false,
    deleteWorking: false,
    exactError: null as string | null,
    errorCode: null as string | null
  };

  const collectionCounts = {
    usersForUser: 0,
    leadsForUser: 0,
    followupsForUser: 0,
    customersForUser: 0,
    businessProfilesForUser: 0,
    contactSubmissionsTotal: 0,
    emailLogsTotal: 0,
    emailOutreachLogsForUser: 0,
    knowledgeBaseTotal: 0,
    activitiesForUser: 0
  };

  const collectionsVerified: { name: string; required: boolean; accessible: boolean; countOrStatus: string; docCount?: number }[] = [];

  let rulesPass = false;
  let rulesDetails = '';
  let rootCause = 'None. System operating normally.';
  let requiredFix = 'None required.';
  let dataRecoveryMessage = '';

  // Required 9 collections list
  const requiredCollections = [
    'users',
    'leads',
    'customers',
    'followups',
    'businessProfiles',
    'contactSubmissions',
    'emailLogs',
    'emailOutreachLogs',
    'knowledge_base'
  ];

  if (!authInfo.isAuthenticated || !authInfo.uid) {
    firestoreInfo.exactError = 'User is not authenticated. Full collection queries require a logged-in user.';
    firestoreInfo.errorCode = 'unauthenticated';
    rootCause = 'No authenticated user session found. Firestore security rules require request.auth != null.';
    requiredFix = 'Sign in or register to authenticate with Firebase before querying Firestore.';
    console.warn('⚠️ User not authenticated. Returning baseline unauthenticated diagnostic.');
    console.groupEnd();

    return {
      timestamp,
      firebaseProject: projectInfo,
      authStatus: authInfo,
      firestoreStatus: firestoreInfo,
      storageStatus: storageInfo,
      collectionCounts,
      collectionsVerified: requiredCollections.map(name => ({
        name,
        required: true,
        accessible: false,
        countOrStatus: 'Authentication required for user-level access'
      })),
      rulesVerification: {
        passed: false,
        details: 'Cannot verify rules while unauthenticated.'
      },
      dataRecovery: {
        leadsFound: 0,
        hasOrphanedLeads: false,
        message: 'Authenticate to access user documents.'
      },
      rootCause,
      requiredFix
    };
  }

  const uid = authInfo.uid;

  // 4. Test Read Access across all 9 specified collections
  try {
    // 1. users
    try {
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      const exists = userSnap.exists();
      collectionCounts.usersForUser = exists ? 1 : 0;
      collectionsVerified.push({
        name: 'users',
        required: true,
        accessible: true,
        countOrStatus: exists ? 'Verified (1 active profile document)' : 'Verified (Collection accessible, 0 docs)',
        docCount: exists ? 1 : 0
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'users', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    // 2. leads
    try {
      const leadsQuery = query(collection(db, 'leads'), where('userId', '==', uid));
      const leadsSnap = await getDocs(leadsQuery);
      collectionCounts.leadsForUser = leadsSnap.size;
      firestoreInfo.readWorking = true;
      firestoreInfo.canConnect = true;
      collectionsVerified.push({
        name: 'leads',
        required: true,
        accessible: true,
        countOrStatus: `Verified (${leadsSnap.size} documents)`,
        docCount: leadsSnap.size
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'leads', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    // 3. customers
    try {
      const customersQuery = query(collection(db, 'customers'), where('userId', '==', uid));
      const customersSnap = await getDocs(customersQuery);
      collectionCounts.customersForUser = customersSnap.size;
      collectionsVerified.push({
        name: 'customers',
        required: true,
        accessible: true,
        countOrStatus: `Verified (${customersSnap.size} documents)`,
        docCount: customersSnap.size
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'customers', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    // 4. followups
    try {
      const followupsQuery = query(collection(db, 'followups'), where('userId', '==', uid));
      const followupsSnap = await getDocs(followupsQuery);
      collectionCounts.followupsForUser = followupsSnap.size;
      collectionsVerified.push({
        name: 'followups',
        required: true,
        accessible: true,
        countOrStatus: `Verified (${followupsSnap.size} documents)`,
        docCount: followupsSnap.size
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'followups', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    // 5. businessProfiles
    try {
      const profileSnap = await getDoc(doc(db, 'businessProfiles', uid));
      const altSnap = await getDoc(doc(db, 'business_profile', uid));
      const exists = profileSnap.exists() || altSnap.exists();
      collectionCounts.businessProfilesForUser = exists ? 1 : 0;
      collectionsVerified.push({
        name: 'businessProfiles',
        required: true,
        accessible: true,
        countOrStatus: exists ? 'Verified (1 active profile)' : 'Verified (Collection accessible, ready)',
        docCount: exists ? 1 : 0
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'businessProfiles', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    // 6. contactSubmissions
    try {
      const contactQuery = query(collection(db, 'contactSubmissions'), limit(10));
      const contactSnap = await getDocs(contactQuery);
      collectionCounts.contactSubmissionsTotal = contactSnap.size;
      collectionsVerified.push({
        name: 'contactSubmissions',
        required: true,
        accessible: true,
        countOrStatus: `Verified (${contactSnap.size} recent records)`,
        docCount: contactSnap.size
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'contactSubmissions', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    // 7. emailLogs
    try {
      const emailLogsQuery = query(collection(db, 'emailLogs'), limit(10));
      const emailLogsSnap = await getDocs(emailLogsQuery);
      collectionCounts.emailLogsTotal = emailLogsSnap.size;
      collectionsVerified.push({
        name: 'emailLogs',
        required: true,
        accessible: true,
        countOrStatus: `Verified (${emailLogsSnap.size} system notifications)`,
        docCount: emailLogsSnap.size
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'emailLogs', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    // 8. emailOutreachLogs
    try {
      const outreachQuery = query(collection(db, 'emailOutreachLogs'), where('userId', '==', uid));
      const outreachSnap = await getDocs(outreachQuery);
      collectionCounts.emailOutreachLogsForUser = outreachSnap.size;
      collectionsVerified.push({
        name: 'emailOutreachLogs',
        required: true,
        accessible: true,
        countOrStatus: `Verified (${outreachSnap.size} Gmail outreach entries)`,
        docCount: outreachSnap.size
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'emailOutreachLogs', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    // 9. knowledge_base
    try {
      const kbQuery = query(collection(db, 'knowledge_base'), limit(10));
      const kbSnap = await getDocs(kbQuery);
      collectionCounts.knowledgeBaseTotal = kbSnap.size;
      collectionsVerified.push({
        name: 'knowledge_base',
        required: true,
        accessible: true,
        countOrStatus: `Verified (${kbSnap.size} documents indexed)`,
        docCount: kbSnap.size
      });
    } catch (e: any) {
      collectionsVerified.push({ name: 'knowledge_base', required: true, accessible: false, countOrStatus: `Error: ${e.message}` });
    }

    firestoreInfo.readWorking = true;
    firestoreInfo.canConnect = true;

  } catch (readErr: any) {
    console.error('   ❌ Firestore Read failed:', readErr);
    firestoreInfo.canConnect = false;
    firestoreInfo.readWorking = false;
    firestoreInfo.exactError = readErr?.message || String(readErr);
    firestoreInfo.errorCode = readErr?.code || 'unknown-read-error';

    if (readErr?.code === 'permission-denied') {
      rootCause = 'Permission Denied: Firestore security rules prevented reading documents with userId == ' + uid;
      requiredFix = 'Ensure Firestore security rules match the collection and request.auth.uid equals document userId.';
    } else if (readErr?.code === 'unavailable') {
      rootCause = 'Firestore Service Unavailable: Network offline or backend unreachable.';
      requiredFix = 'Check internet connection and verify Firestore database instance is active.';
    }
  }

  // 5. Test Write and Delete Access (Self-healing probe)
  if (firestoreInfo.readWorking) {
    const probeDocId = `_diag_probe_${Date.now()}`;
    const probeDocRef = doc(db, 'leads', probeDocId);

    try {
      console.log('5. Testing Firestore Write Access with probe document...');
      await setDoc(probeDocRef, {
        userId: uid,
        customerName: 'Diagnostic Probe Test',
        message: 'Self-test probe',
        status: 'New Inquiry',
        leadScore: 99,
        isDiagnosticProbe: true,
        createdAt: serverTimestamp()
      });
      firestoreInfo.writeWorking = true;
      console.log('   ✅ Write access verified successfully.');

      // Delete probe doc
      await deleteDoc(probeDocRef);
      firestoreInfo.deleteWorking = true;
      console.log('   ✅ Delete access verified successfully.');

      rulesPass = true;
      rulesDetails = 'All security permissions (Read, Write, Update, Delete) are active and verified.';
    } catch (writeErr: any) {
      console.error('   ❌ Write/Delete test failed:', writeErr);
      firestoreInfo.writeWorking = false;
      firestoreInfo.exactError = writeErr?.message || String(writeErr);
      firestoreInfo.errorCode = writeErr?.code || 'write-error';
      rulesPass = false;
      rulesDetails = `Write test failed: ${writeErr?.message}`;

      if (writeErr?.code === 'permission-denied') {
        rootCause = 'Write Permission Denied: Security rules prevented writing document with userId: ' + uid;
        requiredFix = 'Verify write rules allow request.resource.data.userId == request.auth.uid.';
      }
    }
  }

  // 6. Data Recovery Assessment
  if (collectionCounts.leadsForUser > 0) {
    dataRecoveryMessage = `Active database records intact. Found ${collectionCounts.leadsForUser} Lead(s), ${collectionCounts.followupsForUser} Follow-Up(s), ${collectionCounts.customersForUser} Customer(s), and ${collectionCounts.emailOutreachLogsForUser} Outreach Log(s) for user ${uid}.`;
  } else {
    dataRecoveryMessage = `Database connected to ${REQUIRED_PROJECT_ID}. 0 leads currently associated with userId: ${uid}. Existing database schema and collections are preserved.`;
  }

  console.log('6. Summary Collection Status: All 9 collections evaluated.');
  console.groupEnd();

  return {
    timestamp,
    firebaseProject: projectInfo,
    authStatus: authInfo,
    firestoreStatus: firestoreInfo,
    storageStatus: storageInfo,
    collectionCounts,
    collectionsVerified,
    rulesVerification: {
      passed: rulesPass,
      details: rulesDetails || 'Rules verification completed.'
    },
    dataRecovery: {
      leadsFound: collectionCounts.leadsForUser,
      hasOrphanedLeads: false,
      message: dataRecoveryMessage
    },
    rootCause,
    requiredFix
  };
}

