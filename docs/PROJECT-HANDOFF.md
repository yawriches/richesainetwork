# AI Riches Network — project analysis and continuation handoff

**Reviewed:** 6 October 2026. **Workspace:** `/home/ubuntu/airiches` (clean extraction of the uploaded `airiches.zip`). **Status:** running temporary development preview, **not** a production publication or full V1 acceptance.

## What this is

AI Riches Network is a private-beta education platform for the journey **Learn → Practice → Get Feedback → Get Help → Improve → Build Skills → Monetize**. It has public marketing/catalog pages, Supabase-backed learner and administrator areas, secure review uploads, support bookings, a community, memberships, two test-mode payment integrations, and scheduled business operations. It is not a static mockup. Public catalog results currently come from the existing Supabase project `zjnpckryymbjmxhauoux` (Ai Riches Network, London `eu-west-2`); do not modify the unrelated `finches` project.

## Architecture at a glance

| Layer | Source | Responsibility |
| --- | --- | --- |
| Next.js App Router / React / TypeScript / Tailwind | `src/app`, `src/components`, `src/app/globals.css` | SSR public pages, interactive learner/admin UI, auth and payment return pages; 26 declared page patterns in `public/manus-routes.json`. |
| HTTP/application backend | `src/app/api`, `src/server` | Origin and rate-limit checks; authenticated reads/actions, admin operations, enrollment/progress, checkout/verification, signed webhooks, contact, secure media uploads, refunds and health. |
| Identity and public reads | `src/lib/supabase/server.ts`, `src/lib/catalog.ts` | Supabase SSR cookies, user/administrator checks, public catalog/settings, guarded service-client operations. |
| Commerce | `src/server/commerce.ts`, `src/server/refunds.ts`, `src/lib/payments/providers.ts` | Authoritative database price/order selection, Paystack/Kora adapters, verification, idempotent fulfillment and already-processed refund lookup. Live payments are not enabled. |
| Database/storage/jobs | `supabase/migrations` (11 files), `supabase/seed.sql`, `supabase/functions/platform-jobs` | PostgreSQL tables, RLS, transactional RPCs, private/public buckets, initial business configuration and five-minute lifecycle/reconciliation worker. |
| Operations/evidence | `docs/ADMIN-AND-LAUNCH-GUIDE.md`, `TODO.md`, `plan.md`, `tests`, `scripts` | Owner instructions, full requirement ledger, architecture decisions, unit/SQL/integration checks. |

**Main flows:** A public visitor reads published courses, plans and public settings through the publishable Supabase client. A student signs in with Supabase Auth and receives secure cookies; server identity and database RLS gate private records and learning media. Free enrollment and lesson completion use database RPCs. Paid access requires a server-created order, hosted provider checkout, independent payment verification and a transactional entitlement grant—returning from checkout alone grants nothing. Review uploads are privately staged, probed for real media properties, then consume an eligible credit atomically. Bookings reserve expiring slots and are confirmed only after verified payment. Admin changes are server/database-authorized and audited. The Edge worker performs lifecycle, hold, notification-outbox and reconciliation jobs; a sandbox process is not its production scheduler.

## What was done for this preview

