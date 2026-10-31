import type { Project, Voice, TranscriptSegment, SpeechCadence } from '../types';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  provider: string;
  avatarUrl: string;
  plan?: 'free' | 'creator' | 'pro';
  minutesBalance?: number;
  subscriptionExpiresAt?: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: UserProfile;
  message?: string;
}

export interface UploadResponse {
  id: string;
  mediaId?: string;
  url: string;
  filename: string;
  originalName: string;
  size: string;
  sizeBytes?: number;
  mimeType: string;
  mediaType?: string;
  message?: string;
}

export interface GenerateDubbingResponse {
  transcript: TranscriptSegment[];
  targetLanguage: string;
  segmentCount: number;
  message?: string;
}

export interface ProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'all' | Project['status'] | 'ready';
}

export interface ProjectListResponse {
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ApiErrorPayload {
  error?: string;
  code?: string;
  details?: string[];
  requestId?: string;
}

/** A typed API error keeps backend error details available to the UI when needed. */
export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details: string[];
  requestId?: string;

  constructor(status: number, payload: ApiErrorPayload, fallbackMessage: string) {
    super(payload.error || fallbackMessage);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = payload.code;
    this.details = Array.isArray(payload.details) ? payload.details : [];
    this.requestId = payload.requestId;
  }
}

