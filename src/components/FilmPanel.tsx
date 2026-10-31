import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, TranscriptSegment } from '../types';
import { api } from '../services/api';

interface FilmState {
  episode?: { series_id: string; episode: string; glossary_json: string };
  characters: { id: string; name: string; clone_state: string }[];
  speakers: { chunk_index: number; speaker: string; character_id: string; confirmed: number }[];
  chunks: { chunk_index: number; start_time: number; end_time: number; stage: string; state: string }[];
  unresolved: (TranscriptSegment & { unresolvedReason: string })[];
  budget?: { job_id: string; limit_micros: number; reserved_micros: number };
}
async function call<T>(endpoint: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/films${endpoint}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Film request failed.');
  return data;
}
const usd = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;
export function FilmPanel({ project, onRefresh }: { project: Project; onRefresh: () => void }) {
  const [experiment, setExperiment] = useState(false);
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleFormat, setSubtitleFormat] = useState('srt');
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<FilmState | null>(null);
  const [series, setSeries] = useState<{ id: string; title: string }[]>([]);
  const [seriesId, setSeriesId] = useState('');
  const [episode, setEpisode] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState(project.originalLanguage === 'ru' ? 'ru' : 'en');
  const [glossary, setGlossary] = useState('{}');
  const [budget, setBudget] = useState('');
  const [estimate, setEstimate] = useState<{ duration: number; estimatedMicros: number; configured: boolean } | null>(null);
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [canConfigure, setCanConfigure] = useState(false);
  const [settings, setSettings] = useState('');
  const root = `/projects/${project.id}`;
  const loadedProject = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const next = await call<FilmState>(root); setState(next);
    if (loadedProject.current !== project.id) {
      loadedProject.current = project.id;
      setSeriesId(next.episode?.series_id || ''); setEpisode(next.episode?.episode || ''); setGlossary(next.episode?.glossary_json || '{}');
    }
    try {
      const { job } = await api.dubbing.getLatestProjectJob(project.id);
      if (job.filmMode) { setStatus(job.status); setMessage(job.currentStage || ''); if (job.result) setResult(job.result); }
    } catch { /* An unprocessed project has no job yet. */ }
  }, [root, project.id]);
  useEffect(() => {
    let cancelled = false;
    if (typeof api.dubbing.getCapabilities !== 'function') return;
    api.dubbing.getCapabilities().then(c => { if (!cancelled) { setVisible(c.cinema?.ready === true); setExperiment(c.cinema?.separationProvider === 'none'); } }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (cancelled) return;
      try { await refresh(); } catch (error) { if (!cancelled) setMessage((error as Error).message); }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    void poll();
    call<{ series: { id: string; title: string }[] }>('/series').then(r => { if (!cancelled) setSeries(r.series); }).catch(() => {});
    call<{ config: unknown; canConfigure: boolean }>('/settings').then(r => {
      if (!cancelled) { setCanConfigure(r.canConfigure); setSettings(JSON.stringify(r.config || { defaultLimitMicros: 100000000, requestCeilingsMicros: { separation: 0, transcription: 0, translation: 0, clone: 0, speech: 0, identity: 0 } }, null, 2)); }
    }).catch(() => {});
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, project.id, refresh]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await refresh(); } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  if (!visible) return null;
  const active = ['queued', 'transcribing', 'translating', 'synthesizing', 'rendering', 'paused'].includes(status);
  const micros = Math.round(Number(budget) * 1_000_000);
  return <section className="film-panel" aria-label="Film dubbing">
    <h2>Film va serial → o‘zbekcha dublyaj</h2>
    <p>{experiment ? 'Tajriba: DeepSeek tarjimasi va ElevenLabs ovozi. FAL o‘chiq: musiqa va effektlar natijaga kiritilmaydi. Audio avtomatik transkripsiya qilinmaydi; tayyor SRT/JSON kerak.' : 'Ichki beta · qahramon ovozlari · musiqa va effektlar saqlanadi · lab harakati o‘zgartirilmaydi.'}</p>
    {experiment && <details open><summary>Manba subtitrini yuklash</summary>
      <p>SRT matnida qahramonni [Ali] kabi belgilang. Belgisiz replikalar ovoz yaratishdan oldin tekshiruv talab qiladi. JSON: originalText, startTime, endTime, speaker.</p>
      <input type="file" aria-label="Source subtitles file" accept=".srt,.json" disabled={busy || active} onChange={e => { const f = e.target.files?.[0]; if (f) { setSubtitleFormat(f.name.endsWith('.json') ? 'json' : 'srt'); void f.text().then(setSubtitleText).catch(() => setMessage('Subtitr faylini o‘qib bo‘lmadi.')); } }} />
      <textarea className="input" rows={6} aria-label="Source subtitles" value={subtitleText} disabled={active} onChange={e => setSubtitleText(e.target.value)} />
      <button className="btn btn-secondary" disabled={busy || active || !subtitleText.trim()} onClick={() => void act(async () => {
        const imported = await call<{ segmentCount: number }>(`${root}/source-transcript`, 'PUT', { text: subtitleText, format: subtitleFormat });
        setEstimate(null); setMessage(`${imported.segmentCount} ta manba replika saqlandi.`); onRefresh();
      })}>Subtitrni saqlash</button>
    </details>}
    <div className="film-fields">
      <label>Manba tili<select className="input" value={sourceLanguage} disabled={active} onChange={e => { setSourceLanguage(e.target.value); setEstimate(null); }}><option value="en">English</option><option value="ru">Русский</option></select></label>
      <label>Serial<select className="input" value={seriesId} disabled={active} onChange={e => { setSeriesId(e.target.value); setEstimate(null); }}><option value="">Alohida film</option>{series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <label>Epizod<input className="input" value={episode} disabled={active} onChange={e => { setEpisode(e.target.value); setEstimate(null); }} /></label>
      <label>Sarf chegarasi (USD)<input className="input" type="number" min="0.01" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} /></label>
    </div>
    <details><summary>Ismlar, atamalar va murojaatlar lug‘ati</summary><textarea className="input" aria-label="Film glossary" value={glossary} disabled={active} onChange={e => { setGlossary(e.target.value); setEstimate(null); }} /></details>
    <div className="film-actions">
      <button className="btn btn-secondary" disabled={busy || active} onClick={() => void act(async () => {
        const title = window.prompt('Yangi serial nomi'); if (!title) return;
        const created = await call<{ id: string }>('/series', 'POST', { title });
        setSeries(s => [...s, { id: created.id, title }]); setSeriesId(created.id);
      })}>Yangi serial</button>
      <button className="btn btn-secondary" disabled={busy || active} onClick={() => void act(async () => {
        await call(`${root}/episode`, 'PUT', { seriesId: seriesId || null, episode, glossary: JSON.parse(glossary) });
        const e = await call<{ duration: number; estimatedMicros: number; configured: boolean; defaultLimitMicros: number }>(`${root}/estimate`, 'POST');
        setEstimate(e); if (!budget && e.configured) setBudget(String(e.defaultLimitMicros / 1_000_000));
        if (!e.configured) setMessage('Administrator provayder xarajatlarini sozlashi kerak.');
      })}>Davomiylik va xarajatni hisoblash</button>
      <button className="btn btn-primary" disabled={busy || active || !estimate?.configured || micros <= 0 || !Number.isSafeInteger(micros)} onClick={() => void act(async () => {
        await call(`${root}/start`, 'POST', { sourceLanguage, budgetMicros: micros }); setStatus('queued'); setResult(null);
      })}>Filmni boshlash</button>
      {status === 'paused' && <button className="btn btn-primary" disabled={busy || micros <= 0} onClick={() => void act(async () => {
        await call(`/jobs/${state?.budget?.job_id}/resume`, 'POST', { budgetMicros: micros }); setStatus('queued');
      })}>Chegarani oshirish va davom ettirish</button>}
    </div>
    {estimate?.configured && <p>{(estimate.duration / 60).toFixed(1)} daqiqa · konservativ taxmin {usd(estimate.estimatedMicros)}. Xarajat har bir so‘rov uchun sozlangan yuqori chegara bo‘yicha zaxiralanadi.</p>}
    {state?.budget && <p>Sarf zaxirasi: {usd(state.budget.reserved_micros)} / {usd(state.budget.limit_micros)}</p>}
    <p role="status">{status && `${status}: `}{message}</p>
    {!!state?.chunks.length && <details open><summary>Sahnalar ({state.chunks.length})</summary><div className="film-scenes">{state.chunks.map(c => <span key={c.chunk_index}>{c.chunk_index + 1}: {c.start_time.toFixed(0)}–{c.end_time.toFixed(0)}s · {c.state} · {c.stage}</span>)}</div></details>}
    {!!state?.speakers.length && <details><summary>Qahramonlar va ovoz xotirasi</summary><p>Bir qahramonning turli sahnalardagi belgilarini bir profilga bog‘lang. Noaniq mosliklar tekshiruv uchun belgilangan.</p>{state.speakers.map(s => <label className="film-mapping" key={`${s.chunk_index}-${s.speaker}`}>
      Sahna {s.chunk_index + 1} · {s.speaker} {s.confirmed ? '✓' : '· tekshirish kerak'}
      <select className="input" value={s.character_id} disabled={busy || active} onChange={e => void act(async () => {
        await call(`${root}/speakers`, 'PUT', { chunkIndex: s.chunk_index, speaker: s.speaker, characterId: e.target.value });
      })}>{state.characters.map(c => <option key={c.id} value={c.id}>{c.name} · {c.clone_state}</option>)}</select>
      {!s.confirmed && <button className="btn btn-secondary" disabled={busy || active} onClick={() => void act(async () => { await call(`${root}/speakers`, 'PUT', { chunkIndex: s.chunk_index, speaker: s.speaker, characterId: s.character_id }); })}>Tasdiqlash</button>}
    </label>)}</details>}
    {!!state?.unresolved.length && <div><h3>Hal qilinmagan replikalar ({state.unresolved.length})</h3><p>Ko‘rish nusxasida bu dialog oraliqlari jim. Matn yoki qahramonni tuzatib, qayta boshlang; tayyor ovoz qayta ishlatiladi.</p>{state.unresolved.map(s => <p key={s.id}>{s.startTime.toFixed(1)}–{s.endTime.toFixed(1)}s · {s.translatedText} · {s.unresolvedReason}</p>)}</div>}
    {result && <div className="film-actions">
      {result.videoUrl && <a className="btn btn-primary" href={`${result.videoUrl}/download`}>MP4 ko‘rish nusxasi</a>}
      {result.dialogueUrl && <a href={`${result.dialogueUrl}/download`}>O‘zbekcha dialog WAV</a>}
      {result.backgroundUrl && <a href={`${result.backgroundUrl}/download`}>{experiment ? 'Jim fon WAV (FAL o‘chiq)' : 'Fon WAV'}</a>}
      <a href={`/api/films${root}/export/srt`}>SRT</a><a href={`/api/films${root}/export/vtt`}>VTT</a><a href={`/api/films${root}/export/report`}>Tekshiruv hisoboti</a>
      <button className="btn btn-secondary" onClick={onRefresh}>Matn muharririni yangilash</button>
    </div>}
    {canConfigure && <details><summary>Administrator: provayder xarajat chegaralari</summary><p>Har bir turdagi cheklangan so‘rov uchun USD micro-dollar yuqori xarajat chegarasini kiriting (1 USD = 1 000 000). Amaldagi provayder tariflariga qarab sozlang.</p><textarea className="input" aria-label="Provider pricing" rows={10} value={settings} onChange={e => setSettings(e.target.value)} /><button className="btn btn-secondary" disabled={busy} onClick={() => void act(async () => { await call('/settings', 'PUT', JSON.parse(settings)); setMessage('Xarajat chegaralari saqlandi.'); })}>Sozlamalarni saqlash</button></details>}
  </section>;
}
