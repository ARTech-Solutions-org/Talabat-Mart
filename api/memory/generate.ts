import app from "../../artifacts/api-server/src/app";

type VercelRequest = {
  url?: string;
  [key: string]: unknown;
};

type ExpressHandler = (req: VercelRequest, res: unknown) => unknown;
const expressHandler = app as unknown as ExpressHandler;

export default function handler(req: VercelRequest, res: unknown) {
  // The explicit Vercel route can receive either the original path or "/".
  if (!req.url || req.url === "/" || req.url === "/memory/generate") {
    req.url = "/api/memory/generate";
  } else if (!req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
  }

  return expressHandler(req, res);
}