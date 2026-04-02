import { Router } from "express";
import { CountryCode } from "plaid";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ConnectedBankAccount } from "../models/ConnectedBankAccount.js";
import {
  createLinkTokenForUser,
  exchangePublicToken,
  plaidProductsForDocs,
  syncAllPlaidItemsForUser,
} from "../services/providers/plaidProvider.js";

const bankRouter = Router();
bankRouter.use(requireAuth);

const linkTokenSchema = z.object({
  countryCode: z.enum(["US", "GB"]).default("US"),
  androidPackageName: z.string().optional(),
});

const exchangeTokenSchema = z.object({
  publicToken: z.string().min(1),
  countryCode: z.enum(["US", "GB"]).optional(),
  metadata: z
    .object({
      institution: z
        .object({
          institution_id: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
      accounts: z.array(z.object({ id: z.string() })).optional(),
    })
    .optional(),
});

bankRouter.post("/link-token", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const parsed = linkTokenSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload.", issues: parsed.error.flatten() });
  }

  const countryCode =
    parsed.data.countryCode === "GB" ? CountryCode.Gb : CountryCode.Us;

  const token = await createLinkTokenForUser({
    clerkUserId,
    countryCode,
    androidPackageName: parsed.data.androidPackageName,
  });

  return res.json({
    provider: "plaid",
    linkToken: token.linkToken,
    expiration: token.expiration,
    requestId: token.requestId,
  });
});

bankRouter.post("/exchange-token", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const parsed = exchangeTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload.", issues: parsed.error.flatten() });
  }

  const { itemId, connected } = await exchangePublicToken({
    clerkUserId,
    publicToken: parsed.data.publicToken,
    countryCode: parsed.data.countryCode,
    metadata: parsed.data.metadata,
  });

  return res.status(201).json({
    message: "Plaid item linked successfully.",
    itemId,
    connectedAccountId: connected._id,
    institutionName: connected.institutionName,
    institutionId: connected.institutionId,
  });
});

bankRouter.post("/sync", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const summary = await syncAllPlaidItemsForUser(clerkUserId);
  const anyFailed = summary.results.some((r) => !r.ok);
  return res.status(anyFailed ? 207 : 200).json({
    message: anyFailed ? "Sync finished with one or more Plaid item errors." : "Sync complete.",
    linkedAccounts: summary.linkedAccounts,
    results: summary.results,
  });
});

bankRouter.get("/connections", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const rows = await ConnectedBankAccount.find({ clerkUserId })
    .select("-accessToken")
    .sort({ updatedAt: -1 })
    .lean();

  return res.json(rows);
});

bankRouter.get("/providers", (_req, res) => {
  return res.json({
    available: [
      { provider: "plaid", status: "active", products: plaidProductsForDocs() },
      { provider: "truelayer", status: "planned" },
    ],
  });
});

export { bankRouter };
