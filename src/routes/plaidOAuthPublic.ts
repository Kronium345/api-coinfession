import { readFileSync } from "fs";
import { dirname, join } from "path";
import { Router } from "express";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const oauthPublicDir = join(__dirname, "../../oauth-public");

/**
 * Plaid iOS OAuth: Apple Universal Links + redirect landing page.
 * Only use when your API is served at the SAME host as PLAID_REDIRECT_URI
 * (e.g. https://coinfession.app proxied to this server). If the API is only
 * on api.*, keep using the Vercel/static site on the apex domain instead.
 */
export const plaidOAuthPublicRouter = Router();

plaidOAuthPublicRouter.get("/.well-known/apple-app-site-association", (_req, res) => {
  const body = readFileSync(
    join(oauthPublicDir, "apple-app-site-association"),
    "utf8"
  );
  res.type("application/json").send(body);
});

plaidOAuthPublicRouter.get("/plaid", (_req, res) => {
  const body = readFileSync(join(oauthPublicDir, "plaid.html"), "utf8");
  res.type("html").send(body);
});
