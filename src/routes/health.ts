import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});

export { healthRouter };

