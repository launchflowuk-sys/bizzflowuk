import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startReviewRequestScheduler } from "./lib/reviewRequestScheduler";
import { handleStripeWebhook } from "./routes/billing";
import { handleXeroWebhook } from "./lib/accounting/xeroWebhook";

const app: Express = express();

// Coolify's Traefik reverse proxy is always the immediate hop in front of this
// container in every deployment — trust exactly one proxy so rate limiting
// and req.ip resolve the real client IP from X-Forwarded-For instead of
// throwing/misidentifying every request as the proxy's own IP.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

/**
 * Stripe's webhook, mounted BEFORE express.json() and with a raw body parser.
 *
 * The signature is an HMAC over the exact bytes Stripe sent. Once express.json()
 * has parsed and the handler re-stringifies, key order and whitespace can differ
 * and the signature never verifies again — so this one route has to see the
 * buffer, and it has to be registered before the JSON parser claims it.
 */
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

/**
 * Xero's webhook, for the same reason and with the same constraint: the
 * signature is an HMAC over the exact bytes, so this route must see the buffer
 * and must be registered before express.json() claims it.
 *
 * Tells us when an invoice is paid in Xero, so the chase automation stops
 * emailing a customer who has already paid.
 */
app.post("/api/accounting/webhook/xero", express.raw({ type: "application/json" }), handleXeroWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

startReviewRequestScheduler();

export default app;
