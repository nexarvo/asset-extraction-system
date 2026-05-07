import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ChevronDown, ChevronRight, Plus, Check, X, Pencil, Table2, Calendar, HardDrive, Activity } from 'lucide-react';
import type { RootState } from '../store/rootReducer';
import {
  updateJobStatus,
  setActiveSession,
  createSession,
  renameSession,
  type Session,
  type Job,
} from '../store/slices/jobs.slice';
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
  const { sessions, activeSessionId } = useSelector((state: RootState) => state.jobs);
  const dispatch = useDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionsRef = useRef(sessions);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  sessionsRef.current = sessions;

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const toggleSession = useCallback((sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const handleCreateSession = useCallback(() => {
    const newId = `session-${Date.now()}`;
    dispatch(createSession({ id: newId, name: 'Untitled' }));
    setEditingSessionId(newId);
    setEditingName('Untitled');
  }, [dispatch]);

  const startEditing = useCallback((session: Session) => {
    setEditingSessionId(session.id);
    setEditingName(session.name);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingSessionId(null);
    setEditingName('');
  }, []);

  const saveEditing = useCallback(() => {
    if (editingSessionId && editingName.trim()) {
      dispatch(renameSession({ sessionId: editingSessionId, name: editingName.trim() }));
    }
    setEditingSessionId(null);
    setEditingName('');
  }, [dispatch, editingSessionId, editingName]);

  useEffect(() => {
    const pollJobs = () => {
      sessionsRef.current.forEach((session) => {
        session.jobs.forEach((job) => {
          if (job.status === 'waiting' || job.status === 'processing') {
            extractionApi.getJobStatus(job.jobId).then((status) => {
              dispatch(
                updateJobStatus({
                  sessionId: session.id,
                  jobId: job.jobId,
                  status: status.status,
                  progress: status.progress,
                  error: status.error,
                })
              );
            }).catch((err) => {
              console.error('Failed to poll job:', job.jobId, err);
            });
          }
        });
      });
    };

    pollJobs();
    intervalRef.current = setInterval(pollJobs, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [dispatch]);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F5F5F5', overflow: 'hidden' }}>
      <div style={{
        width: '240px',
        height: '100vh',
        backgroundColor: '#F9F9F9',
        borderRight: '0.5px solid #e5e7eb',
        padding: '16px 0',
        overflow: 'auto',
      }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              Sessions
            </span>
            <button
              onClick={handleCreateSession}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isExpanded={expandedSessions.has(session.id)}
              isActive={session.id === activeSessionId}
              isEditing={editingSessionId === session.id}
              editingName={editingSessionId === session.id ? editingName : ''}
              onToggle={() => toggleSession(session.id)}
              onSelect={() => dispatch(setActiveSession(session.id))}
              onStartEdit={() => startEditing(session)}
              onEditChange={setEditingName}
              onSave={saveEditing}
              onCancel={cancelEditing}
            />
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <div style={{
          backgroundColor: '#F9F9F9',
          padding: '10px 24px',
          borderBottom: '0.5px solid #e5e7eb',
        }}>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
            {activeSession?.name ?? 'Documents'}
          </h1>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0 0' }}>
            {activeSession?.jobs.length || 0} {(activeSession?.jobs.length || 0) === 1 ? 'document' : 'documents'}
          </p>
        </div>

        {activeSession && activeSession.jobs.length > 0 ? (
          <div style={{ backgroundColor: '#FCFCFC', borderTop: '0.5px solid #e5e7eb', marginTop: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FCFCFC', border: '0.5px solid #e5e7eb' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '0.5px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderRight: '0.5px solid #e5e7eb' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Table2 size={14} color="#000" />
                      Document
                    </span>
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderRight: '0.5px solid #e5e7eb', width: '100px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} color="#000" />
                      Date
                    </span>
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderRight: '0.5px solid #e5e7eb', width: '80px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <HardDrive size={14} color="#000" />
                      Size
                    </span>
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={14} color="#000" />
                      Extraction Status
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeSession.jobs.map((job) => {
                  const statusStyles = getStatusStyles(job.status);
                  const isSelected = selectedJobId === job.jobId;
                  const formatFileSize = (bytes: number | null | undefined) => {
                    if (!bytes) return '-';
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  };
                  return (
                    <tr
                      key={job.jobId}
                      style={{
                        borderBottom: '0.5px solid #e5e7eb',
                        backgroundColor: isSelected ? '#f0f4ff' : 'transparent',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      onClick={() => setSelectedJobId(job.jobId)}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget.querySelector('.review-btn') as HTMLElement;
                        if (btn) btn.style.display = 'flex';
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget.querySelector('.review-btn') as HTMLElement;
                        if (btn) btn.style.display = 'none';
                      }}
                    >
                      <td style={{ padding: '6px 12px', fontSize: '12px', color: '#111827', borderRight: '0.5px solid #e5e7eb' }}>{job.filename}</td>
                      <td style={{ padding: '6px 12px', fontSize: '12px', color: '#6b7280', borderRight: '0.5px solid #e5e7eb' }}>{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '-'}</td>
                      <td style={{ padding: '6px 12px', fontSize: '12px', color: '#6b7280', borderRight: '0.5px solid #e5e7eb' }}>{formatFileSize(job.fileSize ?? undefined)}</td>
                      <td style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: statusStyles.bg,
                            color: statusStyles.color,
                          }}
                        >
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                        <button
                          className="review-btn"
                          style={{
                            display: 'none',
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#4b5563',
                            backgroundColor: '#F5F5F5',
                            border: '0.5px solid #9ca3af',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{
            marginTop: 'auto',
            textAlign: 'center',
            padding: '60px 20px',
            color: '#9ca3af',
            fontSize: '14px',
          }}>
            No documents in this session
          </div>
        )}
      </div>
    </div>
  );
};

interface SessionItemProps {
  session: Session;
  isExpanded: boolean;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onToggle: () => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const SessionItem = ({
  session,
  isExpanded,
  isActive,
  isEditing,
  editingName,
  onToggle,
  onSelect,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
}: SessionItemProps) => {
  const itemCount = session.jobs.length;

  return (
    <div>
      <div
        onClick={onSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          cursor: 'pointer',
          backgroundColor: isActive ? '#eff6ff' : 'transparent',
          borderLeft: isActive ? '3px solid #1B30D4' : '3px solid transparent',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {isExpanded ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
        </button>

        {isEditing ? (
          <>
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onCancel();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: '#10b981',
              }}
            >
              <Check size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: '#dc2626',
              }}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span style={{
              flex: 1,
              fontSize: '14px',
              fontWeight: 500,
              color: isActive ? '#1B30D4' : '#374151',
            }}>
              {session.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: '#9ca3af',
              }}
            >
              <Pencil size={12} />
            </button>
            <span style={{
              fontSize: '12px',
              color: '#9ca3af',
              backgroundColor: '#f3f4f6',
              padding: '2px 8px',
              borderRadius: '10px',
              marginLeft: '4px',
            }}>
              {itemCount}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
