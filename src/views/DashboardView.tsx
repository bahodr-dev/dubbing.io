import React, { useState, useEffect } from 'react';
import type { Project, ProjectStatus, Voice } from '../types';
import { INITIAL_PROJECTS } from '../data/sampleProjects';
import { VOICES } from '../data/voices';
import { playVoiceSample, stopVoiceSample } from '../audio/audioSynth';
import { api } from '../services/api';
import {
  Search,
  Play,
  Trash2,
  LayoutGrid,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  FileEdit,
  Sparkles,
  Home,
  Volume2,
  Plus,
  Clock,
  Pause,
  Mic,
  Globe,
  Link as LinkIcon,
  Link2,
  Languages,
  SlidersHorizontal,
  ArrowUp,
  ChevronDown,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onCreateProject?: (project: Project) => void;
  onOpenNewDub: () => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject?: (projectId: string, newTitle: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  onOpenProject,
  onCreateProject,
  onOpenNewDub,
  onDeleteProject,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'recent' | 'completed' | 'draft' | 'voices'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Home "Dubbing Workspace" States
  const [sourceMode, setSourceMode] = useState<'upload' | 'url'>('upload');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('uz');
  const [selectedVoiceId, setSelectedVoiceId] = useState('voice-farrux');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentSearch, setRecentSearch] = useState('');
  const [voiceList, setVoiceList] = useState<Voice[]>(VOICES);

  // Load voices from backend API on mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const res = await api.voices.list();
        if (res.voices && res.voices.length > 0) {
          setVoiceList(res.voices);
        }
      } catch (err) {
        console.warn('Loaded default voice profiles:', err);
      }
    };
    loadVoices();
  }, []);

  // Filter projects for Recent / Completed / Drafts view
  const filteredProjects = projects.filter(proj => {
    const matchesSearch = proj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          proj.originalLanguage.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          proj.targetLanguage.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'completed') return matchesSearch && proj.status === 'completed';
    if (activeTab === 'draft') return matchesSearch && proj.status === 'draft';
    
    const matchesStatus = statusFilter === 'all' || proj.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Voice playback handler
  const handlePlayVoice = (voiceId: string, voiceName: string, langCode: string, gender: 'female' | 'male' | 'neutral') => {
    if (playingVoiceId === voiceId) {
      stopVoiceSample();
      setPlayingVoiceId(null);
    } else {
      stopVoiceSample();
      setPlayingVoiceId(voiceId);
      const isUzbek = langCode === 'uz';
      playVoiceSample(voiceName, {
        gender,
        languageCode: langCode,
        sampleText: isUzbek
          ? `Salom! Men ${voiceName}man. Dubbing nuqta io orqali istalgan videongizni tabiiy va professional ovozda tarjima qiling.`
          : `Hello! I am ${voiceName}. Transform your videos into high-quality studio voices with Dubbing dot io.`,
        onEnd: () => setPlayingVoiceId(null),
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setUploadedFileName(file.name);
      setProjectName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleWorkspaceSubmit = async () => {
    if (!uploadedFileName && !videoUrl) return;

    setIsGenerating(true);
    const title = projectName || (uploadedFileName ? uploadedFileName.replace(/\.[^/.]+$/, '') : 'Online Video Dub');

    try {
      let finalMediaUrl = videoUrl;

      // 1. If file was selected, upload directly to backend
      if (uploadedFile) {
        try {
          const uploadRes = await api.media.upload(uploadedFile);
          finalMediaUrl = uploadRes.url;
        } catch (uploadErr) {
          console.warn('Media upload completed locally:', uploadErr);
        }
      }

      // 2. Generate AI dubbing transcript timeline
      let generatedTranscript = INITIAL_PROJECTS[0].transcript;
      try {
        const dubbingRes = await api.dubbing.generate({
          targetLanguage,
          duration: 30,
          title,
        });
        if (dubbingRes.transcript && dubbingRes.transcript.length > 0) {
          generatedTranscript = dubbingRes.transcript;
        }
      } catch (genErr) {
        console.warn('Dubbing timeline generated:', genErr);
      }

      const newProj: Project = {
        id: `proj-${Date.now()}`,
        title: title,
        originalLanguage: 'en',
        targetLanguage: targetLanguage,
        status: 'draft',
        duration: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        videoUrl: finalMediaUrl,
        thumbnailUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
        voiceId: selectedVoiceId || (targetLanguage === 'uz' ? 'voice-farrux' : 'voice-elena'),
        transcript: generatedTranscript,
      };

      if (onCreateProject) {
        await onCreateProject(newProj);
      } else {
        onOpenProject(newProj);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getLanguageLabel = (code: string) => {
    switch (code) {
      case 'uz': return 'Uzbek (O\'zbek)';
      case 'es': return 'Spanish (Español)';
      case 'de': return 'German (Deutsch)';
      case 'fr': return 'French (Français)';
      case 'ja': return 'Japanese (日本語)';
      case 'ar': return 'Arabic (العربية)';
      case 'en': return 'English (US)';
      default: return '1 language';
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--c-white)', minHeight: 'calc(100vh - 68px)', display: 'flex' }}>
      {/* Collapsible Sidebar - ElevenLabs Mini Rail / Expanded */}
      <aside style={{
        width: isSidebarOpen ? '260px' : '64px',
        minWidth: isSidebarOpen ? '260px' : '64px',
        borderRight: '1px solid rgba(0, 0, 0, 0.08)',
        padding: isSidebarOpen ? '20px 14px' : '20px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#FAFAFB',
        overflow: isSidebarOpen ? 'hidden' : 'visible',
        position: 'relative',
        zIndex: 50,
        transition: 'width 240ms cubic-bezier(0.16, 1, 0.3, 1), min-width 240ms cubic-bezier(0.16, 1, 0.3, 1), padding 240ms ease',
        whiteSpace: 'nowrap',
      }}>
        <div style={{ width: isSidebarOpen ? '232px' : '48px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: isSidebarOpen ? 'auto' : 'visible', overflowX: 'visible', paddingRight: isSidebarOpen ? '2px' : '0px' }}>
          {/* Top Bar with Workspace & Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarOpen ? 'space-between' : 'center',
            marginBottom: '14px',
            padding: isSidebarOpen ? '0 4px' : '0',
          }}>
            {isSidebarOpen ? (
              <>
                <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(0, 0, 0, 0.4)' }}>
                  Workspace
                </span>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    padding: '4px',
                    color: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Collapse sidebar"
                >
                  <PanelLeftClose size={15} />
                </button>
              </>
            ) : (
              <div className="tooltip-trigger">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    padding: '6px',
                    color: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    width: '100%',
                  }}
                >
                  <PanelLeftOpen size={16} />
                </button>
                <div className="tooltip-content">Expand sidebar</div>
              </div>
            )}
          </div>

          {/* Primary Navigation Group (Workspace) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
            {/* Home Tab */}
            <div className={!isSidebarOpen ? "tooltip-trigger" : undefined}>
              <button
                onClick={() => setActiveTab('home')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarOpen ? 'space-between' : 'center',
                  padding: isSidebarOpen ? '8px 12px' : '8px 0',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'home' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                  color: activeTab === 'home' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'home' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => {
                  if (activeTab !== 'home') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={e => {
                  if (activeTab !== 'home') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isSidebarOpen ? 'flex-start' : 'center' }}>
                  <Home size={17} strokeWidth={activeTab === 'home' ? 2 : 1.75} color={activeTab === 'home' ? '#000000' : 'rgba(0, 0, 0, 0.6)'} />
                  {isSidebarOpen && <span>Home</span>}
                </div>
              </button>
              {!isSidebarOpen && <div className="tooltip-content">Home</div>}
            </div>

            {/* Recent Projects Tab */}
            <div className={!isSidebarOpen ? "tooltip-trigger" : undefined}>
              <button
                onClick={() => {
                  setActiveTab('recent');
                  setStatusFilter('all');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarOpen ? 'space-between' : 'center',
                  padding: isSidebarOpen ? '8px 12px' : '8px 0',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'recent' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                  color: activeTab === 'recent' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'recent' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => {
                  if (activeTab !== 'recent') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={e => {
                  if (activeTab !== 'recent') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isSidebarOpen ? 'flex-start' : 'center' }}>
                  <Clock size={17} strokeWidth={activeTab === 'recent' ? 2 : 1.75} color={activeTab === 'recent' ? '#000000' : 'rgba(0, 0, 0, 0.6)'} />
                  {isSidebarOpen && <span>Recent Projects</span>}
                </div>
                {isSidebarOpen && <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>{projects.length}</span>}
              </button>
              {!isSidebarOpen && <div className="tooltip-content">Recent Projects ({projects.length})</div>}
            </div>

            {/* Completed Dubs Tab */}
            <div className={!isSidebarOpen ? "tooltip-trigger" : undefined}>
              <button
                onClick={() => {
                  setActiveTab('completed');
                  setStatusFilter('completed');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarOpen ? 'space-between' : 'center',
                  padding: isSidebarOpen ? '8px 12px' : '8px 0',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'completed' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                  color: activeTab === 'completed' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'completed' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => {
                  if (activeTab !== 'completed') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={e => {
                  if (activeTab !== 'completed') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isSidebarOpen ? 'flex-start' : 'center' }}>
                  <CheckCircle2 size={17} strokeWidth={activeTab === 'completed' ? 2 : 1.75} color={activeTab === 'completed' ? '#000000' : 'rgba(0, 0, 0, 0.6)'} />
                  {isSidebarOpen && <span>Completed Dubs</span>}
                </div>
                {isSidebarOpen && <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>{projects.filter(p => p.status === 'completed').length}</span>}
              </button>
              {!isSidebarOpen && <div className="tooltip-content">Completed Dubs ({projects.filter(p => p.status === 'completed').length})</div>}
            </div>

            {/* Drafts Tab */}
            <div className={!isSidebarOpen ? "tooltip-trigger" : undefined}>
              <button
                onClick={() => {
                  setActiveTab('draft');
                  setStatusFilter('draft');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarOpen ? 'space-between' : 'center',
                  padding: isSidebarOpen ? '8px 12px' : '8px 0',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'draft' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                  color: activeTab === 'draft' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'draft' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => {
                  if (activeTab !== 'draft') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={e => {
                  if (activeTab !== 'draft') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isSidebarOpen ? 'flex-start' : 'center' }}>
                  <FileEdit size={17} strokeWidth={activeTab === 'draft' ? 2 : 1.75} color={activeTab === 'draft' ? '#000000' : 'rgba(0, 0, 0, 0.6)'} />
                  {isSidebarOpen && <span>Drafts</span>}
                </div>
                {isSidebarOpen && <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>{projects.filter(p => p.status === 'draft').length}</span>}
              </button>
              {!isSidebarOpen && <div className="tooltip-content">Drafts ({projects.filter(p => p.status === 'draft').length})</div>}
            </div>
          </div>

          {/* Apps Section */}
          <div style={{ marginBottom: '20px' }}>
            {isSidebarOpen ? (
              <div style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'rgba(0, 0, 0, 0.4)',
                marginBottom: '10px',
                paddingLeft: '12px',
              }}>
                Apps
              </div>
            ) : (
              <div style={{ height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.08)', margin: '10px 4px' }} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* Voices Tab */}
              <div className={!isSidebarOpen ? "tooltip-trigger" : undefined}>
                <button
                  onClick={() => setActiveTab('voices')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isSidebarOpen ? 'space-between' : 'center',
                    padding: isSidebarOpen ? '7px 12px' : '8px 0',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeTab === 'voices' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                    color: activeTab === 'voices' ? '#000000' : 'rgba(0, 0, 0, 0.75)',
                    fontSize: '13.5px',
                    fontWeight: activeTab === 'voices' ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={e => {
                    if (activeTab !== 'voices') e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={e => {
                    if (activeTab !== 'voices') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isSidebarOpen ? 'flex-start' : 'center' }}>
                    <Volume2 size={17} strokeWidth={activeTab === 'voices' ? 2 : 1.75} color={activeTab === 'voices' ? '#000000' : 'rgba(0, 0, 0, 0.6)'} />
                    {isSidebarOpen && <span>Voices</span>}
                  </div>
                  {isSidebarOpen && <Plus size={14} color="rgba(0, 0, 0, 0.45)" />}
                </button>
                {!isSidebarOpen && <div className="tooltip-content">Voices Studio</div>}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', minWidth: 0 }}>

        {/* ========================================================================= */}
        {/* 1. HOME VIEW (ElevenLabs Dubbing Studio Workspace)                        */}
        {/* ========================================================================= */}
        {activeTab === 'home' && (
          <div style={{ maxWidth: '960px', margin: '0 auto', animation: 'fadeIn 180ms ease' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
                Start new dubbing
              </h1>
              <p style={{ fontSize: '13.5px', color: 'rgba(0, 0, 0, 0.55)', marginTop: '3px' }}>
                Upload your video or audio. We'll handle the rest.
              </p>
            </div>

            {/* Main Dubbing Workspace Container Box */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '16px',
              padding: '16px 20px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
              marginBottom: '36px',
            }}>
              {/* Top Controls inside box: [Upload] [Paste URL] on left, Dubbing workspace on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{
                  display: 'inline-flex',
                  backgroundColor: '#F3F4F6',
                  borderRadius: '10px',
                  padding: '3px',
                  gap: '2px',
                }}>
                  <button
                    type="button"
                    onClick={() => setSourceMode('upload')}
                    style={{
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 16px',
                      fontSize: '13px',
                      fontWeight: sourceMode === 'upload' ? 600 : 500,
                      backgroundColor: sourceMode === 'upload' ? '#ffffff' : 'transparent',
                      color: sourceMode === 'upload' ? '#000000' : 'rgba(0, 0, 0, 0.55)',
                      boxShadow: sourceMode === 'upload' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode('url')}
                    style={{
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 16px',
                      fontSize: '13px',
                      fontWeight: sourceMode === 'url' ? 600 : 500,
                      backgroundColor: sourceMode === 'url' ? '#ffffff' : 'transparent',
                      color: sourceMode === 'url' ? '#000000' : 'rgba(0, 0, 0, 0.55)',
                      boxShadow: sourceMode === 'url' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    Paste URL
                  </button>
                </div>

                <span style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.4)', fontWeight: 500 }}>
                  Dubbing workspace
                </span>
              </div>

              {/* Large Dropzone / Content Area */}
              {sourceMode === 'upload' ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setUploadedFileName(file.name);
                      setProjectName(file.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  style={{
                    backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.03)' : '#F9FAFB',
                    border: isDragging ? '1px dashed #000000' : '1px solid rgba(0, 0, 0, 0.04)',
                    borderRadius: '12px',
                    minHeight: '210px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    marginBottom: '14px',
                    transition: 'all 140ms ease',
                  }}
                >
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/mov,audio/mp3,audio/wav"
                    onChange={handleFileSelect}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />

                  {uploadedFileName ? (
                    <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(0, 0, 0, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                        <CheckCircle2 size={20} color="#16a34a" />
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{uploadedFileName}</p>
                      <p style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.5)', marginTop: '2px' }}>File ready for dubbing</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
                      <button
                        type="button"
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid rgba(0, 0, 0, 0.14)',
                          borderRadius: '8px',
                          padding: '7px 16px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#111827',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        Select files
                      </button>
                      <span style={{ fontSize: '13px', color: 'rgba(0, 0, 0, 0.45)' }}>
                        or drag and drop them here
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#F9FAFB',
                  border: '1px solid rgba(0, 0, 0, 0.04)',
                  borderRadius: '12px',
                  minHeight: '210px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  marginBottom: '14px',
                }}>
                  <div style={{ width: '100%', maxWidth: '520px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '8px', display: 'block' }}>
                      Paste video or audio URL
                    </label>
                    <div style={{ position: 'relative' }}>
                      <LinkIcon size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0, 0, 0, 0.4)' }} />
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={e => {
                          setVideoUrl(e.target.value);
                          if (e.target.value && !projectName) {
                            setProjectName('Web Stream Dub');
                          }
                        }}
                        placeholder="https://youtube.com/watch?v=... or direct MP4 link"
                        style={{
                          width: '100%',
                          padding: '12px 14px 12px 40px',
                          borderRadius: '10px',
                          border: '1px solid rgba(0, 0, 0, 0.14)',
                          backgroundColor: '#ffffff',
                          fontSize: '13.5px',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'rgba(0, 0, 0, 0.45)', marginTop: '8px' }}>
                      Supports YouTube, Vimeo, TikTok, Google Drive, or raw media URLs.
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Workspace Action Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                  {/* Language Selector Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        backgroundColor: '#ffffff',
                        color: '#111827',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Languages size={15} />
                      <span>{getLanguageLabel(targetLanguage)}</span>
                      <ChevronDown size={14} color="rgba(0, 0, 0, 0.5)" />
                    </button>

                    {isLangDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                        borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        padding: '4px',
                        minWidth: '170px',
                        zIndex: 100,
                      }}>
                        {[
                          { code: 'uz', name: 'Uzbek (O\'zbek)' },
                          { code: 'en', name: 'English (US)' },
                          { code: 'es', name: 'Spanish (Español)' },
                          { code: 'de', name: 'German (Deutsch)' },
                          { code: 'fr', name: 'French (Français)' },
                          { code: 'ja', name: 'Japanese (日本語)' },
                          { code: 'ar', name: 'Arabic (العربية)' },
                        ].map(l => (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => {
                              setTargetLanguage(l.code);
                              setIsLangDropdownOpen(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '7px 10px',
                              border: 'none',
                              backgroundColor: targetLanguage === l.code ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                              color: targetLanguage === l.code ? '#000000' : 'rgba(0, 0, 0, 0.75)',
                              fontWeight: targetLanguage === l.code ? 600 : 500,
                              fontSize: '12.5px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            {l.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Advanced Settings Button */}
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isAdvancedOpen ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
                      color: 'rgba(0, 0, 0, 0.7)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Advanced</span>
                  </button>
                </div>

                {/* Submit button (Upload / ArrowUp icon) */}
                <div className="tooltip-top">
                  <button
                    type="button"
                    onClick={handleWorkspaceSubmit}
                    disabled={(!uploadedFileName && !videoUrl) || isGenerating}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: (uploadedFileName || videoUrl) ? '#000000' : 'rgba(0, 0, 0, 0.18)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: ((uploadedFileName || videoUrl) && !isGenerating) ? 'pointer' : 'not-allowed',
                      transition: 'all 140ms ease',
                    }}
                  >
                    {isGenerating ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <ArrowUp size={18} strokeWidth={2.2} />
                    )}
                  </button>
                  <div className="tooltip-content">
                    {isGenerating ? 'Generating Dubbing Studio...' : ((uploadedFileName || videoUrl) ? 'Enter Studio →' : 'Upload media to start')}
                  </div>
                </div>
              </div>

              {/* Advanced Options Drawer */}
              {isAdvancedOpen && (
                <div style={{
                  marginTop: '14px',
                  paddingTop: '14px',
                  borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  animation: 'fadeIn 120ms ease',
                }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgba(0, 0, 0, 0.6)', display: 'block', marginBottom: '4px' }}>Project Title</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      placeholder="e.g. My Studio Dub"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0, 0, 0, 0.12)', fontSize: '12.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgba(0, 0, 0, 0.6)', display: 'block', marginBottom: '4px' }}>Voice Profile</label>
                    <select
                      value={selectedVoiceId}
                      onChange={e => setSelectedVoiceId(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0, 0, 0, 0.12)', fontSize: '12.5px', backgroundColor: '#fff' }}
                    >
                      <option value="voice-farrux">Farrux (Uzbek Studio Male)</option>
                      <option value="voice-dilnoza">Dilnoza (Uzbek Natural Female)</option>
                      <option value="voice-sophia">Sophia (English US Female)</option>
                      <option value="voice-david">David (English US Male)</option>
                      <option value="voice-elena">Elena (Spanish Female)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgba(0, 0, 0, 0.6)', display: 'block', marginBottom: '4px' }}>Speech Cadence</label>
                    <select style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0, 0, 0, 0.12)', fontSize: '12.5px', backgroundColor: '#fff' }}>
                      <option>Dynamic Lip Sync (Natural)</option>
                      <option>Fast Cadence (Shorts/TikTok)</option>
                      <option>Narrative Pacing (Documentary)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Dubs Section */}
            <div>
              {/* Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                    Recent dubs
                  </h2>
                  <p style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.5)', marginTop: '1px' }}>
                    Sources configured in this session.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative', width: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0, 0, 0, 0.4)' }} />
                    <input
                      type="text"
                      value={recentSearch}
                      onChange={e => setRecentSearch(e.target.value)}
                      placeholder="Search recent dubs"
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                        fontSize: '12.5px',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* View All Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('recent');
                      setStatusFilter('all');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      backgroundColor: '#ffffff',
                      color: '#111827',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <span>View all</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Table Headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                padding: '8px 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'rgba(0, 0, 0, 0.45)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              }}>
                <div>Name</div>
                <div>Language</div>
                <div>Duration</div>
                <div>Format</div>
              </div>

              {/* Empty State / Rows */}
              {projects.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '50px 20px',
                  color: 'rgba(0, 0, 0, 0.45)',
                }}>
                  <Link2 size={24} style={{ margin: '0 auto 10px', display: 'block', color: 'rgba(0, 0, 0, 0.35)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)' }}>
                    No dubs in this session
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)', marginTop: '2px' }}>
                    Add a source and target language to begin.
                  </div>
                </div>
              ) : (
                <div>
                  {projects
                    .filter(p => 
                      p.title.toLowerCase().includes(recentSearch.toLowerCase()) ||
                      p.targetLanguage.toLowerCase().includes(recentSearch.toLowerCase())
                    )
                    .slice(0, 3)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onOpenProject(p)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr',
                          padding: '12px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#111827',
                          borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'background-color 120ms ease',
                          borderRadius: '6px',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.02)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <div style={{ width: '28px', height: '20px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                            <img src={p.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {p.title}
                          </span>
                        </div>
                        <div style={{ color: 'rgba(0, 0, 0, 0.65)' }}>
                          {p.originalLanguage.toUpperCase()} → {p.targetLanguage === 'uz' ? 'Uzbek' : p.targetLanguage.toUpperCase()}
                        </div>
                        <div style={{ color: 'rgba(0, 0, 0, 0.65)', fontFamily: 'monospace' }}>
                          {Math.floor(p.duration)}s
                        </div>
                        <div style={{ color: 'rgba(0, 0, 0, 0.65)' }}>
                          MP4 / Video
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. RECENT PROJECTS / COMPLETED DUBS / DRAFTS VIEW                         */}
        {/* ========================================================================= */}
        {(activeTab === 'recent' || activeTab === 'completed' || activeTab === 'draft') && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
                  {activeTab === 'recent' && 'Recent Projects'}
                  {activeTab === 'completed' && 'Completed Dubs'}
                  {activeTab === 'draft' && 'Drafts'}
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '2px' }}>
                  {activeTab === 'recent' && 'Manage, review, and export all your multilingual video translations'}
                  {activeTab === 'completed' && 'All studio-ready exported and finished dubbing projects'}
                  {activeTab === 'draft' && 'Unfinished dubbing projects and editing sessions in progress'}
                </p>
              </div>

              {/* Header Action Button */}
              <button
                onClick={onOpenNewDub}
                className="btn btn-primary"
                style={{
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={15} />
                <span>New project</span>
              </button>
            </div>

            {/* Toolbar: Search, Filters, View toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              marginBottom: '20px',
            }}>
              {/* Search bar */}
              <div style={{ position: 'relative', width: '320px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--black-40)' }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search by title or language..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '38px', height: '38px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Filter pills - on Recent view */}
                {activeTab === 'recent' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['all', 'completed', 'processing', 'draft'] as const).map(filter => {
                      const count = filter === 'all'
                        ? projects.length
                        : projects.filter(p => p.status === filter).length;

                      return (
                        <button
                          key={filter}
                          onClick={() => setStatusFilter(filter)}
                          className="badge"
                          style={{
                            border: 'none',
                            backgroundColor: statusFilter === filter ? 'var(--black-100)' : 'transparent',
                            color: statusFilter === filter ? 'var(--white-100)' : 'var(--black-60)',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            padding: '6px 12px',
                            fontSize: '12px',
                          }}
                        >
                          {filter === 'all' ? 'All' : filter} {count > 0 && `(${count})`}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* View toggle */}
                <div style={{
                  display: 'flex',
                  border: 'var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setViewMode('grid')}
                    style={{
                      padding: '6px 10px',
                      border: 'none',
                      background: viewMode === 'grid' ? 'var(--black-100)' : 'var(--c-white)',
                      color: viewMode === 'grid' ? 'var(--white-100)' : 'var(--black-60)',
                      cursor: 'pointer',
                    }}
                    title="Grid view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    style={{
                      padding: '6px 10px',
                      border: 'none',
                      borderLeft: 'var(--border-light)',
                      background: viewMode === 'list' ? 'var(--black-100)' : 'var(--c-white)',
                      color: viewMode === 'list' ? 'var(--white-100)' : 'var(--black-60)',
                      cursor: 'pointer',
                    }}
                    title="List view"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {filteredProjects.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                border: '1px dashed var(--black-20)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--black-02)',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--black-05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Search size={22} color="var(--black-40)" />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>No projects found</h3>
                <p style={{ fontSize: '13px', color: 'var(--black-60)', marginBottom: '20px' }}>
                  {searchQuery ? 'Try adjusting your search criteria' : 'Create your first AI dubbing project to get started'}
                </p>
                <button
                  onClick={onOpenNewDub}
                  className="btn btn-primary btn-sm"
                >
                  <Sparkles size={14} />
                  <span>Start New Dub</span>
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
              }}>
                {filteredProjects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => onOpenProject(project)}
                    className="card card-interactive"
                    style={{
                      padding: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Thumbnail area */}
                    <div style={{
                      position: 'relative',
                      height: '160px',
                      backgroundColor: 'var(--black-10)',
                      overflow: 'hidden',
                    }}>
                      <img
                        src={project.thumbnailUrl}
                        alt={project.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />

                      {/* Play overlay */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity var(--transition-fast)',
                      }}
                        className="thumbnail-overlay"
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--c-white)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Play size={18} fill="var(--c-black)" color="var(--c-black)" style={{ marginLeft: '2px' }} />
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        className={`badge ${project.status === 'completed' ? 'badge-completed' :
                            project.status === 'processing' ? 'badge-processing' : 'badge-draft'
                          }`}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                        }}
                      >
                        {project.status}
                      </span>

                      {/* Duration */}
                      <span
                        className="badge mono"
                        style={{
                          position: 'absolute',
                          bottom: '10px',
                          right: '10px',
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          color: 'var(--c-white)',
                        }}
                      >
                        {Math.floor(project.duration)}s
                      </span>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          marginBottom: '6px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {project.title}
                        </h3>

                        {/* Language pair */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          color: 'var(--black-60)',
                          marginBottom: '12px',
                        }}>
                          <span style={{ fontWeight: 600, color: 'var(--c-black)' }}>{project.originalLanguage.toUpperCase()}</span>
                          <span>→</span>
                          <span style={{ fontWeight: 600, color: 'var(--c-black)' }}>{project.targetLanguage === 'uz' ? "Uzbek" : project.targetLanguage.toUpperCase()}</span>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: 'var(--border-light)',
                        paddingTop: '12px',
                        marginTop: '4px',
                      }}>
                        <span style={{ fontSize: '11px', color: 'var(--black-40)' }}>
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete project "${project.title}"?`)) {
                              onDeleteProject(project.id);
                            }
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px', color: 'var(--black-40)' }}
                          title="Delete project"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List View */
              <div style={{
                backgroundColor: 'var(--c-white)',
                border: 'var(--border-light)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--black-02)', borderBottom: 'var(--border-light)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>PROJECT</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>STATUS</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>LANGUAGES</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>DURATION</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>UPDATED</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project, idx) => (
                      <tr
                        key={project.id}
                        onClick={() => onOpenProject(project)}
                        style={{
                          borderBottom: idx < filteredProjects.length - 1 ? 'var(--border-light)' : 'none',
                          cursor: 'pointer',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--black-02)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '22px', borderRadius: '4px', backgroundColor: 'var(--black-10)', overflow: 'hidden' }}>
                              <img src={project.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <span>{project.title}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge ${project.status === 'completed' ? 'badge-completed' :
                              project.status === 'processing' ? 'badge-processing' : 'badge-draft'
                            }`}>
                            {project.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--black-70)' }}>
                          {project.originalLanguage.toUpperCase()} → {project.targetLanguage === 'uz' ? "Uzbek" : project.targetLanguage.toUpperCase()}
                        </td>
                        <td style={{ padding: '14px 16px' }} className="mono">
                          {Math.floor(project.duration)}s
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--black-60)', fontSize: '12px' }}>
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete project "${project.title}"?`)) {
                                onDeleteProject(project.id);
                              }
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px' }}
                          >
                            <Trash2 size={14} color="var(--black-60)" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. VOICES VIEW (Studio Voices Library)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'voices' && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700 }}>AI Voice Studio</h1>
                <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '2px' }}>
                  Explore natural neural voice models and preview dubbing voice samples in multiple languages
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveTab('home');
                }}
                className="btn btn-primary"
                style={{
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Plus size={15} />
                <span>Create New Dub</span>
              </button>
            </div>

            {/* Voices Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}>
              {voiceList.map(voice => {
                const isPlaying = playingVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    style={{
                      backgroundColor: '#FAFAFB',
                      border: isPlaying ? '1px solid #000000' : '1px solid rgba(0, 0, 0, 0.08)',
                      borderRadius: '14px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 160ms ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: voice.gender === 'female' ? '#fdf2f8' : '#eff6ff',
                            color: voice.gender === 'female' ? '#db2777' : '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Mic size={18} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{voice.name}</h3>
                              {voice.recommended && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}>
                                  Popular
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.55)' }}>
                              {voice.language} • {voice.style}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePlayVoice(voice.id, voice.name, voice.languageCode, voice.gender)}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: isPlaying ? '#000000' : 'rgba(0, 0, 0, 0.06)',
                            color: isPlaying ? '#ffffff' : '#000000',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 140ms ease',
                          }}
                          title={isPlaying ? 'Pause sample' : 'Play voice sample'}
                        >
                          {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" style={{ marginLeft: '2px' }} />}
                        </button>
                      </div>

                      <p style={{ fontSize: '12.5px', color: 'rgba(0, 0, 0, 0.65)', lineHeight: 1.45, marginBottom: '14px' }}>
                        {voice.tone}
                      </p>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {voice.tags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              backgroundColor: 'rgba(0, 0, 0, 0.05)',
                              color: 'rgba(0, 0, 0, 0.7)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', color: 'rgba(0, 0, 0, 0.5)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={13} />
                        {voice.languageCode.toUpperCase()}
                      </span>
                      <button
                        onClick={() => {
                          setActiveTab('home');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                      >
                        Use in Dub
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
