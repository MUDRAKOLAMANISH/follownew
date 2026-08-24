import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, X, Database, UserCheck, Key, Server } from 'lucide-react';
import { runFirebaseDiagnostic, DiagnosticResult } from '../lib/firebaseDiagnostic';
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FirebaseDiagnosticModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const handleRunDiagnostic = async () => {
    setLoading(true);
    try {
      const res = await runFirebaseDiagnostic(user);
      setResult(res);
    } catch (err: any) {
      console.error('Diagnostic error:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !result) {
      handleRunDiagnostic();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 rounded-lg border border-indigo-400/30 text-indigo-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Firebase & Firestore Diagnostic
              </h2>
              <p className="text-xs text-slate-400">
                Live database connection, authentication, and rules validation
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Actions toolbar */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Diagnostic Status
            </span>
            <button
              onClick={handleRunDiagnostic}
              disabled={loading}
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Running Diagnostic...' : 'Re-run Diagnostic'}
            </button>
          </div>

          {loading && !result ? (
            <div className="py-12 text-center text-gray-500 space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
              <p className="text-sm font-medium">Validating Firebase config, auth token & collection queries...</p>
            </div>
          ) : result ? (
            <div className="space-y-5 text-sm">
              {/* Section 1: Project & Database */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold">
                    <Server className="h-4 w-4 text-indigo-600" />
                    <span>1. Firebase Project & Service Info</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" /> STRICTLY LOCKED
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                  <div>
                    <span className="font-semibold text-slate-700">Project ID:</span>{' '}
                    <span className="font-mono text-indigo-700 font-bold">{result.firebaseProject.projectId}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Database ID:</span>{' '}
                    <span className="font-mono text-slate-800 text-[11px] truncate block" title={result.firebaseProject.databaseId}>{result.firebaseProject.databaseId}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Storage Bucket:</span>{' '}
                    <span className="font-mono text-slate-800 text-[11px] truncate block">{result.firebaseProject.storageBucket}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Storage Status:</span>{' '}
                    <span className="text-emerald-700 font-bold">{result.storageStatus?.status || 'Active & Connected'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Auth Domain:</span> {result.firebaseProject.authDomain}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Init Status:</span>{' '}
                    <span className="text-emerald-600 font-bold">Permanent Singleton (No Reset)</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Authentication */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  <span>2. Authentication Status</span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Logged In:</span>
                    {result.authStatus.isAuthenticated ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle className="h-3 w-3" /> YES
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        <AlertTriangle className="h-3 w-3" /> NO (Sign-in required)
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">User UID:</span>{' '}
                    <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700 font-mono text-[11px]">
                      {result.authStatus.uid || 'None'}
                    </code>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">User Email:</span> {result.authStatus.email || 'None'}
                  </div>
                </div>
              </div>

              {/* Section 3: Connection & Rules */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <Key className="h-4 w-4 text-indigo-600" />
                  <span>3. Firestore Connection & Permissions</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Read Access:</span>
                    {result.firestoreStatus.readWorking ? (
                      <span className="text-emerald-700 font-bold">WORKING</span>
                    ) : (
                      <span className="text-red-600 font-bold">FAILED</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Write Access:</span>
                    {result.firestoreStatus.writeWorking ? (
                      <span className="text-emerald-700 font-bold">WORKING</span>
                    ) : (
                      <span className="text-red-600 font-bold">FAILED</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Delete Access:</span>
                    {result.firestoreStatus.deleteWorking ? (
                      <span className="text-emerald-700 font-bold">WORKING</span>
                    ) : (
                      <span className="text-red-600 font-bold">FAILED</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Rules Check:</span>
                    {result.rulesVerification.passed ? (
                      <span className="text-emerald-700 font-bold">PASSED</span>
                    ) : (
                      <span className="text-amber-600 font-bold">CHECK LOGS</span>
                    )}
                  </div>
                </div>

                {result.firestoreStatus.exactError && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-800 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-red-900">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                      Error Details ({result.firestoreStatus.errorCode}):
                    </div>
                    <div>{result.firestoreStatus.exactError}</div>
                  </div>
                )}
              </div>

              {/* Section 4: Collection Counts */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold">
                    <Database className="h-4 w-4 text-indigo-600" />
                    <span>4. Verified Firestore Collections Status</span>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Database: {result.firebaseProject.databaseId}
                  </span>
                </div>

                {/* Grid of core metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <div className="text-2xs text-slate-500 font-medium uppercase tracking-wider">Users</div>
                    <div className="text-base font-bold text-slate-800">{result.collectionCounts.usersForUser > 0 ? 'Active' : 'Connected'}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <div className="text-2xs text-slate-500 font-medium uppercase tracking-wider">Leads</div>
                    <div className="text-base font-bold text-indigo-600">{result.collectionCounts.leadsForUser}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <div className="text-2xs text-slate-500 font-medium uppercase tracking-wider">Follow-Ups</div>
                    <div className="text-base font-bold text-amber-600">{result.collectionCounts.followupsForUser}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <div className="text-2xs text-slate-500 font-medium uppercase tracking-wider">Customers</div>
                    <div className="text-base font-bold text-emerald-600">{result.collectionCounts.customersForUser}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <div className="text-2xs text-slate-500 font-medium uppercase tracking-wider">Profile</div>
                    <div className="text-base font-bold text-purple-600">{result.collectionCounts.businessProfilesForUser > 0 ? 'Configured' : 'Ready'}</div>
                  </div>
                </div>

                {/* Detailed Collection Status List */}
                {result.collectionsVerified && result.collectionsVerified.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 divide-y divide-slate-100 text-xs">
                    {result.collectionsVerified.map((col) => (
                      <div key={col.name} className="py-1.5 flex items-center justify-between">
                        <span className="font-mono text-slate-700 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {col.name}
                        </span>
                        <span className="text-slate-500 text-2xs font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
                          {col.countOrStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 5: Diagnostic Verdict */}
              <div className={`p-4 rounded-xl border ${result.firestoreStatus.readWorking && result.firestoreStatus.writeWorking ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                <div className="font-bold flex items-center gap-2 mb-1">
                  {result.firestoreStatus.readWorking && result.firestoreStatus.writeWorking ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span>Firestore Healthy & Fully Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>Diagnostic Issue Detected</span>
                    </>
                  )}
                </div>
                <p className="text-xs">{result.dataRecovery.message}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close Diagnostic
          </button>
        </div>
      </div>
    </div>
  );
}
