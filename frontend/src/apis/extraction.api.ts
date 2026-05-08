import { apiConfig } from "../config/api.config";

export interface ExtractRequest {
  fileIds: string[];
}

export interface ExtractResponse {
  jobs: Array<{
    jobId: string;
    filename: string;
    status: "waiting" | "processing" | "completed" | "failed";
  }>;
}

export interface JobStatusResponse {
  jobId: string;
  status: "waiting" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
}

export interface DocumentByJobResponse {
  jobId: string;
  documentId: string;
  originalFileName: string;
  storageKey: string;
  mimeType: string | null;
  fileSize: number | null;
  status: "waiting" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  createdAt: string;
}

export interface ReviewResponseDto {
  documentId: string;
  originalFileName: string;
  mimeType: string | null;
  totalFields: number;
  page: number;
  pageSize: number;
  fields: Array<{
    id: string;
    fieldName: string;
    rawValue: string | null;
    normalizedValue: object | null;
    confidenceScore: number | null;
    extractionMethod: string | null;
    reviewStatus: string;
    validationStatus: string | null;
    sourceRowIndex: number | null;
    sourceSheetName: string | null;
    isInferred: boolean;
    createdAt: string;
  }>;
}

export const extractionApi = {
  async extract(files: File[], sessionId?: string): Promise<ExtractResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const url = sessionId
      ? `${apiConfig.baseURL}/api/extractions/extract?sessionId=${sessionId}`
      : `${apiConfig.baseURL}/api/extractions/extract`;

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Extract failed: ${response.status}`);
    }

    return response.json();
  },

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await fetch(
      `${apiConfig.baseURL}/api/extractions/jobs/${jobId}`,
      {
        method: "GET",
        headers: apiConfig.headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.status}`);
    }

    return response.json();
  },

  async getDocumentsByJobIds(
    jobIds: string[],
  ): Promise<DocumentByJobResponse[]> {
    const response = await fetch(`${apiConfig.baseURL}/api/documents/by-jobs`, {
      method: "POST",
      headers: apiConfig.headers,
      body: JSON.stringify({ jobIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get documents: ${response.status}`);
    }

    return response.json();
  },

  async getDocumentReview(
    documentId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<ReviewResponseDto> {
    const response = await fetch(
      `${apiConfig.baseURL}/api/documents/${documentId}/review?page=${page}&pageSize=${pageSize}`,
      {
        method: "GET",
        headers: apiConfig.headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get document review: ${response.status}`);
    }

    return response.json();
  },

  async getDocumentsBySession(
    sessionId: string,
  ): Promise<DocumentByJobResponse[]> {
    const response = await fetch(
      `${apiConfig.baseURL}/api/documents/by-session/${sessionId}`,
      {
        method: "GET",
        headers: apiConfig.headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get documents by session: ${response.status}`);
    }

    return response.json();
  },
};
