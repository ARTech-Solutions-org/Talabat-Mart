import { Router } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

type JsonResponse = {
  json: (body: unknown) => void;
};

const router = Router();

router.get("/healthz", (_req: unknown, res: JsonResponse) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
