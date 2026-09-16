import { Router } from "express";

const router = Router();

type GenerateMemoryBody = {
  imageBase64?: string;
  mimeType?: string;
  experience?: "younger" | "older";
  location?:
  | "classroom"
  | "school-yard"
  | "schoolyard"
  | "lab-room"
  | "labroom"
  | "library"
  | "graduation"
  | "trip";
  backgroundId?: string;
  subLocation?: string;
};

type MemoryRequest = {
  body?: GenerateMemoryBody;
  log: {
    error: (...args: unknown[]) => void;
  };
};

type MemoryResponse = {
  status: (code: number) => MemoryResponse;
  json: (body: unknown) => void;
};

type GeminiHttpResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<{
    error?: { message?: string };
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  }>;
};

// ─── Prompt Building Blocks ────────────────────────────────────────────────
// KEY FIX: the age-transformation prompt no longer mentions the background at
// all. Asking one model call to do a dramatic identity-preserving age change
// AND a full background replacement at the same time made it consistently
// take the easy path (background) and ignore the hard one (age). Splitting
// into two sequential calls, each with a single job, fixes that.

const EXPERIENCE_PROMPTS: Record<NonNullable<GenerateMemoryBody["experience"]>, string> = {
  younger: `You are a professional photo editor performing an AGE TRANSFORMATION on a real uploaded photo of two people (a parent and a child). Do not generate a new image from scratch — edit the actual uploaded photo.

TASK — DE-AGE THE ADULT PARENT INTO A CHILD (this is the ONLY task in this step, do not touch the background):
- Identify who is the adult parent (larger body, adult facial structure, possibly beard/stubble or mature features) and who is the child.
- Completely transform the ADULT into a believable, photorealistic 10-12 year old child version of themselves. This transformation MUST be clearly visible and dramatic, not subtle.
- Remove ALL adult facial features: beard, stubble, wrinkles, adult jawline. Replace with smooth youthful skin, rounder face, smaller nose, larger-looking eyes typical of a child.
- Shrink body proportions to a child's size: shorter height, slimmer arms and legs, smaller hands. Adjust their clothing size to fit the new smaller body.
- Give them a schoolchild-appropriate hairstyle.
- The CHILD already in the photo must stay at their exact same age and appearance — do not change them.
- Keep the exact original background completely unchanged in this step.
- Preserve each person's relative position (left/right) and any physical contact (hugging, hand-holding, arm around shoulder), naturally rescaled to the new body size.
- Preserve unique facial identity so each person is recognizable as themselves at the new age.
- FORBIDDEN: text, watermarks, logos, extra limbs, extra people, blurry faces, deformed hands.`,

  older: `You are a professional photo editor performing an AGE TRANSFORMATION on a real uploaded photo of two people (a parent and a child). Do not generate a new image from scratch — edit the actual uploaded photo.

TASK — AGE UP THE CHILD INTO A YOUNG ADULT (this is the ONLY task in this step, do not touch the background):
- Identify who is the child (smaller body, younger facial features) and who is the adult parent.
- Completely transform the CHILD into a photorealistic 20-24 year old young adult version of themselves. This transformation MUST be clearly visible and dramatic, not subtle.
- Add adult facial features: defined jawline, mature facial proportions.
- Give them an adult height and build — they should now be as tall as or taller than the parent, with an adult physique. Adjust clothing to fit the new adult body (smart casual clothing or a graduation gown works well).
- The PARENT already in the photo must stay at their exact current age and appearance — do not change them.
- Keep the exact original background completely unchanged in this step.
- Preserve their relative position (left/right) and closeness/interaction, naturally rescaled to the new adult body size.
- Preserve unique facial identity so each person is recognizable as themselves at the new age.
- FORBIDDEN: text, watermarks, logos, extra limbs, extra people, blurry faces, deformed hands.`,
};

// ─── Multi-Scene Background Categories ─────────────────────────────────────

export interface BackgroundOption {
  id: string;
  label: string;
  prompt: string;
}

export interface LocationCategory {
  label: string;
  options: BackgroundOption[];
}

