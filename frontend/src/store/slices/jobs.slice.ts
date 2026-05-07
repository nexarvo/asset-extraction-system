import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Job {
  jobId: string;
  filename: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

interface JobsState {
  jobs: Job[];
}

const initialState: JobsState = {
  jobs: [],
};

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    setJobs: (state, action: PayloadAction<Job[]>) => {
      state.jobs = action.payload;
    },
    addJob: (state, action: PayloadAction<Job>) => {
      state.jobs.push(action.payload);
    },
    updateJobStatus: (
      state,
      action: PayloadAction<{ jobId: string; status: Job['status']; progress: number; error?: string }>
    ) => {
      const job = state.jobs.find((j) => j.jobId === action.payload.jobId);
      if (job) {
        job.status = action.payload.status;
        job.progress = action.payload.progress;
        job.error = action.payload.error;
      }
    },
    clearJobs: (state) => {
      state.jobs = [];
    },
    removeJob: (state, action: PayloadAction<string>) => {
      state.jobs = state.jobs.filter((j) => j.jobId !== action.payload);
    },
  },
});

export const { setJobs, addJob, updateJobStatus, clearJobs, removeJob } = jobsSlice.actions;
export default jobsSlice.reducer;