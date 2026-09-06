import { Router, type Request, type Response } from "express";

const router = Router();

type GenerateMemoryBody = {
  imageBase64?: string;
  mimeType?: string;
  experience?: "younger" | "older";
  location?: "classroom" | "school-yard" | "reading-room" | "sunny-garden";
};

const experiencePrompts = {
  younger:
    "Make the parent look the same age as the child while keeping the parent's identity recognizable.",
  older:
    "Make the child look the same age as the parent while keeping the child's identity recognizable.",
} as const;

const locationPrompts = {
  classroom: "a warm, lived-in classroom with soft morning light and chalk details",
  "school-yard": "a sunny school yard with warm afternoon light and gentle greenery",
  "reading-room": "a cozy reading room with tall shelves and soft window light",
  "sunny-garden": "a bright family garden with natural greenery and golden light",
} as const;

router.post(
  "/memory/generate",
  async (req: Request<unknown, unknown, GenerateMemoryBody>, res: Response) => {
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

    const prompt = [
      "Edit this family photo into a believable keepsake memory.",
      experiencePrompts[experience],
      `Change the background to ${locationPrompts[location]}.`,
      "Non-negotiable edit rules:",
      "- Preserve the exact pose, body position, hand placement, camera angle, crop, composition, and framing.",
      "- Keep both people's facial identity, expression, clothing silhouette, and relationship recognizable.",
      "- Do not move, add, remove, duplicate, or reshape either person.",
      "- Change only the requested age story and the background.",
      "- Make the edit photorealistic, warm, natural, and family-safe.",
      "Return only the edited image.",
    ].join("\n");

    const parts = imagePart
      ? [{ text: prompt }, imagePart]
      : [{ text: `${prompt}\nThere is no source photo for this demo; create a warm illustrative sample with two people in a locked portrait composition.` }];

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
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
      );

      const payload = (await response.json()) as {
        error?: { message?: string };
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: { mimeType?: string; data?: string };
            }>;
          };
        }>;
      };

      if (!response.ok) {
        req.log.error(
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
        req.log.error("Gemini returned no image part");
        res.status(502).json({ error: "Nano Banana returned no image." });
        return;
      }

      res.json({
        imageBase64: generatedPart.inlineData.data,
        mimeType: generatedPart.inlineData.mimeType ?? "image/png",
      });
    } catch (error) {
      req.log.error({ err: error }, "Unexpected image generation error");
      res.status(502).json({ error: "The memory could not be generated right now." });
    }
  },
);

export default router;