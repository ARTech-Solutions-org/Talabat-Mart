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

const LOCATION_PROMPTS: Record<NonNullable<GenerateMemoryBody["location"]>, string> = {
  classroom: `Place both subjects inside a bright modern classroom while preserving their exact poses: an orange feature wall, a large whiteboard, wooden desks and bookshelves, soft warm daylight streaming through large windows, education photobooth aesthetic.`,
  "school-yard": `Place both subjects outdoors in a school yard at golden-hour sunset while preserving their exact poses: a basketball court hoop, blurred school building and sports fence in the background, warm backlight sun flare, nostalgic autumn/orange tones.`,
  "lab-room": `Place both subjects inside a science lab room while preserving their exact poses: glass beakers and test tubes with amber liquid on the bench, blurred lab equipment and science posters in the background, bright clean lighting.`,
  library: `Place both subjects standing in a long modern library aisle while preserving their exact poses: tall wooden and orange bookshelves lining both sides, warm overhead lamps, reflective floor, deep symmetrical perspective.`,
  graduation: `Place both subjects in a celebratory graduation ceremony while preserving their exact poses: soft bokeh crowd background, floating graduation cap and celebratory confetti in the air, warm festive lighting, joyful celebratory mood.`,
  trip: `Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset while preserving their exact poses: pyramids silhouetted in the warm desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

function buildPrompt(experience: NonNullable<GenerateMemoryBody["experience"]>, location: NonNullable<GenerateMemoryBody["location"]>) {
  const expText = EXPERIENCE_PROMPTS[experience];
  const locText = LOCATION_PROMPTS[location];

  return `Using the uploaded photo as the exact reference for both people, generate a photorealistic image that transports both individuals into a new background with an age transformation while preserving their exact poses and facial identities:

1. CRITICAL POSE, COMPOSITION & IDENTITY PRESERVATION:
- STRICTLY PRESERVE the exact pose, body posture, gestures, arm/hand placement, head tilt, and physical orientation of both individuals from the uploaded photo.
- Maintain their exact positions relative to each other (who is on the left and who is on the right, how they stand or sit, their spatial relationship and physical contact).
- Do NOT alter their poses or invent new body positions. The framing, camera angle, and physical postures must match the original photo.
- PRESERVE facial identity, unique facial features, skin tone, eye shape, nose shape, and distinct smile so they remain 100% immediately recognizable as the same people. Do NOT generate generic or random faces.

2. BACKGROUND REPLACEMENT:
- Replace the original background completely with this new setting:
${locText}
- Integrate both subjects naturally into this new environment with realistic contact lighting and shadows, while keeping their exact poses and interaction.

3. ${expText}

- Style: Warm, cinematic editorial photography, natural lighting, sharp focus on both faces, genuine expressions matching the original photo. High detail, 4K quality.
- Negative constraints: generic random children, completely different poses, altered body postures, swapped positions, repositioned arms or hands, unrecognizable people, extra people, text overlays, watermarks, distorted faces, unrealistic proportions, extra limbs, deformed fingers.`;
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