import mongoose from "mongoose";

const insightCategorySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: { type: String, required: true },
    suggestion: { type: String, required: true },
    minScore: { type: Number, required: true },
    maxScore: { type: Number, required: true },
  },
  { timestamps: true }
);

export const InsightCategory = mongoose.model("InsightCategory", insightCategorySchema);

