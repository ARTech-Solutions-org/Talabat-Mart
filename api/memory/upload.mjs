import fs from 'node:fs';
import path from 'node:path';

function loadLocalEnv() {
  const envPaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env.local'),
    path.resolve(process.cwd(), '../../.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const fileContent = fs.readFileSync(envPath, 'utf8');
        for (const line of fileContent.split(/\r?\n/)) {
          const match = line.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)?\s*$/);
          if (match && !process.env[match[1]]) {
            let val = (match[2] || '').trim();
            val = val.replace(/^['"]|['"]$/g, '');
            process.env[match[1]] = val;
          }
        }
      } catch (e) {}
    }
  }
}
loadLocalEnv();

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

  loadLocalEnv();
  const imgbbKey = process.env.IMGBB_API_KEY;

  // 1. If IMGBB_API_KEY is configured directly, upload to ImgBB
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
      return res.status(502).json({ error: json?.error?.message || 'ImgBB upload failed' });
    } catch (e) {
      console.warn('[upload.mjs] ImgBB upload failed:', e.message);
      return res.status(502).json({ error: `ImgBB upload failed: ${e.message}` });
    }
  }

  // 2. If running locally without local IMGBB_API_KEY, forward to production Vercel which has IMGBB_API_KEY configured
  try {
    const forwardRes = await fetch('https://talabat-mart-photo-booth.vercel.app/api/memory/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    const forwardJson = await forwardRes.json();
    if (forwardRes.ok && forwardJson.url) {
      console.log('[upload.mjs] Uploaded to ImgBB via Vercel proxy:', forwardJson.url);
      return res.status(200).json(forwardJson);
    }
    return res.status(502).json({ error: forwardJson.error || 'Failed to upload to ImgBB via Vercel proxy.' });
  } catch (err) {
    return res.status(502).json({ error: 'IMGBB_API_KEY is not configured and fallback proxy failed.' });
  }
}
