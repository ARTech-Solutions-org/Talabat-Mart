// Vercel Serverless Function — /api/memory/generate (ESM .mjs)

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
    maxDuration: 60,
  },
};

const EXPERIENCE_PROMPTS = {
  younger: `2. AGE TRANSFORMATION — MAKE THE ADULT PARENT YOUNGER:
- Identify the adult parent in the photo (the person with mature adult facial features, beard/stubble, or taller adult build, regardless of whether they stand on the left or right).
- TRANSFORM the adult parent into a young schoolchild / teenager (approximately 10–13 years old), turning them into a kid alongside their child! Give them youthful smooth skin, full youthful hair without gray or beard, and a cheerful kid/teen appearance, while preserving their signature eye shape, smile, and facial resemblance so they are unmistakably the younger version of themselves.
- The younger child in the reference photo remains at their same young age.
- Both subjects now look like two happy school-age peers/friends laughing and interacting warmly together.`,

  older: `2. AGE TRANSFORMATION — MAKE THE CHILD GROW UP INTO AN ADULT GRADUATE:
- Identify the child / younger person in the photo (the smaller person with youthful/childlike features, regardless of whether they stand on the left or right).
- AGE this child UP into a tall, accomplished young adult university graduate (approximately 21–24 years old) wearing a graduation gown or smart adult outfit. Give them mature adult facial proportions and confident adult posture, while clearly preserving their core facial identity, eye shape, and smile matured naturally into adulthood.
- The adult parent stands proudly beside their grown-up child, celebrating this proud milestone together.
- Both subjects share a celebratory, proud family moment.`,
};

const LOCATION_PROMPTS = {
  classroom: `Inside a bright, modern school classroom: an orange accent wall, a large whiteboard with math/science sketches, student wooden desks and tidy bookshelves, soft warm daylight streaming through large windows, education photobooth aesthetic.`,
  'school-yard': `Outdoors in a school yard at golden-hour sunset: a basketball court hoop, blurred school building and sports fence in the background, warm backlight sun flare, nostalgic autumn/orange tones.`,
  'lab-room': `Inside a science lab room: glass beakers and test tubes with amber and colorful liquids on the bench, blurred lab equipment and science posters in the background, bright clean lighting.`,
  library: `Inside a grand modern library aisle: tall wooden and orange bookshelves lining both sides, warm overhead lamps, reflective floor, deep symmetrical perspective.`,
  graduation: `At a university graduation ceremony: soft bokeh crowd background, floating graduation cap and celebratory confetti in the air, warm festive lighting, joyful celebratory mood.`,
  trip: `Outdoors on a desert travel adventure at the Giza Pyramids in Egypt during golden sunset: pyramids silhouetted in the warm desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

function buildPrompt(experience, location) {
  const expText = EXPERIENCE_PROMPTS[experience];
  const locText = LOCATION_PROMPTS[location];

  return `PRIMARY DIRECTIVE: Generate a brand-new photorealistic image that transforms the two individuals from the uploaded reference photo according to the following instructions:

1. COMPLETE BACKGROUND REPLACEMENT (MANDATORY):
Completely REMOVE and DISCARD the original background and setting from the uploaded photo. Do NOT keep any walls, furniture, rooms, or outdoor scenery from the original photo.
The new scene MUST take place entirely within this new environment:
${locText}

${expText}

3. IDENTITY & PHOTOREALISM:
- Keep the distinctive facial resemblance (eye shape, smile, nose, skin tone) of both individuals from the reference photo so their family instantly recognizes them at their new transformed ages.
- Dress both individuals in new, clean clothes that fit the new environment (school/casual clothes for classroom/yard, graduation gown/suit for graduation, travel clothes for trip).
- Warm, cinematic editorial photography, natural lighting, sharp focus on both faces, genuine joyful smiles. High detail, 4K quality.
- Negative constraints: no extra people, no text overlays, no watermarks, no distorted faces, no unrealistic proportions.`;
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
