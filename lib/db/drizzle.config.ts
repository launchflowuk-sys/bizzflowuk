import { defineConfig } from "drizzle-kit";

// Plain relative, forward-slash paths — drizzle-kit resolves these relative to
// this config file itself. Do NOT pre-resolve with path.join(__dirname, ...):
// on Windows that yields an absolute backslash path, which drizzle-kit's own
// glob-based resolution fails to recognise as absolute and re-joins onto the
// config dir, producing a doubled, nonexistent path.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost/placeholder",
  },
});
