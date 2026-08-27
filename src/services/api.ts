import type { Project } from '../types';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  provider: string;
  avatarUrl: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  message?: string;
}

const TOKEN_STORAGE_KEY = 'dubbing_io_token';
const USER_STORAGE_KEY = 'dubbing_io_user';

class ApiClient {
  private baseUrl = '/api';

  public getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  public setToken(token: string) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  public removeToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  // Authentication Endpoints
  public auth = {
    signup: async (email: string, password: string, name?: string): Promise<AuthResponse> => {
      const data = await this.request<AuthResponse>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
      if (data.token) {
        this.setToken(data.token);
        localStorage.setItem(USER_STORAGE_KEY, data.user.email);
      }
      return data;
    },

    signin: async (email: string, password: string): Promise<AuthResponse> => {
      const data = await this.request<AuthResponse>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.token) {
        this.setToken(data.token);
        localStorage.setItem(USER_STORAGE_KEY, data.user.email);
      }
      return data;
    },

    oauth: async (payload: { email: string; name?: string; provider: string; avatarUrl?: string }): Promise<AuthResponse> => {
      const data = await this.request<AuthResponse>('/auth/oauth', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.token) {
        this.setToken(data.token);
        localStorage.setItem(USER_STORAGE_KEY, data.user.email);
      }
      return data;
    },

    me: async (): Promise<{ user: UserProfile }> => {
      return this.request<{ user: UserProfile }>('/auth/me');
    },

    logout: () => {
      this.removeToken();
    },
  };

  // Projects Endpoints
  public projects = {
    list: async (): Promise<{ projects: Project[] }> => {
      return this.request<{ projects: Project[] }>('/projects');
    },

    create: async (project: Project): Promise<{ project: Project }> => {
      return this.request<{ project: Project }>('/projects', {
        method: 'POST',
        body: JSON.stringify(project),
      });
    },

    update: async (id: string, updates: Partial<Project>): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    delete: async (id: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`/projects/${id}`, {
        method: 'DELETE',
      });
    },
  };
}

export const api = new ApiClient();
