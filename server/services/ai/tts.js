import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { uploadsDir } from '../../db.js';

export const VOICE_PROVIDER_MAP = {
  'voice-farrux': { elevenLabsId: 'nPczCjzI2devNBz1zQrb', openaiVoice: 'onyx' },
  'voice-dilnoza': { elevenLabsId: 'EXAVITQu4vr4xnSDxMaL', openaiVoice: 'nova' },
  'voice-jasur': { elevenLabsId: 'VR6AewLTigWG4xSOukaG', openaiVoice: 'echo' },
  'voice-madina': { elevenLabsId: 'LcfcDJNUP1GQjkzn1xUU', openaiVoice: 'shimmer' },
  'voice-sophia': { elevenLabsId: '21m00Tcm4TlvDq8ikWAM', openaiVoice: 'alloy' },
  'voice-david': { elevenLabsId: 'TX3LPaxmHKxFdv7VOQHJ', openaiVoice: 'fable' },
  'voice-elena': { elevenLabsId: 'AZnzlk1XvdvUeBnXmlld', openaiVoice: 'nova' },
  'voice-marcus': { elevenLabsId: 'ErXwobaYiN019PkySvjV', openaiVoice: 'onyx' },
  'voice-kenji': { elevenLabsId: 'g5CIjZEefAph4nJUwfWv', openaiVoice: 'echo' },
  'voice-amina': { elevenLabsId: 'ThT5KcBeYPX3keUQqHPh', openaiVoice: 'shimmer' },
};

import { createMediaAsset } from '../../repositories/mediaRepository.js';

export function hasConfiguredTtsProvider() {
  return Boolean(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY);
}

export function getRenderableVoiceIds() {
  return Object.keys(VOICE_PROVIDER_MAP);
}

export function isRenderableVoiceId(voiceId) {
  return typeof voiceId === 'string' && Object.hasOwn(VOICE_PROVIDER_MAP, voiceId);
}

export async function synthesizeSpeech({
  text,
  voiceId = 'voice-farrux',
  elevenLabsVoiceId = null,
  speed = 1.0,
  userId = null,
  registerAsset = true,
} = {}) {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (elevenLabsVoiceId && (!elevenLabsKey || !/^[a-zA-Z0-9_-]+$/.test(elevenLabsVoiceId))) {
    throw new Error('A valid ElevenLabs voice and API key are required for cloned speech.');
  }
  if (!elevenLabsVoiceId && typeof voiceId === 'string' && voiceId.startsWith('voice-custom-')) {
    throw new Error('Custom voice profiles cannot synthesize audio until a trained provider voice is connected.');
  }
  if (!elevenLabsVoiceId && !isRenderableVoiceId(voiceId)) {
    throw new Error('The selected voice is not connected to a speech provider. Choose an available voice.');
  }
  const mapping = elevenLabsVoiceId ? { elevenLabsId: elevenLabsVoiceId } : VOICE_PROVIDER_MAP[voiceId];

  const outFileName = `tts-${Date.now()}-${randomUUID().slice(0, 8)}.mp3`;
  const outFilePath = path.join(uploadsDir, outFileName);

  const registerMediaUrl = (bufferLength) => {
    if (userId && registerAsset) {
      const asset = createMediaAsset({
        userId,
        originalFilename: `tts-${Date.now()}.mp3`,
        storedFilename: outFileName,
        storagePath: outFilePath,
        mimeType: 'audio/mpeg',
        sizeBytes: bufferLength,
        mediaType: 'audio',
        status: 'ready',
      });
      return `/api/media/${asset.id}`;
    }
    return '';
  };

  // 1. ElevenLabs TTS API
  if (elevenLabsKey && mapping.elevenLabsId && text) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${mapping.elevenLabsId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const buf = Buffer.from(buffer);
        fs.writeFileSync(outFilePath, buf);
        const audioUrl = registerMediaUrl(buf.length);
        return {
          audioUrl,
          filePath: outFilePath,
          storedFilename: outFileName,
          durationEstimate: Math.max(2, text.split(' ').length * 0.4),
          provider: 'ElevenLabs Neural Multilingual v2',
        };
      }
      if (elevenLabsVoiceId) throw new Error(`Cloned voice synthesis failed (${response.status}).`);
    } catch (err) {
      if (elevenLabsVoiceId) throw err;
      console.warn('[ElevenLabs API] Error:', err);
    }
  }

  // 2. OpenAI TTS API
  if (openaiKey && text) {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          input: text,
          voice: mapping.openaiVoice || 'alloy',
          speed: speed || 1.0,
        }),
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const buf = Buffer.from(buffer);
        fs.writeFileSync(outFilePath, buf);
        const audioUrl = registerMediaUrl(buf.length);
        return {
          audioUrl,
          filePath: outFilePath,
          storedFilename: outFileName,
          durationEstimate: Math.max(2, text.split(' ').length * 0.4),
          provider: 'OpenAI TTS HD',
        };
      }
    } catch (err) {
      console.warn('[OpenAI TTS API] Error:', err);
    }
  }

  // 3. Fallback: simulated acoustic preview with Web Speech playback reference
  return {
    audioUrl: '',
    filePath: null,
    storedFilename: null,
    durationEstimate: Math.max(2, (text || '').split(' ').length * 0.4),
    provider: 'Client-Side Neural Web Speech Synthesizer',
  };
}
