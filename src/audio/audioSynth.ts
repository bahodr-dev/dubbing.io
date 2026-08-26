// Web Audio API & Speech Synthesis engine for realistic voice previews & dubbing

let audioCtx: AudioContext | null = null;
let currentOscillators: OscillatorNode[] = [];
let gainNode: GainNode | null = null;
let previewTimeout: number | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export interface VoicePlaybackOptions {
  gender: 'female' | 'male' | 'neutral';
  pitch?: number;
  speed?: number;
  sampleText?: string;
  languageCode?: string;
  onEnd?: () => void;
}

/**
 * Plays a realistic voice preview using Web Speech Synthesis if available,
 * with synchronized Web Audio harmonic resonance and envelope shaping.
 */
export function playVoiceSample(
  voiceName: string,
  options: VoicePlaybackOptions
): { stop: () => void } {
  stopVoiceSample();

  const textToSpeak = options.sampleText || (
    options.languageCode === 'uz' 
      ? `Assalomu alaykum, men ${voiceName}. dubbing.io orqali videolaringiz mukammal jaranglaydi.`
      : `Hello, I'm ${voiceName}. dubbing.io makes your content speak to the world with natural cadence.`
  );

  let hasSpokenWithWebSpeech = false;

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = options.speed || 1.0;
      utterance.pitch = options.pitch || (options.gender === 'female' ? 1.15 : 0.9);
      
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Try to match language code or gender
        const matched = voices.find(v => 
          v.lang.toLowerCase().startsWith(options.languageCode || 'en') ||
          (options.gender === 'female' ? v.name.toLowerCase().includes('female') : v.name.toLowerCase().includes('male'))
        );
        if (matched) {
          utterance.voice = matched;
        }
      }

      utterance.onend = () => {
        if (options.onEnd) options.onEnd();
      };
      utterance.onerror = () => {
        if (options.onEnd) options.onEnd();
      };

      window.speechSynthesis.speak(utterance);
      hasSpokenWithWebSpeech = true;
    } catch {
      hasSpokenWithWebSpeech = false;
    }
  }

  // Also synthesize harmonic resonance via Web Audio for visual and acoustic richness
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const duration = 3.5;

    gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.01, now);
    // If WebSpeech is playing, keep synthesizer subtle as acoustic backing, otherwise louder
    const targetGain = hasSpokenWithWebSpeech ? 0.03 : 0.12;
    gainNode.gain.exponentialRampToValueAtTime(targetGain, now + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Formant frequencies based on gender
    const baseFreq = options.gender === 'female' ? 220 : 130;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, now);
    // Subtle natural speech intonation curve
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, now + 0.8);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 2.0);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + duration);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 2, now);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, now + 1.2);

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(baseFreq * 3, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(options.gender === 'female' ? 1800 : 1200, now);
    filter.Q.setValueAtTime(2.5, now);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);

    currentOscillators = [osc1, osc2, osc3];

    previewTimeout = window.setTimeout(() => {
      stopVoiceSample();
      if (options.onEnd) options.onEnd();
    }, duration * 1000);
  } catch {
    // AudioContext fallback handled silently
  }

  return {
    stop: stopVoiceSample,
  };
}

export function stopVoiceSample(): void {
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  if (previewTimeout) {
    clearTimeout(previewTimeout);
    previewTimeout = null;
  }

  currentOscillators.forEach(osc => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      // ignore
    }
  });
  currentOscillators = [];

  if (gainNode) {
    try {
      gainNode.disconnect();
    } catch {
      // ignore
    }
    gainNode = null;
  }
}
