import { Router } from 'express';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const projectsRouter = Router();

// Apply auth middleware to all project routes
projectsRouter.use(authenticateToken);

// 1. GET ALL PROJECTS FOR LOGGED-IN USER
projectsRouter.get('/', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT * FROM projects 
      WHERE user_id = ? 
      ORDER BY updated_at DESC
    `).all(req.user.id);

    const formatted = projects.map(p => ({
      id: p.id,
      title: p.title,
      sourceUrl: p.source_url,
      thumbnailUrl: p.thumbnail_url,
      originalLanguage: p.original_language,
      targetLanguage: p.target_language,
      status: p.status,
      duration: p.duration,
      segments: p.segments_json ? JSON.parse(p.segments_json) : [],
      updatedAt: p.updated_at,
      createdAt: p.created_at,
    }));

    return res.json({ projects: formatted });
  } catch (err) {
    console.error('Error fetching projects:', err);
    return res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// 2. CREATE PROJECT
projectsRouter.post('/', (req, res) => {
  try {
    const { id, title, sourceUrl, thumbnailUrl, originalLanguage, targetLanguage, status, duration, segments } = req.body;

    if (!id || !title) {
      return res.status(400).json({ error: 'Project ID and title are required.' });
    }

    db.prepare(`
      INSERT INTO projects (
        id, user_id, title, source_url, thumbnail_url, 
        original_language, target_language, status, duration, segments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      title,
      sourceUrl || '',
      thumbnailUrl || '',
      originalLanguage || 'en',
      targetLanguage || 'uz',
      status || 'ready',
      duration || 0,
      segments ? JSON.stringify(segments) : '[]'
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    return res.status(201).json({
      project: {
        id: project.id,
        title: project.title,
        sourceUrl: project.source_url,
        thumbnailUrl: project.thumbnail_url,
        originalLanguage: project.original_language,
        targetLanguage: project.target_language,
        status: project.status,
        duration: project.duration,
        segments: project.segments_json ? JSON.parse(project.segments_json) : [],
        updatedAt: project.updated_at,
        createdAt: project.created_at,
      },
    });
  } catch (err) {
    console.error('Error creating project:', err);
    return res.status(500).json({ error: 'Failed to create project.' });
  }
});

// 3. UPDATE PROJECT
projectsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, status, duration, segments } = req.body;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedDuration = duration !== undefined ? duration : existing.duration;
    const updatedSegments = segments !== undefined ? JSON.stringify(segments) : existing.segments_json;

    db.prepare(`
      UPDATE projects 
      SET title = ?, status = ?, duration = ?, segments_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(updatedTitle, updatedStatus, updatedDuration, updatedSegments, id, req.user.id);

    return res.json({ message: 'Project updated successfully.' });
  } catch (err) {
    console.error('Error updating project:', err);
    return res.status(500).json({ error: 'Failed to update project.' });
  }
});

// 4. DELETE PROJECT
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