export type LocationKey =
  | "trip"
  | "classroom"
  | "schoolyard"
  | "labroom"
  | "library"
  | "graduation";

export const LOCATION_PROMPTS: Record<LocationKey, LocationCategory> = {
  trip: {
    label: "Trip",
    options: [
      {
        id: "pyramids",
        label: "Pyramids",
        prompt:
          "Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset while preserving their exact poses: pyramids silhouetted in the warm desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.",
      },
      {
        id: "zoo",
        label: "Zoo",
        prompt:
          "Place both subjects outdoors at a lively zoo while preserving their exact poses: animal enclosures and greenery softly blurred in the background, natural daylight, cheerful family-outing atmosphere, warm candid photography look.",
      },
      {
        id: "malahy",
        label: "Amusement Park",
        prompt:
          "Place both subjects at a colorful amusement park while preserving their exact poses: blurred ferris wheel and ride lights in the background, warm evening lighting with soft bokeh, festive fairground atmosphere.",
      },
    ],
  },

  classroom: {
    label: "Classroom",
    options: [
      {
        id: "whiteboard",
        label: "Whiteboard",
        prompt:
          "Place both subjects inside a bright modern classroom while preserving their exact poses: a large whiteboard with faint educational writing, wooden desks in the background, soft warm daylight through windows, education photobooth aesthetic.",
      },
      {
        id: "first_day_frame",
        label: "First Day of School Frame",
        prompt:
          "Place both subjects inside a warm classroom while preserving their exact poses: a decorative 'First Day of School' photo frame or banner softly visible in the background, colorful classroom decorations, cheerful natural lighting.",
      },
      {
        id: "desks",
        label: "Desks Row",
        prompt:
          "Place both subjects standing between rows of classroom desks while preserving their exact poses: bookshelves and a chalkboard blurred in the background, warm daylight, cozy classic classroom feel.",
      },
    ],
  },

  schoolyard: {
    label: "School Yard",
    options: [
      {
        id: "football_yard",
        label: "Football Yard",
        prompt:
          "Place both subjects outdoors on a school football yard at golden-hour sunset while preserving their exact poses: goalposts and blurred school building in the background, warm backlight sun flare, nostalgic orange tones.",
      },
      {
        id: "playground",
        label: "Playground",
        prompt:
          "Place both subjects outdoors in a school playground while preserving their exact poses: swings and slides softly blurred in the background, bright cheerful daylight, playful energetic atmosphere.",
      },
      {
        id: "garden",
        label: "Garden",
        prompt:
          "Place both subjects outdoors in a lush school garden while preserving their exact poses: green trees, flower beds, and a stone pathway in the background, soft natural sunlight, calm and fresh atmosphere.",
      },
    ],
  },

  labroom: {
    label: "Lab Room",
    options: [
      {
        id: "microscope",
        label: "Microscope Bench",
        prompt:
          "Place both subjects inside a science lab room while preserving their exact poses: a microscope and lab notebooks on the bench, blurred lab equipment in the background, bright clean lighting.",
      },
      {
        id: "chemical_tubes",
        label: "Chemical Tubes",
        prompt:
          "Place both subjects inside a science lab room while preserving their exact poses: glass beakers and test tubes with amber and blue liquid on the bench, blurred science posters in the background, bright clean lighting.",
      },
      {
        id: "lab_equipment",
        label: "General Lab Equipment",
        prompt:
          "Place both subjects inside a modern science lab while preserving their exact poses: shelves of lab equipment, safety goggles, and a periodic table chart blurred in the background, bright clinical lighting.",
      },
    ],
  },

  library: {
    label: "Library",
    options: [
      {
        id: "bookshelves",
        label: "Bookshelves Aisle",
        prompt:
          "Place both subjects standing in a long modern library aisle while preserving their exact poses: tall wooden bookshelves lining both sides, warm overhead lamps, deep symmetrical perspective.",
      },
      {
        id: "computers",
        label: "Computer Area",
        prompt:
          "Place both subjects inside a modern library computer area while preserving their exact poses: rows of computer desks and soft screen glow blurred in the background, warm ambient lighting.",
      },
      {
        id: "reading_table",
        label: "Reading Table",
        prompt:
          "Place both subjects seated or standing near a library reading table stacked with books while preserving their exact poses: bookshelves blurred in the background, warm cozy lamp lighting.",
      },
    ],
  },

  graduation: {
    label: "Graduation",
    options: [
      {
        id: "school_building",
        label: "School Building",
        prompt:
          "Place both subjects in front of a school building during a graduation celebration while preserving their exact poses: soft bokeh of the building facade and balloons in the background, warm festive lighting.",
      },
      {
        id: "theater",
        label: "Theater",
        prompt:
          "Place both subjects on a graduation ceremony theater stage while preserving their exact poses: stage curtains and soft spotlight glow in the background, warm celebratory mood.",
      },
      {
        id: "crowd_celebration",
        label: "Crowd Celebration",
        prompt:
          "Place both subjects in a celebratory graduation ceremony while preserving their exact poses: soft bokeh crowd background, floating graduation cap and confetti in the air, warm festive lighting, joyful mood.",
      },
    ],
  },
};

