import { Router, type IRouter } from "express";
import healthRouter from "./health";
import autohealRouter from "./autoheal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(autohealRouter);

export default router;
