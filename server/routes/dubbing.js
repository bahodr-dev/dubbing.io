import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';

export const dubbingRouter = Router();

// Multi-language translation dictionaries
const TRANSLATION_MAP = {
  uz: [
    { orig: "Welcome everyone to our next generation AI studio presentation.", trans: "Barchangizni yangi avlod sun'iy intellekt studiyamiz taqdimotiga xush kelibsiz." },
    { orig: "Today we are showcasing automatic video dubbing and voice synchronization.", trans: "Bugun biz avtomatik video dublyaj va ovozni sinxronlashtirish tizimini namoyish etamiz." },
    { orig: "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.", trans: "Bizning neyron ovoz klonlash tizimimiz so'zlovchining his-tuyg'ulari va tempini to'liq saqlab qoladi." },
    { orig: "You can seamlessly translate your video into over thirty global languages in minutes.", trans: "Videolaringizni bir necha daqiqada 30 dan ortiq dunyo tillariga osonlikcha tarjima qilishingiz mumkin." },
    { orig: "Thank you for watching, and start creating your first multilingual dub today.", trans: "E'tiboringiz uchun rahmat, bugunoq o'z ko'p tilli birinchi dublyajingizni yarating." }
  ],
  es: [
    { orig: "Welcome everyone to our next generation AI studio presentation.", trans: "Bienvenidos a todos a nuestra presentación del estudio de IA de próxima generación." },
    { orig: "Today we are showcasing automatic video dubbing and voice synchronization.", trans: "Hoy estamos mostrando el doblaje automático de video y sincronización de voz." },
    { orig: "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.", trans: "Nuestra clonación de voz neural conserva la emoción y cadencia exacta del hablante." },
    { orig: "You can seamlessly translate your video into over thirty global languages in minutes.", trans: "Puedes traducir tus videos a más de treinta idiomas globales en minutos." },
    { orig: "Thank you for watching, and start creating your first multilingual dub today.", trans: "Gracias por ver el video, y comienza a crear tu primer doblaje multilingüe hoy." }
  ],
  de: [
    { orig: "Welcome everyone to our next generation AI studio presentation.", trans: "Herzlich willkommen zu unserer KI-Studio-Präsentation der nächsten Generation." },
    { orig: "Today we are showcasing automatic video dubbing and voice synchronization.", trans: "Heute präsentieren wir automatische Videosynchronisation und Stimmenabstimmung." },
    { orig: "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.", trans: "Unser neuronales Stimmenklonen bewahrt die Emotion und den Rhythmus des Sprechers." },
    { orig: "You can seamlessly translate your video into over thirty global languages in minutes.", trans: "Sie können Ihre Videos in wenigen Minuten in über dreißig Sprachen übersetzen." },
    { orig: "Thank you for watching, and start creating your first multilingual dub today.", trans: "Vielen Dank fürs Zuschauen, starten Sie noch heute Ihre erste Übersetzung." }
  ],
  fr: [
    { orig: "Welcome everyone to our next generation AI studio presentation.", trans: "Bienvenue à tous à notre présentation du studio d'IA de nouvelle génération." },
    { orig: "Today we are showcasing automatic video dubbing and voice synchronization.", trans: "Aujourd'hui, nous présentons le doublage vidéo automatique et la synchronisation vocale." },
    { orig: "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.", trans: "Notre clonage vocal neuronal préserve l'émotion exacte et la cadence de l'orateur." },
    { orig: "You can seamlessly translate your video into over thirty global languages in minutes.", trans: "Vous pouvez traduire vos vidéos en plus de trente langues en quelques minutes." },
    { orig: "Thank you for watching, and start creating your first multilingual dub today.", trans: "Merci d'avoir regardé, commencez à créer votre premier doublage dès aujourd'hui." }
  ],
  ja: [
    { orig: "Welcome everyone to our next generation AI studio presentation.", trans: "次世代AIスタジオのプレゼンテーションへようこそ。" },
    { orig: "Today we are showcasing automatic video dubbing and voice synchronization.", trans: "本日は、自動動画吹き替えと音声同期機能をご紹介します。" },
    { orig: "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.", trans: "ニューラル音声クローンは、元の話者の感情とリズムを正確に保持します。" },
    { orig: "You can seamlessly translate your video into over thirty global languages in minutes.", trans: "わずか数分で30以上の世界中の言語に動画をシームレスに翻訳できます。" },
    { orig: "Thank you for watching, and start creating your first multilingual dub today.", trans: "ご視聴ありがとうございました。本日より最初の吹き替え制作を始めましょう。" }
  ],
  en: [
    { orig: "Welcome everyone to our next generation AI studio presentation.", trans: "Welcome everyone to our next generation AI studio presentation." },
    { orig: "Today we are showcasing automatic video dubbing and voice synchronization.", trans: "Today we are showcasing automatic video dubbing and voice synchronization." },
    { orig: "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.", trans: "Our neural voice cloning preserves the exact emotion and cadence of the original speaker." },
    { orig: "You can seamlessly translate your video into over thirty global languages in minutes.", trans: "You can seamlessly translate your video into over thirty global languages in minutes." },
    { orig: "Thank you for watching, and start creating your first multilingual dub today.", trans: "Thank you for watching, and start creating your first multilingual dub today." }
  ]
};

