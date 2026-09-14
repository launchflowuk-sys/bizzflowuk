import app from "./app";
import { logger } from "./lib/logger";
import { runSeedFixIfNeeded } from "./lib/seedFix";
import { seedAmoServicesIfMissing } from "./lib/seedAmoServices";
import { seedKdEssexIfMissing, ensureKdEssexAdmin } from "./lib/seedKdEssex";
import { seedBlogPostsIfMissing } from "./lib/seedBlogPosts";
import { seedBpsPlumbingIfMissing } from "./lib/seedBpsPlumbing";
import { syncBpsContent } from "./lib/syncBpsContent";
import { startAutomationScheduler } from "./lib/automations/scheduler";
import { clearAllPageCache } from "./lib/pageCache";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runSeedFixIfNeeded()
  .then(() => seedAmoServicesIfMissing())
  .then(() => seedKdEssexIfMissing())
  .then(() => ensureKdEssexAdmin())
  .then(() => seedBpsPlumbingIfMissing())
  .then(() => syncBpsContent())
  .then(() => seedBlogPostsIfMissing())
  .then(() => startAutomationScheduler())
  .then(() => clearAllPageCache().catch((err) => logger.error({ err }, "Page cache clear failed — non-fatal, stale pages may persist")))
  .then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}).catch((err) => {
  logger.error({ err }, "Seed fix crashed — starting server anyway");
  app.listen(port, () => logger.info({ port }, "Server listening"));
});
