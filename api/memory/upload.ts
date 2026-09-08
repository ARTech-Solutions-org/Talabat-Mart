// Vercel Serverless Function — /api/memory/upload
// Uploads image to ImgBB directly (no Express dependency)

declare const process: { env: Record<string, string | undefined> };

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "IMGBB_API_KEY is not configured." });
  }

  const { imageBase64 } = req.body ?? {};
  if (!imageBase64) {
    return res.status(400).json({ error: "Missing image data." });
  }

  // Strip data URL prefix if present
  const data = imageBase64.replace(/^data:[^;]+;base64,/, "");

  try {
    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("image", data);

    const uploadRes = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error(`ImgBB upload failed with status ${uploadRes.status}`);
    }

    const json: any = await uploadRes.json();
    if (!json.data?.url) {
      throw new Error("Invalid response from ImgBB");
    }

    return res.status(200).json({ url: json.data.url });
  } catch (err: any) {
    return res.status(502).json({ error: `Upload failed: ${err.message}` });
  }
}