class ApiClient {
  private baseUrl = '/api';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        data as ApiErrorPayload,
        `Request failed with status ${response.status}`,
      );
    }

    return data as T;
  }

  // 1. AUTHENTICATION
  public auth = {
    signup: async (email: string, password: string, name?: string, inviteToken?: string | null): Promise<AuthResponse> => {
      return this.request<AuthResponse>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, inviteToken }),
      });
    },

    signin: async (email: string, password: string): Promise<AuthResponse> => {
      return this.request<AuthResponse>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },

    forgotPassword: async (email: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
    },

    me: async (): Promise<{ user: UserProfile }> => {
      return this.request<{ user: UserProfile }>('/auth/me');
    },

    logout: async (): Promise<void> => {
      try {
        await this.request('/auth/signout', { method: 'POST' });
      } catch {}
    },
  };

  // 2. MEDIA UPLOADS
  public media = {
    upload: async (file: File, projectId?: string): Promise<UploadResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) {
        formData.append('projectId', projectId);
      }

      const response = await fetch(`${this.baseUrl}/media/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new ApiRequestError(response.status, data as ApiErrorPayload, 'Failed to upload media file.');
      }
      return data as UploadResponse;
    },

    delete: async (id: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`/media/${id}`, {
        method: 'DELETE',
      });
    },

    download: async (id: string, filename: string): Promise<void> => {
      const response = await fetch(`${this.baseUrl}/media/${id}/download`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new ApiRequestError(response.status, data as ApiErrorPayload, 'Failed to download media.');
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    },

    extractUrl: async (url: string): Promise<{ url: string; title: string; thumbnailUrl: string; duration: number }> => {
      return this.request<{ url: string; title: string; thumbnailUrl: string; duration: number }>('/media/extract-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    },

    importUrl: async (url: string): Promise<UploadResponse> => {
      return this.request<UploadResponse>('/media/import-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    },
  };

  // 3. AI DUBBING ENGINE & EXPORTS
  public dubbing = {
    checkMinutes: async (mediaId: string, autoCloneVoices = false, qualityMode: 'standard' | 'cinema' = 'standard'): Promise<{
      canStart: boolean;
      duration: number;
      requiredMinutes: number;
      minutesBalance: number;
    }> => this.request('/dubbing/check-minutes', {
      method: 'POST',
      body: JSON.stringify({ mediaId, autoCloneVoices, qualityMode }),
    }),
    getCapabilities: async (): Promise<{
      canRenderFinalDub: boolean;
      requiredForFinalRender: string[];
      renderableVoiceIds: string[];
      canCloneVoices: boolean;
      cinema?: { enabled: boolean; ready: boolean; maxDuration: number | null; separationProvider?: 'fal' | 'none'; transcriptionProvider?: string; characterMatching?: string; translationProvider?: string };
    }> => this.request('/dubbing/capabilities'),

    process: async (payload: {
      projectId?: string;
      mediaId?: string;
      mediaPath?: string;
      originalLanguage?: string;
      targetLanguage?: string;
      voiceId?: string;
      autoCloneVoices?: boolean;
      autoAssignSiteVoices?: boolean;
      speechCadence: SpeechCadence;
      qualityMode?: 'standard' | 'cinema';
      voiceCloningConsent?: boolean;
      duration?: number;
    }): Promise<{ jobId: string; status: string; reservedMinutes: number; minutesBalance: number; message: string }> => {
      return this.request('/dubbing/process', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    regenerate: async (projectId: string, payload: { segmentIds: string[]; voiceCloningConsent?: boolean; speechCadence: SpeechCadence }): Promise<{ jobId: string; minutesBalance: number }> =>
      this.request(`/dubbing/projects/${projectId}/regenerate`, { method: 'POST', body: JSON.stringify(payload) }),

    getJob: async (jobId: string): Promise<{ job: any; minutesBalance: number }> => {
      return this.request<{ job: any; minutesBalance: number }>(`/dubbing/jobs/${jobId}`);
    },

    getLatestProjectJob: async (projectId: string): Promise<{ jobId: string; status: string; job: any }> => {
      return this.request(`/dubbing/projects/${projectId}/jobs/latest`);
    },

    retryJob: async (jobId: string): Promise<{ jobId: string; status: string; attempt: number; maxAttempts: number; reservedMinutes: number; minutesBalance: number; message: string }> => {
      return this.request(`/dubbing/jobs/${jobId}/retry`, { method: 'POST' });
    },

    getUsage: async (): Promise<{
      minutesBalance: number;
      usage: Array<{
        id: string;
        projectId: string | null;
        jobId: string;
        minutes: number;
        status: 'reserved' | 'consumed' | 'refunded';
        failureReason: string | null;
        reservedAt: string;
        consumedAt: string | null;
        refundedAt: string | null;
        updatedAt: string;
      }>;
    }> => this.request('/dubbing/usage'),

    transcribe: async (payload: {
      mediaId?: string;
      mediaPath?: string;
      projectId?: string;
      duration?: number;
      language?: string;
      async?: boolean;
    }): Promise<{ segments: TranscriptSegment[]; segmentCount: number; jobId?: string; status?: string; message?: string }> => {
      return this.request('/dubbing/transcribe', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getTranscriptionJob: async (jobId: string): Promise<{ jobId: string; status: string; progress: number; job: any }> => {
      return this.request(`/dubbing/transcribe/jobs/${jobId}`);
    },

    getLatestProjectTranscriptionJob: async (projectId: string): Promise<{ jobId: string; status: string; job: any }> => {
      return this.request(`/dubbing/transcribe/projects/${projectId}/jobs/latest`);
    },

    retryTranscriptionJob: async (jobId: string): Promise<{
      jobId: string;
      status: string;
      attempt: number;
      maxAttempts: number;
      message: string;
    }> => this.request(`/dubbing/transcribe/jobs/${jobId}/retry`, { method: 'POST' }),

    translate: async (payload: { text?: string; segments?: TranscriptSegment[]; sourceLanguage?: string; targetLanguage?: string }): Promise<any> => {
      return this.request<any>('/dubbing/translate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    synthesize: async (payload: { text: string; voiceId?: string; speed?: number }): Promise<{ audioUrl: string; duration: number; provider: string }> => {
      return this.request<{ audioUrl: string; duration: number; provider: string }>('/dubbing/synthesize', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

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

    downloadSubtitles: async (projectId: string, format: 'srt' | 'vtt' | 'json', filename?: string): Promise<void> => {
      const response = await fetch(`${this.baseUrl}/dubbing/export/${projectId}/${format}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new ApiRequestError(response.status, data as ApiErrorPayload, 'Failed to export subtitles.');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename || `subtitles-${projectId}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
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

  };

  // 5. PROJECTS MANAGEMENT
  public projects = {
    get: async (id: string): Promise<{ project: Project }> => this.request(`/projects/${encodeURIComponent(id)}`),
    list: async (params: ProjectListParams = {}): Promise<ProjectListResponse> => {
      const query = new URLSearchParams();
      if (params.page !== undefined) query.set('page', String(params.page));
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.status && params.status !== 'all') query.set('status', params.status);
      const queryString = query.toString();
      const suffix = queryString ? `?${queryString}` : '';
      return this.request<ProjectListResponse>(`/projects${suffix}`);
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

  // 6. PAYMENTS & SUBSCRIPTIONS (Payme & Click)
  public payments = {
    getPlans: async (): Promise<{ plans: any[]; supportedProviders: any[] }> => {
      return this.request<{ plans: any[]; supportedProviders: any[] }>('/payments/plans');
    },

    createCheckout: async (payload: {
      planId: string;
      billingCycle?: 'monthly' | 'yearly';
      provider?: 'payme' | 'click' | 'uzum';
      returnUrl?: string;
    }): Promise<{
      order: any;
      paymentUrls: { payme: string; click: string; selected: string };
      message: string;
    }> => {
      return this.request('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getOrders: async (): Promise<{ orders: any[]; subscription: any }> => {
      return this.request('/payments/orders');
    },

    getOrder: async (id: string): Promise<{ order: any; subscription: any }> => {
      return this.request(`/payments/orders/${id}`);
    },

    simulateSuccess: async (orderId: string): Promise<{ message: string; order: any; user: UserProfile }> => {
      return this.request('/payments/simulate-success', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      });
    },
  };
}

export const api = new ApiClient();
