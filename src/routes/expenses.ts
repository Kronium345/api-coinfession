import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Expense } from "../models/Expense.js";

const expensesRouter = Router();

const manualExpenseSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  merchant: z.string().min(1),
  category: z.string().min(1),
  occurredAt: z.string().datetime(),
  notes: z.string().optional(),
});

expensesRouter.use(requireAuth);

expensesRouter.post("/manual", async (req, res) => {
  const parsed = manualExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload.", issues: parsed.error.flatten() });
  }

  const clerkUserId = req.auth!.clerkUserId;
  const created = await Expense.create({
    clerkUserId,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    merchant: parsed.data.merchant,
    category: parsed.data.category,
    occurredAt: new Date(parsed.data.occurredAt),
    sourceType: "manual",
    notes: parsed.data.notes ?? null,
  });

  return res.status(201).json(created);
});

expensesRouter.get("/", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const { startDate, endDate, limit = "50", page = "1" } = req.query;
  const parsedLimit = Math.min(200, Math.max(1, Number(limit)));
  const parsedPage = Math.max(1, Number(page));

  const filter: Record<string, unknown> = { clerkUserId };
  if (typeof startDate === "string" || typeof endDate === "string") {
    filter.occurredAt = {};
    if (typeof startDate === "string") {
      (filter.occurredAt as Record<string, Date>).$gte = new Date(startDate);
    }
    if (typeof endDate === "string") {
      (filter.occurredAt as Record<string, Date>).$lte = new Date(endDate);
    }
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

export { expensesRouter };

