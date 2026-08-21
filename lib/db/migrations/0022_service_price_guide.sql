-- Per-service indicative price guide, rendered as the "What it costs" block.
-- Nullable: the section only renders when a tenant has actually filled it in, so a
-- tenant who has not agreed their ranges publishes nothing rather than a guess.
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "price_guide" text;
