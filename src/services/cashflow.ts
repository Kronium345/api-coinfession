import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { Expense } from "../models/Expense.js";
import { Budget } from "../models/Budget.js";

export type CategoryTotal = { category: string; total: number; currency: string };
export type MerchantTotal = { merchant: string; total: number; count: number };

/** Current-month bank_sync totals grouped by Plaid Item (multi-account aggregation). */
export type LinkedAccountSpend = {
  itemId: string;
  institutionName: string;
  total: number;
  currency: string;
  transactionCount: number;
};

export type CashflowSummary = {
  monthLabel: string;
  monthStart: string;
  monthEnd: string;
  currentMonthTotal: number;
  previousMonthTotal: number;
  monthOverMonthPercent: number | null;
  /** Most common ISO currency in this month’s synced expenses (for display). */
  dominantCurrency: string;
  categoryTotals: CategoryTotal[];
  topMerchants: MerchantTotal[];
  linkedAccountSpend: LinkedAccountSpend[];
};

export type BudgetStatus = {
  id: string;
  category: string;
  monthlyLimit: number;
  currency: string;
  spent: number;
  /** ISO currency of bank-synced spend for this category this month (if any). */
  spendCurrency: string;
  remaining: number;
  status: "ok" | "warning" | "over";
};

function sumAbs(items: Array<{ amount: number }>) {
  return items.reduce((total, item) => total + Math.abs(item.amount), 0);
}

function dominantFromExpenses(items: Array<{ currency: string }>): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const c = (item.currency ?? "USD").toUpperCase();
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best = "USD";
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = c;
    }
  }
  return best;
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

  const categoryBuckets = new Map<string, { total: number; currencyCounts: Map<string, number> }>();
  for (const item of currentMonth) {
    const key = item.category;
    const bucket = categoryBuckets.get(key) ?? { total: 0, currencyCounts: new Map<string, number>() };
    bucket.total += Math.abs(item.amount);
    const cur = (item.currency ?? "USD").toUpperCase();
    bucket.currencyCounts.set(cur, (bucket.currencyCounts.get(cur) ?? 0) + 1);
    categoryBuckets.set(key, bucket);
  }
  const categoryTotals: CategoryTotal[] = Array.from(categoryBuckets.entries())
    .map(([category, bucket]) => {
      let currency = "USD";
      let bestN = 0;
      for (const [c, n] of bucket.currencyCounts) {
        if (n > bestN) {
          bestN = n;
          currency = c;
        }
      }
      return { category, total: bucket.total, currency };
    })
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

  const dominantCurrency = dominantFromExpenses(currentMonth);

  type LinkBucket = {
    institutionName: string;
    total: number;
    currencyCounts: Map<string, number>;
    transactionCount: number;
  };
  const linkBuckets = new Map<string, LinkBucket>();
  for (const row of currentMonth) {
    if (row.sourceType !== "bank_sync") {
      continue;
    }
    const itemKey =
      row.linkedItemId && String(row.linkedItemId).length > 0 ? String(row.linkedItemId) : "__legacy__";
    const institutionName =
      row.institutionName && String(row.institutionName).length > 0
        ? String(row.institutionName)
        : itemKey === "__legacy__"
          ? "Older synced activity"
          : "Linked account";
    const bucket = linkBuckets.get(itemKey) ?? {
      institutionName,
      total: 0,
      currencyCounts: new Map<string, number>(),
      transactionCount: 0,
    };
    bucket.institutionName = institutionName;
    bucket.total += Math.abs(row.amount);
    const cur = (row.currency ?? "USD").toUpperCase();
    bucket.currencyCounts.set(cur, (bucket.currencyCounts.get(cur) ?? 0) + 1);
    bucket.transactionCount += 1;
    linkBuckets.set(itemKey, bucket);
  }
  const linkedAccountSpend: LinkedAccountSpend[] = Array.from(linkBuckets.entries())
    .map(([itemId, b]) => {
      let currency = "USD";
      let bestN = 0;
      for (const [c, n] of b.currencyCounts) {
        if (n > bestN) {
          bestN = n;
          currency = c;
        }
      }
      return {
        itemId,
        institutionName: b.institutionName,
        total: b.total,
        currency,
        transactionCount: b.transactionCount,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    monthLabel: monthStart.toISOString().slice(0, 7),
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
    currentMonthTotal,
    previousMonthTotal,
    monthOverMonthPercent,
    dominantCurrency,
    categoryTotals,
    topMerchants,
    linkedAccountSpend,
  };
}

export async function buildBudgetStatuses(
  clerkUserId: string,
  categoryTotals: CategoryTotal[]
): Promise<BudgetStatus[]> {
  const rules = await Budget.find({ clerkUserId }).sort({ categoryKey: 1 }).lean();
  const spendByCategory = new Map(
    categoryTotals.map((c) => [c.category.toLowerCase(), { total: c.total, currency: c.currency }])
  );

  return rules.map((rule) => {
    const key = rule.categoryKey.toLowerCase();
    const row = spendByCategory.get(key);
    const spent = row?.total ?? 0;
    const spendCurrency = row?.currency ?? rule.currency;
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
      spendCurrency,
      remaining,
      status,
    };
  });
}
