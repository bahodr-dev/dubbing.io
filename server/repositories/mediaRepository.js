import { randomUUID } from 'crypto';
import { db } from '../db.js';

/**
 * Strips internal filesystem paths and formats media object for client API responses
 */
export function formatMedia(asset) {
  if (!asset) return null;
  return {
    id: asset.id,
    mediaId: asset.id,
    userId: asset.user_id,
    projectId: asset.project_id || null,
    originalName: asset.original_filename,
    originalFilename: asset.original_filename,
    mimeType: asset.mime_type,
    sizeBytes: asset.size_bytes,
    size: (asset.size_bytes / (1024 * 1024)).toFixed(1) + ' MB',
    mediaType: asset.media_type || 'video',
    status: asset.status || 'ready',
    url: `/api/media/${asset.id}`,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
  };
}

/**
 * Creates a new media asset database record with explicit user ownership
 */
export function createMediaAsset({
  id,
  userId,
  projectId = null,
  originalFilename,
  storedFilename,
  storagePath,
  mimeType,
  sizeBytes,
  mediaType = 'video',
  status = 'ready',
}) {
  const mediaId = id || `med-${randomUUID().slice(0, 12)}`;

  db.prepare(`
    INSERT INTO media_assets (
      id, user_id, project_id, original_filename, stored_filename,
      storage_path, mime_type, size_bytes, media_type, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mediaId,
    userId,
    projectId,
    originalFilename,
    storedFilename,
    storagePath,
    mimeType,
    sizeBytes,
    mediaType,
    status
  );

  return findById(mediaId);
}

/**
 * Finds media asset by primary ID
 */
export function findById(id) {
  return db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id);
}

/**
 * Finds media asset by ID, strictly verifying user ownership
 */
export function findByIdAndUser(id, userId) {
  if (!id || !userId) return null;
  return db.prepare('SELECT * FROM media_assets WHERE id = ? AND user_id = ?').get(id, userId);
}

/**
 * Finds media asset by stored filename and user ID
 */
export function findByStoredFilenameAndUser(storedFilename, userId) {
  if (!storedFilename || !userId) return null;
  return db.prepare('SELECT * FROM media_assets WHERE stored_filename = ? AND user_id = ?').get(storedFilename, userId);
}

/**
 * Finds all media assets attached to a project for a specific user
 */
export function findByProjectAndUser(projectId, userId) {
  if (!projectId || !userId) return [];
  return db.prepare('SELECT * FROM media_assets WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC').all(projectId, userId);
}

/**
 * Deletes media asset record from database, verifying user ownership
 */
export function deleteMediaAsset(id, userId) {
  if (!id || !userId) return false;
  const result = db.prepare('DELETE FROM media_assets WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

/**
 * Attaches a media asset to a project, verifying user ownership
 */
export function attachToProject(mediaId, projectId, userId) {
  if (!mediaId || !userId) return false;
  const result = db.prepare(`
    UPDATE media_assets 
    SET project_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(projectId, mediaId, userId);
  return result.changes > 0;
}
