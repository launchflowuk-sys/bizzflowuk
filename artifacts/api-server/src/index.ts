import app from "./app";
import { logger } from "./lib/logger";
import { runSeedFixIfNeeded } from "./lib/seedFix";
import { seedAmoServicesIfMissing } from "./lib/seedAmoServices";
import { seedKdEssexIfMissing, ensureKdEssexAdmin } from "./lib/seedKdEssex";
import { seedBlogPostsIfMissing } from "./lib/seedBlogPosts";
import { seedBpsPlumbingIfMissing } from "./lib/seedBpsPlumbing";
import { seedBpsReviewsIfMissing } from "./lib/seedBpsReviews";
import { syncBpsContent } from "./lib/syncBpsContent";
import { startAutomationScheduler } from "./lib/automations/scheduler";
import { startDemoResetScheduler } from "./lib/demo/reset";
import { startGoogleReviewScheduler } from "./lib/reviews/googleSync";
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
  // One-time backfill of Brandon's real reviews, which Google's five-review
  // cap will not hand over. DELETE THIS LINE once he starts curating them
  // himself: it is idempotent against duplicates, but a review he deletes on
  // purpose in the dashboard would come back on the next boot.
  .then(() => seedBpsReviewsIfMissing())
  .then(() => seedBlogPostsIfMissing())
  .then(() => startAutomationScheduler())
  // Puts the public demo back how it was, daily and in-process — so it is
  // never an environment someone has to remember to configure.
  .then(() => startDemoResetScheduler())
  .then(() => startGoogleReviewScheduler())
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
