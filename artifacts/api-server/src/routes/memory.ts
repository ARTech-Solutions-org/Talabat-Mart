import { Router } from "express";

const router = Router();

type GenerateMemoryBody = {
  imageBase64?: string;
  mimeType?: string;
  experience?: "younger" | "older";
  location?: "classroom" | "school-yard" | "reading-room" | "sunny-garden";
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

const experiencePrompts = {
  younger: {
    headline: "Imagine the parent as a child the same age as their child in this photo.",
    detail: [
      "Age down the PARENT/ADULT only: make their face, hair, skin, and body proportions look like they are the same young age as the child.",
      "The CHILD must remain completely unchanged — same age, same face, same size.",
      "Both people must still look like the same individuals — preserve facial features, hairstyle character, and relationship dynamic.",
    ],
  },
  older: {
    headline: "Imagine the child grown up to the same age as their parent in this photo.",
    detail: [
      "Age up the CHILD only: make their face, hair, skin, and body proportions look like they are the same adult age as the parent.",
      "The PARENT/ADULT must remain completely unchanged — same age, same face, same size.",
      "Both people must still look like the same individuals — preserve facial features, hairstyle character, and relationship dynamic.",
    ],
  },
} as const;

const locationPrompts = {
  classroom: "a warm, cozy Egyptian classroom from the 1990s — old wooden desks, a chalkboard covered in Arabic writing, soft dusty morning light through tall windows, a warm honey-yellow and tan color palette",
  "school-yard": "a sunny Egyptian school yard — bright afternoon sunlight, children playing in the background, trees casting dappled shade, warm amber and green tones",
  "reading-room": "an intimate reading room — tall wooden bookshelves lined with Arabic and English books, a small desk lamp casting warm golden light, dust motes in a soft beam of sunlight",
  "sunny-garden": "a lush home garden with bright natural sunlight — blooming flowers, green hedges, golden hour glow, soft shadows on the grass, warm and family-friendly",
} as const;

router.post(
  "/memory/generate",
  async (req: MemoryRequest, res: MemoryResponse) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: "Nano Banana is not configured. Add GEMINI_API_KEY to continue.",
      });
      return;
    }

    const { imageBase64, mimeType = "image/jpeg", experience, location } =
      req.body ?? {};

    if (!experience || !location) {
      res.status(400).json({ error: "Choose an experience and a location first." });
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

    const expPrompt = experiencePrompts[experience];
    const locPrompt = locationPrompts[location];

    const prompt = [
      "You are a professional photo editor creating a heartfelt keepsake memory photo.",
      "",
      `MEMORY EXPERIENCE: ${expPrompt.headline}`,
      ...expPrompt.detail.map(d => `- ${d}`),
      "",
      `BACKGROUND: Replace the background with ${locPrompt}.`,
      "",
      "STRICT NON-NEGOTIABLE RULES:",
      "- Preserve the EXACT pose, body position, hand placement, camera angle, crop, composition, and framing — do not alter these at all.",
      "- Do NOT move, add, remove, duplicate, flip, or reshape either person.",
      "- Do NOT change clothing, accessories, or any other aspect beyond what is specified above.",
      "- The result must be photorealistic, warm, natural, and family-safe.",
      "- Output ONLY the edited image with no extra text or commentary.",
    ].join("\n");


    const parts = imagePart
      ? [{ text: prompt }, imagePart]
      : [{ text: `${prompt}\nThere is no source photo for this demo; create a warm illustrative sample with two people in a locked portrait composition.` }];

    try {
      const response = (await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseModalities: ["IMAGE"],
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