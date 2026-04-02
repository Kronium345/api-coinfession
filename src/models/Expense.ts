import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "USD" },
    merchant: { type: String, required: true },
    category: { type: String, required: true },
    occurredAt: { type: Date, required: true, index: true },
    sourceType: {
      type: String,
      enum: ["manual", "subscription", "bank_sync", "card_sync"],
      required: true,
    },
    sourceRef: { type: String, default: null },
    notes: { type: String, default: null },
    pending: { type: Boolean, default: false },
    plaidCategoryLabels: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    linkedItemId: { type: String, default: null, index: true },
    plaidAccountId: { type: String, default: null },
    institutionName: { type: String, default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ clerkUserId: 1, occurredAt: -1 });
expenseSchema.index(
  { clerkUserId: 1, sourceType: 1, sourceRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceType: "bank_sync",
      sourceRef: { $type: "string" },
    },
  }
);

export const Expense = mongoose.model("Expense", expenseSchema);

