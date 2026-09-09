// Vercel Serverless Function — /api/memory/generate (ESM .mjs)

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
    maxDuration: 60,
  },
};

const EXPERIENCE_PROMPTS = {
  younger: `AGE TRANSFORMATION — REJUVENATE THE PARENT (PRESERVING EXACT IDENTITY & POSE):
- Retain the exact body pose, stance, gestures, hand placement, and interaction between both individuals as seen in the reference photo.
- For the Parent / Adult: Rejuvenate the parent into their vibrant prime youth (approx 20–25 years old). Give them smooth, youthful skin, fuller and darker hair (remove any gray hair or aging lines), and fresh young-adult energy — WHILE STRICTLY PRESERVING their facial bone structure, eye shape, nose, distinctive smile, and identity so they are 100% UNMISTAKABLY the same person in their youth. Do NOT turn the adult into a child.
- For the Child: Keep the child at their EXACT same age, facial features, and expression from the original photo.
- Both individuals must remain immediately recognizable as the same real people from the photo, holding their original pose.`,

  older: `AGE TRANSFORMATION — GROW UP THE CHILD (PRESERVING EXACT IDENTITY & POSE):
- Retain the exact body pose, stance, gestures, hand placement, and interaction between both individuals as seen in the reference photo.
- For the Child: Age the child up into a tall, accomplished young adult / university graduate (approx 20–24 years old). Give them mature adult facial proportions while STRICTLY PRESERVING their childhood facial identity (same eyes, face shape, distinctive smile, and skin tone).
- For the Parent / Adult: Keep the parent clearly recognizable and proud, looking refreshed and youthful (rejuvenated by 5–10 years).
- Both individuals keep their exact pose, placement, and spatial relationship from the reference photo.`,
};

const LOCATION_PROMPTS = {
  classroom: `Place both subjects inside a bright modern classroom while preserving their exact poses: an orange feature wall, a large whiteboard, wooden desks and bookshelves, soft warm daylight streaming through large windows, education photobooth aesthetic.`,
  'school-yard': `Place both subjects outdoors in a school yard at golden-hour sunset while preserving their exact poses: a basketball court hoop, blurred school building and sports fence in the background, warm backlight sun flare, nostalgic autumn/orange tones.`,
  'lab-room': `Place both subjects inside a science lab room while preserving their exact poses: glass beakers and test tubes with amber liquid on the bench, blurred lab equipment and science posters in the background, bright clean lighting.`,
  library: `Place both subjects standing in a long modern library aisle while preserving their exact poses: tall wooden and orange bookshelves lining both sides, warm overhead lamps, reflective floor, deep symmetrical perspective.`,
  graduation: `Place both subjects in a celebratory graduation ceremony while preserving their exact poses: soft bokeh crowd background, floating graduation cap and celebratory confetti in the air, warm festive lighting, joyful celebratory mood.`,
  trip: `Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset while preserving their exact poses: pyramids silhouetted in the warm desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

function buildPrompt(experience, location) {
  const expText = EXPERIENCE_PROMPTS[experience];
  const locText = LOCATION_PROMPTS[location];

  return `Using the uploaded photo as the exact reference for both people, generate a photorealistic image that preserves the exact same individuals and their poses, transported into a new background with an age transformation:

1. CRITICAL POSE, COMPOSITION & IDENTITY PRESERVATION:
- STRICTLY PRESERVE the exact pose, body posture, gestures, arm/hand placement, head tilt, and physical orientation of both individuals from the uploaded photo.
- Maintain their exact positions relative to each other (who is on the left and who is on the right, how they stand or sit, their spatial relationship).
- Do NOT alter their poses or invent new body positions. The framing, camera angle, and physical postures must match the original photo.
- PRESERVE their facial identity, unique facial features, skin tone, eye shape, nose shape, and distinct smile so they remain 100% immediately recognizable as the same people. Do NOT generate generic or random faces.

2. BACKGROUND REPLACEMENT:
- Replace the original background completely with this new setting:
${locText}
- Integrate both subjects naturally into this new environment with realistic contact lighting and shadows, while keeping their exact poses and interaction.

3. ${expText}

- Style: Warm, cinematic editorial photography, natural lighting, sharp focus on both faces, genuine expressions matching the original photo. High detail, 4K quality.
- Negative constraints: changed poses, altered posture, different body positions, swapped positions, repositioned arms or hands, random faces, generic faces, child version of parent, unrecognizable people, extra people, text overlays, watermarks, distorted faces, unrealistic proportions, extra limbs, deformed fingers.`;
}

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

  if (!EXPERIENCE_PROMPTS[experience] || !LOCATION_PROMPTS[location]) {
    return res.status(400).json({ error: 'Invalid experience or location choice.' });
  }

  const prompt = buildPrompt(experience, location);

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
