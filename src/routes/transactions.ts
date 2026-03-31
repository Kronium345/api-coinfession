import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Expense } from "../models/Expense.js";

const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

transactionsRouter.get("/", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const { limit = "100", page = "1", sourceType } = req.query;
  const parsedLimit = Math.min(500, Math.max(1, Number(limit)));
  const parsedPage = Math.max(1, Number(page));
  const filter: Record<string, unknown> = { clerkUserId };

  if (typeof sourceType === "string" && sourceType.length > 0) {
    filter.sourceType = sourceType;
  }

  const [items, total] = await Promise.all([
    Expense.find(filter)
      .sort({ occurredAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean(),
    Expense.countDocuments(filter),
  ]);

  return res.json({
    items,
    page: parsedPage,
    limit: parsedLimit,
    total,
    totalPages: Math.ceil(total / parsedLimit),
  });
});

export { transactionsRouter };

