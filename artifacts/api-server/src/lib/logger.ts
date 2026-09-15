import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  /**
   * `||`, not `??`.
   *
   * Declaring `LOG_LEVEL: ${LOG_LEVEL:-}` in docker-compose sets the variable to
   * an EMPTY STRING rather than leaving it undefined. `??` only falls back on
   * null/undefined, so pino received `level: ""`, threw
   * "default level: must be included in custom levels", and the API crash-looped
   * on boot — taking every tenant site down with it while the build itself
   * reported success.
   *
   * An unset optional env var must never be able to stop the server starting.
   */
  level: process.env.LOG_LEVEL || "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
