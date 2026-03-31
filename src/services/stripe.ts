import Stripe from "stripe";
import { env } from "../config/env.js";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

export async function getOrCreateStripeCustomer(clerkUserId: string) {
  const existing = await stripe.customers.search({
    query: `metadata['clerkUserId']:'${clerkUserId}'`,
    limit: 1,
  });

  if (existing.data[0]) {
    return existing.data[0];
  }

  return stripe.customers.create({
    metadata: { clerkUserId },
  });
}

