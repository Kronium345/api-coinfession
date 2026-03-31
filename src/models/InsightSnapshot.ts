import mongoose from "mongoose";

const insightItemSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    score: { type: Number, required: true },
    band: { type: String, required: true },
    confidence: { type: Number, required: true },
    topFactors: [{ type: String, required: true }],
    description: { type: String, required: true },
    suggestion: { type: String, required: true },
  },
  { _id: false }
);

const insightSnapshotSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    engineVersion: { type: String, required: true, default: "rules_v1" },
    items: [insightItemSchema],
  },
  { timestamps: true }
);

insightSnapshotSchema.index({ clerkUserId: 1, windowStart: -1, windowEnd: -1 });

export const InsightSnapshot = mongoose.model("InsightSnapshot", insightSnapshotSchema);

