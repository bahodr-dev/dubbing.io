/**
 * Formats duration in seconds consistently.
 * Returns `${Math.floor(seconds)}s` for < 60s to preserve established metadata pattern,
 * and `m:ss` (e.g., "1:15") for values of 60 seconds or greater.
 */
export function formatDuration(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '0s';
  }

  const rounded = Math.floor(seconds);
  if (rounded < 60) {
    return `${rounded}s`;
  }

  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Gracefully formats an ISO date string to a locale date string.
 * Handles invalid or missing dates without throwing.
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
}

/**
 * Keeps project names compact and prevents long titles from disrupting layouts.
 * Unicode-aware so multi-byte characters are never split in half.
 */
export function truncateProjectTitle(title: string, maxLength = 12): string {
  const characters = Array.from(title);
  return characters.length > maxLength ? `${characters.slice(0, maxLength).join('')}...` : title;
}

/**
 * Clamps processing progress to 0 - 100.
 * Returns undefined if progress is not a valid number (indeterminate).
 */
export function clampProgress(progress?: number): number | undefined {
  if (typeof progress !== 'number' || isNaN(progress)) {
    return undefined;
  }
  return Math.min(100, Math.max(0, Math.round(progress)));
}
