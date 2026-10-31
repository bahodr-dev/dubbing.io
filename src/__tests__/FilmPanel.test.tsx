import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FilmPanel } from '../components/FilmPanel';
import type { Project } from '../types';
vi.mock('../services/api', () => ({ api: { dubbing: { getCapabilities: vi.fn(async () => ({ cinema: { ready: true } })), getLatestProjectJob: vi.fn(async () => { throw new Error('No job'); }) } } }));
afterEach(() => vi.unstubAllGlobals());
describe('Film Studio controls', () => {
  it('requires a reviewable estimate before starting and does not request per-job consent', async () => {
    const fetch = vi.fn(async (url: string, options?: RequestInit) => {
      let data: unknown = { characters: [], speakers: [], chunks: [], unresolved: [] };
      if (url.endsWith('/settings')) data = { config: null, canConfigure: false };
      if (url.endsWith('/series')) data = { series: [] };
      if (url.endsWith('/estimate')) data = { configured: true, duration: 7200, estimatedMicros: 25000000, defaultLimitMicros: 50000000 };
      if (url.endsWith('/start')) { expect(options?.method).toBe('POST'); data = { jobId: 'film-job' }; }
      return { ok: true, json: async () => data };
    });
    vi.stubGlobal('fetch', fetch);
    const project = { id: 'p', originalLanguage: 'en', transcript: [] } as unknown as Project;
    render(<FilmPanel project={project} onRefresh={() => {}} />);
    const start = await screen.findByRole('button', { name: 'Filmni boshlash' });
    expect(start).toBeDisabled();
    expect(screen.queryByText(/I confirm I have permission/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Davomiylik va xarajatni hisoblash' }));
    await waitFor(() => expect(start).toBeEnabled());
    expect(screen.getByText(/120.0 daqiqa/)).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/start'))).toBe(false);
    fireEvent.click(start);
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith('/start'))).toBe(true));
    const startCall = fetch.mock.calls.find(([url]) => url.endsWith('/start'))!;
    expect(JSON.parse(String(startCall[1]?.body))).toEqual({ sourceLanguage: 'en', budgetMicros: 50000000 });
  });
});
