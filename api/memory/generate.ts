// Vercel Serverless Function — /api/memory/generate
// Calls Gemini image generation directly (no Express dependency)

declare const process: { env: Record<string, string | undefined> };

export const config = { maxDuration: 60 };

const BASE_PROMPT = `Using the uploaded photo as the exact identity reference for both people, regenerate a photorealistic image of the same two individuals — preserve their facial identity, unique features, skin tone, and hairstyle so they remain clearly recognizable as the same people. Keep their original clothing colors and style unless the scene requires a natural adjustment. Maintain a warm, cinematic, editorial photography look with soft natural lighting, sharp focus on both faces, and a joyful, affectionate interaction between the two subjects (natural pose, genuine smile). Do not add any extra people. High detail, professional photo quality, 4K.`;

const EXPERIENCE_PROMPTS: Record<string, string> = {
  younger: `Age transformation: keep the child's apparent age exactly the same as in the original photo. Reduce the parent's apparent age by approximately 15–20 years — smoother skin, fuller and darker hair (remove gray if present), more youthful facial structure — while keeping the parent clearly recognizable as the same person (same face shape, eyes, nose, smile). The parent should now look youthful, energetic, close in age to a young adult, standing/sitting naturally next to the child.`,
  older: `Age transformation: age the child up to look like a young adult / recent graduate, approximately 20–24 years old — mature facial proportions, adult height and posture — while clearly preserving the child's original facial identity (same eyes, face shape, smile, hair color/texture, just matured). Simultaneously reduce the parent's apparent age by approximately 10–15 years — smoother skin, more youthful hair and posture — while keeping the parent clearly recognizable as the same person. The goal is for the two subjects to now appear close in age to each other, like siblings or peers, while still visibly being the same two people from the original photo.`,
};

const LOCATION_PROMPTS: Record<string, string> = {
  classroom: `Place both subjects inside a bright modern classroom: orange accent wall, large whiteboard behind them, wooden desks and bookshelves, soft warm daylight streaming through a window, cozy education-brand aesthetic.`,
  "school-yard": `Place both subjects outdoors in a school yard at golden-hour sunset: school building and fence softly blurred in the background, warm backlit sun flare, basketball hoop visible, nostalgic warm orange tones.`,
  "lab-room": `Place both subjects in a science lab room: glass beakers and test tubes with amber liquid on the bench beside them, blurred lab equipment and posters in the background, bright clinical lighting mixed with warm accents.`,
  library: `Place both subjects standing in a long library aisle: tall orange bookshelves lining both sides, bright fluorescent ceiling lights, glossy reflective floor, deep symmetrical perspective toward the background.`,
  graduation: `Place both subjects in a graduation-ceremony atmosphere: soft bokeh crowd background, confetti and a graduation cap tossed in the air around them, celebratory warm lighting, festive joyful mood.`,
  trip: `Place both subjects outdoors at the Giza Pyramids in Egypt during golden sunset: pyramids silhouetted in the warm-toned desert background, soft sand foreground, travel-photography look with warm orange/brown color grading.`,
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "GEMINI_API_KEY is not configured." });
  }

  const { imageBase64, mimeType = "image/jpeg", experience, location } = req.body ?? {};

  if (!experience || !location) {
    return res.status(400).json({ error: "Choose an experience and a location first." });
  }

  const experiencePrompt = EXPERIENCE_PROMPTS[experience];
  const locationPrompt = LOCATION_PROMPTS[location];

  if (!experiencePrompt || !locationPrompt) {
    return res.status(400).json({ error: "Invalid experience or location choice." });
  }

  const prompt = [
    BASE_PROMPT,
    experiencePrompt,
    locationPrompt,
    "Negative: no extra people, no text overlays, no watermarks, no distorted faces, no unrealistic proportions",
  ].join("\n\n");

  const imagePart = imageBase64
    ? { inlineData: { mimeType, data: imageBase64.replace(/^data:[^;]+;base64,/, "") } }
    : null;

  const parts = imagePart
    ? [imagePart, { text: prompt }]
    : [{ text: prompt }];

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      }
    );

    const payload: any = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: payload?.error?.message ?? `Gemini error ${response.status}`,
      });
    }

    const generatedPart = payload.candidates
      ?.flatMap((c: any) => c.content?.parts ?? [])
      .find((p: any) => p.inlineData?.data);

    if (!generatedPart?.inlineData?.data) {
      return res.status(502).json({ error: "Gemini returned no image." });
    }

    return res.status(200).json({
      imageBase64: generatedPart.inlineData.data,
      mimeType: generatedPart.inlineData.mimeType ?? "image/png",
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}