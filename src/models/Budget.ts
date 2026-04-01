import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    categoryKey: { type: String, required: true },
    displayCategory: { type: String, required: true },
    monthlyLimit: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
  },
  { timestamps: true }
);

budgetSchema.index({ clerkUserId: 1, categoryKey: 1 }, { unique: true });

export const Budget = mongoose.model("Budget", budgetSchema);
