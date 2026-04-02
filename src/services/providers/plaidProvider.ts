import type { Transaction } from "plaid";
import { CountryCode, Products } from "plaid";
import { ConnectedBankAccount } from "../../models/ConnectedBankAccount.js";
import { Expense } from "../../models/Expense.js";
import { buildLinkTokenConfig, plaidClient } from "../plaid.js";
import { decryptPlaidAccessToken, encryptPlaidAccessToken } from "../tokenCrypto.js";

const SYNC_PAGE_SIZE = 500;

export async function createLinkTokenForUser(params: {
  clerkUserId: string;
  countryCode: CountryCode;
  androidPackageName?: string;
}) {
  const response = await plaidClient.linkTokenCreate(
    buildLinkTokenConfig({
      clerkUserId: params.clerkUserId,
      countryCodes: [params.countryCode],
      androidPackageName: params.androidPackageName,
    })
  );
  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
    requestId: response.data.request_id,
  };
}

export async function exchangePublicToken(params: {
  clerkUserId: string;
  publicToken: string;
  /** Preferred source: the same country used when creating the Link token. */
  countryCode?: "US" | "GB";
  metadata?: {
    institution?: { institution_id?: string; name?: string };
    accounts?: { id: string }[];
  };
}) {
  const exchange = await plaidClient.itemPublicTokenExchange({
    public_token: params.publicToken,
  });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;
  const encryptedToken = encryptPlaidAccessToken(accessToken);

  const item = await plaidClient.itemGet({ access_token: accessToken });
  const institutionId = item.data.item.institution_id;

  let institutionName: string | null = params.metadata?.institution?.name ?? null;
  let countryFromInstitution: "US" | "GB" | null = null;
  if (institutionId) {
    const institutions = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us, CountryCode.Gb],
      options: { include_optional_metadata: false },
    });
    institutionName = institutions.data.institution.name;
    const codes = institutions.data.institution.country_codes ?? [];
    if (codes.includes(CountryCode.Gb)) countryFromInstitution = "GB";
    else if (codes.includes(CountryCode.Us)) countryFromInstitution = "US";
  }

  const resolvedCountry: "US" | "GB" | undefined =
    params.countryCode ?? countryFromInstitution ?? undefined;

  const connected = await ConnectedBankAccount.findOneAndUpdate(
    { clerkUserId: params.clerkUserId, provider: "plaid", itemId },
    {
      $set: {
        clerkUserId: params.clerkUserId,
        provider: "plaid",
        itemId,
        accessToken: encryptedToken,
        institutionId: institutionId ?? params.metadata?.institution?.institution_id ?? null,
        institutionName,
        plaidAccountIds: params.metadata?.accounts?.map((a) => a.id) ?? [],
        status: "active",
        lastSyncError: null,
        transactionsCursor: null,
        ...(resolvedCountry ? { countryCode: resolvedCountry } : {}),
      },
    },
    { upsert: true, new: true }
  );

  return { itemId, connected };
}

function mapPlaidTransactionToExpense(
  linked: InstanceType<typeof ConnectedBankAccount>,
  txn: Transaction
): Record<string, unknown> {
  const category =
    txn.personal_finance_category?.primary ?? txn.category?.[0] ?? "Uncategorized";
  const currency = (txn.iso_currency_code ?? txn.unofficial_currency_code ?? "USD").toUpperCase();

  return {
    clerkUserId: linked.clerkUserId,
    amount: txn.amount,
    currency,
    merchant: txn.merchant_name ?? txn.name ?? "Bank transaction",
    category,
    occurredAt: new Date(txn.date),
    sourceType: "bank_sync",
    sourceRef: txn.transaction_id,
    pending: txn.pending ?? false,
    plaidCategoryLabels: txn.category ?? [],
    notes: null,
    linkedItemId: linked.itemId,
    plaidAccountId: txn.account_id ?? null,
    institutionName: linked.institutionName ?? null,
    metadata: {
      provider: "plaid",
      itemId: linked.itemId,
      accountId: txn.account_id,
      paymentChannel: txn.payment_channel,
      pending: txn.pending,
      authorizedDate: txn.authorized_date,
      personalFinanceCategory: txn.personal_finance_category,
    },
  };
}

