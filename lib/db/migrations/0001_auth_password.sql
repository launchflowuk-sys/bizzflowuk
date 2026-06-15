-- Make clerk_id nullable (password-based auth no longer requires it)
ALTER TABLE "users" ALTER COLUMN "clerk_id" DROP NOT NULL;--> statement-breakpoint

-- Add password_hash column for bcrypt-hashed passwords
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;--> statement-breakpoint

-- Add unique constraint on email (users are now identified by email)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
  END IF;
END $$;
