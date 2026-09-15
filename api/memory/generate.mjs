// Vercel Serverless Function — /api/memory/generate (ESM .mjs)

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
    maxDuration: 60,
  },
};

const EXPERIENCE_PROMPTS = {
  younger: `AGE TRANSFORMATION — DE-AGE THE PARENT INTO A SCHOOLCHILD (CHILDHOOD LIKENESS & EXACT POSE):
- Identify the adult parent (the person with adult facial features, beard/stubble, or mature build) and the child in the reference photo.
- For the Adult Parent: Turn the parent into a schoolchild (approximately 10–12 years old). This must be a true, photorealistic CHILDHOOD VERSION of this specific person:
  * STRICTLY PRESERVE the parent's core facial DNA: exact eye shape, eyelid fold, nose structure, eyebrow arch, distinctive smile shape, ear shape, and natural skin tone, naturally adapted into a 10–12 year old kid's face (what this exact adult looked like as a school student).
  * Remove all facial hair, beard, mustache, and adult facial creases, giving them smooth youthful skin and school-kid hair.
  * Adjust their body size to a 10–12 year old child while KEEPING their exact pose, arm and hand placement, and head tilt from the photo.
  * It must NOT be a random generic child face; anyone looking at the photo should immediately recognize the childhood face of this exact parent!
- For the Child: Keep the child at their EXACT same age, facial features, and expression from the original photo.
- Both subjects now appear as two school-age peers/friends standing together, maintaining the EXACT physical interaction, gestures, and pose from the original photo.`,

  older: `AGE TRANSFORMATION — GROW UP THE CHILD (PRESERVING EXACT IDENTITY & POSE):
- Retain the exact body pose, stance, gestures, hand placement, and interaction between both individuals as seen in the reference photo.
- For the Child: Age the child up into a tall, accomplished young adult / university graduate (approx 20–24 years old). Give them mature adult facial proportions while STRICTLY PRESERVING their childhood facial identity (same eyes, face shape, distinctive smile, and skin tone).
- For the Parent / Adult: Keep the parent clearly recognizable and proud, looking refreshed and youthful.
- Both individuals keep their exact pose, placement, and spatial relationship from the reference photo.`,
};

const LOCATION_PROMPTS = {
  trip: {
    label: 'Trip',
    options: [
      {
        id: 'pyramids',
        label: 'Pyramids',
        prompt:
          'Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset while preserving their exact poses: pyramids silhouetted in the warm desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.',
      },
      {
        id: 'zoo',
        label: 'Zoo',
        prompt:
          'Place both subjects outdoors at a lively zoo while preserving their exact poses: animal enclosures and greenery softly blurred in the background, natural daylight, cheerful family-outing atmosphere, warm candid photography look.',
      },
      {
        id: 'malahy',
        label: 'Amusement Park',
        prompt:
          'Place both subjects at a colorful amusement park while preserving their exact poses: blurred ferris wheel and ride lights in the background, warm evening lighting with soft bokeh, festive fairground atmosphere.',
      },
    ],
  },

  classroom: {
    label: 'Classroom',
    options: [
      {
        id: 'whiteboard',
        label: 'Whiteboard',
        prompt:
          'Place both subjects inside a bright modern classroom while preserving their exact poses: a large whiteboard with faint educational writing, wooden desks in the background, soft warm daylight through windows, education photobooth aesthetic.',
      },
      {
        id: 'first_day_frame',
        label: 'First Day of School Frame',
        prompt:
          "Place both subjects inside a warm classroom while preserving their exact poses: a decorative 'First Day of School' photo frame or banner softly visible in the background, colorful classroom decorations, cheerful natural lighting.",
      },
      {
        id: 'desks',
        label: 'Desks Row',
        prompt:
          'Place both subjects standing between rows of classroom desks while preserving their exact poses: bookshelves and a chalkboard blurred in the background, warm daylight, cozy classic classroom feel.',
      },
    ],
  },

  schoolyard: {
    label: 'School Yard',
    options: [
      {
        id: 'football_yard',
        label: 'Football Yard',
        prompt:
          'Place both subjects outdoors on a school football yard at golden-hour sunset while preserving their exact poses: goalposts and blurred school building in the background, warm backlight sun flare, nostalgic orange tones.',
      },
      {
        id: 'playground',
        label: 'Playground',
        prompt:
          'Place both subjects outdoors in a school playground while preserving their exact poses: swings and slides softly blurred in the background, bright cheerful daylight, playful energetic atmosphere.',
      },
      {
        id: 'garden',
        label: 'Garden',
        prompt:
          'Place both subjects outdoors in a lush school garden while preserving their exact poses: green trees, flower beds, and a stone pathway in the background, soft natural sunlight, calm and fresh atmosphere.',
      },
    ],
  },

  labroom: {
    label: 'Lab Room',
    options: [
      {
        id: 'microscope',
        label: 'Microscope Bench',
        prompt:
          'Place both subjects inside a science lab room while preserving their exact poses: a microscope and lab notebooks on the bench, blurred lab equipment in the background, bright clean lighting.',
      },
      {
        id: 'chemical_tubes',
        label: 'Chemical Tubes',
        prompt:
          'Place both subjects inside a science lab room while preserving their exact poses: glass beakers and test tubes with amber and blue liquid on the bench, blurred science posters in the background, bright clean lighting.',
      },
      {
        id: 'lab_equipment',
        label: 'General Lab Equipment',
        prompt:
          'Place both subjects inside a modern science lab while preserving their exact poses: shelves of lab equipment, safety goggles, and a periodic table chart blurred in the background, bright clinical lighting.',
      },
    ],
  },

  library: {
    label: 'Library',
    options: [
      {
        id: 'bookshelves',
        label: 'Bookshelves Aisle',
        prompt:
          'Place both subjects standing in a long modern library aisle while preserving their exact poses: tall wooden bookshelves lining both sides, warm overhead lamps, deep symmetrical perspective.',
      },
      {
        id: 'computers',
        label: 'Computer Area',
        prompt:
          'Place both subjects inside a modern library computer area while preserving their exact poses: rows of computer desks and soft screen glow blurred in the background, warm ambient lighting.',
      },
      {
        id: 'reading_table',
        label: 'Reading Table',
        prompt:
          'Place both subjects seated or standing near a library reading table stacked with books while preserving their exact poses: bookshelves blurred in the background, warm cozy lamp lighting.',
      },
    ],
  },

  graduation: {
    label: 'Graduation',
    options: [
      {
        id: 'school_building',
        label: 'School Building',
        prompt:
          'Place both subjects in front of a school building during a graduation celebration while preserving their exact poses: soft bokeh of the building facade and balloons in the background, warm festive lighting.',
      },
      {
        id: 'theater',
        label: 'Theater',
        prompt:
          'Place both subjects on a graduation ceremony theater stage while preserving their exact poses: stage curtains and soft spotlight glow in the background, warm celebratory mood.',
      },
      {
        id: 'crowd_celebration',
        label: 'Crowd Celebration',
        prompt:
          'Place both subjects in a celebratory graduation ceremony while preserving their exact poses: soft bokeh crowd background, floating graduation cap and confetti in the air, warm festive lighting, joyful mood.',
      },
    ],
  },
};

