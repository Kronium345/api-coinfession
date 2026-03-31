import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    plan: { type: String, default: null },
    category: { type: String, default: null },
    paymentMethod: { type: String, default: null },
    status: { type: String, default: "active" },
    startDate: { type: Date, default: null },
    price: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    billing: { type: String, required: true },
    renewalDate: { type: Date, default: null },
    color: { type: String, default: null },
  },
  { timestamps: true }
);

subscriptionSchema.index({ clerkUserId: 1, renewalDate: 1 });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);

