---
name: Auth approach — custom JWT replacing Clerk
description: The app uses its own JWT (jsonwebtoken) signed with SESSION_SECRET, NOT Clerk. Password hashing with bcryptjs.
---

## Rule
This app uses custom JWT authentication — not Clerk. Clerk has been fully removed.

**How to apply:**
- Login: POST /api/auth/login → returns JWT
- JWT stored in localStorage under key `lf_token`
- API client reads token via `setAuthTokenGetter(() => Promise.resolve(localStorage.getItem('lf_token')))`
- `requireAuth` middleware: verifies JWT with SESSION_SECRET, looks up user by `payload.userId` (integer ID)
- Users table: `clerk_id` is nullable, `password_hash` holds bcrypt hash
- To create new users: insert with bcrypt-hashed password directly in DB (no registration form)

**Why:** Clerk required external service dependency, complex proxy setup, and caused deployment failures on Coolify/VPS. Simple JWT is self-contained and works anywhere.

**Auth context:** `artifacts/web/src/lib/auth.tsx` — `useAuthCtx()` hook provides `isSignedIn`, `signIn(token)`, `signOut()`
