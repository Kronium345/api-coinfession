import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { Expense } from "../models/Expense.js";
import { Budget } from "../models/Budget.js";

export type CategoryTotal = { category: string; total: number };
export type MerchantTotal = { merchant: string; total: number; count: number };

export type CashflowSummary = {
  monthLabel: string;
  monthStart: string;
  monthEnd: string;
  currentMonthTotal: number;
  previousMonthTotal: number;
  monthOverMonthPercent: number | null;
  categoryTotals: CategoryTotal[];
  topMerchants: MerchantTotal[];
};

export type BudgetStatus = {
  id: string;
  category: string;
  monthlyLimit: number;
  currency: string;
  spent: number;
  remaining: number;
  status: "ok" | "warning" | "over";
};

function sumAbs(items: Array<{ amount: number }>) {
  return items.reduce((total, item) => total + Math.abs(item.amount), 0);
}

export async function buildCashflowSummary(clerkUserId: string): Promise<CashflowSummary> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const previousStart = startOfMonth(subMonths(now, 1));
  const previousEnd = endOfMonth(subMonths(now, 1));

  const [currentMonth, previousMonth] = await Promise.all([
    Expense.find({
      clerkUserId,
      occurredAt: { $gte: monthStart, $lte: monthEnd },
    }).lean(),
    Expense.find({
      clerkUserId,
      occurredAt: { $gte: previousStart, $lte: previousEnd },
    }).lean(),
  ]);

  const currentMonthTotal = sumAbs(currentMonth);
  const previousMonthTotal = sumAbs(previousMonth);
  const monthOverMonthPercent =
    previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : null;

  const categoryBuckets = new Map<string, number>();
  for (const item of currentMonth) {
    const key = item.category;
    categoryBuckets.set(key, (categoryBuckets.get(key) ?? 0) + Math.abs(item.amount));
  }
  const categoryTotals: CategoryTotal[] = Array.from(categoryBuckets.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const merchantAgg = new Map<string, { total: number; count: number; display: string }>();
  for (const item of currentMonth) {
    const key = item.merchant.trim().toLowerCase();
    const cur = merchantAgg.get(key) ?? {
      total: 0,
      count: 0,
      display: item.merchant.trim(),
    };
    cur.total += Math.abs(item.amount);
    cur.count += 1;
    merchantAgg.set(key, cur);
  }
  const topMerchants: MerchantTotal[] = Array.from(merchantAgg.values())
    .map((v) => ({ merchant: v.display, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return {
    monthLabel: monthStart.toISOString().slice(0, 7),
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
    currentMonthTotal,
    previousMonthTotal,
    monthOverMonthPercent,
    categoryTotals,
    topMerchants,
  };
}

export async function buildBudgetStatuses(
  clerkUserId: string,
  categoryTotals: CategoryTotal[]
): Promise<BudgetStatus[]> {
  const rules = await Budget.find({ clerkUserId }).sort({ categoryKey: 1 }).lean();
  const spentByCategory = new Map(categoryTotals.map((c) => [c.category.toLowerCase(), c.total]));

  return rules.map((rule) => {
    const spent = spentByCategory.get(rule.categoryKey.toLowerCase()) ?? 0;
    const remaining = rule.monthlyLimit - spent;
    let status: BudgetStatus["status"] = "ok";
    if (spent >= rule.monthlyLimit) {
      status = "over";
    } else if (rule.monthlyLimit > 0 && spent >= rule.monthlyLimit * 0.8) {
      status = "warning";
    }
    return {
      id: String(rule._id),
      category: rule.displayCategory,
      monthlyLimit: rule.monthlyLimit,
      currency: rule.currency,
      spent,
      remaining,
      status,
    };
  });
}
