// Vercel Serverless Function — /api/memory/upload (ESM .mjs)

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

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    console.error('IMGBB_API_KEY is not set in environment variables');
    return res.status(503).json({ error: 'IMGBB_API_KEY is not configured on server.' });
  }

  const { imageBase64 } = req.body ?? {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing image data.' });
  }

  const data = imageBase64.replace(/^data:[^;]+;base64,/, '');

  try {
    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', data);

    const uploadRes = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    const json = await uploadRes.json();

    if (!uploadRes.ok || !json.data?.url) {
      const errMsg = json?.error?.message || `ImgBB HTTP ${uploadRes.status}`;
      console.error('ImgBB upload error:', errMsg, json);
      return res.status(502).json({ error: `Upload failed: ${errMsg}` });
    }

    return res.status(200).json({ url: json.data.url });
  } catch (err) {
    console.error('ImgBB exception:', err);
    return res.status(500).json({ error: `Upload error: ${err.message}` });
  }
}