// Normalize keys to support both hyphens and aliases
function normalizeLocationKey(key) {
  if (!key) return null;
  const clean = key.toLowerCase().replace(/[-_\s]/g, '');
  if (clean === 'trip') return 'trip';
  if (clean === 'classroom') return 'classroom';
  if (clean === 'schoolyard' || clean === 'school') return 'schoolyard';
  if (clean === 'labroom' || clean === 'lab') return 'labroom';
  if (clean === 'library') return 'library';
  if (clean === 'graduation') return 'graduation';
  return null;
}

// In-memory tracker to avoid repeating the same scene consecutively
const lastPickedHistory = new Map();

function getRandomBackground(category, specificId) {
  const normKey = normalizeLocationKey(category);
  if (!normKey || !LOCATION_PROMPTS[normKey]) {
    throw new Error(`Unknown location category: ${category}`);
  }

  const categoryData = LOCATION_PROMPTS[normKey];
  const options = categoryData.options;

  if (specificId) {
    const specific = options.find((opt) => opt.id.toLowerCase() === specificId.toLowerCase());
    if (specific) return specific;
  }

  const lastIndex = lastPickedHistory.get(normKey);
  let chosenIndex;

  if (options.length > 1 && lastIndex !== undefined) {
    const candidateIndices = options.map((_, i) => i).filter((i) => i !== lastIndex);
    chosenIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
  } else {
    chosenIndex = Math.floor(Math.random() * options.length);
  }

  lastPickedHistory.set(normKey, chosenIndex);
  return options[chosenIndex];
}

function buildPrompt(experience, location, specificBackgroundId) {
  const expText = EXPERIENCE_PROMPTS[experience];
  const background = getRandomBackground(location, specificBackgroundId);

  const prompt = `Using the uploaded photo as the exact reference for both people, generate a photorealistic image that transports both individuals into a new background with an age transformation while preserving their exact poses and facial identities:

1. CRITICAL POSE, COMPOSITION & IDENTITY PRESERVATION:
- STRICTLY PRESERVE the exact pose, body posture, gestures, arm/hand placement, head tilt, and physical orientation of both individuals from the uploaded photo.
- Maintain their exact positions relative to each other (who is on the left and who is on the right, how they stand or sit, their spatial relationship and physical contact).
- Do NOT alter their poses or invent new body positions. The framing, camera angle, and physical postures must match the original photo.
- PRESERVE facial identity, unique facial features, skin tone, eye shape, nose shape, and distinct smile so they remain 100% immediately recognizable as the same people. Do NOT generate generic or random faces.

2. BACKGROUND REPLACEMENT:
- Replace the original background completely with this new setting:
${background.prompt}
- Integrate both subjects naturally into this new environment with realistic contact lighting and shadows, while keeping their exact poses and interaction.

3. ${expText}

- Style: Warm, cinematic editorial photography, natural lighting, sharp focus on both faces, genuine expressions matching the original photo. High detail, 4K quality.
- Negative constraints: generic random children, completely different poses, altered body postures, swapped positions, repositioned arms or hands, unrecognizable people, extra people, text overlays, watermarks, distorted faces, unrealistic proportions, extra limbs, deformed fingers.`;

  return { prompt, background };
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

  const {
    imageBase64,
    mimeType = 'image/jpeg',
    experience,
    location,
    backgroundId,
    subLocation,
  } = req.body ?? {};

  if (!experience || !location) {
    return res.status(400).json({ error: 'Choose an experience and a location first.' });
  }

  const normLocation = normalizeLocationKey(location);
  if (!EXPERIENCE_PROMPTS[experience] || !normLocation) {
    return res.status(400).json({ error: 'Invalid experience or location choice.' });
  }

  const { prompt, background } = buildPrompt(
    experience,
    location,
    backgroundId || subLocation,
  );
  console.log(
    `[Vercel Generate] Category: "${location}" -> Selected Scene: [${background.id}] "${background.label}"`,
  );

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
          background: {
            category: location,
            id: background.id,
            label: background.label,
          },
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