// Map normalized keys to handle hyphens ("school-yard" -> "schoolyard", "lab-room" -> "labroom")
export function normalizeLocationKey(key: string): LocationKey | null {
  const clean = key.toLowerCase().replace(/[-_\s]/g, "");
  if (clean === "trip") return "trip";
  if (clean === "classroom") return "classroom";
  if (clean === "schoolyard" || clean === "school") return "schoolyard";
  if (clean === "labroom" || clean === "lab") return "labroom";
  if (clean === "library") return "library";
  if (clean === "graduation") return "graduation";
  return null;
}

// In-memory tracker to prevent consecutive repeated scenes for the same category
const lastPickedHistory = new Map<LocationKey, number>();

export function getRandomBackground(
  category: string,
  specificId?: string,
): BackgroundOption {
  const normKey = normalizeLocationKey(category);
  if (!normKey || !LOCATION_PROMPTS[normKey]) {
    throw new Error(`Unknown location category: ${category}`);
  }

  const categoryData = LOCATION_PROMPTS[normKey];
  const options = categoryData.options;

  // If a specific sub-scene ID is requested, use it directly
  if (specificId) {
    const specific = options.find(
      (opt) => opt.id.toLowerCase() === specificId.toLowerCase(),
    );
    if (specific) return specific;
  }

  // Smart random: avoid picking the exact same scene twice consecutively
  const lastIndex = lastPickedHistory.get(normKey);
  let chosenIndex: number;

  if (options.length > 1 && lastIndex !== undefined) {
    const candidateIndices = options.map((_, i) => i).filter((i) => i !== lastIndex);
    chosenIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
  } else {
    chosenIndex = Math.floor(Math.random() * options.length);
  }

  lastPickedHistory.set(normKey, chosenIndex);
  return options[chosenIndex];
}

function buildBackgroundPrompt(background: BackgroundOption): string {
  return `You are a professional photo editor. You are given a real photo of two people whose ages have ALREADY been edited in a previous step. Do not generate a new image from scratch — edit the actual uploaded photo.

TASK — BACKGROUND REPLACEMENT ONLY (this is the ONLY task in this step):
- Do NOT change either person's face, age, body, or clothing in any way. Keep both people pixel-for-pixel as close to identical as possible — only their surroundings change.
- Remove the original background and replace it with:
${background.prompt}
- Naturally composite both subjects into the new scene with matching light direction, color temperature, and shadows.
- Maintain their exact relative positions (left/right placement) and any physical contact (hand-holding, hugging, arm-around-shoulder).
- Output style: photorealistic, cinematic warm tones, sharp faces, 4K quality.
- FORBIDDEN: text, watermarks, logos, extra limbs, extra people, blurry faces, deformed hands.`;
}

// ─── Single Gemini image-edit call ─────────────────────────────────────────
// Both pipeline steps (age transform, then background swap) go through this
// same helper — it sends one image + one instruction and returns one image.

