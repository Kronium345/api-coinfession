import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { ensureInsightCategories } from "./services/insightCategories.js";

async function bootstrap() {
  await connectMongo();
  await ensureInsightCategories();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`API listening on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});

