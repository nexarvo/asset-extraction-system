import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Job {
  jobId: string;
  filename: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export interface Session {
  id: string;
  name: string;
  jobs: Job[];
}

interface JobsState {
  sessions: Session[];
  activeSessionId: string | null;
}

const initialState: JobsState = {
  sessions: [],
  activeSessionId: null,
};

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    createSession: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const newSession: Session = {
        id: action.payload.id,
        name: action.payload.name,
        jobs: [],
      };
      state.sessions.push(newSession);
      if (!state.activeSessionId) {
        state.activeSessionId = newSession.id;
      }
    },
    setActiveSession: (state, action: PayloadAction<string>) => {
      state.activeSessionId = action.payload;
    },
    addJobsToSession: (state, action: PayloadAction<{ sessionId: string; jobs: Job[] }>) => {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) {
        session.jobs.push(...action.payload.jobs);
      }
    },
    updateJobStatus: (
      state,
      action: PayloadAction<{ sessionId: string; jobId: string; status: Job['status']; progress: number; error?: string }>
    ) => {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) {
        const job = session.jobs.find((j) => j.jobId === action.payload.jobId);
        if (job) {
          job.status = action.payload.status;
          job.progress = action.payload.progress;
          job.error = action.payload.error;
        }
      }
    },
    removeJob: (state, action: PayloadAction<{ sessionId: string; jobId: string }>) => {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) {
        session.jobs = session.jobs.filter((j) => j.jobId !== action.payload.jobId);
      }
    },
    removeSession: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.activeSessionId === action.payload) {
        state.activeSessionId = state.sessions[0]?.id ?? null;
      }
    },
    renameSession: (state, action: PayloadAction<{ sessionId: string; name: string }>) => {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) {
        session.name = action.payload.name;
      }
    },
  },
});

export const {
  createSession,
  setActiveSession,
  addJobsToSession,
  updateJobStatus,
  removeJob,
  removeSession,
  renameSession,
} = jobsSlice.actions;
export default jobsSlice.reducer;
