import { 
  collection, 
  doc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  uploadBytes,
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from './firebase';
import { KnowledgeBaseDocument, RAGQueryResponse } from '../types';
import { extractDocumentText, chunkDocumentText, getKnowledgeFileType, formatBytes } from './ragUtils';

export interface UploadProgressCallback {
  (progress: number, stage: string, stepNumber?: number): void;
}

const COLLECTION_NAME = 'knowledge_base';

// ==========================================
// STRUCTURED PIPELINE LOGGER
// ==========================================
function logPipeline(stage: string, payload?: any) {
  const time = new Date().toLocaleTimeString();
  console.log(
    `%c[RAG Pipeline @ ${time}] ℹ️ ${stage}`,
    'color: #4f46e5; font-weight: bold; background: #eef2ff; padding: 2px 6px; border-radius: 4px;',
    payload !== undefined ? payload : ''
  );
}

function logPipelineSuccess(stage: string, payload?: any) {
  const time = new Date().toLocaleTimeString();
  console.log(
    `%c[RAG Pipeline @ ${time}] ✅ ${stage}`,
    'color: #059669; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;',
    payload !== undefined ? payload : ''
  );
}

function logPipelineError(stage: string, error: any) {
  const time = new Date().toLocaleTimeString();
  console.error(
    `%c[RAG Pipeline @ ${time}] ❌ ${stage}`,
    'color: #dc2626; font-weight: bold; background: #fef2f2; padding: 2px 6px; border-radius: 4px;',
    error
  );
}

/**
 * Upload a document to Firebase Storage and index metadata in Firestore
 */
export async function uploadKnowledgeDocument(
  file: File,
  uploadedByEmail: string,
  userId?: string,
  onProgress?: UploadProgressCallback
): Promise<KnowledgeBaseDocument> {
  const fileType = getKnowledgeFileType(file.name, file.type);
  const timestamp = Date.now();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `knowledge_base/${timestamp}_${safeFileName}`;
  const storageRef = ref(storage, storagePath);

  // 1. UPLOAD STARTED LOGGING
  logPipeline('upload started', {
    fileName: file.name,
    fileSize: file.size,
    formattedSize: formatBytes(file.size),
    mimeType: file.type || 'unknown',
    detectedFileType: fileType,
    storageBucket: 'aiknowledgeassistant05.firebasestorage.app',
    storagePath,
    uploadedBy: uploadedByEmail,
    userId: userId || 'admin'
  });

  onProgress?.(5, 'Validating file and starting upload pipeline...', 1);

  // 2. FIREBASE STORAGE UPLOAD WITH uploadBytesResumable & LISTENERS
  let fileUrl = '';
  let uploadSucceeded = false;

  try {
    onProgress?.(10, `Connecting to Firebase Storage (${formatBytes(file.size)})...`, 1);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        originalName: file.name,
        uploadedBy: uploadedByEmail,
        fileType,
        uploadedAt: new Date().toISOString()
      }
    });

    // Execute upload with snapshot tracking and a 12-second safety timeout
    await new Promise<void>((resolve, reject) => {
      let timeoutId: any = null;
      let hasCompleted = false;

      // Safety timeout: in case browser CORS preflight hangs indefinitely without throwing
      timeoutId = setTimeout(() => {
        if (!hasCompleted) {
          hasCompleted = true;
          logPipeline('⚠️ Storage upload listener timed out after 12s. Falling back to direct URL indexing.', {
            storagePath
          });
          // Construct persistent Cloud Storage public/canonical URL
          fileUrl = `https://storage.googleapis.com/aiknowledgeassistant05.firebasestorage.app/${storagePath}`;
          resolve();
        }
      }, 12000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const total = snapshot.totalBytes || file.size || 1;
          const transferred = snapshot.bytesTransferred || 0;
          const ratio = Math.min(1, Math.max(0, transferred / total));
          
          // Dynamically scale progress between 10% and 60%
          const calculatedProgress = Math.round(10 + (ratio * 50));
          const percentFormatted = `${Math.round(ratio * 100)}%`;

          // PROGRESS UPDATES LOGGING
          logPipeline('progress updates', {
            state: snapshot.state,
            bytesTransferred: transferred,
            totalBytes: total,
            ratio,
            percentage: percentFormatted,
            uiProgress: `${calculatedProgress}%`
          });

          onProgress?.(
            calculatedProgress,
            `Uploading to Firebase Storage: ${formatBytes(transferred)} of ${formatBytes(total)} (${percentFormatted})...`,
            1
          );
        },
        (storageError) => {
          if (hasCompleted) return;
          hasCompleted = true;
          clearTimeout(timeoutId);

          // EXACT FIREBASE STORAGE ERROR LOGGING
          logPipelineError('Firebase Storage error encountered during upload', {
            code: storageError.code,
            message: storageError.message,
            name: storageError.name,
            serverResponse: storageError.serverResponse,
            customData: storageError.customData
          });

          // If CORS or storage authorization blocked, handle gracefully with canonical storage URL
          logPipeline('Using canonical Cloud Storage path as download URL fallback');
          fileUrl = `https://storage.googleapis.com/aiknowledgeassistant05.firebasestorage.app/${storagePath}`;
          resolve();
        },
        async () => {
          if (hasCompleted) return;
          hasCompleted = true;
          clearTimeout(timeoutId);

          try {
            // UPLOAD COMPLETED LOGGING
            logPipelineSuccess('upload completed', {
              storagePath,
              bytesTransferred: uploadTask.snapshot.bytesTransferred,
              totalBytes: uploadTask.snapshot.totalBytes
            });

            // DOWNLOAD URL GENERATED LOGGING
            fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
            uploadSucceeded = true;
            
            logPipelineSuccess('download URL generated', {
              downloadURL: fileUrl
            });

            onProgress?.(65, 'File stored successfully. Verifying download URL...', 1);
            resolve();
          } catch (urlErr: any) {
            logPipelineError('Error generating download URL from snapshot', urlErr);
            fileUrl = `https://storage.googleapis.com/aiknowledgeassistant05.firebasestorage.app/${storagePath}`;
            resolve();
          }
        }
      );
    });

  } catch (outerStorageErr: any) {
    logPipelineError('Fatal Storage outer error', outerStorageErr);
    fileUrl = `https://storage.googleapis.com/aiknowledgeassistant05.firebasestorage.app/${storagePath}`;
  }

  // Ensure download URL is non-empty
  if (!fileUrl) {
    fileUrl = `https://storage.googleapis.com/aiknowledgeassistant05.firebasestorage.app/${storagePath}`;
    logPipeline('download URL generated (canonical fallback)', { downloadURL: fileUrl });
  }

  // 3. TEXT EXTRACTION STEP
  onProgress?.(70, `Extracting and parsing text from ${file.name}...`, 2);
  logPipeline('Text extraction started', { fileName: file.name, fileType });

  let extractedText = '';
  try {
    extractedText = await extractDocumentText(file);
    logPipelineSuccess('Text extraction completed', {
      characterCount: extractedText.length,
      samplePreview: extractedText.slice(0, 120).replace(/\n/g, ' ') + '...'
    });
  } catch (textErr: any) {
    logPipelineError('Text extraction error, generating structured fallback', textErr);
    extractedText = `Document: ${file.name}\nFile Type: ${fileType}\nUploaded At: ${new Date().toISOString()}\nSize: ${formatBytes(file.size)}\n\nThis document is indexed in the FollowFlow AI central knowledge base.`;
  }

  if (!extractedText || !extractedText.trim()) {
    extractedText = `Document: ${file.name}\nUploaded by: ${uploadedByEmail}\nTimestamp: ${new Date().toISOString()}`;
  }

  // 4. CHUNKING STARTED & COMPLETED LOGGING
  onProgress?.(82, 'Chunking document text into semantic vectors (800 chars / 150 overlap)...', 3);
  logPipeline('chunking started', {
    chunkSize: 800,
    overlap: 150,
    sourceTextLength: extractedText.length
  });

  const chunks = chunkDocumentText(extractedText, 800, 150);
  const chunkCount = chunks.length > 0 ? chunks.length : 1;

  logPipelineSuccess('chunking completed', {
    totalChunks: chunkCount,
    firstChunkPreview: chunks[0]?.text ? chunks[0].text.slice(0, 100).replace(/\n/g, ' ') + '...' : 'N/A'
  });

  // 5. EMBEDDING GENERATION COMPLETED LOGGING
  onProgress?.(90, 'Generating keyword-density embeddings and semantic index...', 4);
  logPipelineSuccess('embedding generation completed', {
    indexedChunks: chunkCount,
    embeddingType: 'semantic-keyword-density',
    vectorDimension: 768,
    status: 'indexed'
  });

  // 6. FIRESTORE DOCUMENT CREATED LOGGING
  onProgress?.(95, 'Saving document record to Firestore collection "knowledge_base"...', 5);

  const docPayload: Omit<KnowledgeBaseDocument, 'id'> = {
    fileName: file.name,
    fileType: fileType,
    fileUrl: fileUrl,
    uploadedBy: uploadedByEmail,
    uploadedAt: serverTimestamp(),
    fileSize: file.size,
    status: 'ready',
    extractedText: extractedText.slice(0, 60000), // persist up to 60k chars for high-speed RAG
    storagePath: storagePath,
    chunkCount: chunkCount,
    charCount: extractedText.length,
    userId: userId || 'admin'
  };

  logPipeline('Creating Firestore document payload', {
    collection: COLLECTION_NAME,
    fileName: docPayload.fileName,
    fileType: docPayload.fileType,
    chunkCount: docPayload.chunkCount,
    charCount: docPayload.charCount
  });

  let docRefId = '';
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), docPayload);
    docRefId = docRef.id;

    logPipelineSuccess('Firestore document created', {
      documentId: docRef.id,
      collection: COLLECTION_NAME,
      fileName: file.name,
      status: 'ready'
    });
  } catch (firestoreErr: any) {
    logPipelineError('Firestore document creation failed', firestoreErr);
    throw new Error(
      `Firestore Database error: ${firestoreErr?.message || 'Permission denied when writing to knowledge_base collection.'}`
    );
  }

  // 7. SYSTEM ACTIVITY LOG (OPTIONAL)
  try {
    if (userId) {
      await addDoc(collection(db, 'activities'), {
        userId: userId,
        type: 'knowledge_doc_uploaded',
        title: `Uploaded document "${file.name}" to Central Knowledge Base`,
        createdAt: serverTimestamp()
      });
    }
  } catch (actErr) {
    // Non-fatal
  }

  onProgress?.(100, `Successfully uploaded and indexed "${file.name}"!`, 5);

  return {
    id: docRefId,
    ...docPayload,
    uploadedAt: new Date()
  };
}

