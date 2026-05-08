import { apiConfig } from '../config/api.config';

export interface Session {
  id: string;
  name: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionRequest {
  name: string;
  createdBy?: string;
}

export const sessionsApi = {
  async create(name: string): Promise<Session> {
    const response = await fetch(`${apiConfig.baseURL}/api/sessions`, {
      method: 'POST',
      headers: apiConfig.headers,
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    return response.json();
  },

  async getAll(skip = 0, take = 50): Promise<{ data: Session[]; total: number }> {
    const response = await fetch(`${apiConfig.baseURL}/api/sessions?skip=${skip}&take=${take}`, {
      method: 'GET',
      headers: apiConfig.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.status}`);
    }

    return response.json();
  },

  async getById(id: string): Promise<Session> {
    const response = await fetch(`${apiConfig.baseURL}/api/sessions/${id}`, {
      method: 'GET',
      headers: apiConfig.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.status}`);
    }

    return response.json();
  },

  async update(id: string, name: string): Promise<Session> {
    const response = await fetch(`${apiConfig.baseURL}/api/sessions/${id}`, {
      method: 'PUT',
      headers: apiConfig.headers,
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update session: ${response.status}`);
    }

    return response.json();
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${apiConfig.baseURL}/api/sessions/${id}`, {
      method: 'DELETE',
      headers: apiConfig.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.status}`);
    }

    return response.json();
  },
};