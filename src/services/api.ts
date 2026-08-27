import type { Project, Voice, TranscriptSegment } from '../types';

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

export interface UploadResponse {
  url: string;
  filename: string;
  originalName: string;
  size: string;
  mimeType: string;
  message?: string;
}

export interface GenerateDubbingResponse {
  transcript: TranscriptSegment[];
  targetLanguage: string;
  segmentCount: number;
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

  // 1. AUTHENTICATION
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

  // 2. MEDIA UPLOADS
  public media = {
    upload: async (file: File): Promise<UploadResponse> => {
      const token = this.getToken();
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/media/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload media file.');
      }
      return data as UploadResponse;
    },

    extractUrl: async (url: string): Promise<{ url: string; title: string; thumbnailUrl: string; duration: number }> => {
      return this.request<{ url: string; title: string; thumbnailUrl: string; duration: number }>('/media/extract-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    },
  };

  // 3. AI DUBBING ENGINE & EXPORTS
  public dubbing = {
    generate: async (payload: {
      sourceUrl?: string;
      originalLanguage?: string;
      targetLanguage?: string;
      title?: string;
      duration?: number;
    }): Promise<GenerateDubbingResponse> => {
      return this.request<GenerateDubbingResponse>('/dubbing/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getExportUrl: (projectId: string, format: 'srt' | 'vtt' | 'json'): string => {
      return `${this.baseUrl}/dubbing/export/${projectId}/${format}`;
    },

    downloadSubtitles: (projectId: string, format: 'srt' | 'vtt' | 'json') => {
      const url = `${this.baseUrl}/dubbing/export/${projectId}/${format}`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `subtitles.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  };

  // 4. VOICES STUDIO
  public voices = {
    list: async (language?: string, gender?: string): Promise<{ voices: Voice[] }> => {
      const params = new URLSearchParams();
      if (language) params.append('language', language);
      if (gender) params.append('gender', gender);
      const query = params.toString() ? `?${params.toString()}` : '';
      return this.request<{ voices: Voice[] }>(`/voices${query}`);
    },

    clone: async (voiceData: {
      name: string;
      language?: string;
      languageCode?: string;
      gender?: 'male' | 'female' | 'neutral';
      style?: Voice['style'];
      tone?: string;
      tags?: string[];
      previewUrl?: string;
    }): Promise<{ voice: Voice; message: string }> => {
      return this.request<{ voice: Voice; message: string }>('/voices/clone', {
        method: 'POST',
        body: JSON.stringify(voiceData),
      });
    },
  };

  // 5. PROJECTS MANAGEMENT
  public projects = {
    list: async (): Promise<{ projects: Project[] }> => {
      return this.request<{ projects: Project[] }>('/projects');
    },

    create: async (project: Partial<Project>): Promise<{ project: Project }> => {
      return this.request<{ project: Project }>('/projects', {
        method: 'POST',
        body: JSON.stringify(project),
      });
    },

    update: async (id: string, updates: Partial<Project>): Promise<{ project?: Project; message: string }> => {
      return this.request<{ project?: Project; message: string }>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    updateTranscript: async (id: string, transcript: TranscriptSegment[]): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`/projects/${id}/transcript`, {
        method: 'PUT',
        body: JSON.stringify({ transcript }),
      });
    },

    duplicate: async (id: string): Promise<{ project: Project; message: string }> => {
      return this.request<{ project: Project; message: string }>(`/projects/${id}/duplicate`, {
        method: 'POST',
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
