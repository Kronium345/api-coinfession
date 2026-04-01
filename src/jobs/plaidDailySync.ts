import cron from "node-cron";
import { ConnectedBankAccount } from "../models/ConnectedBankAccount.js";
import { env } from "../config/env.js";
import { syncAllPlaidItemsForUser } from "../services/providers/plaidProvider.js";

export function startPlaidDailySyncJob() {
  if (env.NODE_ENV === "test") {
    return;
  }
  // Every day at 06:00 server local time
  cron.schedule("0 6 * * *", async () => {
    try {
      const clerkUserIds = await ConnectedBankAccount.distinct("clerkUserId", {
        provider: "plaid",
        status: "active",
      });
      for (const clerkUserId of clerkUserIds) {
        await syncAllPlaidItemsForUser(clerkUserId as string);
      }
      console.log(`[cron] plaid daily sync finished for ${clerkUserIds.length} user(s)`);
    } catch (err) {
      console.error("[cron] plaid daily sync failed", err);
    }
  });
  console.log("[cron] Plaid daily sync scheduled (06:00 server time)");
}