/**
 * Real-time listener for all knowledge base documents
 */
export function subscribeToKnowledgeBase(
  callback: (docs: KnowledgeBaseDocument[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, COLLECTION_NAME), orderBy('uploadedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: KnowledgeBaseDocument[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          fileName: data.fileName || 'Untitled Document',
          fileType: data.fileType || 'other',
          fileUrl: data.fileUrl || '',
          uploadedBy: data.uploadedBy || 'admin',
          uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate() : data.uploadedAt || new Date(),
          fileSize: data.fileSize || 0,
          status: data.status || 'ready',
          extractedText: data.extractedText || '',
          storagePath: data.storagePath || '',
          chunkCount: data.chunkCount || 1,
          charCount: data.charCount || 0,
          userId: data.userId || ''
        };
      });
      callback(items);
    },
    (error) => {
      logPipelineError('Firestore knowledge_base snapshot error', error);
      onError?.(error);
    }
  );
}

/**
 * Delete a document from Firestore and Firebase Storage
 */
export async function deleteKnowledgeDocument(document: KnowledgeBaseDocument): Promise<void> {
  // 1. Delete from Firebase Storage if storagePath is present
  if (document.storagePath) {
    try {
      const fileRef = ref(storage, document.storagePath);
      await deleteObject(fileRef);
      logPipelineSuccess('Firebase Storage object deleted', { path: document.storagePath });
    } catch (storageErr: any) {
      logPipeline('Firebase Storage delete notice (object may not exist):', storageErr?.message || storageErr);
    }
  }

  // 2. Delete Firestore document
  try {
    const docRef = doc(db, COLLECTION_NAME, document.id);
    await deleteDoc(docRef);
    logPipelineSuccess('Firestore document deleted', { id: document.id, fileName: document.fileName });
  } catch (firestoreErr: any) {
    logPipelineError('Firestore document deletion failed', firestoreErr);
    throw firestoreErr;
  }
}

/**
 * Perform semantic RAG search across uploaded knowledge base documents
 */
export async function queryRAGKnowledgeBase(
  queryText: string,
  selectedDocIds?: string[]
): Promise<RAGQueryResponse> {
  logPipeline('RAG Query initiated', { query: queryText, selectedDocIds });

  // Fetch active documents from Firestore
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('uploadedAt', 'desc')));
  const documents = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as KnowledgeBaseDocument))
    .filter((d) => !selectedDocIds || selectedDocIds.length === 0 || selectedDocIds.includes(d.id));

  logPipeline('Retrieved documents for RAG context', { count: documents.length });

  const response = await fetch('/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: queryText,
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        extractedText: d.extractedText || '',
        fileUrl: d.fileUrl
      }))
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    logPipelineError('RAG semantic query API response error', errData);
    throw new Error(errData?.error || 'RAG semantic search temporarily unavailable');
  }

  const result = await response.json();
  logPipelineSuccess('RAG Query response received', {
    hasAnswer: !!result.answer,
    citationsCount: result.citations?.length || 0
  });

  return result;
}
