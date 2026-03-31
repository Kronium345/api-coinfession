import Stripe from "stripe";
import { env } from "../config/env.js";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY to enable Stripe routes.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return stripeClient;
}

export async function getOrCreateStripeCustomer(clerkUserId: string) {
  const stripe = getStripeClient();
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

