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

const EXPERIENCE_PROMPTS: Record<NonNullable<GenerateMemoryBody["experience"]>, string> = {
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

const LOCATION_PROMPTS: Record<NonNullable<GenerateMemoryBody["location"]>, string> = {
  classroom: `Inside a bright, modern school classroom: an orange accent wall, a large whiteboard with math/science sketches, student wooden desks and tidy bookshelves, soft warm daylight streaming through large windows, education photobooth aesthetic.`,

  "school-yard": `Outdoors in a school yard at golden-hour sunset: a basketball court hoop, blurred school building and sports fence in the background, warm backlight sun flare, nostalgic autumn/orange tones.`,

  "lab-room": `Inside a science lab room: glass beakers and test tubes with amber and colorful liquids on the bench, blurred lab equipment and science posters in the background, bright clean lighting.`,

  library: `Inside a grand modern library aisle: tall wooden and orange bookshelves lining both sides, warm overhead lamps, reflective floor, deep symmetrical perspective.`,

  graduation: `At a university graduation ceremony: soft bokeh crowd background, floating graduation cap and celebratory confetti in the air, warm festive lighting, joyful celebratory mood.`,

  trip: `Outdoors on a desert travel adventure at the Giza Pyramids in Egypt during golden sunset: pyramids silhouetted in the warm desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

function buildPrompt(experience: NonNullable<GenerateMemoryBody["experience"]>, location: NonNullable<GenerateMemoryBody["location"]>) {
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

    if (!EXPERIENCE_PROMPTS[experience] || !LOCATION_PROMPTS[location]) {
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

    const prompt = buildPrompt(experience, location);

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