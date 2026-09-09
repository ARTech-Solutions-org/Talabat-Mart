// Vercel Serverless Function — /api/memory/generate (ESM .mjs)

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
    maxDuration: 60,
  },
};

const BASE_PROMPT = `Using the uploaded photo as the exact identity reference for both people, regenerate a photorealistic image of the same two individuals.

CRITICAL SUBJECT IDENTIFICATION INSTRUCTION:
First, carefully analyze the two individuals in the uploaded reference photo:
- Person 1 (The older / more mature person): Look for more mature facial features, adult bone structure, facial hair/stubble, or older appearance. If both individuals are similar in age (e.g. friends, peers, or brothers), designate the person on the LEFT as Person 1.
- Person 2 (The younger / less mature person): Look for younger, more youthful, or child/teen facial features and smaller proportions. If both individuals are similar in age, designate the person on the RIGHT as Person 2.
- KEEP RELATIVE POSITIONS: Maintain Person 1 on the left and Person 2 on the right so identities are never swapped or confused.

IDENTITY PRESERVATION:
Preserve both individuals' exact facial identity, eye shape, nose, distinct features, skin tone, and hair texture so they remain 100% clearly recognizable as the same people. Keep their original clothing colors and style unless the scene requires a natural adjustment. Maintain a warm, cinematic, editorial photography look with soft natural lighting, sharp focus on both faces, and a joyful, genuine smile. Do not add any extra people. High detail, professional photo quality, 4K.`;

const EXPERIENCE_PROMPTS = {
  younger: `AGE TRANSFORMATION — MAKE THE OLDER PERSON YOUNGER:
- For Person 1 (the older / adult subject, or person on the left): Visually de-age Person 1 by approximately 15–20 years. Give Person 1 smooth, youthful, radiant skin, darker/fuller hair without gray, and an energetic young-adult appearance (as if they traveled back in time to their youth) — WHILE STRICTLY PRESERVING their facial bone structure, eye shape, smile, and identity so they are unmistakably the younger version of themselves.
- For Person 2 (the younger / child subject, or person on the right): KEEP Person 2 at their EXACT same original age and facial features from the reference photo without aging them.
- Interaction: Both subjects now appear close in age like peers or young friends, interacting warmly and happily together in the scene.`,

  older: `AGE TRANSFORMATION — MAKE THE YOUNGER PERSON GROW UP:
- For Person 2 (the younger / child subject, or person on the right): Age Person 2 UP into an accomplished young adult / university graduate (approximately 20–24 years old). Give them mature adult facial proportions, adult height, and a confident adult demeanor — WHILE STRICTLY PRESERVING their core facial identity, eye shape, nose, smile, and distinct features matured naturally into adulthood.
- For Person 1 (the older / adult subject, or person on the left): Keep Person 1 clearly recognizable and proudly celebrating together (slightly refreshed and rejuvenated by 5–10 years so they look vibrant, proud, and energized).
- Interaction: Person 2 is now grown up standing proudly beside Person 1 as an accomplished adult graduate/peer, sharing a proud, celebratory milestone moment.`,
};

const LOCATION_PROMPTS = {
  classroom: `Place both subjects inside a bright modern classroom: orange accent wall, large whiteboard behind them, wooden desks and bookshelves, soft warm daylight streaming through a window, cozy education-brand aesthetic.`,
  'school-yard': `Place both subjects outdoors in a school yard at golden-hour sunset: school building and fence softly blurred in the background, warm backlit sun flare, basketball hoop visible, nostalgic warm orange tones.`,
  'lab-room': `Place both subjects in a science lab room: glass beakers and test tubes with amber liquid on the bench beside them, blurred lab equipment and posters in the background, bright clinical lighting mixed with warm accents.`,
  library: `Place both subjects standing in a long library aisle: tall orange bookshelves lining both sides, bright fluorescent ceiling lights, glossy reflective floor, deep symmetrical perspective toward the background.`,
  graduation: `Place both subjects in a graduation-ceremony atmosphere: soft bokeh crowd background, confetti and a graduation cap tossed in the air around them, celebratory warm lighting, festive joyful mood.`,
  trip: `Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset: pyramids silhouetted in the warm-toned desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

const NEGATIVE_PROMPT = 'no extra people, no text overlays, no watermarks, no distorted faces, no unrealistic proportions';

// Candidate models in order of priority
const CANDIDATE_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.5-flash-image',
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
    `Negative: ${NEGATIVE_PROMPT}`,
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

        // Continue and try next candidate model
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

  let userFriendlyError = lastError || 'Gemini returned no image.';
  if (lastError && (lastError.includes('limit: 0') || lastError.includes('quota') || lastError.includes('429'))) {
    userFriendlyError = 'Google AI Studio quota limit is 0 on free tier for image generation. Please link a billing account to your Google Cloud project to activate quota.';
  }

  return res.status(502).json({
    error: userFriendlyError,
    details: lastError,
  });
}
