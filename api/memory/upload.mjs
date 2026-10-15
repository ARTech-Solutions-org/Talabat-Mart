import fs from 'node:fs';
import path from 'node:path';

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
    maxDuration: 60,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64 } = req.body ?? {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing image data.' });
  }

  const data = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '').replace(/^data:[^;]+;base64,/, '');

  // 1. If running on Vercel or IMGBB_API_KEY is provided, try ImgBB
  const imgbbKey = process.env.IMGBB_API_KEY;
  if (imgbbKey) {
    try {
      const formData = new FormData();
      formData.append('key', imgbbKey);
      formData.append('image', data);

      const uploadRes = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await uploadRes.json();
      if (uploadRes.ok && json.data?.url) {
        console.log('[upload.mjs] Uploaded to ImgBB:', json.data.url);
        return res.status(200).json({ url: json.data.url, success: true });
      }
      console.warn('[upload.mjs] ImgBB returned non-ok:', json);
    } catch (e) {
      console.warn('[upload.mjs] ImgBB upload failed:', e.message);
    }
  }

  // 2. Local filesystem storage (for local dev and local booth)
  try {
    const buffer = Buffer.from(data, 'base64');
    const uploadsDir = path.resolve(process.cwd(), 'artifacts/memory-booth/public/uploads');
    if (!fs.existsSync(uploadsDir)) {
      try {
        fs.mkdirSync(uploadsDir, { recursive: true });
      } catch (e) {}
    }

    const fileName = `memory_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const localFilePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(localFilePath, buffer);
    console.log('[upload.mjs] Saved locally to:', localFilePath);
    return res.status(200).json({
      url: `/uploads/${fileName}`,
      filename: fileName,
      success: true
    });
  } catch (fsErr) {
    console.warn('[upload.mjs] Local write failed:', fsErr.message);
  }

  return res.status(502).json({
    error: 'Upload failed: neither ImgBB nor local storage succeeded.'
  });
}
