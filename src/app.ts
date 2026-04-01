import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { accountsRouter } from "./routes/accounts.js";
import { expensesRouter } from "./routes/expenses.js";
import { healthRouter } from "./routes/health.js";
import { insightsRouter } from "./routes/insights.js";
import { bankRouter } from "./routes/bank.js";
import { budgetsRouter } from "./routes/budgets.js";
import { subscriptionsRouter } from "./routes/subscriptions.js";
import { transactionsRouter } from "./routes/transactions.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp() {
  const app = express();
  const isDev = env.NODE_ENV !== "production";

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed"));
      },
    })
  );

  app.use(
    rateLimit({
      windowMs: isDev ? 60 * 1000 : 15 * 60 * 1000,
      limit: isDev ? 2000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: isDev
        ? "Too many requests in development. Check for a request loop in the app."
        : "Too many requests, please try again later.",
    })
  );
  app.use(morgan("combined"));

  app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
  app.use(express.json());

  app.use("/api", healthRouter);
  if (env.hasStripe) {
    app.use("/api/accounts", accountsRouter);
  }
  app.use("/api/bank", bankRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/subscriptions", subscriptionsRouter);
  app.use("/api/insights", insightsRouter);
  app.use("/api/budgets", budgetsRouter);
  if (env.hasStripe) {
    app.use("/api/webhooks", webhooksRouter);
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

