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

const EXPERIENCE_PROMPTS: Record<NonNullable<GenerateMemoryBody["experience"]>, string> = {
  younger: `THIS IS PRIMARILY AN AGE TRANSFORMATION TASK — DE-AGE THE PARENT INTO A CHILD:
- The MOST IMPORTANT goal is to transform the adult parent's appearance into a 10–12 year old child. This transformation MUST be clearly visible and dramatic — not subtle.
- Identify who is the adult parent (larger, adult facial structure, possibly has beard/stubble or mature features) and who is the child.
- PARENT TRANSFORMATION (MANDATORY — this is the main task):
  * Completely transform the parent into a believable, photorealistic 10–12 year old child version of themselves.
  * Remove ALL adult facial features: beard, stubble, wrinkles, adult jawline. Replace with smooth youthful skin, rounder face, smaller nose, larger-looking eyes typical of a child.
  * Shrink their body proportions to a child's size — shorter, slimmer arms and legs, smaller hands.
  * Hair should look like a schoolchild's hairstyle.
  * The result must look like a REAL 10–12 year old child, not an adult with a younger face.
- CHILD IN PHOTO: Keep the child at their exact same age and appearance — do NOT change them.
- POSE: After the transformation, both now appear as two school-age kids. Keep their relative positions and physical interaction (hugging, standing close, etc.) but naturally adapt the body sizes.`,

  older: `THIS IS PRIMARILY AN AGE TRANSFORMATION TASK — AGE UP THE CHILD INTO A YOUNG ADULT:
- The MOST IMPORTANT goal is to transform the child's appearance into a 20–24 year old young adult / university graduate. This transformation MUST be clearly visible and dramatic — not subtle.
- Identify who is the child (smaller, younger facial features) and who is the adult parent.
- CHILD TRANSFORMATION (MANDATORY — this is the main task):
  * Completely transform the child into a photorealistic 20–24 year old young adult version of themselves.
  * Add adult facial features: defined jawline, mature facial proportions, adult height and build.
  * The child should now be as tall as or taller than the parent, with an adult physique.
  * They may wear a graduation gown or smart casual clothing befitting a young graduate.
  * The result must look like a REAL young adult, not a child with a slightly older face.
- PARENT IN PHOTO: Keep the parent at their exact current age and appearance — do NOT change them.
- POSE: After the transformation, they appear as a proud parent standing with their grown-up child. Keep their relative closeness and interaction naturally adapted to their new adult sizes.`,
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

function buildPrompt(
  experience: NonNullable<GenerateMemoryBody["experience"]>,
  location: string,
  specificBackgroundId?: string,
): { prompt: string; background: BackgroundOption } {
  const expText = EXPERIENCE_PROMPTS[experience];
  const background = getRandomBackground(location, specificBackgroundId);

  const prompt = `You are given a reference photo of two people. Your task has TWO parts — perform BOTH:

PART 1 — AGE TRANSFORMATION (PRIMARY TASK — do this first and make it clearly visible):
${expText}

PART 2 — BACKGROUND REPLACEMENT (SECONDARY TASK — after transformation):
Replace the original background completely with this new setting:
${background.prompt}
Integrate both subjects naturally into this new environment with realistic lighting and shadows.

CRITICAL RULES FOR BOTH PARTS:
- The age transformation in Part 1 MUST be dramatic and obvious — if someone compares the output to the original photo, the transformed person must look clearly younger/older, not the same.
- PRESERVE facial identity and unique features of each person so they remain recognizable as themselves (just at a different age).
- Maintain their relative positions and physical interaction (who is on which side, their closeness, any physical contact).
- Style: Warm, cinematic photorealistic photography, sharp focus on both faces, natural lighting, 4K quality.
- Do NOT add: text overlays, watermarks, extra people, distorted faces, extra limbs, deformed hands.`;

  return { prompt, background };
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

    if (!experience || !location) {
      res.status(400).json({ error: "Choose an experience and a location first." });
      return;
    }

    const normLocation = normalizeLocationKey(location);
    if (!EXPERIENCE_PROMPTS[experience] || !normLocation) {
      res.status(400).json({ error: "Invalid experience or location choice." });
      return;
    }

    const { prompt, background } = buildPrompt(
      experience,
      location,
      backgroundId || subLocation,
    );
    console.log(
      `[Memory Generate] Category: "${location}" -> Selected Scene: [${background.id}] "${background.label}"`,
    );

    const imagePart = imageBase64
      ? {
        inlineData: {
          mimeType,
          data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
        },
      }
      : null;

    const parts = imagePart
      ? [imagePart, { text: prompt }]
      : [{ text: `${prompt}\nThere is no source photo for this demo; create a warm illustrative sample with two people in a locked portrait composition.` }];

    try {
      const response = (await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
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
        req.log?.error(
          { status: response.status },
          "Gemini returned an empty or invalid response",
        );
        res.status(502).json({
          error: `Gemini returned an invalid response (HTTP ${response.status}).`,
        });
        return;
      }

      if (!response.ok) {
        req.log?.error(
          { status: response.status, message: payload.error?.message },
          "Gemini image generation failed",
        );
        res.status(502).json({
          error: payload.error?.message ?? "Nano Banana could not generate the memory.",
        });
        return;
      }

      const generatedPart = payload.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        .find((part) => part.inlineData?.data);

      if (!generatedPart?.inlineData?.data) {
        req.log?.error("Gemini returned no image part");
        res.status(502).json({ error: "Nano Banana returned no image." });
        return;
      }

      res.json({
        imageBase64: generatedPart.inlineData.data,
        mimeType: generatedPart.inlineData.mimeType ?? "image/png",
        background: {
          category: location,
          id: background.id,
          label: background.label,
        },
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
    const buffer = Buffer.from(data, "base64");
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