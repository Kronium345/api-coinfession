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
import { subscriptionsRouter } from "./routes/subscriptions.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp() {
  const app = express();

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
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
  app.use(morgan("combined"));

  app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api/accounts", accountsRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/subscriptions", subscriptionsRouter);
  app.use("/api/insights", insightsRouter);
  app.use("/api/webhooks", webhooksRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

