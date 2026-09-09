import { Router } from "express";

const router = Router();

type GenerateMemoryBody = {
  imageBase64?: string;
  mimeType?: string;
  experience?: "younger" | "older";
  location?: "classroom" | "school-yard" | "lab-room" | "library" | "graduation" | "trip";
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

const BASE_PROMPT = `Using the uploaded photo as the exact identity reference for both people, regenerate a photorealistic image of the same two individuals.

CRITICAL SUBJECT IDENTIFICATION INSTRUCTION:
First, carefully analyze the two individuals in the uploaded reference photo:
- Person 1 (The older / more mature person): Look for more mature facial features, adult bone structure, facial hair/stubble, or older appearance. If both individuals are similar in age (e.g. friends, peers, or brothers), designate the person on the LEFT as Person 1.
- Person 2 (The younger / less mature person): Look for younger, more youthful, or child/teen facial features and smaller proportions. If both individuals are similar in age, designate the person on the RIGHT as Person 2.
- KEEP RELATIVE POSITIONS: Maintain Person 1 on the left and Person 2 on the right so identities are never swapped or confused.

IDENTITY PRESERVATION:
Preserve both individuals' exact facial identity, eye shape, nose, distinct features, skin tone, and hair texture so they remain 100% clearly recognizable as the same people. Keep their original clothing colors and style unless the scene requires a natural adjustment. Maintain a warm, cinematic, editorial photography look with soft natural lighting, sharp focus on both faces, and a joyful, genuine smile. Do not add any extra people. High detail, professional photo quality, 4K.`;

const EXPERIENCE_PROMPTS: Record<NonNullable<GenerateMemoryBody["experience"]>, string> = {
  younger: `AGE TRANSFORMATION — MAKE THE OLDER PERSON YOUNGER:
- For Person 1 (the older / adult subject, or person on the left): Visually de-age Person 1 by approximately 15–20 years. Give Person 1 smooth, youthful, radiant skin, darker/fuller hair without gray, and an energetic young-adult appearance (as if they traveled back in time to their youth) — WHILE STRICTLY PRESERVING their facial bone structure, eye shape, smile, and identity so they are unmistakably the younger version of themselves.
- For Person 2 (the younger / child subject, or person on the right): KEEP Person 2 at their EXACT same original age and facial features from the reference photo without aging them.
- Interaction: Both subjects now appear close in age like peers or young friends, interacting warmly and happily together in the scene.`,

  older: `AGE TRANSFORMATION — MAKE THE YOUNGER PERSON GROW UP:
- For Person 2 (the younger / child subject, or person on the right): Age Person 2 UP into an accomplished young adult / university graduate (approximately 20–24 years old). Give them mature adult facial proportions, adult height, and a confident adult demeanor — WHILE STRICTLY PRESERVING their core facial identity, eye shape, nose, smile, and distinct features matured naturally into adulthood.
- For Person 1 (the older / adult subject, or person on the left): Keep Person 1 clearly recognizable and proudly celebrating together (slightly refreshed and rejuvenated by 5–10 years so they look vibrant, proud, and energized).
- Interaction: Person 2 is now grown up standing proudly beside Person 1 as an accomplished adult graduate/peer, sharing a proud, celebratory milestone moment.`,
};

const LOCATION_PROMPTS: Record<NonNullable<GenerateMemoryBody["location"]>, string> = {
  classroom: `Place both subjects inside a bright modern classroom: orange accent wall, large whiteboard behind them, wooden desks and bookshelves, soft warm daylight streaming through a window, cozy education-brand aesthetic.`,

  "school-yard": `Place both subjects outdoors in a school yard at golden-hour sunset: school building and fence softly blurred in the background, warm backlit sun flare, basketball hoop visible, nostalgic warm orange tones.`,

  "lab-room": `Place both subjects in a science lab room: glass beakers and test tubes with amber liquid on the bench beside them, blurred lab equipment and posters in the background, bright clinical lighting mixed with warm accents.`,

  library: `Place both subjects standing in a long library aisle: tall orange bookshelves lining both sides, bright fluorescent ceiling lights, glossy reflective floor, deep symmetrical perspective toward the background.`,

  graduation: `Place both subjects in a graduation-ceremony atmosphere: soft bokeh crowd background, confetti and a graduation cap tossed in the air around them, celebratory warm lighting, festive joyful mood.`,

  trip: `Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset: pyramids silhouetted in the warm-toned desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

const NEGATIVE_PROMPT = `no extra people, no text overlays, no watermarks, no distorted faces, no unrealistic proportions`;

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

    const { imageBase64, mimeType = "image/jpeg", experience, location } =
      req.body ?? {};

    if (!experience || !location) {
      res.status(400).json({ error: "Choose an experience and a location first." });
      return;
    }

    const experiencePrompt = EXPERIENCE_PROMPTS[experience];
    const locationPrompt = LOCATION_PROMPTS[location];

    if (!experiencePrompt || !locationPrompt) {
      res.status(400).json({ error: "Invalid experience or location choice." });
      return;
    }

    const imagePart = imageBase64
      ? {
        inlineData: {
          mimeType,
          data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
        },
      }
      : null;

    // Combine the three prompt blocks as specified
    const prompt = [
      BASE_PROMPT,
      experiencePrompt,
      locationPrompt,
      `Negative: ${NEGATIVE_PROMPT}`,
    ].join("\n\n");

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