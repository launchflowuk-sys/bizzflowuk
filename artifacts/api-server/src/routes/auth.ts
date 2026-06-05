import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  res.json(req.authUser);
});

router.post("/users/sync", async (req, res) => {
  try {
    const { clerkId, email, firstName, lastName, tenantSlug } = req.body;
    if (!clerkId || !email) {
      res.status(400).json({ error: "clerkId and email required" });
      return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    if (existing.length) {
      const updated = await db.update(usersTable)
        .set({ email, firstName: firstName ?? null, lastName: lastName ?? null })
        .where(eq(usersTable.clerkId, clerkId))
        .returning();
      res.json(updated[0]);
      return;
    }
    const inserted = await db.insert(usersTable).values({ clerkId, email, firstName: firstName ?? null, lastName: lastName ?? null, role: "CUSTOMER" }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
