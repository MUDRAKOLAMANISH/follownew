import { useState, useEffect, useRef, ChangeEvent, DragEvent } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, 
  Upload, 
  FileText, 
  Trash2, 
  Eye, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  HardDrive, 
  ShieldCheck, 
  Lock, 
  Search, 
  Filter, 
  Sparkles, 
  Layers, 
  Database, 
  FileCode, 
  RefreshCw,
  Plus,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { KnowledgeBaseDocument, KnowledgeFileType } from '../types';
import { 
  uploadKnowledgeDocument, 
  subscribeToKnowledgeBase, 
  deleteKnowledgeDocument 
} from '../lib/knowledgeBaseService';
import { formatBytes } from '../lib/ragUtils';
import { isUserAdmin, getUserRole } from '../lib/adminAuth';
import DocumentViewerModal from '../components/DocumentViewerModal';
import DeleteDocumentModal from '../components/DeleteDocumentModal';
import RAGInteractiveTester from '../components/RAGInteractiveTester';
import RAGDebugPanel from '../components/RAGDebugPanel';

export default function AdminKnowledgeBase() {
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);
  const userRole = getUserRole(user);

  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadStep, setUploadStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'documents' | 'upload' | 'rag_sandbox' | 'rag_debug'>('documents');

  // Modals
  const [selectedDocForView, setSelectedDocForView] = useState<KnowledgeBaseDocument | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedDocForDelete, setSelectedDocForDelete] = useState<KnowledgeBaseDocument | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [testerInitialQuery, setTesterInitialQuery] = useState('');

  // 1. Subscribe to Firestore collection `knowledge_base`
  useEffect(() => {
    if (!user) return;
    setIsLoadingDocs(true);

    const unsubscribe = subscribeToKnowledgeBase(
      (docs) => {
        setDocuments(docs);
        setIsLoadingDocs(false);
      },
      (err) => {
        console.error('Firestore knowledge_base listener error:', err);
        setErrorNotice('Unable to sync knowledge base documents. Verify Firestore permissions.');
        setIsLoadingDocs(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Handle File Upload
  const handleFileProcess = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;

    const file = files[0];
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown'];
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');

    if (!validExtensions.includes(ext)) {
      setErrorNotice(`Unsupported file format. Please upload PDF, DOCX, TXT, or Markdown files.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorNotice('File size exceeds 25 MB limit. Please upload a smaller document.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadStage('Initializing upload pipeline...');
    setUploadStep(1);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const newDoc = await uploadKnowledgeDocument(
        file,
        user.email || 'admin@followflow.ai',
        user.uid,
        (progress, stage, stepNumber) => {
          setUploadProgress(progress);
          setUploadStage(stage);
          if (stepNumber) setUploadStep(stepNumber);
        }
      );

      setSuccessNotice(`Successfully uploaded and indexed "${file.name}" in Knowledge Base!`);
      setActiveTab('documents');
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorNotice(err?.message || 'Failed to upload document to Firebase Storage. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage('');
      setUploadStep(1);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileProcess(e.target.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileProcess(e.dataTransfer.files);
  };

  // 3. Handle Document Deletion
  const handleConfirmDelete = async (docToDelete: KnowledgeBaseDocument) => {
    await deleteKnowledgeDocument(docToDelete);
    setSuccessNotice(`Deleted "${docToDelete.fileName}" from Knowledge Base and Storage.`);
  };

  // Metrics Calculations
  const totalDocs = documents.length;
  const totalSizeBytes = documents.reduce((acc, d) => acc + (d.fileSize || 0), 0);
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunkCount || 1), 0);
  const pdfCount = documents.filter((d) => d.fileType === 'pdf').length;
  const docxCount = documents.filter((d) => d.fileType === 'docx').length;
  const txtCount = documents.filter((d) => d.fileType === 'txt').length;
  const mdCount = documents.filter((d) => d.fileType === 'md').length;

  // Filtered Documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = 
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.extractedText && doc.extractedText.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = filterType === 'all' || doc.fileType.toLowerCase() === filterType.toLowerCase();
    const matchesStatus = filterStatus === 'all' || doc.status.toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesType && matchesStatus;
  });

  const getFormatBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return { label: 'PDF', bg: 'bg-red-50 text-red-700 border-red-200', icon: '📄' };
      case 'docx':
      case 'doc':
        return { label: 'DOCX', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: '📝' };
      case 'md':
      case 'markdown':
        return { label: 'MD', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: '📑' };
      case 'txt':
        return { label: 'TXT', bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: '📃' };
      default:
        return { label: type.toUpperCase(), bg: 'bg-gray-50 text-gray-700 border-gray-200', icon: '📄' };
    }
  };

  // If unauthorized non-admin tries to access (RBAC enforcement)
  if (!isAdmin) {
    return (
      <DashboardLayout title="Access Restricted - Super Admin Only">
        <div className="max-w-xl mx-auto py-16 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center shadow-xs">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Super Admin Access Required</h2>
            <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
              The Central Product Knowledge Base is strictly reserved for the application owner and Super Administrators. Regular users and business owners cannot view or manage central product documents.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 max-w-md mx-auto text-left space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-500">Current Account:</span>
              <span className="font-mono text-gray-900">{user?.email || 'Authenticated User'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-500">Assigned Role:</span>
              <span className="font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-800">{userRole}</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Super Admin Central Knowledge Base">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Notification Alerts */}
        {successNotice && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successNotice}</span>
            </div>
            <button 
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorNotice && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="font-medium">{errorNotice}</span>
            </div>
            <button 
              onClick={() => setErrorNotice(null)}
              className="text-red-700 hover:text-red-900 text-xs font-semibold px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page Header Banner */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  Super Admin Central Knowledge Base
                </h1>
                <span className="text-2xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Product-Level RAG
                </span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Follow Buddy Brain
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Central product knowledge repository for FollowFlow AI. Upload product guides, pricing docs, FAQs, and feature manuals used by Follow Buddy and AI services.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Product Document</span>
            </button>
            <button
              onClick={() => setActiveTab('rag_debug')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors shadow-2xs"
            >
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span>RAG Debug Panel</span>
            </button>
            <button
              onClick={() => setActiveTab('rag_sandbox')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span>Test Knowledge Retrieval</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
              <span>Total Documents</span>
              <FileText className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalDocs}</div>
            <div className="text-2xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Stored in Firestore
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
              <span>Storage Utilized</span>
              <HardDrive className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatBytes(totalSizeBytes)}</div>
            <div className="text-2xs text-gray-500">
              Firebase Storage Bucket Active
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
              <span>RAG Vector Chunks</span>
              <Layers className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalChunks}</div>
            <div className="text-2xs text-indigo-600 font-semibold">
              Indexed for Semantic Search
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
              <span>Supported Formats</span>
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-2xs px-1.5 py-0.5 rounded font-bold bg-red-50 text-red-700 border border-red-100">{pdfCount} PDF</span>
              <span className="text-2xs px-1.5 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-100">{docxCount} DOCX</span>
              <span className="text-2xs px-1.5 py-0.5 rounded font-bold bg-slate-50 text-slate-700 border border-slate-200">{txtCount} TXT</span>
              <span className="text-2xs px-1.5 py-0.5 rounded font-bold bg-purple-50 text-purple-700 border border-purple-100">{mdCount} MD</span>
            </div>
            <div className="text-2xs text-gray-400">
              Auto-parsed into RAG embeddings
            </div>
          </div>
        </div>

        {/* Upload Zone & Progress */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInputChange} 
          accept=".pdf,.docx,.doc,.txt,.md,.markdown" 
          className="hidden" 
        />

        {isUploading && (
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-indigo-600 animate-spin" />
                <span className="font-bold text-gray-900">{uploadStage || 'Processing document...'}</span>
              </div>
              <span className="font-mono font-bold text-indigo-600 text-sm">{uploadProgress}%</span>
            </div>

            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300 rounded-full" 
                style={{ width: `${Math.max(5, Math.min(100, uploadProgress))}%` }}
              ></div>
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              <div className={`p-2 rounded-xl text-center border transition-all ${
                uploadStep >= 1 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}>
                <div className="text-2xs font-bold">1. Storage</div>
                <div className="text-3xs opacity-80">Byte Upload</div>
              </div>

              <div className={`p-2 rounded-xl text-center border transition-all ${
                uploadStep >= 2 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}>
                <div className="text-2xs font-bold">2. Extraction</div>
                <div className="text-3xs opacity-80">Text & OCR</div>
              </div>

              <div className={`p-2 rounded-xl text-center border transition-all ${
                uploadStep >= 3 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}>
                <div className="text-2xs font-bold">3. Chunking</div>
                <div className="text-3xs opacity-80">800 chars / 150 overlap</div>
              </div>

              <div className={`p-2 rounded-xl text-center border transition-all ${
                uploadStep >= 4 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}>
                <div className="text-2xs font-bold">4. Embedding</div>
                <div className="text-3xs opacity-80">Vector Index</div>
              </div>

              <div className={`p-2 rounded-xl text-center border transition-all ${
                uploadStep >= 5 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}>
                <div className="text-2xs font-bold">5. Firestore</div>
                <div className="text-3xs opacity-80">knowledge_base</div>
              </div>
            </div>

            <p className="text-2xs text-gray-500">
              Real-time upload pipeline streaming to Firebase Storage & Firestore. Detailed logs are available in Developer Tools Console (F12).
            </p>
          </div>
        )}

        {/* Drag & Drop Upload Banner */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-7 text-center transition-all ${
            isDragging
              ? 'border-indigo-600 bg-indigo-50/60 scale-[1.005]'
              : 'border-gray-300 bg-white hover:bg-gray-50/70 hover:border-indigo-400'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 border border-indigo-100 shadow-2xs">
            <Upload className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Drag and drop your company documents here, or click to browse
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-3">
            Supports <strong className="text-gray-700">PDF (.pdf)</strong>, <strong className="text-gray-700">Word (.docx)</strong>, <strong className="text-gray-700">Text (.txt)</strong>, and <strong className="text-gray-700">Markdown (.md)</strong> up to 25 MB.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">PDF</span>
            <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">DOCX</span>
            <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200">TXT</span>
            <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">MD</span>
            <span className="text-2xs font-medium text-gray-400">• Firebase Storage & Firestore Synced</span>
          </div>
        </div>

        {/* Navigation Tabs (Documents vs RAG Debug vs RAG Sandbox) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'documents'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Document Repository ({documents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rag_debug')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'rag_debug'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-amber-300" />
            <span>RAG Debug Panel (Super Admin)</span>
          </button>

          <button
            onClick={() => setActiveTab('rag_sandbox')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'rag_sandbox'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Interactive RAG Tester</span>
          </button>
        </div>

        {/* TAB 1: Document Repository Table */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            
            {/* Toolbar (Search & Filters) */}
            <div className="p-4 border-b border-gray-200 bg-gray-50/70 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents by name or content..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* File Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                >
                  <option value="all">All File Types</option>
                  <option value="pdf">PDF Documents (.pdf)</option>
                  <option value="docx">Word Documents (.docx)</option>
                  <option value="txt">Text Files (.txt)</option>
                  <option value="md">Markdown (.md)</option>
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="ready">Ready / Indexed</option>
                  <option value="processing">Processing</option>
                  <option value="active">Active</option>
                </select>

                {/* Clear Filter Button */}
                {(searchQuery || filterType !== 'all' || filterStatus !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterType('all');
                      setFilterStatus('all');
                    }}
                    className="px-2.5 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Document Table */}
            {isLoadingDocs ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
                <p className="text-xs text-gray-500">Loading Knowledge Base from Firestore...</p>
              </div>
            ) : filteredDocuments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50/80 border-b border-gray-200 text-2xs uppercase tracking-wider text-gray-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Document / File Name</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">File Size</th>
                      <th className="py-3 px-3">Upload Date</th>
                      <th className="py-3 px-3">Uploaded By</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDocuments.map((doc) => {
                      const badge = getFormatBadge(doc.fileType);
                      const formattedDate = doc.uploadedAt instanceof Date 
                        ? doc.uploadedAt.toLocaleDateString() + ' ' + doc.uploadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : doc.uploadedAt?.toDate 
                          ? doc.uploadedAt.toDate().toLocaleDateString() + ' ' + doc.uploadedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Recently';

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors group">
                          
                          {/* File Name & Icon */}
                          <td className="py-3.5 px-4 font-medium text-gray-900">
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">{badge.icon}</span>
                              <div className="truncate max-w-xs sm:max-w-md">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDocForView(doc);
                                    setIsViewModalOpen(true);
                                  }}
                                  className="text-left font-bold text-gray-900 hover:text-indigo-600 transition-colors truncate block"
                                  title={doc.fileName}
                                >
                                  {doc.fileName}
                                </button>
                                <span className="text-2xs text-gray-400 font-mono">
                                  {doc.chunkCount || 1} vector chunks • {doc.charCount || doc.extractedText?.length || 0} characters
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-3">
                            <span className={`text-2xs font-semibold px-2 py-0.5 rounded border ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>

                          {/* File Size */}
                          <td className="py-3.5 px-3 font-mono font-medium text-gray-700 whitespace-nowrap">
                            {formatBytes(doc.fileSize)}
                          </td>

                          {/* Upload Date */}
                          <td className="py-3.5 px-3 whitespace-nowrap text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              <span>{formattedDate}</span>
                            </div>
                          </td>

                          {/* Uploaded By */}
                          <td className="py-3.5 px-3 text-gray-600 truncate max-w-[140px]" title={doc.uploadedBy}>
                            <span className="text-2xs bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">
                              {doc.uploadedBy.split('@')[0] || doc.uploadedBy}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {doc.status === 'ready' ? 'Indexed' : doc.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View / Inspect */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDocForView(doc);
                                  setIsViewModalOpen(true);
                                }}
                                className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="View extracted text & chunks"
                              >
                                <Eye className="h-4 w-4" />
                              </button>

                              {/* Download from Storage */}
                              {doc.fileUrl && (
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Download original file from Firebase Storage"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              )}

                              {/* Test in RAG */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTesterInitialQuery(`What are the key points in ${doc.fileName}?`);
                                  setActiveTab('rag_sandbox');
                                }}
                                className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Ask question about this document in RAG"
                              >
                                <Sparkles className="h-4 w-4 text-amber-500" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDocForDelete(doc);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete document from Storage & Firestore"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">No documents found</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  {searchQuery || filterType !== 'all' 
                    ? 'No documents matched your filter criteria. Try adjusting your query.' 
                    : 'Get started by uploading your first PDF, DOCX, TXT, or Markdown document above.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterType('all');
                      setFilterStatus('all');
                    }}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )}

            {/* Table Footer Stats */}
            <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex flex-wrap items-center justify-between gap-2 text-2xs text-gray-500">
              <span>Showing {filteredDocuments.length} of {documents.length} knowledge documents</span>
              <span className="font-mono">Collection: /knowledge_base • Bucket: aiknowledgeassistant05.firebasestorage.app</span>
            </div>

          </div>
        )}

        {/* TAB 2: Super Admin RAG Diagnostic & Pipeline Auditor */}
        {activeTab === 'rag_debug' && (
          <RAGDebugPanel
            documents={documents}
            initialQuery="price details of FollowFlow AI"
            onOpenDocViewer={(doc) => {
              setSelectedDocForView(doc);
              setIsViewModalOpen(true);
            }}
          />
        )}

        {/* TAB 3: Live RAG Query Tester Sandbox */}
        {activeTab === 'rag_sandbox' && (
          <RAGInteractiveTester
            documents={documents}
            initialQuery={testerInitialQuery}
            onOpenDocViewer={(doc) => {
              setSelectedDocForView(doc);
              setIsViewModalOpen(true);
            }}
          />
        )}

        {/* View Document Modal */}
        <DocumentViewerModal
          document={selectedDocForView}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedDocForView(null);
          }}
          onTestQuery={(q) => {
            setTesterInitialQuery(q);
            setActiveTab('rag_sandbox');
          }}
        />

        {/* Delete Document Confirmation Modal */}
        <DeleteDocumentModal
          document={selectedDocForDelete}
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedDocForDelete(null);
          }}
          onConfirmDelete={handleConfirmDelete}
        />

      </div>
    </DashboardLayout>
  );
}
