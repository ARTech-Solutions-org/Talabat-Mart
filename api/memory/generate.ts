export const config = {
  api: {
    bodyParser: false,
  },
};

type VercelRequest = {
  url?: string;
  [key: string]: unknown;
};

let expressHandler: any = null;

export default async function handler(req: VercelRequest, res: any) {
  try {
    if (!expressHandler) {
      const appModule = await import("../../artifacts/api-server/src/app");
      expressHandler = appModule.default || appModule;
      if (typeof expressHandler !== "function") {
        throw new Error(`expressHandler is not a function, it is: ${typeof expressHandler}`);
      }
    }

    if (!req.url || req.url === "/" || req.url === "/memory/generate") {
      req.url = "/api/memory/generate";
    } else if (!req.url.startsWith("/api")) {
      req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
    }

    return expressHandler(req, res);
  } catch (error: any) {
    res.status(500).json({
      error: `Vercel Startup Error: ${error.message ?? String(error)}`,
    });
  }
}