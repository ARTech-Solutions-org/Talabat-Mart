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

const BASE_PROMPT = `Using the uploaded photo as the exact identity reference for both people, regenerate a photorealistic image of the same two individuals — preserve their facial identity, unique features, skin tone, and hairstyle so they remain clearly recognizable as the same people. Keep their original clothing colors and style unless the scene requires a natural adjustment. Maintain a warm, cinematic, editorial photography look with soft natural lighting, sharp focus on both faces, and a joyful, affectionate interaction between the two subjects (natural pose, genuine smile). Do not add any extra people. High detail, professional photo quality, 4K.`;

const EXPERIENCE_PROMPTS: Record<NonNullable<GenerateMemoryBody["experience"]>, string> = {
  younger: `Age transformation: keep the child's apparent age exactly the same as in the original photo. Reduce the parent's apparent age by approximately 15–20 years — smoother skin, fuller and darker hair (remove gray if present), more youthful facial structure — while keeping the parent clearly recognizable as the same person (same face shape, eyes, nose, smile). The parent should now look youthful, energetic, close in age to a young adult, standing/sitting naturally next to the child.`,

  older: `Age transformation: age the child up to look like a young adult / recent graduate, approximately 20–24 years old — mature facial proportions, adult height and posture — while clearly preserving the child's original facial identity (same eyes, face shape, smile, hair color/texture, just matured). Simultaneously reduce the parent's apparent age by approximately 10–15 years — smoother skin, more youthful hair and posture — while keeping the parent clearly recognizable as the same person. The goal is for the two subjects to now appear close in age to each other, like siblings or peers, while still visibly being the same two people from the original photo.`,
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