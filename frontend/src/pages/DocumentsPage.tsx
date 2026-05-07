import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ChevronDown, ChevronRight, Plus, Eye, Trash2, Check, X, Pencil } from 'lucide-react';
import type { RootState } from '../store/rootReducer';
import {
  updateJobStatus,
  removeJob,
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

  const handleDeleteJob = useCallback((sessionId: string, jobId: string) => {
    dispatch(removeJob({ sessionId, jobId }));
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
    }
  }, [dispatch, selectedJobId]);

  const handleViewJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F5F5F5' }}>
      <div style={{
        width: '240px',
        backgroundColor: '#FCFCFC',
        borderRight: '1px solid #e5e7eb',
        padding: '16px 0',
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

      <div style={{ flex: 1, padding: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>
          {activeSession?.name ?? 'Documents'}
        </h1>

        {activeSession && activeSession.jobs.length > 0 ? (
          <div style={{ backgroundColor: '#FCFCFC', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', width: '50px' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>Filename</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', width: '120px' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', width: '200px' }}>Progress</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', width: '150px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeSession.jobs.map((job, index) => {
                  const statusStyles = getStatusStyles(job.status);
                  const isSelected = selectedJobId === job.jobId;
                  return (
                    <tr
                      key={job.jobId}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        borderLeft: isSelected ? '3px solid #1B30D4' : '3px solid transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedJobId(job.jobId)}
                    >
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
                                backgroundColor: '#1B30D4',
                                borderRadius: '3px',
                                transition: 'width 0.3s',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '35px' }}>{job.progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewJob(job.jobId);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              color: '#1B30D4',
                              backgroundColor: 'transparent',
                              border: '1px solid #c7d2fe',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            <Eye size={14} />
                            View
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteJob(activeSession.id, job.jobId);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
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
                            <Trash2 size={14} />
                            Delete
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
          <div style={{
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
