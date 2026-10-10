# AI Riches Network — Owner Guide

## Current environment

Your verified `richesad1@gmail.com` account is the initial administrator. Open the application Preview, sign in, and choose **Admin centre** (the shield icon is also available on mobile). The backend is your separate Supabase project `zjnpckryymbjmxhauoux`, in organization `tpqjafasmzazlqzubbqn`. Finches was not modified. This is a **private beta Preview**, not a public production launch.

The site uses Next.js, TypeScript, Tailwind and Supabase Auth/PostgreSQL/private Storage. The deployed Supabase-native worker has JWT verification enabled, encrypted test credentials and a five-minute schedule for lifecycle processing. It handles expiry, reminders, publication, booking-hold release, due-video cleanup and bounded payment reconciliation. In-app notifications are real; the email outbox is **not evidence of delivered customer email**.

## Create your first real course

For a free course, open **Courses → New record**, supply its title, unique slug, description, instructor, category, level and access type FREE. Keep it DRAFT while writing it. Create its ordered course modules, then ordered lessons linked to those modules; add text, video, practice exercises, prompts and resources as appropriate. Use the media-upload controls rather than local filesystem paths. Publish the course when its content is ready.

For a purchase course, create an ACTIVE **COURSE product** first. Create a pricing option linked to that product with the appropriate country/currency and ONCE billing. Associate the product with the course before publishing; publication is rejected without an active course price. Amounts entered in the admin editor are **major currency units** (for example `75.00`); the server stores integer minor units using the currency metadata. Changing an existing price creates a version and preserves old orders. No real published course library or testimonials were invented for this build.

**People → user history** has an explicit courtesy course-access grant. It requires a reason, is audited, and creates no fake payment. Existing purchase/learning history remains separate from access rights.

## Configure the community

**Membership plans** owns the included review allowance and paid-period benefits. Community Monthly starts at GHS 75 with two included reviews; quarterly GHS 200 and annual GHS 700 are inactive examples. Renewal is currently **manual pay-to-renew**, not an automatic charge. Cancellation does not cut off the already-paid period. Included credits expire without rollover; an active member’s allowance replaces, rather than adds to, the free calendar-month allowance. Additional purchased review credits are separate.

Use Events, AI drops and Announcements for genuine content. Set audience PUBLIC or MEMBERS appropriately. Meeting links/private files are gated on the backend. Configure `community.whatsapp_url` in Business settings, enter the real invitation and activate the setting. It cannot be marked public. Membership gating protects delivery of the invitation, not a copied invitation: rotate it or moderate the WhatsApp group when necessary; automatic removal/messaging is not implemented.

| Setting                                    | What you can configure                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `learning.recommendation_mappings`         | JSON array of `{interest, experience_level, course_id}` for published free starting courses.                       |
| `gamification.badge_rules`                 | `{badge_key, activity, threshold}`; activity POINTS_TOTAL, LESSONS_COMPLETED or REVIEWS_COMPLETED.                 |
| `home.hero_title`, `home.hero_description` | Homepage introduction.                                                                                             |
| `public.testimonials`                      | Genuine approved `{quote, name, role}` entries; empty means hidden.                                                |
| `contact.email`                            | A real public support address, if you choose to supply one. The contact form already writes a private admin inbox. |
| Review limits/retention                    | Duration, allowed MIME types, byte limit, turnaround and raw-video retention from typed settings.                  |
| `refund.access_policy`                     | KEEP_ACCESS or REVOKE_FULL, applied only after independently verified full refunds. History is retained.           |

Points and basic badges are recognition, **not money**. The points rules control awards for completed lessons and reviewed projects. Advanced leaderboards/challenges remain outside V1.

## Review projects and provide 1-on-1 help

In Review queue, open the private video, assign/start the review and enter category scores, overall score, strengths, improvements and next steps. Students see their structured feedback and history. The upload server probes the actual video instead of trusting its declared type/duration. Initial limits are 90 seconds and an editable 50 MB cap; turnaround is 72 hours and raw-video retention is 30 days after completion. Deleting a raw video does not delete feedback/history.

