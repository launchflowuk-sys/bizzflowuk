import app from "./app";
import { logger } from "./lib/logger";
import { runSeedFixIfNeeded } from "./lib/seedFix";
import { seedAmoServicesIfMissing } from "./lib/seedAmoServices";

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

runSeedFixIfNeeded().then(() => seedAmoServicesIfMissing()).then(() => {
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
