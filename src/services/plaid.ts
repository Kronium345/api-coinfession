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
  const base = {
    user: { client_user_id: params.clerkUserId },
    client_name: params.clientName ?? "Coinfession",
    language: "en",
    products: [Products.Transactions],
    country_codes: params.countryCodes ?? [CountryCode.Us],
    transactions: { days_requested: 90 },
  };

  /**
   * Android / React Native: send `android_package_name` only — do not send
   * `redirect_uri` on /link/token/create.
   * @see https://plaid.com/docs/link/oauth/#android-sdk-and-android-on-react-native
   *
   * iOS / RN on iOS: send allowlisted universal-link `redirect_uri` for OAuth banks.
   * @see https://plaid.com/docs/link/oauth/#react-native-on-ios
   */
  if (params.androidPackageName) {
    return { ...base, android_package_name: params.androidPackageName };
  }

  if (env.PLAID_REDIRECT_URI) {
    return { ...base, redirect_uri: env.PLAID_REDIRECT_URI };
  }

  return base;
}