Create support packages and their prices, then future availability windows with capacity and the real meeting link. The initial example is 30 minutes / GHS 100. A student’s hold reserves capacity temporarily; only verified payment confirms an appointment. Availability times are stored in UTC and shown in the viewer’s local time. Configure cancellation/rescheduling notice policies before offering sessions. A late paid booking that cannot be assigned is recorded as **REQUIRES_ACTION**, not silently lost or falsely confirmed; staff must arrange a resolution or process a refund outside this application.

## Payment mode and remaining launch gates

Both supplied merchant credentials are **test keys**. Ghana/GHS mobile-money checkout initialization and pending verification have passed for Paystack and Kora. No payment was completed and no real funds were charged. Unvisited Paystack `abandoned` sessions remain PENDING; they are not prematurely cancelled. Live checkout and automatic recurring billing remain disabled. Nigeria, Kenya and South Africa have configurable country/currency records, but their actual prices and merchant eligibility still need your business decisions and separate validation—no exchange-rate prices were invented.

Signed success webhooks independently verify reference, amount, currency, order and mode before transactional access grants. Replay tests confirm no duplicate grants. Refund history supports partial/full totals and unique refund IDs. The admin Payments/Refund history control **only looks up an already-processed test refund**; it never initiates a refund. Provider refund lookups and successful hosted payment completion still need merchant-sandbox acceptance testing; SQL ledger/replay tests are not a substitute.

Before a public launch, provide your real course content/instructors, approved testimonials, sessions/meeting links, membership copy, contact channels and country-specific prices. Configure production Auth SMTP for unrestricted student verification/recovery email and a verified transactional email sender/domain. Decide the public domain, update APP_ORIGIN and Supabase Auth Site/Redirect URLs, configure provider webhooks to that production origin and complete successful/failed/refund/payment-method tests. Public SEO/canonicals/sitemap must be finalized for the chosen production domain; this beta deliberately has noindex metadata. Do not treat a saved checkpoint or a successful Next.js build as publication.

## Engineering status and boundaries

The source contains versioned migrations, RLS/authorization, snapshot-safe pricing, real student/admin APIs, validated media, native jobs, unit tests and disposable two-student API fixtures. TypeScript and the production Next.js build passed. Tests cover real login cookies/onboarding/enrollment/private lesson access/completion, invalid media, concurrent last-credit uploads, cross-student denial, provider checkout/pending behavior, SQL replay/membership expiry/manual grants/points/badges and refund-ledger history. Detailed latest API results are in docs/integration-validation.json and repository tests.

The full master specification is **not yet fully launch-accepted**. The complete operational value hierarchy across global/product/plan/country overrides, all notification-type toggles/email delivery, complete admin appointment conflict-safe editing, unlimited history/lookup pagination, and exhaustive successful merchant/booking/retention/mobile acceptance remain open in TODO.md. These are stated gaps, not passed requirements. Real content, email sender configuration, local prices and live merchant decisions are owner-dependent gates.

Secrets are supplied only through protected configuration. Never paste keys/passwords into course fields, contact messages, chat or source. Do not re-run development seed SQL over an established live database: the seed is for initial provisioning, while business changes belong in admin. Production container setup is prepared, but the container was not publicly deployed. Source/checkpoint changes do not automatically publish.

## Security-advisor observations

Supabase reports [SECURITY DEFINER functions callable by signed-in users](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). These are deliberate transactional RPCs: student functions enforce current-user ownership/access and admin functions enforce active admin status internally. They must not be generalized into unguarded RPCs. The [RLS/no-policy notice for validated_uploads](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is intentional: browser roles have no read/write grants or policy; only trusted server validation and guarded submission can use the staging records. [Leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); review/enable it in your own Supabase Auth settings where available before production. No account-security or billing change was made for this advisory. These notices are documented, not described as a clean penetration test.
