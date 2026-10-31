import { api } from '../services/api';

const requiredMinutesForDuration = (seconds: number) => Math.ceil(seconds) / 60;

function insufficientMinutesMessage(required: number, balance: number): string {
  return `This video needs ${required.toFixed(2)} dubbing minutes, but your balance is ${balance.toFixed(2)} minutes. Add minutes or choose a shorter video.`;
}

function readLocalDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof URL.createObjectURL !== 'function') return resolve(null);
    const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    let objectUrl: string;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      return resolve(null);
    }
    const timer = window.setTimeout(() => finish(null), 5000);
    const finish = (duration: number | null) => {
      window.clearTimeout(timer);
      media.removeAttribute('src');
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };
    media.onloadedmetadata = () => finish(Number.isFinite(media.duration) && media.duration > 0 ? media.duration : null);
    media.onerror = () => finish(null);
    media.preload = 'metadata';
    media.src = objectUrl;
  });
}

/** Check the live balance before transferring a file. Browser duration is only an early hint. */
export async function checkMinutesBeforeUpload(file?: File | null, autoCloneVoices = false, qualityMode: 'standard' | 'cinema' = 'standard'): Promise<void> {
  if (qualityMode === 'cinema') {
    const caps = await api.dubbing.getCapabilities();
    if (!caps.cinema?.ready) throw new Error('Cinema quality is not available for this account.');
  }
  const { minutesBalance } = await api.dubbing.getUsage();
  if (!Number.isFinite(minutesBalance) || minutesBalance <= 0) {
    throw new Error('No dubbing minutes remain on your plan. Add minutes before starting.');
  }
  if (!file) return;
  const localDuration = await readLocalDuration(file);
  const required = localDuration ? requiredMinutesForDuration(localDuration) * (qualityMode === 'cinema' || autoCloneVoices ? 1.5 : 1) : 0;
  if (required > minutesBalance + 0.000001) {
    throw new Error(insufficientMinutesMessage(required, minutesBalance));
  }
}

/** The server probes the uploaded file and makes the authoritative comparison. */
export async function checkUploadedMediaMinutes(mediaId: string, autoCloneVoices = false, qualityMode: 'standard' | 'cinema' = 'standard'): Promise<number> {
  const result = await (qualityMode === 'cinema' ? api.dubbing.checkMinutes(mediaId, autoCloneVoices, qualityMode) : api.dubbing.checkMinutes(mediaId, autoCloneVoices));
  if (!result.canStart) {
    throw new Error(insufficientMinutesMessage(result.requiredMinutes, result.minutesBalance));
  }
  return result.duration;
}