export async function syncTransactionsForLinkedAccount(
  linked: InstanceType<typeof ConnectedBankAccount>
): Promise<
  | {
      ok: true;
      pages: number;
      added: number;
      modified: number;
      removed: number;
      nextCursor: string;
    }
  | { ok: false; error: string }
> {
  let accessToken: string;
  try {
    accessToken = decryptPlaidAccessToken(linked.accessToken);
  } catch (err) {
    linked.lastSyncError = err instanceof Error ? err.message : "Could not decrypt access token";
    await linked.save();
    return { ok: false, error: linked.lastSyncError };
  }

  let cursor: string | undefined =
    linked.transactionsCursor && linked.transactionsCursor.length > 0
      ? linked.transactionsCursor
      : undefined;

  let pages = 0;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let nextCursor = cursor ?? "";

  try {
    while (true) {
      pages += 1;
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
        count: SYNC_PAGE_SIZE,
      });

      const data = response.data;

      for (const txn of data.added) {
        await Expense.updateOne(
          {
            clerkUserId: linked.clerkUserId,
            sourceType: "bank_sync",
            sourceRef: txn.transaction_id,
          },
          { $set: mapPlaidTransactionToExpense(linked, txn) },
          { upsert: true }
        );
        added += 1;
      }

      for (const txn of data.modified) {
        await Expense.updateOne(
          {
            clerkUserId: linked.clerkUserId,
            sourceType: "bank_sync",
            sourceRef: txn.transaction_id,
          },
          { $set: mapPlaidTransactionToExpense(linked, txn) },
          { upsert: true }
        );
        modified += 1;
      }

      for (const r of data.removed) {
        await Expense.deleteOne({
          clerkUserId: linked.clerkUserId,
          sourceType: "bank_sync",
          sourceRef: r.transaction_id,
        });
        removed += 1;
      }

      nextCursor = data.next_cursor;
      cursor = data.next_cursor;

      if (!data.has_more) {
        break;
      }
    }

    linked.transactionsCursor = nextCursor;
    linked.lastSyncAt = new Date();
    linked.lastSyncError = null;
    linked.status = "active";
    await linked.save();

    return { ok: true, pages, added, modified, removed, nextCursor };
  } catch (err) {
    linked.lastSyncError = err instanceof Error ? err.message : "Sync failed";
    const code =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error_code?: string } } }).response?.data?.error_code
        : undefined;
    if (code === "ITEM_LOGIN_REQUIRED") {
      linked.status = "reauth_required";
    }
    await linked.save();
    return { ok: false, error: linked.lastSyncError ?? "Sync failed" };
  }
}

export async function syncAllPlaidItemsForUser(clerkUserId: string) {
  const linkedAccounts = await ConnectedBankAccount.find({
    clerkUserId,
    provider: "plaid",
    status: "active",
  });

  const results: Array<{
    itemId: string;
    ok: boolean;
    pages?: number;
    added?: number;
    modified?: number;
    removed?: number;
    error?: string;
  }> = [];

  for (const linked of linkedAccounts) {
    const summary = await syncTransactionsForLinkedAccount(linked);
    if (summary.ok) {
      results.push({
        itemId: linked.itemId,
        ok: true,
        pages: summary.pages,
        added: summary.added,
        modified: summary.modified,
        removed: summary.removed,
      });
    } else {
      results.push({
        itemId: linked.itemId,
        ok: false,
        error: summary.error,
      });
    }
  }

  return { linkedAccounts: linkedAccounts.length, results };
}

export function plaidProductsForDocs() {
  return [Products.Transactions];
}
