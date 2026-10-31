import { textProvider } from './textProvider.js';
/**
 * Provider-Agnostic Translation Service
 * Supports OpenAI GPT & DeepL with native high-quality Uzbek translation prompt
 */

const FALLBACK_TRANSLATION_MAP = {
  uz: {
    "Welcome everyone to our next generation AI studio presentation.": "Barchangizni yangi avlod sun'iy intellekt studiyamiz taqdimotiga xush kelibsiz.",
    "Today we are showcasing automatic video dubbing and voice synchronization.": "Bugun biz avtomatik video dublyaj va ovozni sinxronlashtirish tizimini namoyish etamiz.",
    "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.": "Bizning neyron ovoz klonlash tizimimiz so'zlovchining his-tuyg'ulari va tempini to'liq saqlab qoladi.",
    "You can seamlessly translate your video into over thirty global languages in minutes.": "Videolaringizni bir necha daqiqada 30 dan ortiq dunyo tillariga osonlikcha tarjima qilishingiz mumkin.",
    "Thank you for watching, and start creating your first multilingual dub today.": "E'tiboringiz uchun rahmat, bugunoq o'z ko'p tilli birinchi dublyajingizni yarating."
  },
  es: {
    "Welcome everyone to our next generation AI studio presentation.": "Bienvenidos a todos a nuestra presentación del estudio de IA de próxima generación.",
    "Today we are showcasing automatic video dubbing and voice synchronization.": "Hoy estamos mostrando el doblaje automático de video y sincronización de voz.",
    "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.": "Nuestra clonación de voz neural conserva la emoción y cadencia exacta del hablante.",
    "You can seamlessly translate your video into over thirty global languages in minutes.": "Puedes traducir tus videos a más de treinta idiomas globales en minutos.",
    "Thank you for watching, and start creating your first multilingual dub today.": "Gracias por ver el video, y comienza a crear tu primer doblaje multilingüe hoy."
  },
  de: {
    "Welcome everyone to our next generation AI studio presentation.": "Herzlich willkommen zu unserer KI-Studio-Präsentation der nächsten Generation.",
    "Today we are showcasing automatic video dubbing and voice synchronization.": "Heute präsentieren wir automatische Videosynchronisation und Stimmenabstimmung.",
    "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.": "Unser neuronales Stimmenklonen bewahrt die Emotion und den Rhythmus des Sprechers.",
    "You can seamlessly translate your video into over thirty global languages in minutes.": "Sie können Ihre Videos in wenigen Minuten in über dreißig Sprachen übersetzen.",
    "Thank you for watching, and start creating your first multilingual dub today.": "Vielen Dank fürs Zuschauen, starten Sie noch heute Ihre erste Übersetzung."
  },
  fr: {
    "Welcome everyone to our next generation AI studio presentation.": "Bienvenue à tous à notre présentation du studio d'IA de nouvelle génération.",
    "Today we are showcasing automatic video dubbing and voice synchronization.": "Aujourd'hui, nous présentons le doublage vidéo automatique et la synchronisation vocale.",
    "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.": "Notre clonage vocal neuronal préserve l'émotion exacte et la cadence de l'orateur.",
    "You can seamlessly translate your video into over thirty global languages in minutes.": "Vous pouvez traduire vos vidéos en plus de trente langues en quelques minutes.",
    "Thank you for watching, and start creating your first multilingual dub today.": "Merci d'avoir regardé, commencez à créer votre premier doublage dès aujourd'hui."
  },
  ja: {
    "Welcome everyone to our next generation AI studio presentation.": "次世代AIスタジオのプレゼンテーションへようこそ。",
    "Today we are showcasing automatic video dubbing and voice synchronization.": "本日は、自動動画吹き替えと音声同期機能をご紹介します。",
    "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.": "ニューラル音声クローンは、元の話者の感情とリズムを正確に保持します。",
    "You can seamlessly translate your video into over thirty global languages in minutes.": "わずか数分で30以上の世界中の言語に動画をシームレスに翻訳できます。",
    "Thank you for watching, and start creating your first multilingual dub today.": "ご視聴ありがとうございました。本日より最初の吹き替え制作を始めましょう。"
  }
};

