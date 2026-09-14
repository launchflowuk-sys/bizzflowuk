import { runAutomationsForAllTenants } from "../../routes/automations";
import { logger } from "../logger";

/**
 * In-process automation scheduler.
 *
 * The engine originally needed an external daily task calling
 * /internal/jobs/automations-daily with a shared secret. That works, but it is an
 * operational step that has to be configured per environment, and until somebody
 * does it the automations look built and silently never run — the worst failure
 * mode, because nothing errors.
 *
 * Running it in the process removes that step. It is safe here specifically
 * because every rule writes an automation_runs row before it acts: a rule cannot
 * act on the same subject twice, so an extra sweep costs a few queries and
 * changes nothing. That latch is what makes frequency a non-decision.
 *
 * Hourly rather than daily for the same reason. A chase configured for day 3
 * fires within an hour of crossing day 3 instead of waiting for a fixed
 * overnight window, and the latch stops it firing again.
 *
 * The HTTP endpoint stays: it is still the way to trigger a sweep by hand while
 * debugging, and an external scheduler can still drive it if that is ever
 * preferred.
 */

const HOUR = 60 * 60 * 1000;
/** Let the app finish booting and seeding before the first sweep. */
const FIRST_RUN_DELAY = 2 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function sweep(reason: string): Promise<void> {
  // A slow sweep must never overlap itself — two concurrent passes would both
  // read the same due rows before either had written its latch.
  if (running) {
    logger.warn({ reason }, "Automation sweep skipped — the previous one is still running");
    return;
  }
  running = true;
  const startedAt = Date.now();
  try {
    const result = await runAutomationsForAllTenants();
    // Only log when something happened, so a quiet night does not fill the log
    // with hourly noise.
    if (result.actions > 0) {
      logger.info({ ...result, reason, ms: Date.now() - startedAt }, "Automation sweep complete");
    }
  } catch (err) {
    logger.error({ err, reason }, "Automation sweep failed");
  } finally {
    running = false;
  }
}

export function startAutomationScheduler(): void {
  // An escape hatch for a console or a one-off container that should not be
  // sending anything on a business's behalf.
  if (process.env["AUTOMATIONS_DISABLED"] === "1") {
    logger.info("Automation scheduler disabled by AUTOMATIONS_DISABLED");
    return;
  }
  if (timer) return;

  const first = setTimeout(() => { void sweep("first run after boot"); }, FIRST_RUN_DELAY);
  // Do not hold the process open on this alone.
  first.unref?.();

  timer = setInterval(() => { void sweep("hourly"); }, HOUR);
  timer.unref?.();

  logger.info("Automation scheduler started — hourly");
}

export function stopAutomationScheduler(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
