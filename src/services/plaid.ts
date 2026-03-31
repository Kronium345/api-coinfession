import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import { env } from "../config/env.js";

const configuration = new Configuration({
  basePath: PlaidEnvironments[env.PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
      "PLAID-SECRET": env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export function buildLinkTokenConfig(params: {
  clerkUserId: string;
  clientName?: string;
  countryCodes?: CountryCode[];
  androidPackageName?: string;
}) {
  return {
    user: { client_user_id: params.clerkUserId },
    client_name: params.clientName ?? "Coinfession",
    language: "en",
    products: [Products.Transactions],
    country_codes: params.countryCodes ?? [CountryCode.Us],
    redirect_uri: env.PLAID_REDIRECT_URI,
    android_package_name: params.androidPackageName,
  };
}

