import { useEffect, useRef, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Plus,
  Check,
  X,
  Pencil,
  Table2,
  Calendar,
  HardDrive,
  Activity,
} from "lucide-react";
import type { RootState } from "../store/rootReducer";
import {
  updateJobStatus,
  setActiveSession,
  setSessions,
  createSession,
  renameSession,
  type Session,
  type Job,
} from "../store/slices/jobs.slice";
import { extractionApi, type ReviewResponseDto } from "../apis/extraction.api";
import { sessionsApi } from "../apis/sessions.api";

const POLL_INTERVAL = 3000;
const FALLBACK_STATUS: Job["status"] = "waiting";

const getStatusStyles = (status: Job["status"]) => {
  switch (status) {
    case "completed":
      return { bg: "#d1fae5", color: "#065f46" };
    case "failed":
      return { bg: "#fee2e2", color: "#991b1b" };
    case "processing":
      return { bg: "#dbeafe", color: "#1e40af" };
    case "waiting":
      return { bg: "#f3f4f6", color: "#4b5563" };
    default:
      return { bg: "#f3f4f6", color: "#4b5563" };
  }
};

const normalizeStatus = (status: unknown): Job["status"] => {
  if (
    status === "waiting" ||
    status === "processing" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  return FALLBACK_STATUS;
};

export const DocumentsPage = () => {
  const { sessions, activeSessionId } = useSelector(
    (state: RootState) => state.jobs,
  );
  const dispatch = useDispatch();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionsRef = useRef(sessions);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [reviewingDocument, setReviewingDocument] = useState<{
    documentId: string;
    filename: string;
    data: ReviewResponseDto["fields"] | null;
  } | null>(null);
  const safeSessions = sessions.map((session) => ({
    ...session,
    jobs: Array.isArray(session.jobs)
      ? session.jobs
          .filter((job) => Boolean(job))
          .map((job) => ({
            jobId: typeof job.jobId === "string" ? job.jobId : "",
            documentId:
              typeof job.documentId === "string" ? job.documentId : undefined,
            filename:
              typeof job.filename === "string" ? job.filename : "Unnamed document",
            storageKey:
              typeof job.storageKey === "string" ? job.storageKey : undefined,
            mimeType:
              typeof job.mimeType === "string" || job.mimeType === null
                ? job.mimeType
                : null,
            fileSize: typeof job.fileSize === "number" ? job.fileSize : null,
            status: normalizeStatus(job.status),
            progress: typeof job.progress === "number" ? job.progress : 0,
            error: typeof job.error === "string" ? job.error : undefined,
            createdAt:
              typeof job.createdAt === "string" ? job.createdAt : undefined,
          }))
      : [],
  }));
  sessionsRef.current = safeSessions;

  const activeSession = safeSessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionsResponse = await sessionsApi.getAll(0, 100);
        const normalizedSessions: Session[] = [];
        const existingSessions = new Map(
          sessionsRef.current.map((session) => [session.id, session]),
        );

        for (const session of sessionsResponse.data) {
          const docs = await extractionApi.getDocumentsBySession(session.id);
          const jobsFromDocs: Job[] = docs.map((doc) => ({
            jobId: typeof doc.jobId === "string" ? doc.jobId : "",
            documentId: doc.documentId,
            filename: doc.originalFileName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            status: normalizeStatus(doc.status),
            progress: typeof doc.progress === "number" ? doc.progress : 0,
            createdAt: doc.createdAt,
          }));
          const existingSession = existingSessions.get(session.id);
          const existingJobs = Array.isArray(existingSession?.jobs)
            ? existingSession.jobs
            : [];
          const jobsById = new Map<string, Job>();

          jobsFromDocs.forEach((job) => {
            if (job.jobId) jobsById.set(job.jobId, job);
          });
          existingJobs.forEach((job) => {
            if (!job.jobId) return;
            if (!jobsById.has(job.jobId)) {
              jobsById.set(job.jobId, job);
            }
          });

          normalizedSessions.push({
            id: session.id,
            name: session.name,
            jobs: Array.from(jobsById.values()),
          });
        }

        dispatch(setSessions(normalizedSessions));
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      }
    };

    fetchData();
  }, [dispatch]);

  const handleCreateSession = useCallback(() => {
    const newId = `session-${Date.now()}`;
    dispatch(createSession({ id: newId, name: "Untitled" }));
    setEditingSessionId(newId);
    setEditingName("Untitled");
  }, [dispatch]);

  const startEditing = useCallback((session: Session) => {
    setEditingSessionId(session.id);
    setEditingName(session.name);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingSessionId(null);
    setEditingName("");
  }, []);

  const saveEditing = useCallback(async () => {
    if (editingSessionId && editingName.trim()) {
      try {
        await sessionsApi.update(editingSessionId, editingName.trim());
      } catch (err) {
        console.error("Failed to update session:", err);
      }
      dispatch(
        renameSession({
          sessionId: editingSessionId,
          name: editingName.trim(),
        }),
      );
    }
    setEditingSessionId(null);
    setEditingName("");
  }, [dispatch, editingSessionId, editingName]);

  const handleReview = useCallback(async (job: Job) => {
    if (!job.documentId) return;
    try {
      const reviewData = await extractionApi.getDocumentReview(
        job.documentId,
        1,
        10,
      );
      setReviewingDocument({
        documentId: job.documentId,
        filename: job.filename,
        data: reviewData.fields,
      });
    } catch (err) {
      console.error("Failed to load review:", err);
    }
  }, []);

  useEffect(() => {
    const pollJobs = () => {
      sessionsRef.current.forEach((session) => {
        session.jobs.forEach((job) => {
          if (
            job.jobId &&
            (job.status === "waiting" || job.status === "processing")
          ) {
            extractionApi
              .getJobStatus(job.jobId)
              .then((status) => {
                if (!("status" in status)) {
                  return;
                }
                dispatch(
                  updateJobStatus({
                    sessionId: session.id,
                    jobId: status.jobId || job.jobId,
                    status: normalizeStatus(status.status),
                    progress:
                      typeof status.progress === "number" ? status.progress : 0,
                    error: status.error,
                  }),
                );
              })
              .catch((err) => {
                console.error("Failed to poll job:", job.jobId, err);
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
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#F5F5F5",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "240px",
          height: "100vh",
          backgroundColor: "#F9F9F9",
          borderRight: "0.5px solid #e5e7eb",
          padding: "16px 0",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
            }}
          >
            Sessions
          </span>
          <button
            onClick={handleCreateSession}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: "#f3f4f6",
              color: "#6b7280",
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {safeSessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            isEditing={editingSessionId === session.id}
            editingName={editingSessionId === session.id ? editingName : ""}
            onSelect={() => dispatch(setActiveSession(session.id))}
            onStartEdit={() => startEditing(session)}
            onEditChange={setEditingName}
            onSave={saveEditing}
            onCancel={cancelEditing}
          />
        ))}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
        }}
      >
        <div
          style={{
            backgroundColor: "#F9F9F9",
            padding: "10px 24px",
            borderBottom: "0.5px solid #e5e7eb",
          }}
        >
          <h1
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#111827",
              margin: 0,
            }}
          >
            {activeSession?.name ?? "Documents"}
          </h1>
          <p
            style={{ fontSize: "12px", color: "#9ca3af", margin: "2px 0 0 0" }}
          >
            {activeSession?.jobs.length || 0}{" "}
            {(activeSession?.jobs.length || 0) === 1 ? "document" : "documents"}
          </p>
        </div>

        {activeSession && activeSession.jobs.length > 0 ? (
          <div
            style={{
              backgroundColor: "#FCFCFC",
              borderTop: "0.5px solid #e5e7eb",
              marginTop: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "#FCFCFC",
                border: "0.5px solid #e5e7eb",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f9fafb",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#6b7280",
                      borderRight: "0.5px solid #e5e7eb",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Table2 size={14} color="#000" />
                      Document
                    </span>
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#6b7280",
                      borderRight: "0.5px solid #e5e7eb",
                      width: "100px",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Calendar size={14} color="#000" />
                      Date
                    </span>
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#6b7280",
                      borderRight: "0.5px solid #e5e7eb",
                      width: "80px",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <HardDrive size={14} color="#000" />
                      Size
                    </span>
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#6b7280",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Activity size={14} color="#000" />
                      Extraction Status
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeSession.jobs.map((job) => {
                  const safeStatus = normalizeStatus(job.status);
                  const statusStyles = getStatusStyles(safeStatus);
                  const isSelected = selectedJobId === job.jobId;
                  const safeFilename = job.filename || "Unnamed document";
                  const formatFileSize = (bytes: number | null | undefined) => {
                    if (!bytes) return "-";
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024)
                      return `${(bytes / 1024).toFixed(1)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  };
                  return (
                    <tr
                      key={job.jobId || `${safeFilename}-${job.createdAt || "na"}`}
                      style={{
                        borderBottom: "0.5px solid #e5e7eb",
                        backgroundColor: isSelected ? "#f0f4ff" : "transparent",
                        cursor: "pointer",
                        position: "relative",
                      }}
                      onClick={() => setSelectedJobId(job.jobId || null)}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget.querySelector(
                          ".review-btn",
                        ) as HTMLElement;
                        if (btn) btn.style.display = "flex";
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget.querySelector(
                          ".review-btn",
                        ) as HTMLElement;
                        if (btn) btn.style.display = "none";
                      }}
                    >
                      <td
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          color: "#111827",
                          borderRight: "0.5px solid #e5e7eb",
                        }}
                      >
                        {safeFilename}
                      </td>
                      <td
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          color: "#6b7280",
                          borderRight: "0.5px solid #e5e7eb",
                        }}
                      >
                        {job.createdAt
                          ? new Date(job.createdAt).toLocaleDateString()
                          : "-"}
                      </td>
                      <td
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          color: "#6b7280",
                          borderRight: "0.5px solid #e5e7eb",
                        }}
                      >
                        {formatFileSize(job.fileSize ?? undefined)}
                      </td>
                      <td
                        style={{
                          padding: "6px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontSize: "11px",
                            fontWeight: 500,
                            backgroundColor: statusStyles.bg,
                            color: statusStyles.color,
                          }}
                        >
                          {safeStatus.charAt(0).toUpperCase() +
                            safeStatus.slice(1)}
                        </span>
                        <button
                          className="review-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReview(job);
                          }}
                          style={{
                            display: "none",
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            padding: "4px 12px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#4b5563",
                            backgroundColor: "#F5F5F5",
                            border: "0.5px solid #9ca3af",
                            borderRadius: "4px",
                            cursor: "pointer",
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
            {reviewingDocument ? (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "240px",
                  transform: "translateY(-50%)",
                  width: "calc(100% - 240px)",
                  maxHeight: "70vh",
                  backgroundColor: "#FCFCFC",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: "8px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 100,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "0.5px solid #e5e7eb",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#111827",
                      margin: 0,
                    }}
                  >
                    {reviewingDocument.filename}
                  </h3>
                  <button
                    onClick={() => setReviewingDocument(null)}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      border: "none",
                      backgroundColor: "#f3f4f6",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
                  {reviewingDocument.data &&
                  reviewingDocument.data.length > 0 ? (
                    (() => {
                      const dataArray = reviewingDocument.data as Array<{
                        normalizedValue: Record<string, unknown> | null;
                      }>;
                      const allDataObjects = dataArray
                        .map((d) => d.normalizedValue)
                        .filter(Boolean) as Record<string, unknown>[];
                      if (allDataObjects.length === 0) {
                        return (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#9ca3af",
                              textAlign: "center",
                              padding: "20px",
                            }}
                          >
                            No data available
                          </div>
                        );
                      }
                      const headers = Object.keys(allDataObjects[0]);
                      return (
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            backgroundColor: "#FCFCFC",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: "#f9fafb",
                                borderBottom: "0.5px solid #e5e7eb",
                              }}
                            >
                              {headers.map((header) => (
                                <th
                                  key={header}
                                  style={{
                                    textAlign: "left",
                                    padding: "6px 8px",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    color: "#6b7280",
                                    borderRight: "0.5px solid #e5e7eb",
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {allDataObjects.map((dataObj, idx) => (
                              <tr
                                key={idx}
                                style={{
                                  borderBottom: "0.5px solid #e5e7eb",
                                }}
                              >
                                {headers.map((header) => {
                                  const value = dataObj[header];
                                  const displayValue =
                                    value === null || value === undefined
                                      ? "-"
                                      : typeof value === "object"
                                        ? JSON.stringify(value)
                                        : String(value);
                                  return (
                                    <td
                                      key={header}
                                      style={{
                                        padding: "6px 8px",
                                        fontSize: "11px",
                                        color: "#374151",
                                        borderRight: "0.5px solid #e5e7eb",
                                      }}
                                    >
                                      {displayValue}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()
                  ) : (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#9ca3af",
                        textAlign: "center",
                        padding: "20px",
                      }}
                    >
                      No fields found
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            style={{
              marginTop: "auto",
              textAlign: "center",
              padding: "60px 20px",
              color: "#9ca3af",
              fontSize: "14px",
            }}
          >
            No documents in this session
          </div>
        )}
      </div>
    </div>
  );
};

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const SessionItem = ({
  session,
  isActive,
  isEditing,
  editingName,
  onSelect,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
}: SessionItemProps) => {
  return (
    <div>
      <div
        onClick={onSelect}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          cursor: "pointer",
          backgroundColor: isActive ? "#f3f4f6" : "transparent",
        }}
      >
        {isEditing ? (
          <>
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
                if (e.key === "Escape") onCancel();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                flex: 1,
                padding: "4px 8px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                outline: "none",
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                padding: 0,
                color: "#10b981",
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                padding: 0,
                color: "#dc2626",
              }}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span
              style={{
                flex: 1,
                fontSize: "12px",
                fontWeight: 500,
                color: "#3A4251",
              }}
            >
              {session.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                padding: 0,
                color: "#9ca3af",
              }}
            >
              <Pencil size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
