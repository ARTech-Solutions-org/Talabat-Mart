import app from "../artifacts/api-server/src/app";

type VercelRequest = {
  url?: string;
  [key: string]: unknown;
};

type ExpressHandler = (req: VercelRequest, res: unknown) => unknown;
const expressHandler = app as unknown as ExpressHandler;

export default function handler(
  req: VercelRequest,
  res: unknown,
) {
  // Vercel may pass the dynamic function path with or without the /api prefix.
  // The shared Express app mounts its router at /api, so normalize both forms.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
  }

  return expressHandler(req, res);
}