import { endOfMonth, startOfMonth } from "date-fns";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { InsightFeature } from "../models/InsightFeature.js";
import { InsightSnapshot } from "../models/InsightSnapshot.js";
import {
  buildFeatureVector,
  categorizeScore,
  scoreOpportunity,
} from "../services/insightsEngine.js";
import { buildInsightDashboardPayload } from "../services/insightDashboard.js";

const insightsRouter = Router();

insightsRouter.use(requireAuth);

async function recomputeInsights(clerkUserId: string) {
  const windowStart = startOfMonth(new Date());
  const windowEnd = endOfMonth(new Date());
  const features = await buildFeatureVector(clerkUserId);
  const { score, factors } = scoreOpportunity(features);
  const category = await categorizeScore(score);

  await InsightFeature.deleteMany({ clerkUserId, windowStart, windowEnd, version: "v1" });
  await InsightFeature.insertMany(
    Object.entries(features).map(([featureKey, featureValue]) => ({
      clerkUserId,
      featureKey,
      featureValue,
      windowStart,
      windowEnd,
      version: "v1",
    }))
  );

  const snapshot = await InsightSnapshot.findOneAndUpdate(
    { clerkUserId, windowStart, windowEnd, engineVersion: "rules_v1" },
    {
      $set: {
        clerkUserId,
        windowStart,
        windowEnd,
        engineVersion: "rules_v1",
        items: [
          {
            code: category.code,
            score,
            band: category.label,
            confidence: 0.76,
            topFactors: factors,
            description: category.description,
            suggestion: category.suggestion,
          },
        ],
      },
    },
    { upsert: true, new: true }
  ).lean();

  return { features, snapshot };
}

insightsRouter.get("/summary", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const latest = await InsightSnapshot.findOne({ clerkUserId }).sort({ windowEnd: -1 }).lean();

  if (latest) {
    const payload = await buildInsightDashboardPayload(latest, clerkUserId);
    return res.json(payload);
  }

  const result = await recomputeInsights(clerkUserId);
  if (!result.snapshot) {
    return res.status(500).json({ message: "Could not build insights snapshot." });
  }
  const payload = await buildInsightDashboardPayload(result.snapshot, clerkUserId);
  return res.json(payload);
});

insightsRouter.post("/recompute", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const result = await recomputeInsights(clerkUserId);
  if (!result.snapshot) {
    return res.status(500).json({ message: "Could not build insights snapshot." });
  }
  const payload = await buildInsightDashboardPayload(result.snapshot, clerkUserId);
  return res.json({
    message: "Recomputed insights with RulesEngineV1.",
    snapshot: payload,
    features: result.features,
  });
});

export { insightsRouter };

