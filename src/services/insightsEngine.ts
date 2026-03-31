import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { Expense } from "../models/Expense.js";
import { InsightCategory } from "../models/InsightCategory.js";

export type FeatureVector = {
  recurrenceConfidence: number;
  monthOverMonthDrift: number;
  categoryConcentration: number;
  discretionaryRatio: number;
  duplicateSubscriptionsLikelihood: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function buildFeatureVector(clerkUserId: string): Promise<FeatureVector> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const previousStart = startOfMonth(subMonths(now, 1));
  const previousEnd = endOfMonth(subMonths(now, 1));

  const [currentMonth, previousMonth] = await Promise.all([
    Expense.find({ clerkUserId, occurredAt: { $gte: monthStart, $lte: monthEnd } }).lean(),
    Expense.find({
      clerkUserId,
      occurredAt: { $gte: previousStart, $lte: previousEnd },
    }).lean(),
  ]);

  const sum = (items: Array<{ amount: number }>) =>
    items.reduce((total, item) => total + Math.abs(item.amount), 0);

  const currentTotal = sum(currentMonth);
  const previousTotal = sum(previousMonth);
  const driftRaw = previousTotal > 0 ? (currentTotal - previousTotal) / previousTotal : 0;

  const categoryBuckets = new Map<string, number>();
  for (const item of currentMonth) {
    categoryBuckets.set(item.category, (categoryBuckets.get(item.category) ?? 0) + Math.abs(item.amount));
  }
  const largestCategory = Math.max(...Array.from(categoryBuckets.values()), 0);
  const categoryConcentration = currentTotal > 0 ? largestCategory / currentTotal : 0;

  const discretionarySpend = currentMonth
    .filter((item) =>
      ["entertainment", "shopping", "dining", "lifestyle"].includes(item.category.toLowerCase())
    )
    .reduce((total, item) => total + Math.abs(item.amount), 0);
  const discretionaryRatio = currentTotal > 0 ? discretionarySpend / currentTotal : 0;

  const merchantCounts = new Map<string, number>();
  for (const item of currentMonth) {
    merchantCounts.set(item.merchant.toLowerCase(), (merchantCounts.get(item.merchant.toLowerCase()) ?? 0) + 1);
  }
  const duplicateMerchants = Array.from(merchantCounts.values()).filter((count) => count >= 2).length;
  const duplicateSubscriptionsLikelihood =
    merchantCounts.size > 0 ? duplicateMerchants / merchantCounts.size : 0;

  const recurrenceConfidence = clamp01(currentMonth.length / 25);

  return {
    recurrenceConfidence,
    monthOverMonthDrift: clamp01((driftRaw + 1) / 2),
    categoryConcentration: clamp01(categoryConcentration),
    discretionaryRatio: clamp01(discretionaryRatio),
    duplicateSubscriptionsLikelihood: clamp01(duplicateSubscriptionsLikelihood),
  };
}

const WEIGHTS: Record<keyof FeatureVector, number> = {
  recurrenceConfidence: 0.25,
  monthOverMonthDrift: 0.2,
  categoryConcentration: 0.2,
  discretionaryRatio: 0.2,
  duplicateSubscriptionsLikelihood: 0.15,
};

export function scoreOpportunity(features: FeatureVector) {
  const score = Object.entries(features).reduce((total, [key, value]) => {
    return total + value * WEIGHTS[key as keyof FeatureVector];
  }, 0);

  const factors = Object.entries(features)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);

  return { score: clamp01(score), factors };
}

export async function categorizeScore(score: number) {
  const category = await InsightCategory.findOne({
    minScore: { $lte: score },
    maxScore: { $gte: score },
  }).lean();

  if (category) {
    return category;
  }

  if (score >= 0.67) {
    return {
      code: "high",
      label: "High Opportunity",
      description: "Spending patterns suggest meaningful optimization opportunities.",
      suggestion: "Prioritize duplicate subscriptions and high discretionary categories.",
    };
  }
  if (score >= 0.34) {
    return {
      code: "moderate",
      label: "Moderate Opportunity",
      description: "Some categories are growing faster than expected.",
      suggestion: "Review month-over-month drift and set category spending caps.",
    };
  }
  return {
    code: "low",
    label: "Low Opportunity",
    description: "Current spending pattern appears stable and diversified.",
    suggestion: "Keep monitoring trends and revisit in the next billing cycle.",
  };
}

