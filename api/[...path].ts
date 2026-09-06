import app from "../artifacts/api-server/src/app";

export default function handler(
  req: Parameters<typeof app>[0],
  res: Parameters<typeof app>[1],
) {
  // Vercel may pass the dynamic function path with or without the /api prefix.
  // The shared Express app mounts its router at /api, so normalize both forms.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
  }

  return app(req, res);
}