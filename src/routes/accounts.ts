import { Router } from "express";
import { z } from "zod";
import { ensureClerkUser, requireAuth } from "../middleware/auth.js";
import { LinkedAccount } from "../models/LinkedAccount.js";
import { getOrCreateStripeCustomer, stripe } from "../services/stripe.js";

const accountsRouter = Router();

const attachSchema = z.object({
  paymentMethodId: z.string().optional(),
  financialAccountId: z.string().optional(),
  institutionName: z.string().optional(),
  accountDisplayName: z.string().optional(),
  accountType: z.string().optional(),
  accountSubType: z.string().optional(),
});

accountsRouter.use(requireAuth);

accountsRouter.post("/link-session", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  await ensureClerkUser(clerkUserId);
  const customer = await getOrCreateStripeCustomer(clerkUserId);
  res.json({
    provider: "stripe",
    providerCustomerId: customer.id,
    message: "Use Stripe SDK on mobile to collect tokenized payment or bank account data.",
  });
});

accountsRouter.post("/attach", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const parsed = attachSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload.", issues: parsed.error.flatten() });
  }

  const customer = await getOrCreateStripeCustomer(clerkUserId);

  if (parsed.data.paymentMethodId) {
    await stripe.paymentMethods.attach(parsed.data.paymentMethodId, {
      customer: customer.id,
    });
  }

  const linked = await LinkedAccount.findOneAndUpdate(
    {
      clerkUserId,
      provider: "stripe",
      paymentMethodId: parsed.data.paymentMethodId ?? null,
      financialAccountId: parsed.data.financialAccountId ?? null,
    },
    {
      $set: {
        clerkUserId,
        provider: "stripe",
        providerCustomerId: customer.id,
        paymentMethodId: parsed.data.paymentMethodId ?? null,
        financialAccountId: parsed.data.financialAccountId ?? null,
        institutionName: parsed.data.institutionName ?? null,
        accountDisplayName: parsed.data.accountDisplayName ?? null,
        accountType: parsed.data.accountType ?? null,
        accountSubType: parsed.data.accountSubType ?? null,
      },
    },
    { upsert: true, new: true }
  );

  return res.status(201).json(linked);
});

accountsRouter.get("/", async (req, res) => {
  const clerkUserId = req.auth!.clerkUserId;
  const accounts = await LinkedAccount.find({ clerkUserId }).sort({ updatedAt: -1 }).lean();
  res.json(accounts);
});

export { accountsRouter };

