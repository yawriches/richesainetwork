# AI Riches Network

Connected private beta built from the user-supplied product specification. See [Owner/admin and launch guide](docs/ADMIN-AND-LAUNCH-GUIDE.md), [full outcome ledger](TODO.md), and [approved plan](plan.md). This milestone is not full production/V1 acceptance and has not been publicly published.

## Stack and structure

- `src/app`: Next.js public/student/admin pages, authenticated APIs, auth callback, signed webhooks and health endpoint.
- `src/components`: editorial public UI, course/player/student/admin forms and operational controls.
- `src/lib`: Supabase client boundaries, safe catalog data, currency formatting and provider adapters.
- `src/server`: authorization, commerce/refund verification, protected learning media, recommendations and schema-aligned admin operations.
- `supabase/migrations`: forward-only schema, RLS, transactional workflows and native-job provisioning. The approved project already has these applied; do not reapply blindly.
- `supabase/functions/platform-jobs`: JWT-authenticated native lifecycle and bounded test-payment reconciliation.
- `supabase/seed.sql`: initial business values only, not a live-database reset.
- `tests` and `scripts`: unit, local rollback-only SQL and isolated two-student/provider API checks.

## Runtime

Use the pinned package manager in `package.json`, then `pnpm install --frozen-lockfile` and `pnpm dev`. Listen on `0.0.0.0:3000`; durable data/media belong in Supabase, not this process's filesystem. Supply credentials through protected deployment configuration, never commit them. The active beta is bound to project `zjnpckryymbjmxhauoux`; `src/lib/supabase/server.ts` contains that public project URL and the temporary beta origin. For another environment, set the correct APP_ORIGIN and update Supabase Auth Site/Redirect URLs; the hardcoded beta fallback is not a production domain.

`pnpm typecheck`, `pnpm test`, and `pnpm build` are the standard source checks. Development and production build directories are isolated to prevent hydration corruption. Docker installs dependencies and builds without private database access, then runs the standalone server with ffprobe/ffmpeg for genuine media inspection; a Docker image itself was not built/deployed in this milestone.

`GET /api/health` is unauthenticated. `public/manus-routes.json` declares 26 current page patterns; APIs and callback/system endpoints are excluded. Preview uses secure cross-site cookies. Browser third-party-cookie policies can still require opening Preview directly.

## Verification boundaries

Eight unit checks passed. The core SQL suite passed 23 assertions and operational SQL passed nine, with fixtures rolled back in disposable PostgreSQL. Latest actual API checks are in `docs/integration-validation.json`: two controlled student accounts, real session cookies, onboarding, free enrollment, entitled/private access, progress/recognition, invalid media, concurrent private upload credit protection and Paystack/Kora hosted checkout initialization/pending verification. Temporary accounts/content/media/orders were cleaned; no payment was completed and no real funds were charged. `scripts/check-integration.mjs` is an intentionally mutating fixture test; do not run it casually against a live business without reviewing its scoped fixture/cleanup behavior.

The five-minute Supabase cron dispatches the authenticated Edge worker; manual authorized HTTP 200 and anonymous HTTP 401 were observed. Email outbox records are not delivered emails. Financial success/refund provider acceptance, complete booking/retention/mobile acceptance and remaining operational requirements in TODO are not reported as passed. Beta metadata has noindex; final public SEO needs the actual production domain.

The canonical managed Git checkpoint stores code separately from publication. Automatic publication is off. Do not enable live payments or publicly publish without completing the documented owner-dependent and engineering launch gates.