// 1. GENERATE DUBBING TRANSCRIPT TIMELINE
dubbingRouter.post('/generate', (req, res) => {
  try {
    const { targetLanguage = 'uz', duration = 30 } = req.body;
    const langCode = targetLanguage.toLowerCase();
    const pairs = TRANSLATION_MAP[langCode] || TRANSLATION_MAP['uz'];

    const stepDuration = Math.max(3, duration / pairs.length);
    const transcript = pairs.map((pair, index) => {
      const startTime = parseFloat((index * stepDuration).toFixed(2));
      const endTime = parseFloat(((index + 1) * stepDuration).toFixed(2));

      return {
        id: `seg-${randomUUID().slice(0, 8)}`,
        startTime,
        endTime,
        originalText: pair.orig,
        translatedText: pair.trans,
        speaker: index % 2 === 0 ? 'Speaker 1' : 'Speaker 2',
        confidence: 0.96 + Math.random() * 0.03,
      };
    });

    return res.json({
      transcript,
      targetLanguage,
      segmentCount: transcript.length,
      message: 'AI Dubbing transcript generated successfully!',
    });
  } catch (err) {
    console.error('Error generating dubbing:', err);
    return res.status(500).json({ error: 'Failed to generate dubbing transcript.' });
  }
});

// Helper to format seconds to SRT timestamp: 00:00:00,000
function formatSrtTime(seconds) {
  const pad = (num, size) => ('000' + num).slice(-size);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
}

// 2. EXPORT SUBTITLES (SRT, VTT, JSON)
dubbingRouter.get('/export/:id/:format', (req, res) => {
  try {
    const { id, format } = req.params;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const segments = project.segments_json ? JSON.parse(project.segments_json) : [];
    const cleanTitle = (project.title || 'dubbing-export').replace(/[^a-zA-Z0-9-_]/g, '_');

    if (format === 'srt') {
      let srtContent = '';
      segments.forEach((seg, index) => {
        srtContent += `${index + 1}\n`;
        srtContent += `${formatSrtTime(seg.startTime)} --> ${formatSrtTime(seg.endTime)}\n`;
        srtContent += `${seg.translatedText || seg.originalText}\n\n`;
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.srt"`);
      return res.send(srtContent);
    }

    if (format === 'vtt') {
      let vttContent = 'WEBVTT\n\n';
      segments.forEach((seg, index) => {
        const start = formatSrtTime(seg.startTime).replace(',', '.');
        const end = formatSrtTime(seg.endTime).replace(',', '.');
        vttContent += `${index + 1}\n${start} --> ${end}\n${seg.translatedText || seg.originalText}\n\n`;
      });

      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.vtt"`);
      return res.send(vttContent);
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.json"`);
      return res.json({ project, segments });
    }

    return res.status(400).json({ error: 'Unsupported format. Use srt, vtt, or json.' });
  } catch (err) {
    console.error('Error exporting subtitles:', err);
    return res.status(500).json({ error: 'Failed to export subtitles.' });
  }
});
