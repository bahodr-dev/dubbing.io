export type ProjectStatus = 'draft' | 'processing' | 'completed' | 'failed';

export interface TranscriptSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  originalText: string;
  translatedText: string;
  speaker?: string;
  confidence?: number;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  style: 'Natural' | 'Professional' | 'Narrative' | 'Conversational' | 'Dynamic' | 'Warm';
  gender: 'female' | 'male' | 'neutral';
  tone: string;
  previewUrl?: string;
  tags: string[];
  recommended?: boolean;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  voiceCount: number;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  originalLanguage: string;
  targetLanguage: string;
  status: ProjectStatus;
  duration: number; // in seconds
  createdAt: string;
  updatedAt: string;
  videoUrl: string;
  thumbnailUrl: string;
  voiceId: string;
  transcript: TranscriptSegment[];
  processingProgress?: number;
  currentStageIndex?: number;
  videoQuality?: '1080p' | '4K' | '720p';
  fileSize?: string;
}

export interface ProcessingStep {
  id: string;
  label: string;
  detail: string;
  targetPercent: number;
}

export type ActiveTab = 'landing' | 'dashboard' | 'studio' | 'pricing' | 'signup';
