import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { cleanupJobVoiceClones } from '../services/ai/voiceCloning.js';
import {
  parseProjectListQuery,
  sendProjectValidationError,
  validateProjectPayload,
  validateTranscript,
} from '../validators/projectValidator.js';

export const projectsRouter = Router();

// Apply auth middleware to all project routes
projectsRouter.use(authenticateToken);

function formatProject(p) {
  const sourceMediaUrl = p.source_media_id ? `/api/media/${p.source_media_id}` : (p.source_url || '');
  const dubbedVideoUrl = p.output_media_id ? `/api/media/${p.output_media_id}` : '';
  const dubbedAudioUrl = p.output_audio_media_id ? `/api/media/${p.output_audio_media_id}` : '';
  return {
    id: p.id,
    title: p.title,
    description: p.description || '',
    sourceUrl: sourceMediaUrl,
    videoUrl: sourceMediaUrl,
    sourceVideoUrl: sourceMediaUrl,
    dubbedVideoUrl,
    dubbedAudioUrl,
    audioUrl: dubbedAudioUrl,
    mediaId: p.source_media_id || null,
    outputMediaId: p.output_media_id || null,
    outputAudioMediaId: p.output_audio_media_id || null,
    thumbnailUrl: p.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    originalLanguage: p.original_language || 'en',
    targetLanguage: p.target_language || 'uz',
    voiceId: p.voice_id || 'voice-farrux',
    speakerVoices: p.speaker_voices_json ? JSON.parse(p.speaker_voices_json) : {},
    status: p.status || 'ready',
    duration: p.duration || 0,
    fileSize: p.file_size || '12.4 MB',
    videoQuality: p.video_quality || '1080p',
    transcript: p.segments_json ? JSON.parse(p.segments_json) : [],
    updatedAt: p.updated_at,
    createdAt: p.created_at,
  };
}

