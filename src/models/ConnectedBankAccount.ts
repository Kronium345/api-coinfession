import mongoose from "mongoose";

const connectedBankAccountSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    provider: { type: String, enum: ["plaid", "truelayer"], required: true },
    itemId: { type: String, required: true },
    accessToken: { type: String, required: true },
    institutionId: { type: String, default: null },
    institutionName: { type: String, default: null },
    plaidAccountIds: [{ type: String }],
    transactionsCursor: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "inactive", "reauth_required", "disconnected"],
      default: "active",
    },
    lastSyncAt: { type: Date, default: null },
    lastSyncError: { type: String, default: null },
    /** Plaid link region: UK → GBP, US → USD in the app. */
    countryCode: { type: String, enum: ["US", "GB"], required: false },
  },
  { timestamps: true }
);

connectedBankAccountSchema.index({ clerkUserId: 1, provider: 1, itemId: 1 }, { unique: true });

export const ConnectedBankAccount = mongoose.model(
  "ConnectedBankAccount",
  connectedBankAccountSchema
);

