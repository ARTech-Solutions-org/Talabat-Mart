// Vercel Serverless Function — /api/memory/generate (ESM .mjs)

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
    maxDuration: 60,
  },
};

const BASE_PROMPT = `Using the uploaded photo as the exact reference for both people, regenerate a photorealistic image of the same two individuals.
CRITICAL POSE & COMPOSITION PRESERVATION:
- Strictly preserve the exact pose, body posture, gestures, arm/hand placement, and physical orientation of both individuals as seen in the original photo.
- Maintain their exact positions relative to each other (who is on the left and who is on the right, how they stand or sit, head tilts, and body angles).
- Do NOT alter their poses or invent new body positions. The composition, framing, and physical postures must match the original photo as closely as possible.
- Preserve their facial identity, unique facial features, skin tone, eye shape, and hairstyle so they remain immediately and clearly recognizable as the same people.
- Keep their original clothing colors and style unless the scene requires a natural adjustment.
- Maintain a warm, cinematic, editorial photography look with soft natural lighting, sharp focus on both faces, and genuine facial expressions matching the original photo.
- Do not add any extra people. High detail, professional photo quality, 4K.`;

const EXPERIENCE_PROMPTS = {
  younger: `Age transformation (strictly maintaining original poses): Keep the child's apparent age and posture exactly the same as in the original photo. Reduce the parent's facial apparent age by approximately 15–20 years — smoother skin, fuller and darker hair (remove gray if present), more youthful facial structure — while keeping the parent clearly recognizable as the same person (same face shape, eyes, nose, smile). The parent and child must maintain their exact body posture, stance, hand positions, and spatial relationship from the reference photo without changing poses.`,
  older: `Age transformation (strictly maintaining original poses): Age the child up to look like a young adult / recent graduate, approximately 20–24 years old — mature facial proportions — while clearly preserving the child's original facial identity (same eyes, face shape, smile, hair color/texture, just matured) and keeping their original body pose and stance. Simultaneously reduce the parent's facial apparent age by approximately 10–15 years — smoother skin, youthful facial features — while keeping the parent clearly recognizable. Both subjects must keep their exact relative positions, stance, gestures, and overall body posture from the original photo.`,
};

const LOCATION_PROMPTS = {
  classroom: `Place both subjects inside a bright modern classroom while retaining their exact poses and positions: orange accent wall, large whiteboard behind them, wooden desks and bookshelves, soft warm daylight streaming through a window, cozy education-brand aesthetic.`,
  'school-yard': `Place both subjects outdoors in a school yard at golden-hour sunset while retaining their exact poses and positions: school building and fence softly blurred in the background, warm backlit sun flare, basketball hoop visible, nostalgic warm orange tones.`,
  'lab-room': `Place both subjects in a science lab room while retaining their exact poses and positions: glass beakers and test tubes with amber liquid on the bench beside them, blurred lab equipment and posters in the background, bright clinical lighting mixed with warm accents.`,
  library: `Place both subjects standing in a long library aisle while retaining their exact poses and positions: tall orange bookshelves lining both sides, bright fluorescent ceiling lights, glossy reflective floor, deep symmetrical perspective toward the background.`,
  graduation: `Place both subjects in a graduation-ceremony atmosphere while retaining their exact poses and positions: soft bokeh crowd background, confetti and a graduation cap tossed in the air around them, celebratory warm lighting, festive joyful mood.`,
  trip: `Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset while retaining their exact poses and positions: pyramids silhouetted in the warm-toned desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

const NEGATIVE_PROMPT = 'changed poses, altered posture, different body positions, swapped positions, repositioned arms or hands, extra people, text overlays, watermarks, distorted faces, unrealistic proportions, extra limbs, deformed fingers';

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
