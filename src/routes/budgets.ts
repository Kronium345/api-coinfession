import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Budget } from "../models/Budget.js";

const budgetsRouter = Router();
budgetsRouter.use(requireAuth);

const upsertSchema = z.object({
  category: z.string().min(1),
  monthlyLimit: z.number().positive(),
  currency: z.string().min(1).max(8).optional(),
});

budgetsRouter.get("/", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const rows = await Budget.find({ clerkUserId }).sort({ displayCategory: 1 }).lean();
  return res.json(rows);
});

budgetsRouter.post("/", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const parsed = upsertSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload.", issues: parsed.error.flatten() });
  }
  const trimmed = parsed.data.category.trim();
  const categoryKey = trimmed.toLowerCase();
  const doc = await Budget.findOneAndUpdate(
    { clerkUserId, categoryKey },
    {
      $set: {
        clerkUserId,
        categoryKey,
        displayCategory: trimmed,
        monthlyLimit: parsed.data.monthlyLimit,
        currency: parsed.data.currency ?? "USD",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.status(201).json(doc);
});

budgetsRouter.delete("/:id", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const id = req.params.id;
  const result = await Budget.deleteOne({ _id: id, clerkUserId });
  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Budget not found." });
  }
  return res.json({ message: "Deleted." });
});

export { budgetsRouter };
