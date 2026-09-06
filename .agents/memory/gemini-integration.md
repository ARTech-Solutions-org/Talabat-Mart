---
name: Gemini image generation access
description: How this project handles Nano Banana access when the managed AI integration is unavailable
---

The app uses a server-side `GEMINI_API_KEY` secret as the fallback for Nano Banana image generation when the managed Gemini integration cannot be provisioned.

**Why:** The managed integration can be blocked by workspace account limits; exposing the key in browser code would be unsafe.

**How to apply:** Keep Gemini calls behind the API server, never return or log the key, and preserve the prompt rules that lock the source pose, framing, and composition.