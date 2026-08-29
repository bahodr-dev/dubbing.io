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

export async function synthesizeSpeech({
  text,
  voiceId = 'voice-farrux',
  speed = 1.0,
  userId = null,
} = {}) {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const mapping = VOICE_PROVIDER_MAP[voiceId] || VOICE_PROVIDER_MAP['voice-farrux'];

  const outFileName = `tts-${Date.now()}-${randomUUID().slice(0, 8)}.mp3`;
  const outFilePath = path.join(uploadsDir, outFileName);

  const registerMediaUrl = (bufferLength) => {
    if (userId) {
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
          durationEstimate: Math.max(2, text.split(' ').length * 0.4),
          provider: 'ElevenLabs Neural Multilingual v2',
        };
      }
    } catch (err) {
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
    durationEstimate: Math.max(2, (text || '').split(' ').length * 0.4),
    provider: 'Client-Side Neural Web Speech Synthesizer',
  };
}
