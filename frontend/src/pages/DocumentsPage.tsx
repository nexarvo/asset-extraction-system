import { useEffect, useRef, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/rootReducer';
import { updateJobStatus, removeJob, type Job } from '../store/slices/jobs.slice';
import { extractionApi } from '../apis/extraction.api';

const POLL_INTERVAL = 3000;

const getStatusStyles = (status: Job['status']) => {
  switch (status) {
    case 'completed':
      return { bg: '#d1fae5', color: '#065f46' };
    case 'failed':
      return { bg: '#fee2e2', color: '#991b1b' };
    case 'processing':
      return { bg: '#dbeafe', color: '#1e40af' };
    case 'waiting':
      return { bg: '#f3f4f6', color: '#4b5563' };
    default:
      return { bg: '#f3f4f6', color: '#4b5563' };
  }
};

export const DocumentsPage = () => {
  const jobs = useSelector((state: RootState) => state.jobs.jobs);
  const dispatch = useDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      const response = await extractionApi.extract(Array.from(files));
      for (const job of response.jobs) {
        dispatch({
          type: 'jobs/addJob',
          payload: {
            jobId: job.jobId,
            filename: job.filename,
            status: job.status,
            progress: 0,
          },
        });
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  }, [dispatch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const pendingJobs = jobs.filter(
      (j) => j.status === 'waiting' || j.status === 'processing'
    );

    if (pendingJobs.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) {
      return;
    }

    const pollJobs = async () => {
      const currentPendingJobs = jobs.filter(
        (j) => j.status === 'waiting' || j.status === 'processing'
      );

      if (currentPendingJobs.length === 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      for (const job of currentPendingJobs) {
        try {
          const status = await extractionApi.getJobStatus(job.jobId);
          dispatch(
            updateJobStatus({
              jobId: job.jobId,
              status: status.status,
              progress: status.progress,
              error: status.error,
            })
          );
        } catch (err) {
          console.error('Failed to poll job:', job.jobId, err);
        }
      }
    };

    intervalRef.current = setInterval(pollJobs, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [dispatch, jobs]);

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px', color: '#111827' }}>
        Document Upload
      </h1>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: '8px',
          padding: '48px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragging ? '#eff6ff' : '#fafafa',
          transition: 'all 0.2s',
          marginBottom: '32px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.csv"
          onChange={(e) => handleUpload(e.target.files)}
          style={{ display: 'none' }}
        />
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6b7280"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ margin: '0 auto 16px' }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <p style={{ fontSize: '16px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
          {isUploading ? 'Uploading...' : isDragging ? 'Drop files here' : 'Drag and Drop files here or Browse'}
        </p>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>
          Supported formats: PDF, XLSX, CSV
        </p>
      </div>

      {jobs.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>#</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Filename</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '200px' }}>Progress</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => {
                const statusStyles = getStatusStyles(job.status);
                return (
                  <tr key={job.jobId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: '14px' }}>{index + 1}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>{job.filename}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: statusStyles.bg,
                          color: statusStyles.color,
                        }}
                      >
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${job.progress}%`,
                              height: '100%',
                              backgroundColor: '#3b82f6',
                              borderRadius: '3px',
                              transition: 'width 0.3s',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '35px' }}>{job.progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => dispatch(removeJob(job.jobId))}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: '#dc2626',
                          backgroundColor: 'transparent',
                          border: '1px solid #fca5a5',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
