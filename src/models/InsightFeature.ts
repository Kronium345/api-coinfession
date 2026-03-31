import mongoose from "mongoose";

const insightFeatureSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    featureKey: { type: String, required: true },
    featureValue: { type: Number, required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    version: { type: String, default: "v1" },
  },
  { timestamps: true }
);

insightFeatureSchema.index({ clerkUserId: 1, featureKey: 1, windowStart: 1, windowEnd: 1 });

export const InsightFeature = mongoose.model("InsightFeature", insightFeatureSchema);