- Extracted the **source**, excluding 722 bundled `.next-dev` cache entries and the TypeScript build cache; retained the uploaded source/migrations and did **not** apply migrations or reseed the existing database.
- Initialized the source as the managed Manus WebDev project **AI Riches Network** with server and database capabilities. Installed exactly the lockfile dependencies with pnpm 11.25.0; source is restored without a local `.env.local`.
- Stored `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, and `KORA_SECRET_KEY` through the managed protected-secrets system. Payment credentials are test-mode credentials; live payments remain disabled.
- Copied the original supplied hero artwork to `public/manus-storage/async-images/JqF3sKTx85QkLLmyRAebqF/image-1.webp` because the archive referenced a previous preview's storage path. This makes the artwork render on this preview without relying on that old route. The application source now also uses the managed Preview origin and optional server-key fallback behavior.
- Started `pnpm dev` on `0.0.0.0:3000`; verified the managed Preview, homepage, real course detail, `/courses`, `/membership`, `/login`, artwork, `/api/health`, `/manus-routes.json` and public catalog endpoints. At verification time, public data returned **one published course** (Introduction to Ai Video Ads) and **one active membership plan** (Community Monthly).
- Ran `pnpm typecheck`, `pnpm test` (**13/13 passed**), and `pnpm build` (**passed**). These checks are source-level and unit tests; I did **not** rerun the fixture-writing integration scripts against the existing database. Supabase's read-only migration list confirms all 11 named migrations are present, though its applied version timestamps differ from the source filenames.

**Preview:** https://8328-iqw2vgew0jam8za26w1xc-c557bf5f.us1.manus.computer — managed WebDev Preview, not a public launch. The original archive remains `/home/ubuntu/upload/airiches.zip`; a preserved source backup is also retained at `/home/ubuntu/airiches-source-backup-20261006-0850`.

## Important boundaries and current gaps

1. **Protected runtime credentials are now configured in managed secrets.** The service-role and Paystack/Kora test keys are available to the server runtime but never stored in source or browser code. The private overview and payment-readiness paths should now be retested on this managed Preview. Registration/recovery callbacks still require an authorized Supabase Auth redirect origin and functioning email delivery.
2. **Existing integration evidence is historical, not a fresh pass here.** `docs/integration-validation.json` reports two-account auth/onboarding/enrollment/media/progress tests, credit-concurrency isolation, and Paystack/Kora test initialization/pending checks; `docs/lesson-video-validation.json` reports the supplied YouTube-link playback repair. They used controlled fixtures and are evidence from the prior environment. No completed payment or refund-provider acceptance is claimed.
3. **V1 remains incomplete.** `TODO.md` deliberately leaves full outcomes open where any acceptance clause is unmet. Notable work: complete global/product/plan/country setting precedence; notification-type configuration and real customer email delivery; robust admin appointment editing and booking/retention/mobile acceptance; scalable histories; successful provider sandbox payments/refunds; real business content, contact channels, country prices and merchant decisions; production domain, Auth SMTP and SEO. No live-payment activation or public production publication is authorized by this handoff.
4. **Admin/user security cannot be inferred from browser appearance.** The real database has RLS and guarded RPCs, but new work must retain server authorization, verified payment fulfillment, signed private-media access, origin/CSRF protection and audit behavior. Do not run `supabase/seed.sql` over the established project, blindly reapply migrations, run fixture-writing scripts casually, or log/share protected keys. The existing `/api/health` only confirms the Next.js process, not every dependent service.
5. **Portability note:** `PREVIEW_ORIGIN` in `src/lib/supabase/server.ts` now defaults to the managed Preview and can be overridden by `APP_ORIGIN`; the obsolete temporary origin was removed from the mutation allowlist. A future production deployment should replace temporary origin assumptions deliberately, validate Supabase Auth redirects, and use a production domain.

## Next development entry points

- **Product requirements:** start with `TODO.md` and `plan.md`; the owner-facing process and launch gates are in `docs/ADMIN-AND-LAUNCH-GUIDE.md`.
- **UI:** `src/components/portal.tsx` (student), `src/components/admin.tsx` / `admin-operations.tsx` (admin), `src/components/site.tsx` (public shell), and `src/app` (routes).
- **Business behavior:** `src/app/api/action/route.ts` (mutation dispatch), `src/app/api/data/route.ts` (read dispatch), `src/server` (domain operations), and the corresponding Supabase SQL/RLS migrations. Keep changes aligned across UI, API and database.
- **Running locally:** from `/home/ubuntu/airiches`, use `pnpm dev`; check `pnpm typecheck && pnpm test && pnpm build`. Add missing protected runtime keys only through an authorized secret-management channel; never paste them into source or this handoff. For future feature work, choose a specific TODO outcome, establish missing backend/redirect configuration, implement it end-to-end and test with isolated fixtures before claiming completion.
