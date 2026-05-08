import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Table2 } from 'lucide-react';
import { extractionApi } from '../apis/extraction.api';
import { sessionsApi } from '../apis/sessions.api';
import { createSession, addJobsToSession, setActiveSession, type Job } from '../store/slices/jobs.slice';
import { ROUTES } from '../constants/routes';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const UploadPage = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const unique = newFiles.filter((f) => !existingNames.has(f.name));
        return [...prev, ...unique];
      });
    }
  }, []);

  const removeFile = useCallback((fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const unique = droppedFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...unique];
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleExtract = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const sessionName = `Session ${new Date().toLocaleString()}`;
      const session = await sessionsApi.create(sessionName);
      
      const response = await extractionApi.extract(files, session.id);
      const jobIds = response.jobs.map((job) => job.jobId);

      const documentsResponse = await extractionApi.getDocumentsByJobIds(jobIds);
      const documentMap = new Map(documentsResponse.map((doc) => [doc.jobId, doc]));

      const jobs: Job[] = response.jobs.map((job) => {
        const doc = documentMap.get(job.jobId);
        return {
          jobId: job.jobId,
          documentId: doc?.documentId,
          filename: doc?.originalFileName || job.filename,
          storageKey: doc?.storageKey,
          mimeType: doc?.mimeType,
          fileSize: doc?.fileSize,
          status: doc?.status as Job['status'] || job.status,
          progress: doc?.progress || 0,
          createdAt: doc?.createdAt,
        };
      });

      dispatch(createSession({ id: session.id, name: session.name }));
      dispatch(addJobsToSession({ sessionId: session.id, jobs }));
      dispatch(setActiveSession(session.id));
      navigate(ROUTES.DOCUMENTS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 'calc(50% - 250px)',
        left: 0,
        right: 0,
        height: '1px',
        backgroundColor: '#d1d5db',
      }} />

      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 'calc(50% - 324px)',
        width: '1px',
        backgroundColor: '#d1d5db',
        zIndex: 0,
      }} />

      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 'calc(50% - 324px)',
        width: '1px',
        backgroundColor: '#d1d5db',
        zIndex: 0,
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', position: 'relative', zIndex: 1 }}>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            width: '600px',
            borderRadius: '12px',
            backgroundColor: '#FCFCFC',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#F9F9F9',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Table2 size={22} color="#1B30D4" />
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#000' }}>
                Upload Files
              </span>
            </div>
            <button
              onClick={handleExtract}
              disabled={files.length === 0 || loading}
              style={{
                padding: '8px 20px',
                backgroundColor: files.length === 0 || loading ? '#d1d5db' : '#1B30D4',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: files.length === 0 || loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? 'Extracting...' : 'Extract'}
            </button>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              margin: '24px',
              padding: '40px 20px',
              border: `1px dashed ${isDragging ? '#3b82f6' : '#d1d5db'}`,
              borderRadius: '8px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragging ? '#eff6ff' : 'transparent',
              transition: 'all 0.2s',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto 12px' }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              {isDragging ? 'Drop files here' : 'Drag and Drop files here'}
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              .csv, .xlsx, .pdf
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {files.length > 0 && (
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {files.map((file) => (
                  <div
                    key={file.name}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#374151',
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>{file.name}</span>
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>({formatFileSize(file.size)})</span>
                    <button
                      onClick={() => removeFile(file.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        padding: 0,
                        border: 'none',
                        borderRadius: '50%',
                        backgroundColor: '#e5e7eb',
                        color: '#6b7280',
                        cursor: 'pointer',
                        fontSize: '14px',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 'calc(50% - 250px)',
        left: 0,
        right: 0,
        height: '1px',
        backgroundColor: '#d1d5db',
      }} />

      {error && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};
