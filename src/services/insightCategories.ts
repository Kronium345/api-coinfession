import { InsightCategory } from "../models/InsightCategory.js";

const DEFAULT_CATEGORIES = [
  {
    code: "low",
    label: "Low Opportunity",
    description: "Current spending pattern appears stable and diversified.",
    suggestion: "Keep monitoring trends and revisit in the next billing cycle.",
    minScore: 0,
    maxScore: 0.3399,
  },
  {
    code: "moderate",
    label: "Moderate Opportunity",
    description: "Some categories are growing faster than expected.",
    suggestion: "Review month-over-month drift and set category spending caps.",
    minScore: 0.34,
    maxScore: 0.6699,
  },
  {
    code: "high",
    label: "High Opportunity",
    description: "Spending patterns suggest meaningful optimization opportunities.",
    suggestion: "Prioritize duplicate subscriptions and high discretionary categories.",
    minScore: 0.67,
    maxScore: 1,
  },
];

export async function ensureInsightCategories() {
  for (const category of DEFAULT_CATEGORIES) {
    await InsightCategory.updateOne({ code: category.code }, { $set: category }, { upsert: true });
  }
}