function translateWithDeepLTargetCode(languageCode) {
  const normalized = String(languageCode || '').trim().toLowerCase();
  const overrides = {
    en: 'EN-US',
    pt: 'PT-PT',
    zh: 'ZH',
  };
  return overrides[normalized] || normalized.toUpperCase();
}

async function translateWithDeepL({ text, sourceLanguage, targetLanguage, apiKey }) {
  const configuredBaseUrl = process.env.DEEPL_API_BASE_URL;
  const baseUrl = configuredBaseUrl || (apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/translate`, {
    method: 'POST',
    signal: AbortSignal.timeout(120_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body: JSON.stringify({
      text: [text],
      ...(sourceLanguage && sourceLanguage !== 'auto' ? { source_lang: translateWithDeepLTargetCode(sourceLanguage) } : {}),
      target_lang: translateWithDeepLTargetCode(targetLanguage),
      preserve_formatting: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepL translation request failed (${response.status}).`);
  }
  const data = await response.json();
  const translated = data.translations?.[0]?.text?.trim();
  if (!translated) throw new Error('DeepL returned no translated text.');
  return translated;
}

async function translateBatchWithOpenAI({
  items = [],
  sourceLanguage = 'en',
  targetLanguage = 'uz',
  apiKey,
}) {
  if (!items.length || !apiKey) return new Map();

  const prompt = `You are an expert dubbing translator and localization engineer specializing in natural spoken speech. Translate the following dialogue segments from ${sourceLanguage === 'auto' ? 'their detected source language' : sourceLanguage} to ${targetLanguage}.
Guidelines:
1. Maintain natural conversational tone, emotional nuances, and pacing suitable for dubbing.
2. The translated text should closely match the natural spoken duration of the original phrase.
3. Return a JSON object with the property "translations", containing an array of objects with "index" (number) and "translatedText" (string):
{"translations": [{"index": 0, "translatedText": "..."}]}`;

  const payload = items.map((item) => ({
    index: item.batchIndex,
    speaker: item.speaker || 'Speaker',
    text: item.originalText,
  }));

  const provider = textProvider();
  const response = await fetch(provider.url, {
    method: 'POST',
    signal: AbortSignal.timeout(120_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      ...(provider.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify({ segments: payload }) },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`${provider.provider} batch translation failed (${response.status}).`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) throw new Error(`${provider.provider} returned empty response for batch translation.`);

  const parsed = JSON.parse(rawContent);
  const translations = Array.isArray(parsed.translations)
    ? parsed.translations
    : (Array.isArray(parsed.segments) ? parsed.segments : []);

  const resultMap = new Map();
  for (const entry of translations) {
    if (typeof entry.index === 'number' && typeof entry.translatedText === 'string') {
      resultMap.set(entry.index, entry.translatedText.trim());
    }
  }
  return resultMap;
}

export async function translateText({
  text,
  sourceLanguage = 'en',
  targetLanguage = 'uz',
} = {}) {
  const provider = textProvider();
  const openaiKey = provider.apiKey;
  if (provider.provider === 'deepseek' && !openaiKey) throw new Error('DEEPSEEK_API_KEY is required for DeepSeek translation.');
  const deepLKey = process.env.DEEPL_API_KEY;
  const targetCode = (targetLanguage || 'uz').toLowerCase();

  // 1. Try OpenAI GPT Translation if API key configured
  if (openaiKey && text && text.trim()) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
    signal: AbortSignal.timeout(120_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
      ...(provider.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
          messages: [
            {
              role: 'system',
              content: `You are an expert dubbing translator and localization engineer specializing in natural spoken speech. Translate the following text from ${sourceLanguage === 'auto' ? 'its detected source language' : sourceLanguage} to ${targetLanguage}. Maintain spoken conversational tone, timing constraints, and emotional impact. Output ONLY the translated text without commentary.`,
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok && provider.provider === 'deepseek') throw new Error(`DeepSeek translation failed (${response.status}).`);
      if (response.ok) {
        const data = await response.json();
        const translated = data.choices?.[0]?.message?.content?.trim();
        if (translated) return translated;
        if (provider.provider === 'deepseek') throw new Error('DeepSeek returned empty translation.');
      }
    } catch (err) {
      if (provider.provider === 'deepseek') throw err;
      console.warn('[Translation API] Error, falling back to dictionary:', err);
    }
  }

  // 2. DeepL fallback. Its API accepts a JSON `text` array and returns a
  // matching `translations` array, which keeps this adapter provider-agnostic.
  if (deepLKey && text && text.trim()) {
    try {
      return await translateWithDeepL({
        text,
        sourceLanguage,
        targetLanguage,
        apiKey: deepLKey,
      });
    } catch (err) {
      console.warn('[DeepL Translation API] Error, trying local fallback:', err.message);
    }
  }

  // 3. Small deterministic fallback for local demos and tests.
  const dict = FALLBACK_TRANSLATION_MAP[targetCode];
  if (dict && dict[text]) {
    return dict[text];
  }

  if (sourceLanguage.toLowerCase() === targetCode) {
    return text || '';
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('No translation provider is configured for this text. Set OPENAI_API_KEY or DEEPL_API_KEY.');
  }

  // Development fallback is deliberately explicit in the UI/job result rather
  // than pretending the original text was translated in production.
  return text || '';
}

export async function translateSegments({
  segments = [],
  sourceLanguage = 'en',
  targetLanguage = 'uz',
  preserveExistingTranslations = false,
} = {}) {
  const provider = textProvider();
  const openaiKey = provider.apiKey;
  if (provider.provider === 'deepseek' && !openaiKey) throw new Error('DEEPSEEK_API_KEY is required for DeepSeek translation.');
  const BATCH_SIZE = 25;

  // 1. Identify which segments already have usable translations and which need translation
  const pendingItems = [];
  const preparedSegments = segments.map((seg, idx) => {
    const originalText = preserveExistingTranslations
      ? seg.originalText || seg.text || ''
      : seg.text || seg.originalText || '';

    const hasUsableTranslation = typeof seg.translatedText === 'string' &&
      seg.translatedText.trim() &&
      (seg.translationEdited === true ||
        (seg.translationEdited !== false && seg.translatedText !== originalText));

    if (preserveExistingTranslations && hasUsableTranslation) {
      return {
        ...seg,
        originalText,
        translatedText: seg.translatedText,
        needsTranslation: false,
      };
    }

    if (!originalText || !originalText.trim()) {
      return {
        ...seg,
        originalText,
        translatedText: originalText,
        needsTranslation: false,
      };
    }

    const item = {
      segIndex: idx,
      batchIndex: pendingItems.length,
      originalText,
      speaker: seg.speaker,
    };
    pendingItems.push(item);

    return {
      ...seg,
      originalText,
      translatedText: '',
      needsTranslation: true,
    };
  });

  // 2. If there are pending items and OpenAI is available, attempt batch translation in chunks
  const translatedMap = new Map();
  if (pendingItems.length > 0 && openaiKey) {
    for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
      const chunk = pendingItems.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await translateBatchWithOpenAI({
          items: chunk,
          sourceLanguage,
          targetLanguage,
          apiKey: openaiKey,
        });
        if (provider.provider === 'deepseek' && chunk.some(item => !batchResults.get(item.batchIndex))) throw new Error('DeepSeek returned an incomplete translation batch; review before retrying.');
        for (const item of chunk) {
          if (batchResults.has(item.batchIndex)) {
            translatedMap.set(item.segIndex, batchResults.get(item.batchIndex));
          }
        }
      } catch (err) {
        if (provider.provider === 'deepseek') throw err;
        console.warn('[Translation API] Batch translation error, falling back to individual translation:', err.message);
      }
    }
  }

  // 3. For any segments that weren't translated by the batch (or if batch was not used/failed),
  // fall back to individual translateText (handles DeepL, dictionary fallback, dev fallback, etc.)
  for (const item of pendingItems) {
    if (!translatedMap.has(item.segIndex)) {
      const translated = await translateText({
        text: item.originalText,
        sourceLanguage,
        targetLanguage,
      });
      translatedMap.set(item.segIndex, translated);
    }
  }

  // 4. Assemble final results
  return preparedSegments.map((seg, idx) => {
    const { needsTranslation: _needsTranslation, ...cleanSeg } = seg;
    if (translatedMap.has(idx)) {
      return {
        ...cleanSeg,
        translatedText: translatedMap.get(idx),
      };
    }
    return cleanSeg;
  });
}
