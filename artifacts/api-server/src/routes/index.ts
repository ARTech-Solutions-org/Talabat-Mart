import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import memoryRouter from "./memory.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(memoryRouter);

export default router;
