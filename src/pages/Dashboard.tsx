import { useState, useEffect } from 'react';
import { 
  Users, 
  MessageCircle, 
  AlertTriangle, 
  Activity, 
  Plus, 
  Bot, 
  Building2, 
  CheckCircle2, 
  UserCheck, 
  DollarSign,
  Clock,
  Package,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Flame,
  Zap,
  Snowflake
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardLayout from '../components/DashboardLayout';
import { Link } from 'react-router-dom';
import { BusinessProfileData, DashboardStats } from '../types';
import { handleFirestoreError, getBusinessStatusStyle } from '../lib/firestoreUtils';
import { calculateDynamicLeadScore } from '../lib/leadScoring';
import { runExistingLeadsFollowupMigration } from '../lib/followupSync';
import FirebaseDiagnosticModal from '../components/FirebaseDiagnosticModal';
import { ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats & { hotLeads: number; warmLeads: number; coldLeads: number }>({
    totalLeads: 0,
    interested: 0,
    followUpNeeded: 0,
    waitingForStock: 0,
    ordersConfirmed: 0,
    customersPurchased: 0,
    notInterested: 0,
    pendingFollowUps: 0,
    completedFollowUps: 0,
    highPriorityFollowUps: 0,
    highPriorityLeads: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0
  });
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileData | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let unsubProfile: () => void;
    let unsubLeads: () => void;
    let unsubFollowUps: () => void;
    let unsubCustomers: () => void;
    let unsubActivity: () => void;

    console.log(`[Dashboard] Setting up real-time Firestore listeners for user: ${user.uid}`);

    // 1. Fetch Business Profile
    unsubProfile = onSnapshot(
      doc(db, 'business_profile', user.uid), 
      (docSnap) => {
        if (docSnap.exists()) {
          setBusinessProfile(docSnap.data() as BusinessProfileData);
          setFirestoreError(null);
        } else {
          // Check fallback businessProfiles collection
          onSnapshot(doc(db, 'businessProfiles', user.uid), (altSnap) => {
            if (altSnap.exists()) {
              setBusinessProfile(altSnap.data() as BusinessProfileData);
            }
          });
        }
      },
      (err) => {
        const errDetail = handleFirestoreError(err, 'Dashboard business profile');
        setFirestoreError(errDetail);
      }
    );

    // 2. Fetch Leads: Calculate business status metrics
    const leadsQuery = query(
      collection(db, 'leads'),
      where('userId', '==', user.uid)
    );

    unsubLeads = onSnapshot(
      leadsQuery, 
      (snap) => {
        setFirestoreError(null);
        const leadsData = snap.docs.map(d => d.data());
        const total = leadsData.length;
        
        let interestedCount = 0;
        let followUpNeededCount = 0;
        let waitingForStockCount = 0;
        let ordersConfirmedCount = 0;
        let customersPurchasedCount = 0;
        let notInterestedCount = 0;
        let highPriorityCount = 0;
        let hotCount = 0;
        let warmCount = 0;
        let coldCount = 0;

        leadsData.forEach((l) => {
          const s = String(l.status || l.aiStatus || 'New Inquiry');
          const p = String(l.priority || '').toLowerCase();
          
          let score = typeof l.leadScore === 'number' ? l.leadScore : (typeof l.aiScore === 'number' ? l.aiScore : null);
          let temp = l.leadTemperature;

          if (score === null || !temp) {
            const computed = calculateDynamicLeadScore({
              phone: l.phone || l.phoneNumber || l.whatsappNumber || '',
              whatsappNumber: l.whatsappNumber || l.phone || l.phoneNumber || '',
              email: l.email || '',
              productInterest: l.productInterest || '',
              message: l.message || l.notes || ''
            });
            score = score ?? computed.leadScore;
            temp = temp || computed.leadTemperature;
          }

          if (temp === 'Hot Lead' || score >= 70) hotCount++;
          else if (temp === 'Warm Lead' || (score >= 40 && score <= 69)) warmCount++;
          else coldCount++;

          if (s === 'Interested' || s === 'Hot') interestedCount++;
          else if (s === 'Follow Up Needed' || s === 'Contacted') followUpNeededCount++;
          else if (s === 'Waiting For Stock') waitingForStockCount++;
          else if (s === 'Order Confirmed') ordersConfirmedCount++;
          else if (s === 'Customer Purchased' || s === 'Completed' || s === 'Closed') customersPurchasedCount++;
          else if (s === 'Not Interested') notInterestedCount++;

          if (p === 'high' || score >= 70 || s === 'Order Confirmed' || s === 'Interested') {
            highPriorityCount++;
          }
        });

        setStats(prev => ({
          ...prev,
          totalLeads: total,
          interested: interestedCount,
          followUpNeeded: followUpNeededCount,
          waitingForStock: waitingForStockCount,
          ordersConfirmed: ordersConfirmedCount,
          customersPurchased: customersPurchasedCount,
          notInterested: notInterestedCount,
          highPriorityLeads: highPriorityCount,
          hotLeads: hotCount,
          warmLeads: warmCount,
          coldLeads: coldCount
        }));
      },
      (err) => {
        const errDetail = handleFirestoreError(err, 'Dashboard leads listener');
        setFirestoreError(errDetail);
      }
    );

    // 3. Fetch Follow-Ups: Listen to followups collection for the current user
    const followupsQuery = query(
      collection(db, 'followups'),
      where('userId', '==', user.uid)
    );
    unsubFollowUps = onSnapshot(
      followupsQuery,
      (snap) => {
        setFirestoreError(null);
        const allFollowUps = snap.docs.map(d => d.data());
        
        const pendingList = allFollowUps.filter(f => {
          const s = String(f.status || '').toLowerCase();
          const isCompleted = f.completed === true || s === 'completed' || s === 'done';
          return !isCompleted;
        });

        const highPriorityList = pendingList.filter(f => {
          const score = typeof f.leadScore === 'number' ? f.leadScore : (typeof f.score === 'number' ? f.score : 0);
          return score > 75 || f.priority === 'High';
        });

        const completedList = allFollowUps.filter(f => {
          const s = String(f.status || '').toLowerCase();
          return f.completed === true || s === 'completed' || s === 'done';
        });

        setStats(prev => ({
          ...prev,
          pendingFollowUps: pendingList.length,
          highPriorityFollowUps: highPriorityList.length,
          completedFollowUps: completedList.length
        }));
      },
      (err) => {
        const errDetail = handleFirestoreError(err, 'Dashboard followups listener');
        setFirestoreError(errDetail);
      }
    );

    // Run background migration for existing leads
    runExistingLeadsFollowupMigration(user.uid).catch(err => {
      console.warn('[Dashboard] Migration check:', err);
    });

    // 4. Fetch Customers
    const customersQuery = query(
      collection(db, 'customers'),
      where('userId', '==', user.uid)
    );

    unsubCustomers = onSnapshot(
      customersQuery,
      (snap) => {
        setFirestoreError(null);
        const customersList = snap.docs.map(d => d.data());
        const totalCust = customersList.length;
        const rev = customersList.reduce((acc, c) => {
          const pList = Array.isArray(c.purchaseHistory) ? c.purchaseHistory : [];
          const cRev = pList.reduce((pAcc: number, p: any) => pAcc + (Number(p.amount) || 0), 0);
          return acc + (c.totalSpend || cRev || 0);
        }, 0);

        setStats(prev => ({
          ...prev,
          totalCustomers: totalCust,
          totalRevenue: rev
        }));
      },
      (err) => {
        const errDetail = handleFirestoreError(err, 'Dashboard customers listener');
        setFirestoreError(errDetail);
      }
    );

    // 5. Fetch Recent Activity
    const activityQuery = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(6)
    );

    unsubActivity = onSnapshot(
      activityQuery, 
      (snap) => {
        setRecentActivity(snap.docs.map(d => ({
          id: d.id,
          title: d.data().title,
          date: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date()
        })));
        setLoading(false);
      },
      (err) => {
        console.error('[Dashboard activity listener error]:', err);
        setLoading(false);
      }
    );

    return () => {
      if (unsubProfile) unsubProfile();
      if (unsubLeads) unsubLeads();
      if (unsubFollowUps) unsubFollowUps();
      if (unsubCustomers) unsubCustomers();
      if (unsubActivity) unsubActivity();
    };
  }, [user]);

  return (
    <DashboardLayout title="Overview">
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[380px] bg-white rounded-2xl border border-gray-100 p-8 shadow-xs">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-100 border-t-indigo-600"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">Loading Dashboard Data...</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-sm text-center">
            Establishing secure Firestore live listeners for project <span className="font-mono font-medium text-gray-700">aiknowledgeassistant05</span>...
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {firestoreError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3.5 rounded-xl flex items-center gap-3 text-xs sm:text-sm">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <div className="flex-1">
                <strong className="font-semibold block">Data retrieval issue detected.</strong>
                <span className="text-rose-700">{firestoreError}</span>
              </div>
              <button 
                onClick={() => setIsDiagnosticOpen(true)}
                className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
              >
                Diagnose
              </button>
            </div>
          )}

          {/* Real-time Data Integrity & Recovery Status Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">Live Firestore Data Status</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-100 text-emerald-800">
                    Active on aiknowledgeassistant05
                  </span>
                </div>
                <p className="text-2xs text-gray-500 mt-0.5">
                  User ID: <span className="font-mono text-gray-700">{user?.uid || 'None'}</span> • Email: <span className="font-medium text-gray-700">{user?.email || 'N/A'}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-medium text-gray-700 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-gray-200">
              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                <span className="text-gray-400 text-2xs block">Leads</span>
                <span className="font-bold text-gray-900">{stats.totalLeads}</span>
              </div>
              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                <span className="text-gray-400 text-2xs block">Customers</span>
                <span className="font-bold text-gray-900">{stats.totalCustomers}</span>
              </div>
              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                <span className="text-gray-400 text-2xs block">Follow-Ups</span>
                <span className="font-bold text-gray-900">{stats.pendingFollowUps + stats.completedFollowUps}</span>
              </div>
              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                <span className="text-gray-400 text-2xs block">Profile</span>
                <span className={`font-bold ${businessProfile ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {businessProfile?.businessName ? 'Configured' : 'Pending'}
                </span>
              </div>
              <button
                onClick={() => setIsDiagnosticOpen(true)}
                className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                <span>Verify</span>
              </button>
            </div>
          </div>
          
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 rounded-2xl p-7 text-white shadow-md relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1.5">
                  Welcome back{businessProfile?.businessName ? `, ${businessProfile.businessName}` : '!'}
                </h2>
                <p className="text-indigo-200 mb-5 max-w-2xl text-xs sm:text-sm leading-relaxed">
                  Automated sales pipeline, live business status tracking, and lifelong customer records.
                </p>
              </div>
              <button
                onClick={() => setIsDiagnosticOpen(true)}
                className="self-start inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-xs transition-colors shrink-0"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Firestore Diagnostic</span>
              </button>
            </div>
            
            {businessProfile ? (
              <div className="flex flex-wrap gap-3">
                <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/20">
                  <p className="text-2xs text-indigo-200 uppercase tracking-wider font-semibold">Category</p>
                  <p className="font-semibold text-xs flex items-center gap-1.5 mt-0.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-300" /> {businessProfile.category || 'Store'}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/20">
                  <p className="text-2xs text-indigo-200 uppercase tracking-wider font-semibold">Offerings</p>
                  <p className="font-semibold text-xs mt-0.5">
                    {businessProfile.products ? businessProfile.products.split(',').length : 0} Products / {businessProfile.services ? businessProfile.services.split(',').length : 0} Services
                  </p>
                </div>
                {businessProfile.whatsappNumber && (
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/20">
                    <p className="text-2xs text-indigo-200 uppercase tracking-wider font-semibold">WhatsApp</p>
                    <p className="font-semibold text-xs mt-0.5 text-emerald-300">
                      {businessProfile.whatsappNumber}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/business-profile" className="inline-flex items-center gap-2 bg-white text-indigo-700 px-4 py-2 rounded-xl font-semibold text-xs hover:bg-gray-50 transition-colors shadow-sm">
                <Building2 className="h-4 w-4" /> Setup Business Profile
              </Link>
            )}
          </div>

          {/* Dynamic AI Lead Temperature Overview (Hot / Warm / Cold) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <span>AI Lead Purchase Intent & Temperature</span>
                </h3>
                <p className="text-2xs text-gray-500 mt-0.5">
                  Dynamic scores calculated from contact signals, intent keywords, message depth, and interest.
                </p>
              </div>
              <Link
                to="/leads"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 self-start sm:self-auto"
              >
                <span>Filter by Temperature</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Hot Leads */}
              <Link
                to="/leads"
                className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-50 hover:border-rose-300 transition group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Flame className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-rose-900">Hot Leads</span>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900">
                    70 - 100
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-rose-950 mt-2">{stats.hotLeads}</p>
                <p className="text-2xs text-rose-700 mt-1">High purchase intent keywords & direct contact info</p>
              </Link>

              {/* Warm Leads */}
              <Link
                to="/leads"
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-50 hover:border-amber-300 transition group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Zap className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-amber-900">Warm Leads</span>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                    40 - 69
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-amber-950 mt-2">{stats.warmLeads}</p>
                <p className="text-2xs text-amber-700 mt-1">Active inquiry with partial contact channels</p>
              </Link>

              {/* Cold Leads */}
              <Link
                to="/leads"
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-300 transition group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                      <Snowflake className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Cold Leads</span>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    0 - 39
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">{stats.coldLeads}</p>
                <p className="text-2xs text-slate-600 mt-1">Minimal detail or early-stage general questions</p>
              </Link>
            </div>
          </div>

          {/* Business Lead Pipeline Status Metrics (Required Tracking Metrics) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                <span>Live Leads Pipeline by Business Status</span>
              </h3>
              <Link to="/leads" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                <span>View All Leads</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* 1. Total Leads */}
              <Link to="/leads" className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs hover:border-gray-400 hover:shadow-xs transition group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold text-gray-500 uppercase tracking-wider">Total Leads</span>
                  <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-colors">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLeads}</p>
                <p className="text-2xs text-gray-400 mt-1">All incoming leads</p>
              </Link>

              {/* 2. Interested Customers */}
              <Link to="/leads" className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold text-indigo-600 uppercase tracking-wider">Interested</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-indigo-950">{stats.interested}</p>
                <p className="text-2xs text-indigo-500 mt-1">Pricing & inquiry active</p>
              </Link>

              {/* 3. Follow Up Needed */}
              <Link to="/leads" className="bg-white p-4 rounded-2xl border border-amber-100 shadow-2xs hover:border-amber-300 hover:shadow-xs transition group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold text-amber-600 uppercase tracking-wider">Follow Up</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-950">{stats.followUpNeeded}</p>
                <p className="text-2xs text-amber-600 mt-1">Callback or scheduled</p>
              </Link>

              {/* 4. Waiting For Stock */}
              <Link to="/leads" className="bg-white p-4 rounded-2xl border border-rose-100 shadow-2xs hover:border-rose-300 hover:shadow-xs transition group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold text-rose-600 uppercase tracking-wider">Waiting Stock</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-rose-950">{stats.waitingForStock}</p>
                <p className="text-2xs text-rose-500 mt-1">Restock alerts pending</p>
              </Link>

              {/* 5. Orders Confirmed */}
              <Link to="/leads" className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold text-emerald-600 uppercase tracking-wider">Confirmed</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <ShoppingBag className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-950">{stats.ordersConfirmed}</p>
                <p className="text-2xs text-emerald-600 mt-1">Ready for fulfillment</p>
              </Link>

              {/* 6. Customers Purchased */}
              <Link to="/customers" className="bg-white p-4 rounded-2xl border border-green-200 shadow-2xs hover:border-green-400 hover:shadow-xs transition group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold text-green-700 uppercase tracking-wider">Purchased</span>
                  <div className="w-7 h-7 rounded-lg bg-green-50 text-green-700 flex items-center justify-center group-hover:bg-green-700 group-hover:text-white transition-colors">
                    <UserCheck className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-950">{stats.customersPurchased}</p>
                <p className="text-2xs text-green-600 mt-1">Saved in database</p>
              </Link>
            </div>
          </div>

          {/* Customer Database & Follow-Ups High Level Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Customer Database Retention Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Lifelong Retention
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Database</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-extrabold text-gray-900">{stats.totalCustomers || 0}</p>
                  <span className="text-xs text-gray-500">Profiles stored</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Total Recorded Revenue: <strong className="text-emerald-700 font-bold">${stats.totalRevenue?.toLocaleString() || 0}</strong>
                </p>
              </div>
              <Link
                to="/customers"
                className="mt-4 text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 pt-3 border-t border-gray-100"
              >
                <span>Access Customer Database</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Pending Outreach Tasks Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  {stats.highPriorityFollowUps > 0 ? (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      <span>{stats.highPriorityFollowUps} High Priority</span>
                    </span>
                  ) : (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Outreach Engine
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Follow-Ups</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-extrabold text-gray-900">{stats.pendingFollowUps}</p>
                  <span className="text-xs text-gray-500">Tasks waiting</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                  <span>Completed: <strong className="text-gray-900 font-semibold">{stats.completedFollowUps}</strong></span>
                  {stats.highPriorityFollowUps > 0 && (
                    <span className="text-red-600 font-semibold flex items-center gap-0.5">
                      <Flame className="h-3 w-3 inline" /> {stats.highPriorityFollowUps} urgent
                    </span>
                  )}
                </div>
              </div>
              <Link
                to="/followups"
                className="mt-4 text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 pt-3 border-t border-gray-100"
              >
                <span>Open Follow-Up Pipeline</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* AI Assistant Quick Analyzer Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    Smart AI
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Message Analyzer</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">Instant Inquiry Scoring</p>
                <p className="text-xs text-gray-500 mt-2">
                  Paste incoming WhatsApp messages to instantly generate personalized replies & high-converting follow-ups.
                </p>
              </div>
              <Link
                to="/ai-assistant"
                className="mt-4 text-xs font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1.5 pt-3 border-t border-gray-100"
              >
                <span>Launch AI Assistant</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              <span>Real-Time Business Activity</span>
            </h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-2.5">
                {recentActivity.map((activity, i) => (
                  <div key={activity.id || i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{activity.title}</p>
                      <p className="text-2xs text-gray-400 mt-0.5">
                        {activity.date instanceof Date ? `${activity.date.toLocaleDateString()} at ${activity.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Recently'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-xs">
                No recent activity logged yet. Add leads to view live events here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Firestore Diagnostic Modal */}
      <FirebaseDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
      />
    </DashboardLayout>
  );
}
