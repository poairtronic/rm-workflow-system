import React, { useState, useEffect } from 'react';
import { workflowService } from '../../../services/workflowService';
import { Button } from '../../../components/ui/Button';

interface ScDocumentsSectionProps {
  scId: string;
  isReadOnly?: boolean;
}

export const ScDocumentsSection: React.FC<ScDocumentsSectionProps> = ({
  scId,
  isReadOnly = false,
}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('SC_DRAWING');

  const loadDocuments = async () => {
    if (!scId) return;
    try {
      setLoading(true);
      setError(null);
      const docs = await workflowService.getScDocuments(scId);
      setDocuments(docs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load SC supporting documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [scId]);

  const handleUploadAndAttach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !scId) return;

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      const uploadedFile = await workflowService.uploadFile(formData);

      await workflowService.attachScDocument(scId, uploadedFile.id, documentType);

      setSelectedFile(null);
      const fileInput = document.getElementById(`sc-doc-file-input-${scId}`) as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to upload and attach SC document');
    } finally {
      setUploading(false);
    }
  };

  const handleDetach = async (attachmentId: string) => {
    if (!scId) return;
    try {
      setLoading(true);
      setError(null);
      await workflowService.detachScDocument(scId, attachmentId);
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to detach document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (attachmentId: string) => {
    if (!scId) return;
    try {
      const res = await workflowService.getScDocumentDownloadUrl(scId, attachmentId);
      if (res?.url) {
        window.open(res.url, '_blank');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate download link');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="border p-4 rounded-lg bg-white mt-4 space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h4 className="font-semibold text-base text-gray-800">
          SC Supporting Documents (Component Reference)
        </h4>
        <span className="text-xs text-gray-500">
          {documents.length} Document{documents.length === 1 ? '' : 's'}
        </span>
      </div>

      {error && (
        <div className="p-2 bg-red-50 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {!isReadOnly && (
        <form onSubmit={handleUploadAndAttach} className="bg-gray-50 p-3 rounded grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Select SC Reference File (PDF, PNG, JPG)
            </label>
            <input
              id={`sc-doc-file-input-${scId}`}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              required
              className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              SC Document Type
            </label>
            <select
              className="input-field text-xs py-1"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <option value="SC_DRAWING">SC Drawing</option>
              <option value="CUSTOMER_REFERENCE">Customer Reference</option>
              <option value="SC_SUPPORTING_REFERENCE">SC Supporting Reference</option>
              <option value="TECHNICAL_REFERENCE">Technical Reference</option>
            </select>
          </div>

          <div>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Uploading...' : '+ Upload SC Document'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-gray-500 italic">Loading SC documents...</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No SC supporting documents attached.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">File Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Size</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Uploaded</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {documents.map((att) => (
                <tr key={att.id}>
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {att.file?.originalName || 'SC Document'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">
                      {att.documentType || 'UNCLASSIFIED'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {formatFileSize(att.file?.size)}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {att.createdAt ? new Date(att.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(att.id)}
                    >
                      Download
                    </Button>
                    {!isReadOnly && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDetach(att.id)}
                      >
                        Detach
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
