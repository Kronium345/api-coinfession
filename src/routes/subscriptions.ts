import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Subscription } from "../models/Subscription.js";

const subscriptionsRouter = Router();

const createSubscriptionSchema = z.object({
  name: z.string().min(1),
  plan: z.string().optional(),
  category: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.string().default("active"),
  startDate: z.string().datetime().optional(),
  price: z.number().positive(),
  currency: z.string().default("USD"),
  billing: z.string().min(1),
  renewalDate: z.string().datetime().optional(),
  color: z.string().optional(),
});

subscriptionsRouter.use(requireAuth);

subscriptionsRouter.get("/", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const items = await Subscription.find({ clerkUserId }).sort({ createdAt: -1 }).lean();
  res.json(items);
});

subscriptionsRouter.post("/", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const parsed = createSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload.", issues: parsed.error.flatten() });
  }

  const created = await Subscription.create({
    clerkUserId,
    ...parsed.data,
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    renewalDate: parsed.data.renewalDate ? new Date(parsed.data.renewalDate) : null,
  });
  return res.status(201).json(created);
});

export { subscriptionsRouter };

