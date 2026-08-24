import { useState } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw } from 'lucide-react';
import { KnowledgeBaseDocument } from '../types';
import { formatBytes } from '../lib/ragUtils';

interface DeleteDocumentModalProps {
  document: KnowledgeBaseDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (document: KnowledgeBaseDocument) => Promise<void>;
}

export default function DeleteDocumentModal({
  document,
  isOpen,
  onClose,
  onConfirmDelete
}: DeleteDocumentModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !document) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirmDelete(document);
      onClose();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err?.message || 'Failed to delete document. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
        
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h3 className="text-base font-bold text-gray-900 mb-1">
            Delete Knowledge Document?
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            Are you sure you want to permanently delete this document? This will remove the file from Firebase Storage and un-index it from Firestore.
          </p>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 mb-4 space-y-1 text-xs">
            <div className="font-semibold text-gray-900 truncate">
              {document.fileName}
            </div>
            <div className="text-gray-500 text-2xs flex items-center gap-2">
              <span className="uppercase font-semibold">{document.fileType}</span>
              <span>•</span>
              <span>{formatBytes(document.fileSize)}</span>
              <span>•</span>
              <span>{document.chunkCount || 1} RAG Chunks</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Document</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