// 1. GET PROJECTS FOR LOGGED-IN USER (server-side pagination, search, and status filtering)
projectsRouter.get('/', (req, res) => {
  try {
    const parsed = parseProjectListQuery(req.query);
    if (!parsed.valid) {
      return sendProjectValidationError(res, parsed.errors);
    }

    const { page, limit, search, status } = parsed.value;
    const filters = ['user_id = ?'];
    const params = [req.user.id];

    if (search) {
      const term = `%${search.toLowerCase()}%`;
      filters.push('(LOWER(title) LIKE ? OR LOWER(original_language) LIKE ? OR LOWER(target_language) LIKE ?)');
      params.push(term, term, term);
    }
    if (status !== 'all') {
      filters.push('status = ?');
      params.push(status);
    }

    const whereClause = filters.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) AS total FROM projects WHERE ${whereClause}`).get(...params).total;
    const projects = db.prepare(`
      SELECT * FROM projects
      WHERE ${whereClause}
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, (page - 1) * limit);
    const totalPages = Math.ceil(total / limit);

    return res.json({
      projects: projects.map(formatProject),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error('Error fetching projects:', err);
    return res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// 2. CREATE PROJECT
projectsRouter.post('/', (req, res) => {
  try {
    const validation = validateProjectPayload(req.body);
    if (!validation.valid) {
      return sendProjectValidationError(res, validation.errors);
    }

    const { 
      id, title, description, sourceUrl, videoUrl, thumbnailUrl, 
      originalLanguage, targetLanguage, voiceId, speakerVoices, status, duration,
      fileSize, videoQuality, transcript, segments, mediaId
    } = req.body;

    const projectId = id || `proj-${randomUUID().slice(0, 8)}`;
    const projectTitle = title || 'Untitled Studio Dub';
    const mediaUrl = videoUrl || sourceUrl || '';
    const transcriptData = transcript || segments || [];
    const inferredMediaId = typeof mediaId === 'string' && mediaId
      ? mediaId
      : (/^\/api\/media\/([a-zA-Z0-9_-]+)$/.exec(mediaUrl)?.[1] || null);

    if (inferredMediaId) {
      const ownedMedia = db.prepare('SELECT id FROM media_assets WHERE id = ? AND user_id = ?').get(inferredMediaId, req.user.id);
      if (!ownedMedia) {
        return res.status(404).json({ error: 'Source media not found or unauthorized.' });
      }
    }

    const existingProject = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (existingProject) {
      return res.status(409).json({ error: 'A project with this id already exists.' });
    }

    db.prepare(`
      INSERT INTO projects (
        id, user_id, title, description, source_url, thumbnail_url, 
        original_language, target_language, voice_id, speaker_voices_json, source_media_id, status, duration,
        file_size, video_quality, segments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      req.user.id,
      projectTitle,
      description || '',
      mediaUrl,
      thumbnailUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      originalLanguage || 'en',
      targetLanguage || 'uz',
      voiceId || 'voice-farrux',
      speakerVoices ? JSON.stringify(speakerVoices) : null,
      inferredMediaId,
      status || 'ready',
      duration || 30,
      fileSize || '12.4 MB',
      videoQuality || '1080p',
      JSON.stringify(transcriptData)
    );

    if (inferredMediaId) {
      db.prepare('UPDATE media_assets SET project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .run(projectId, inferredMediaId, req.user.id);
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    return res.status(201).json({
      project: formatProject(project),
      message: 'Project created successfully!',
    });
  } catch (err) {
    console.error('Error creating project:', err);
    return res.status(500).json({ error: 'Failed to create project.' });
  }
});

// 3. UPDATE PROJECT METADATA
projectsRouter.put('/:id', (req, res) => {
  try {
    const validation = validateProjectPayload(req.body);
    if (!validation.valid) {
      return sendProjectValidationError(res, validation.errors);
    }

    const { id } = req.params;
    const {
      title, description, status, duration, voiceId, speakerVoices,
      originalLanguage, targetLanguage, transcript, segments, mediaId, videoUrl, sourceUrl,
    } = req.body;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedDuration = duration !== undefined ? duration : existing.duration;
    const updatedVoiceId = voiceId !== undefined ? voiceId : existing.voice_id;
    const updatedOriginalLanguage = originalLanguage !== undefined ? originalLanguage : existing.original_language;
    const updatedTargetLanguage = targetLanguage !== undefined ? targetLanguage : existing.target_language;
    const updatedSpeakerVoices = speakerVoices !== undefined ? JSON.stringify(speakerVoices) : existing.speaker_voices_json;
    const transcriptToSave = transcript !== undefined ? transcript : (segments !== undefined ? segments : null);
    const updatedSegments = transcriptToSave !== null ? JSON.stringify(transcriptToSave) : existing.segments_json;
    const requestedMediaUrl = videoUrl || sourceUrl;
    const inferredMediaId = mediaId !== undefined
      ? mediaId
      : (typeof requestedMediaUrl === 'string' ? (/^\/api\/media\/([a-zA-Z0-9_-]+)$/.exec(requestedMediaUrl)?.[1] || undefined) : undefined);
    const updatedMediaId = inferredMediaId !== undefined ? inferredMediaId : existing.source_media_id;
    const updatedSourceUrl = requestedMediaUrl !== undefined ? requestedMediaUrl : existing.source_url;

    if (updatedMediaId) {
      const ownedMedia = db.prepare('SELECT id FROM media_assets WHERE id = ? AND user_id = ?').get(updatedMediaId, req.user.id);
      if (!ownedMedia) return res.status(404).json({ error: 'Source media not found or unauthorized.' });
    }

    db.prepare(`
      UPDATE projects 
      SET title = ?, description = ?, status = ?, duration = ?, voice_id = ?,
          original_language = ?, target_language = ?, speaker_voices_json = ?, segments_json = ?,
          source_url = ?, source_media_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(updatedTitle, updatedDesc, updatedStatus, updatedDuration, updatedVoiceId,
      updatedOriginalLanguage, updatedTargetLanguage, updatedSpeakerVoices, updatedSegments,
      updatedSourceUrl, updatedMediaId || null, id, req.user.id);

    if (updatedMediaId) {
      db.prepare('UPDATE media_assets SET project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .run(id, updatedMediaId, req.user.id);
    }

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    return res.json({ 
      project: formatProject(updated),
      message: 'Project updated successfully.' 
    });
  } catch (err) {
    console.error('Error updating project:', err);
    return res.status(500).json({ error: 'Failed to update project.' });
  }
});

// 4. UPDATE LIVE TRANSCRIPT SEGMENTS
projectsRouter.put('/:id/transcript', (req, res) => {
  try {
    const { id } = req.params;
    const { transcript } = req.body;

    const validation = validateTranscript(transcript);
    if (!validation.valid) {
      return sendProjectValidationError(res, validation.errors);
    }

    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    db.prepare(`
      UPDATE projects 
      SET segments_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(JSON.stringify(transcript), id, req.user.id);

    return res.json({ message: 'Transcript synchronized successfully.' });
  } catch (err) {
    console.error('Error updating transcript:', err);
    return res.status(500).json({ error: 'Failed to update transcript.' });
  }
});

// 5. DUPLICATE PROJECT
projectsRouter.post('/:id/duplicate', (req, res) => {
  try {
    const { id } = req.params;
    const original = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user.id);

    if (!original) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const newId = `proj-${randomUUID().slice(0, 8)}`;
    const newTitle = `${original.title} (Copy)`;

    db.prepare(`
      INSERT INTO projects (
        id, user_id, title, description, source_url, thumbnail_url, 
        original_language, target_language, voice_id, source_media_id, status, duration,
        file_size, video_quality, segments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      req.user.id,
      newTitle,
      original.description,
      original.source_url,
      original.thumbnail_url,
      original.original_language,
      original.target_language,
      original.voice_id,
      original.source_media_id,
      original.status,
      original.duration,
      original.file_size,
      original.video_quality,
      original.segments_json
    );

    const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId);

    return res.status(201).json({
      project: formatProject(created),
      message: 'Project duplicated successfully!',
    });
  } catch (err) {
    console.error('Error duplicating project:', err);
    return res.status(500).json({ error: 'Failed to duplicate project.' });
  }
});

// 6. DELETE PROJECT
projectsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const activeJob = db.prepare(`
      SELECT id FROM dubbing_jobs
      WHERE project_id = ? AND user_id = ? AND status NOT IN ('completed', 'failed')
      LIMIT 1
    `).get(id, req.user.id);
    if (activeJob) return res.status(409).json({ error: 'Wait for the active dubbing job to finish before deleting this project.' });
    const cloneJobs = db.prepare('SELECT DISTINCT job_id FROM job_voice_clones WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL')
      .all(id, req.user.id);
    for (const cloneJob of cloneJobs) {
      const failures = await cleanupJobVoiceClones(cloneJob.job_id);
      if (failures.length) return res.status(503).json({ error: 'Could not remove cloned voices yet. Try deleting the project again.' });
    }
    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, req.user.id);
    return res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Error deleting project:', err);
    return res.status(500).json({ error: 'Failed to delete project.' });
  }
});
