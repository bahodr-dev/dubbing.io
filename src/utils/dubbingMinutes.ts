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
export async function checkMinutesBeforeUpload(file?: File | null): Promise<void> {
  const { minutesBalance } = await api.dubbing.getUsage();
  if (!Number.isFinite(minutesBalance) || minutesBalance <= 0) {
    throw new Error('No dubbing minutes remain on your plan. Add minutes before starting.');
  }
  if (!file) return;
  const localDuration = await readLocalDuration(file);
  if (localDuration && requiredMinutesForDuration(localDuration) > minutesBalance + 0.000001) {
    throw new Error(insufficientMinutesMessage(requiredMinutesForDuration(localDuration), minutesBalance));
  }
}

/** The server probes the uploaded file and makes the authoritative comparison. */
export async function checkUploadedMediaMinutes(mediaId: string): Promise<number> {
  const result = await api.dubbing.checkMinutes(mediaId);
  if (!result.canStart) {
    throw new Error(insufficientMinutesMessage(result.requiredMinutes, result.minutesBalance));
  }
  return result.duration;
}
