import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startReviewRequestScheduler } from "./lib/reviewRequestScheduler";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

startReviewRequestScheduler();

export default app;
