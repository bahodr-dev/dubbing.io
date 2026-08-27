import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const projectsRouter = Router();

// Apply auth middleware to all project routes
projectsRouter.use(authenticateToken);

function formatProject(p) {
  return {
    id: p.id,
    title: p.title,
    description: p.description || '',
    sourceUrl: p.source_url || '',
    videoUrl: p.source_url || '',
    thumbnailUrl: p.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    originalLanguage: p.original_language || 'en',
    targetLanguage: p.target_language || 'uz',
    voiceId: p.voice_id || 'voice-farrux',
    status: p.status || 'ready',
    duration: p.duration || 0,
    fileSize: p.file_size || '12.4 MB',
    videoQuality: p.video_quality || '1080p',
    transcript: p.segments_json ? JSON.parse(p.segments_json) : [],
    updatedAt: p.updated_at,
    createdAt: p.created_at,
  };
}

// 1. GET ALL PROJECTS FOR LOGGED-IN USER
projectsRouter.get('/', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT * FROM projects 
      WHERE user_id = ? 
      ORDER BY updated_at DESC
    `).all(req.user.id);

    return res.json({ projects: projects.map(formatProject) });
  } catch (err) {
    console.error('Error fetching projects:', err);
    return res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// 2. CREATE PROJECT
projectsRouter.post('/', (req, res) => {
  try {
    const { 
      id, title, description, sourceUrl, videoUrl, thumbnailUrl, 
      originalLanguage, targetLanguage, voiceId, status, duration, 
      fileSize, videoQuality, transcript, segments 
    } = req.body;

    const projectId = id || `proj-${randomUUID().slice(0, 8)}`;
    const projectTitle = title || 'Untitled Studio Dub';
    const mediaUrl = videoUrl || sourceUrl || '';
    const transcriptData = transcript || segments || [];

    db.prepare(`
      INSERT INTO projects (
        id, user_id, title, description, source_url, thumbnail_url, 
        original_language, target_language, voice_id, status, duration, 
        file_size, video_quality, segments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      status || 'ready',
      duration || 30,
      fileSize || '12.4 MB',
      videoQuality || '1080p',
      JSON.stringify(transcriptData)
    );

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
    const { id } = req.params;
    const { title, description, status, duration, voiceId, transcript, segments } = req.body;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedDuration = duration !== undefined ? duration : existing.duration;
    const updatedVoiceId = voiceId !== undefined ? voiceId : existing.voice_id;
    const transcriptToSave = transcript !== undefined ? transcript : (segments !== undefined ? segments : null);
    const updatedSegments = transcriptToSave !== null ? JSON.stringify(transcriptToSave) : existing.segments_json;

    db.prepare(`
      UPDATE projects 
      SET title = ?, description = ?, status = ?, duration = ?, voice_id = ?, segments_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(updatedTitle, updatedDesc, updatedStatus, updatedDuration, updatedVoiceId, updatedSegments, id, req.user.id);

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

    if (!Array.isArray(transcript)) {
      return res.status(400).json({ error: 'Transcript must be an array of segments.' });
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
        original_language, target_language, voice_id, status, duration, 
        file_size, video_quality, segments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
projectsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, req.user.id);
    return res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Error deleting project:', err);
    return res.status(500).json({ error: 'Failed to delete project.' });
  }
});
