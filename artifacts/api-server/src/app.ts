import express from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app = express();

const pinoHttpFn = (pinoHttpModule as any).default || pinoHttpModule;
app.use(
  pinoHttpFn({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler to ensure JSON responses instead of HTML for 500s
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express global error:", err);
  res.status(500).json({
    error: `Internal Server Error: ${err?.message ?? String(err)}`,
  });
});

export default app;
