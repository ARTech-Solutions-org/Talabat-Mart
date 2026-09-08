// Vercel Serverless Function — /api/memory/generate (ESM .mjs)

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
    maxDuration: 60,
  },
};

const BASE_PROMPT = `Using the uploaded photo as the exact identity reference for both people, regenerate a photorealistic image of the same two individuals — preserve their facial identity, unique features, skin tone, and hairstyle so they remain clearly recognizable as the same people. Keep their original clothing colors and style unless the scene requires a natural adjustment. Maintain a warm, cinematic, editorial photography look with soft natural lighting, sharp focus on both faces, and a joyful, affectionate interaction between the two subjects (natural pose, genuine smile). Do not add any extra people. High detail, professional photo quality, 4K.`;

const EXPERIENCE_PROMPTS = {
  younger: `Age transformation: keep the child's apparent age exactly the same as in the original photo. Reduce the parent's apparent age by approximately 15–20 years — smoother skin, fuller and darker hair (remove gray if present), more youthful facial structure — while keeping the parent clearly recognizable as the same person (same face shape, eyes, nose, smile). The parent should now look youthful, energetic, close in age to a young adult, standing/sitting naturally next to the child.`,
  older: `Age transformation: age the child up to look like a young adult / recent graduate, approximately 20–24 years old — mature facial proportions, adult height and posture — while clearly preserving the child's original facial identity (same eyes, face shape, smile, hair color/texture, just matured). Simultaneously reduce the parent's apparent age by approximately 10–15 years — smoother skin, more youthful hair and posture — while keeping the parent clearly recognizable as the same person. The goal is for the two subjects to now appear close in age to each other, like siblings or peers, while still visibly being the same two people from the original photo.`,
};

const LOCATION_PROMPTS = {
  classroom: `Place both subjects inside a bright modern classroom: orange accent wall, large whiteboard behind them, wooden desks and bookshelves, soft warm daylight streaming through a window, cozy education-brand aesthetic.`,
  'school-yard': `Place both subjects outdoors in a school yard at golden-hour sunset: school building and fence softly blurred in the background, warm backlit sun flare, basketball hoop visible, nostalgic warm orange tones.`,
  'lab-room': `Place both subjects in a science lab room: glass beakers and test tubes with amber liquid on the bench beside them, blurred lab equipment and posters in the background, bright clinical lighting mixed with warm accents.`,
  library: `Place both subjects standing in a long library aisle: tall orange bookshelves lining both sides, bright fluorescent ceiling lights, glossy reflective floor, deep symmetrical perspective toward the background.`,
  graduation: `Place both subjects in a graduation-ceremony atmosphere: soft bokeh crowd background, confetti and a graduation cap tossed in the air around them, celebratory warm lighting, festive joyful mood.`,
  trip: `Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset: pyramids silhouetted in the warm-toned desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

// Candidate models in order of priority
const CANDIDATE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured in environment variables');
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on Vercel.' });
  }

  const { imageBase64, mimeType = 'image/jpeg', experience, location } = req.body ?? {};

  if (!experience || !location) {
    return res.status(400).json({ error: 'Choose an experience and a location first.' });
  }

  const experiencePrompt = EXPERIENCE_PROMPTS[experience];
  const locationPrompt = LOCATION_PROMPTS[location];

  if (!experiencePrompt || !locationPrompt) {
    return res.status(400).json({ error: 'Invalid experience or location choice.' });
  }

  const prompt = [
    BASE_PROMPT,
    experiencePrompt,
    locationPrompt,
    'Negative: no extra people, no text overlays, no watermarks, no distorted faces, no unrealistic proportions',
  ].join('\n\n');

  let cleanMime = mimeType;
  let cleanBase64 = imageBase64;

  if (imageBase64) {
    const dataUriMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/s);
    if (dataUriMatch) {
      cleanMime = dataUriMatch[1];
      cleanBase64 = dataUriMatch[2];
    } else {
      cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    }
  }

  const parts = cleanBase64
    ? [
        { inlineData: { mimeType: cleanMime, data: cleanBase64 } },
        { text: prompt },
      ]
    : [{ text: prompt }];

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      console.log(`Attempting image generation with model: ${model}`);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = payload?.error?.message || `HTTP ${response.status}`;
        console.warn(`Model ${model} failed (${response.status}): ${errorMsg}`);
        lastError = `[${model}] ${errorMsg}`;

        // If model not found or modalities unsupported, try next model
        if (response.status === 404 || response.status === 400) {
          continue;
        }
        // If quota exceeded or permission denied, stop and report
        if (response.status === 403 || response.status === 429) {
          return res.status(502).json({ error: `Gemini API quota/permission error: ${errorMsg}` });
        }
        continue;
      }

      // Check candidates
      const candidate = payload.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY') {
        return res.status(502).json({ error: 'Image was blocked by AI safety filters. Please try another photo.' });
      }

      const allParts = candidate?.content?.parts ?? [];
      const imagePart = allParts.find(
        (p) => (p.inlineData && p.inlineData.data) || (p.inline_data && p.inline_data.data)
      );

      if (imagePart) {
        const data = imagePart.inlineData?.data || imagePart.inline_data?.data;
        const mime = imagePart.inlineData?.mimeType || imagePart.inline_data?.mime_type || 'image/png';
        console.log(`Successfully generated image using model: ${model}`);
        return res.status(200).json({
          imageBase64: data,
          mimeType: mime,
        });
      }

      // If text-only returned
      const textPart = allParts.find((p) => p.text);
      if (textPart?.text) {
        console.warn(`Model ${model} returned text without image: ${textPart.text.slice(0, 200)}`);
        lastError = `Model returned text only: ${textPart.text.slice(0, 150)}`;
      } else {
        lastError = `Model ${model} returned no image data`;
      }
    } catch (err) {
      console.error(`Fetch exception for ${model}:`, err);
      lastError = err.message;
    }
  }

  // All candidate models failed
  console.error('All candidate Gemini models failed. Last error:', lastError);
  return res.status(502).json({
    error: `Image generation failed: ${lastError || 'Gemini returned no image.'}`,
  });
}
