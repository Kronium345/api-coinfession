import { Router } from "express";
import { env } from "../config/env.js";
import { Expense } from "../models/Expense.js";
import { LinkedAccount } from "../models/LinkedAccount.js";
import { stripe } from "../services/stripe.js";

const webhooksRouter = Router();

webhooksRouter.post("/stripe", async (req, res) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ message: "STRIPE_WEBHOOK_SECRET is not configured." });
  }

  const signature = req.header("stripe-signature");
  if (!signature) {
    return res.status(400).json({ message: "Missing stripe-signature header." });
  }

  const event = stripe.webhooks.constructEvent(
    req.body,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === "payment_method.attached") {
    const paymentMethod = event.data.object;
    if (typeof paymentMethod.customer === "string") {
      await LinkedAccount.updateOne(
        { provider: "stripe", providerCustomerId: paymentMethod.customer },
        {
          $set: {
            paymentMethodId: paymentMethod.id,
            brand: paymentMethod.card?.brand ?? null,
            last4: paymentMethod.card?.last4 ?? null,
            expMonth: paymentMethod.card?.exp_month ?? null,
            expYear: paymentMethod.card?.exp_year ?? null,
            status: "active",
          },
        }
      );
    }
  }

  if (event.type === "charge.succeeded") {
    const charge = event.data.object;
    if (typeof charge.customer === "string") {
      const linked = await LinkedAccount.findOne({
        provider: "stripe",
        providerCustomerId: charge.customer,
      }).lean();

      if (linked?.clerkUserId) {
        await Expense.create({
          clerkUserId: linked.clerkUserId,
          amount: Math.abs((charge.amount ?? 0) / 100),
          currency: (charge.currency ?? "usd").toUpperCase(),
          merchant: charge.billing_details?.name ?? "Card charge",
          category: "Uncategorized",
          occurredAt: new Date((charge.created ?? Date.now()) * 1000),
          sourceType: "card_sync",
          sourceRef: charge.id,
          metadata: { provider: "stripe" },
        });
      }
    }
  }

  return res.json({ received: true });
});

export { webhooksRouter };

