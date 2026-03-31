import { endOfDay, startOfDay, subDays } from "date-fns";
import { Router } from "express";
import { CountryCode, Products } from "plaid";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ConnectedBankAccount } from "../models/ConnectedBankAccount.js";
import { Expense } from "../models/Expense.js";
import { buildLinkTokenConfig, plaidClient } from "../services/plaid.js";

const bankRouter = Router();
bankRouter.use(requireAuth);

const linkTokenSchema = z.object({
  countryCode: z.enum(["US", "GB"]).default("US"),
  androidPackageName: z.string().optional(),
});

const exchangeTokenSchema = z.object({
  publicToken: z.string().min(1),
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

  const response = await plaidClient.linkTokenCreate(
    buildLinkTokenConfig({
      clerkUserId,
      countryCodes: [countryCode],
      androidPackageName: parsed.data.androidPackageName,
    })
  );

  return res.json({
    provider: "plaid",
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
    requestId: response.data.request_id,
  });
});

bankRouter.post("/exchange-token", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const parsed = exchangeTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload.", issues: parsed.error.flatten() });
  }

  const exchange = await plaidClient.itemPublicTokenExchange({
    public_token: parsed.data.publicToken,
  });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const item = await plaidClient.itemGet({ access_token: accessToken });
  const institutionId = item.data.item.institution_id;

  let institutionName: string | null = parsed.data.metadata?.institution?.name ?? null;
  if (institutionId) {
    const institutions = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us, CountryCode.Gb],
      options: { include_optional_metadata: false },
    });
    institutionName = institutions.data.institution.name;
  }

  const connected = await ConnectedBankAccount.findOneAndUpdate(
    { clerkUserId, provider: "plaid", itemId },
    {
      $set: {
        clerkUserId,
        provider: "plaid",
        itemId,
        accessToken,
        institutionId: institutionId ?? parsed.data.metadata?.institution?.institution_id ?? null,
        institutionName,
        plaidAccountIds: parsed.data.metadata?.accounts?.map((a) => a.id) ?? [],
        status: "active",
      },
    },
    { upsert: true, new: true }
  );

  return res.status(201).json({
    message: "Plaid item linked successfully.",
    itemId,
    connectedAccountId: connected._id,
  });
});

bankRouter.post("/sync", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const linkedAccounts = await ConnectedBankAccount.find({
    clerkUserId,
    provider: "plaid",
    status: "active",
  });

  let upserted = 0;

  for (const linked of linkedAccounts) {
    const txResponse = await plaidClient.transactionsGet({
      access_token: linked.accessToken,
      start_date: startOfDay(subDays(new Date(), 30)).toISOString().slice(0, 10),
      end_date: endOfDay(new Date()).toISOString().slice(0, 10),
      options: { count: 500 },
    });

    for (const txn of txResponse.data.transactions) {
      await Expense.updateOne(
        {
          clerkUserId,
          sourceType: "bank_sync",
          sourceRef: txn.transaction_id,
        },
        {
          $set: {
            clerkUserId,
            amount: Math.abs(txn.amount),
            currency: "USD",
            merchant: txn.merchant_name ?? txn.name ?? "Bank transaction",
            category: txn.personal_finance_category?.primary ?? txn.category?.[0] ?? "Uncategorized",
            occurredAt: new Date(txn.date),
            sourceType: "bank_sync",
            sourceRef: txn.transaction_id,
            metadata: {
              provider: "plaid",
              accountId: txn.account_id,
              paymentChannel: txn.payment_channel,
              pending: txn.pending,
            },
          },
        },
        { upsert: true }
      );
      upserted += 1;
    }

    linked.lastSyncAt = new Date();
    await linked.save();
  }

  return res.json({
    message: "Sync complete.",
    linkedAccounts: linkedAccounts.length,
    upsertedTransactions: upserted,
  });
});

bankRouter.get("/transactions", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const { limit = "100", page = "1" } = req.query;
  const parsedLimit = Math.min(500, Math.max(1, Number(limit)));
  const parsedPage = Math.max(1, Number(page));

  const filter = { clerkUserId };
  const [items, total] = await Promise.all([
    Expense.find(filter)
      .sort({ occurredAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean(),
    Expense.countDocuments(filter),
  ]);

  return res.json({
    items,
    page: parsedPage,
    limit: parsedLimit,
    total,
    totalPages: Math.ceil(total / parsedLimit),
  });
});

bankRouter.get("/providers", (_req, res) => {
  return res.json({
    available: [
      { provider: "plaid", status: "active", products: [Products.Transactions] },
      { provider: "truelayer", status: "planned" },
    ],
  });
});

export { bankRouter };

