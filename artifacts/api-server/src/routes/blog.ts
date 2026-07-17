import { Router } from "express";
import { db } from "@workspace/db";
import { blogPostsTable, blogCategoriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import { sanitizeUpdate } from "../lib/sanitizeUpdate";
import { invalidateTenantPageCache } from "../lib/pageCache";

const router = Router();
function tid(req: any) { return req.authUser?.tenantId!; }

router.get("/blog/categories", requireTenantAccess, async (req, res) => {
  try {
    const cats = await db.select().from(blogCategoriesTable).where(eq(blogCategoriesTable.tenantId, tid(req)));
    res.json(cats);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/blog/categories", requireTenantAccess, async (req, res) => {
  try {
    const cat = await db.insert(blogCategoriesTable).values({ ...req.body, tenantId: tid(req) }).returning();
    res.status(201).json(cat[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/blog/categories/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(blogCategoriesTable).where(and(eq(blogCategoriesTable.id, Number(req.params.id)), eq(blogCategoriesTable.tenantId, tid(req))));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/blog/posts", requireTenantAccess, async (req, res) => {
  try {
    const posts = await db.select().from(blogPostsTable).where(eq(blogPostsTable.tenantId, tid(req))).orderBy(sql`${blogPostsTable.createdAt} desc`);
    res.json(posts);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/blog/posts", requireTenantAccess, async (req, res) => {
  try {
    const post = await db.insert(blogPostsTable).values({ ...req.body, tenantId: tid(req) }).returning();
    res.status(201).json(post[0]);
    invalidateTenantPageCache(tid(req)).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/blog/posts/:id", requireTenantAccess, async (req, res) => {
  try {
    const post = await db.select().from(blogPostsTable).where(and(eq(blogPostsTable.id, Number(req.params.id)), eq(blogPostsTable.tenantId, tid(req)))).limit(1);
    if (!post.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(post[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/blog/posts/:id", requireTenantAccess, async (req, res) => {
  try {
    const post = await db.update(blogPostsTable).set(sanitizeUpdate(req.body)).where(and(eq(blogPostsTable.id, Number(req.params.id)), eq(blogPostsTable.tenantId, tid(req)))).returning();
    if (!post.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(post[0]);
    invalidateTenantPageCache(tid(req)).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/blog/posts/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(blogPostsTable).where(and(eq(blogPostsTable.id, Number(req.params.id)), eq(blogPostsTable.tenantId, tid(req))));
    res.status(204).send();
    invalidateTenantPageCache(tid(req)).catch(err => req.log.error({ err }, "Failed to invalidate page cache"));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
