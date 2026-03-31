import mongoose from "mongoose";

const linkedAccountSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    provider: { type: String, enum: ["stripe"], required: true },
    providerCustomerId: { type: String, required: true },
    paymentMethodId: { type: String, default: null },
    financialAccountId: { type: String, default: null },
    institutionName: { type: String, default: null },
    accountDisplayName: { type: String, default: null },
    accountType: { type: String, default: null },
    accountSubType: { type: String, default: null },
    brand: { type: String, default: null },
    last4: { type: String, default: null },
    expMonth: { type: Number, default: null },
    expYear: { type: Number, default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

linkedAccountSchema.index(
  { clerkUserId: 1, provider: 1, paymentMethodId: 1, financialAccountId: 1 },
  { unique: true, sparse: true }
);

export const LinkedAccount = mongoose.model("LinkedAccount", linkedAccountSchema);