async function editImageWithGemini(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  promptText: string,
): Promise<{ data: string; mimeType: string } | null> {
  const imagePart = {
    inlineData: {
      mimeType,
      data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
    },
  };

  const response = (await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [imagePart, { text: promptText }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    },
  )) as GeminiHttpResponse;

  let payload: Awaited<ReturnType<GeminiHttpResponse["json"]>>;
  try {
    payload = await response.json();
  } catch {
    console.warn("[Gemini] Empty or invalid response, status:", response.status);
    return null;
  }

  if (!response.ok) {
    console.warn("[Gemini] Request failed:", response.status, payload.error?.message);
    return null;
  }

  const generatedPart = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => part.inlineData?.data);

  if (!generatedPart?.inlineData?.data) {
    console.warn("[Gemini] No image part in response");
    return null;
  }

  return {
    data: generatedPart.inlineData.data,
    mimeType: generatedPart.inlineData.mimeType ?? "image/png",
  };
}

router.post(
  "/memory/generate",
  async (req: MemoryRequest, res: MemoryResponse) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: "Gemini API key is not configured. Add GEMINI_API_KEY to continue.",
      });
      return;
    }

    const {
      imageBase64,
      mimeType = "image/jpeg",
      experience,
      location,
      backgroundId,
      subLocation,
    } = req.body ?? {};

    if (!imageBase64) {
      res.status(400).json({ error: "Missing source photo." });
      return;
    }

    if (!experience || !location) {
      res.status(400).json({ error: "Choose an experience and a location first." });
      return;
    }

    const normLocation = normalizeLocationKey(location);
    if (!EXPERIENCE_PROMPTS[experience] || !normLocation) {
      res.status(400).json({ error: "Invalid experience or location choice." });
      return;
    }

    const background = getRandomBackground(location, backgroundId || subLocation);
    console.log(
      `[Memory Generate] Category: "${location}" -> Selected Scene: [${background.id}] "${background.label}"`,
    );

    try {
      // ── Step 1: age transformation only, background untouched ──────────
      console.log("[Pipeline] Step 1/2: age transformation");
      const ageResult = await editImageWithGemini(
        apiKey,
        imageBase64,
        mimeType,
        EXPERIENCE_PROMPTS[experience],
      );

      if (!ageResult) {
        res.status(502).json({
          error: "Nano Banana could not perform the age transformation.",
        });
        return;
      }

      // ── Step 2: background swap on the already-aged image ──────────────
      console.log("[Pipeline] Step 2/2: background replacement");
      const finalResult = await editImageWithGemini(
        apiKey,
        ageResult.data,
        ageResult.mimeType,
        buildBackgroundPrompt(background),
      );

      // If the background step fails for any reason, still return the
      // age-transformed image rather than nothing — it's the harder, more
      // important part of the task, so a partial success beats a total one.
      const output = finalResult ?? ageResult;
      if (!finalResult) {
        console.warn("[Pipeline] Background step failed, returning age-only result");
      }

      res.json({
        imageBase64: output.data,
        mimeType: output.mimeType,
        background: {
          category: location,
          id: background.id,
          label: background.label,
        },
        backgroundApplied: Boolean(finalResult),
      });
    } catch (error) {
      req.log?.error({ err: error }, "Unexpected image generation error");
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unknown generation service error.";
      res.status(502).json({ error: `Generation service error: ${message}` });
    }
  },
);

router.post("/memory/upload", async (req: MemoryRequest, res: MemoryResponse) => {
  try {
    const { imageBase64 } = req.body ?? {};
    if (!imageBase64) {
      res.status(400).json({ error: "Missing image data." });
      return;
    }
    const data = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "IMGBB_API_KEY is not configured." });
      return;
    }

    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("image", data);

    const uploadRes: any = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData as any,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload failed with status ${uploadRes.status}`);
    }

    const jsonRes = await uploadRes.json();
    if (!jsonRes.data || !jsonRes.data.url) {
      throw new Error("Invalid response from ImgBB");
    }

    res.json({ url: jsonRes.data.url });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to upload image to ImgBB");
    res.status(502).json({ error: "Could not upload image for QR code." });
  }
});

export default router;