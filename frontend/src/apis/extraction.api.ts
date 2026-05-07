import { apiConfig } from '../config/api.config';

export interface ExtractRequest {
  fileIds: string[];
}

export interface ExtractResponse {
  jobs: Array<{
    jobId: string;
    filename: string;
    status: 'waiting' | 'processing' | 'completed' | 'failed';
  }>;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export const extractionApi = {
  async extract(files: File[]): Promise<ExtractResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await fetch(`${apiConfig.baseURL}/extractions/extract`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Extract failed: ${response.status}`);
    }

    return response.json();
  },

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await fetch(`${apiConfig.baseURL}/extractions/jobs/${jobId}`, {
      method: 'GET',
      headers: apiConfig.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.status}`);
    }

    return response.json();
  },
};