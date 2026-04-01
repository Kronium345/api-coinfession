import type { BudgetStatus, CashflowSummary } from "./cashflow.js";
import { buildBudgetStatuses, buildCashflowSummary } from "./cashflow.js";

export type InsightDashboardPayload = {
  _id?: string;
  clerkUserId: string;
  items: Array<{
    code: string;
    score: number;
    band: string;
    confidence: number;
    topFactors: string[];
    description: string;
    suggestion: string;
  }>;
  windowStart: string;
  windowEnd: string;
  engineVersion: string;
  insightsUpdatedAt: string;
  cashflow: CashflowSummary;
  budgetStatuses: BudgetStatus[];
};

type SnapshotLike = {
  _id?: unknown;
  clerkUserId: string;
  items: InsightDashboardPayload["items"];
  windowStart: Date;
  windowEnd: Date;
  engineVersion: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function buildInsightDashboardPayload(
  snapshot: SnapshotLike,
  clerkUserId: string
): Promise<InsightDashboardPayload> {
  const cashflow = await buildCashflowSummary(clerkUserId);
  const budgetStatuses = await buildBudgetStatuses(clerkUserId, cashflow.categoryTotals);
  const updatedAt = snapshot.updatedAt ?? snapshot.createdAt ?? new Date();

  return {
    _id: snapshot._id ? String(snapshot._id) : undefined,
    clerkUserId,
    items: snapshot.items,
    windowStart: new Date(snapshot.windowStart).toISOString(),
    windowEnd: new Date(snapshot.windowEnd).toISOString(),
    engineVersion: snapshot.engineVersion,
    insightsUpdatedAt: new Date(updatedAt).toISOString(),
    cashflow,
    budgetStatuses,
  };
}
