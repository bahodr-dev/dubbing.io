export type ProjectStatus = 'draft' | 'processing' | 'completed' | 'partial' | 'paused' | 'failed';
export type VoiceMode = 'clone' | 'site';
export type SpeechCadence = 'natural' | 'fast' | 'narrative';
export type QualityMode = 'standard' | 'cinema';
export type Expression = 'neutral' | 'whisper' | 'shout' | 'sad' | 'happy';
export interface NewDubOptions {
  qualityMode?: QualityMode;
  voiceMode: VoiceMode;
  voiceCloningConsent?: boolean;
  speechCadence: SpeechCadence;
}

export interface TranscriptSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  originalText: string;
  translatedText: string;
  translationEdited?: boolean;
  translationLanguage?: string;
  translationSourceText?: string;
  expression?: Expression;
  expressionEdited?: boolean;
  qualityWarnings?: string[];
  regenerationStatus?: 'ready' | 'needs_edit' | 'pending';
  speaker?: string;
  speakerSource?: 'diarization' | 'manual' | 'manual-unverified';
  confidence?: number;
  characterId?: string;
  unresolvedReason?: string;
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
  qualityMode?: QualityMode;
  editRevision?: number;
  dialogueUrl?: string;
  backgroundUrl?: string;
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
  sourceVideoUrl?: string;
  dubbedVideoUrl?: string;
  dubbedAudioUrl?: string;
  thumbnailUrl: string;
  voiceId: string;
  speakerVoices?: Record<string, string>;
  mediaId?: string;
  outputMediaId?: string;
  outputAudioMediaId?: string;
  audioUrl?: string;
  transcript: TranscriptSegment[];
  processingProgress?: number;
  currentStageIndex?: number;
  videoQuality?: '1080p' | '4K' | '720p';
  fileSize?: string;
}

export type JobStatus = 'pending' | 'queued' | 'transcribing' | 'translating' | 'synthesizing' | 'rendering' | 'completed' | 'partial' | 'paused' | 'failed';

export interface ProcessingStep {
  id: string;
  label: string;
  detail: string;
  targetPercent: number;
}

export type ActiveTab = 'home' | 'dashboard' | 'studio' | 'pricing' | 'signup';

export interface PaymentPlan {
  id: string;
  name: string;
  tier: 'free' | 'creator' | 'pro' | 'addon';
  minutes: number;
  priceMonthlyUSD: number;
  priceMonthlyUZS: number;
  priceYearlyUSD: number;
  priceYearlyUZS: number;
  description: string;
  features: string[];
}

export interface PaymentOrder {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  amountUzs: number;
  amountUsd: number;
  minutesCredited: number;
  provider: 'payme' | 'click' | 'uzum';
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  createdAt: string;
  completedAt?: string;
}

export interface UserSubscription {
  plan: 'free' | 'creator' | 'pro';
  minutesBalance: number;
  subscriptionExpiresAt?: string | null;
}

export type ProjectLoadState = 'loading' | 'success' | 'error';
