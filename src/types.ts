export type BusinessLeadStatus = 
  | 'New Inquiry' 
  | 'Interested' 
  | 'Follow Up Needed' 
  | 'Waiting For Stock' 
  | 'Price Shared' 
  | 'Order Confirmed' 
  | 'Customer Purchased' 
  | 'Not Interested';

export interface StatusHistoryRecord {
  id?: string;
  status: string;
  timestamp: any;
  note?: string;
}

export interface Lead {
  id: string;
  name?: string;
  customerName: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  message?: string;
  customerMessage?: string;
  notes?: string;
  productInterest?: string;
  leadScore: number;
  aiScore?: number;
  leadTemperature?: 'Cold Lead' | 'Warm Lead' | 'Hot Lead' | string;
  priority: 'High' | 'Normal' | 'Low' | string;
  status: BusinessLeadStatus | string;
  aiStatus?: BusinessLeadStatus | string;
  createdAt?: any;
  updatedAt?: any;
  lastContactAt?: any;
  lastContactDate?: string;
  statusHistory?: StatusHistoryRecord[];
  followUpHistory?: FollowupRecord[];
  purchaseHistory?: PurchaseRecord[];
  userId: string;
}

export interface FollowUp {
  id: string;
  followupId?: string;
  leadId?: string;
  customerName: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  message?: string;
  customerMessage?: string;
  productInterest?: string;
  task?: string;
  generatedSubject?: string;
  generatedMessage?: string;
  callToAction?: string;
  generatedCallToAction?: string;
  status: 'Pending' | 'pending' | 'sent' | 'completed' | 'Completed' | BusinessLeadStatus | string;
  sourceStatus?: string;
  followUpDate?: string;
  dueDate?: string;
  priority?: 'High' | 'Normal' | 'Low' | string;
  leadScore?: number;
  leadTemperature?: 'Cold Lead' | 'Warm Lead' | 'Hot Lead' | string;
  completed?: boolean;
  createdAt?: any;
  updatedAt?: any;
  generatedAt?: any;
  userId: string;
}

export interface BusinessProfileData {
  userId: string;
  businessName: string;
  category: string;
  products: string;
  services: string;
  whatsappNumber?: string;
  contactInformation?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ActivityItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  createdAt: any;
}

export interface PurchaseRecord {
  id: string;
  item: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface FollowupRecord {
  id: string;
  date: string;
  channel: 'WhatsApp' | 'Email' | 'Phone' | 'Meeting' | 'Other' | string;
  note: string;
  summary?: string;
}

export interface Customer {
  id: string;
  name: string;
  customerName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  purchaseHistory: PurchaseRecord[];
  followupHistory: FollowupRecord[];
  lastContactDate?: string;
  notes?: string;
  status?: 'Active' | 'VIP' | 'Inactive' | string;
  tags?: string[];
  totalPurchases?: number;
  totalSpend?: number;
  sourceLeadId?: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DashboardStats {
  totalLeads: number;
  interested: number;
  followUpNeeded: number;
  waitingForStock: number;
  ordersConfirmed: number;
  customersPurchased: number;
  notInterested?: number;
  pendingFollowUps: number;
  completedFollowUps: number;
  highPriorityFollowUps: number;
  highPriorityLeads: number;
  totalCustomers?: number;
  totalRevenue?: number;
}

export type KnowledgeFileType = 'pdf' | 'docx' | 'txt' | 'md' | 'other';
export type KnowledgeDocStatus = 'ready' | 'processing' | 'indexed' | 'active' | 'error';

export interface KnowledgeBaseDocument {
  id: string;
  fileName: string;
  fileType: KnowledgeFileType | string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: any;
  fileSize: number;
  status: KnowledgeDocStatus | string;
  extractedText?: string;
  storagePath?: string;
  chunkCount?: number;
  summary?: string;
  tags?: string[];
  userId?: string;
  charCount?: number;
}

export interface RAGSourceCitation {
  docId: string;
  fileName: string;
  fileType: string;
  snippet: string;
  relevanceScore?: number;
  fileUrl?: string;
  chunkIndex?: number;
}

export interface RAGChunkMatch {
  docId: string;
  fileName: string;
  fileType: string;
  fileUrl?: string;
  chunkText: string;
  score: number;
  relevancePercentage: number;
  chunkIndex?: number;
}

export interface RAGDiagnosticReport {
  uploadStatus: {
    collection: string;
    totalDocuments: number;
    readyCount: number;
    status: 'connected' | 'empty' | 'error';
    documents: Array<{
      id: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      extractedTextLength: number;
      chunkCount: number;
      status: string;
    }>;
  };
  extractionStatus: {
    totalExtractedChars: number;
    documentsWithText: number;
    documentsMissingText: number;
    status: 'healthy' | 'warning' | 'error';
    details: string;
  };
  chunkingStatus: {
    totalChunksGenerated: number;
    chunkSize: number;
    overlap: number;
    status: 'healthy' | 'empty' | 'error';
    details: string;
  };
  retrievalStatus: {
    query: string;
    queryTerms: string[];
    matchedChunksCount: number;
    topScore: number;
    thresholdUsed: number;
    status: 'found' | 'no_matches';
    reasonIfEmpty?: string;
    matchedChunks: RAGChunkMatch[];
  };
  groundingStatus: {
    modelUsed: string;
    contextProvided: boolean;
    finalPrompt: string;
    responseLength: number;
    status: 'grounded' | 'fallback_not_found' | 'error';
    details: string;
  };
}

export interface RAGQueryResponse {
  answer: string;
  sources: RAGSourceCitation[];
  query: string;
  modelUsed?: string;
  contextFound: boolean;
  debugInfo?: {
    matchedChunks?: RAGChunkMatch[];
    topScore?: number;
    queryTerms?: string[];
    finalPrompt?: string;
    reasonIfEmpty?: string;
    diagnosticReport?: RAGDiagnosticReport;
  };
}

export interface EmailOutreachLog {
  id?: string;
  userId: string;
  customerId?: string;
  customerName?: string;
  leadId?: string;
  recipientEmail: string;
  subject: string;
  message: string;
  status: 'sent' | 'failed' | 'delivered';
  errorMessage?: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  sentAt: any;
  emailType?: 'follow_up' | 'promotional' | 'thank_you' | 'custom' | string;
}

export interface GmailConnection {
  userId: string;
  emailAddress: string;
  connectedAt: any;
  lastUsedAt?: any;
  status: 'connected' | 'disconnected' | 'expired';
  accessToken?: string;
  expiresAt?: number;
  displayName?: string;
  photoUrl?: string;
}

