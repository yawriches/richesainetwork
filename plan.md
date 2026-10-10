# AI Riches Network — V1 Implementation Plan

## 1. Goal and source of truth

Build a real, secure, database-driven AI education and community platform from `AIRICHESNETWORKProduct.docx`, not a collection of static screens. The core journey is:

**Learn → Practice → Get Feedback → Get Help → Improve → Build Skills → Monetize.**

The administrator must be able to operate the business—content, products, pricing, membership benefits, review allowances, appointments, countries, providers, and operational settings—without editing source code.

This plan covers the complete operating V1. Implementation will proceed through connected milestones; those milestones organize the work, rather than reducing the requested scope. Features explicitly designated as future work remain outside V1.

## 2. Confirmed decisions and current state

- **Backend:** a new, separate Supabase project named **AI Riches Network**.
- **Target Supabase organization:** **Ai Riches Network**, as supplied by you. During execution, resolve that display name to an organization ID and verify that the connected account has permission to create projects there. Do not substitute the existing organization or modify `finches`.
- **Planned region:** Ireland, `eu-west-1`, matching the existing project’s region. This is an adjustable infrastructure assumption, not a claim about legal data-residency requirements.
- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, and accessible reusable components.
- **Application backend:** Supabase PostgreSQL, Auth, Storage, RLS, SQL functions, and Edge Functions; Next.js server routes provide application operations and any Node-specific media validation.
- **Payments:** Paystack and Kora through a shared provider interface, as required by the specification. Do not replace them with Stripe.
- **Workspace:** the managed web project exists at `/home/ubuntu/airiches`; initialization reported an empty workspace with no framework, application code, dependencies, or running application. No implementation is complete.
- **Hosting:** use the managed project’s preview and prepare a production container for Next.js. Keep durable business data and uploaded files in Supabase, not the container filesystem.

**Provisioning constraint:** if the requested organization cannot be found, access is unavailable, or project creation requires a paid commitment or explicit approval, stop at that dependency and request the necessary action. No purchases, account-plan changes, or modification of the unrelated `finches` project are authorized by this plan.

## 3. V1 scope

### Public website

Build Home, Courses, Course Detail, Membership, About, Contact, Registration, Login, password recovery, and authentication callback pages.

- Home explains the learning ecosystem, skill areas, how it works, courses, community, technical reviews, and live support, with clear calls to action.
- Course catalog supports access type, category, and experience-level filters, search, and pagination.
- Course details show instructor, curriculum, lesson count, duration, objectives, prerequisites, applicable price, and access requirements.
- Membership displays only active, available plans and their database-defined benefits.
- Public copy and featured content are manageable through admin settings/content records where operationally useful.
- Testimonial sections remain hidden until genuine, approved content exists; do not invent customers, outcomes, revenue, ratings, or income guarantees.

### Accounts and onboarding

Use Supabase email/password authentication with verification, sign-in, sign-out, password recovery, and protected sessions. Configure actual preview and eventual production redirect URLs.

Onboarding records country, interests, and experience level, then recommends a suitable published course or next action. Use configurable recommendation mappings rather than an unnecessary AI tutor.

Implement Student and Admin permissions. Community membership is an entitlement, not a client-controlled role. Structure permissions to accommodate future reviewers, instructors, and moderators without building their full interfaces now. Establish the owner’s initial admin access through a verified identity and a trusted bootstrap step; never let users promote themselves.

### Student experience

Build a mobile-first dashboard with one prominent next action and:

- enrolled courses, progress, and resume links;
- review credit balance, submission status, and completed feedback;
- membership plan, status, benefits, and renewal/end date;
- upcoming appointment and authorized meeting link;
- latest AI drops, events, announcements, and notifications;
- real learning/review statistics and any implemented recognition records.

Organize navigation into Learn, Practice, Support, Community, and Account. Include profile, preferences, purchase history, membership management, review history, and appointment history. All empty states explain what the learner can do next.

### Dynamic learning system

Admin manages courses, modules, ordered lessons, resources, access types, publication state, and featured content. Lessons support video, rich text, images, downloadable resources, external links, exercises, and prompts.

Implement free enrollment, paid-course entitlement access, eligible-membership course access, lesson completion, current lesson, resume, completion percentage, and completion date. Preserve purchased-course access and historical progress when membership expires. Gate protected lesson content and files at the backend, not merely by hiding buttons.

### Products, pricing, memberships, and entitlements

Use the central model:

**Product → Price option → Order → Verified payment → Entitlement.**

- `product_prices` is the source of truth for amounts and currencies; courses and membership plans reference it instead of duplicating prices.
- Membership plans define billing/duration, supported countries/providers, included reviews, status, and benefits.
- Admin can create, edit, activate, pause, archive, reorder, and feature applicable products/prices/plans.
- Snapshot the price, currency, benefits, and applicable terms at purchase so subsequent edits do not rewrite transaction history or silently change an already-paid period.
- Price changes create a new applicable price version; new purchases use the active version. Existing subscription repricing requires an explicit future policy, not an implicit overwrite.
- Support active, expiring, expired, cancelled, and paused membership behavior. Cancellation stops future renewal while access remains until the paid period ends. Expiry removes only membership-derived access and allowances.
- Include country/provider/currency eligibility and simple date-bounded promotional prices. Advanced coupon campaigns, complex usage limits, and referral systems remain future work.

### Technical reviews

Build a submission form with video upload, project category, review category, description, and question/request. Display limits, expected turnaround, and current credits from configuration.

- Private uploads use a staged/quarantine workflow. Validate actual size, file type, and video duration server-side; browser metadata is advisory only.
- Use Node-compatible media probing in the Next.js container for validation that cannot run reliably inside a Supabase Edge Function. Do not trust a user-supplied duration field.
- Atomically consume a valid credit only when the submission is accepted; concurrent requests must not overspend the balance.
- Included allowances are scoped to periods, expire without rollover, and are computed from configuration or the active membership plan. Purchased credits are tracked separately.
- Admin queue shows pending, under-review, completed, and overdue submissions with user, reviewer, dates, category, authorized video access, and history.
- Admin assigns reviewers, records configurable category scores, an overall score, strengths, improvements, and next steps, then publishes feedback.
- Implement **PENDING → UNDER_REVIEW → REVIEWED** with server-validated transitions.
- Automatically delete eligible raw review videos after the configured post-completion retention period while retaining submission metadata, scoring, feedback, and audit history. Never apply that cleanup to unrelated buckets or the existing Supabase project.

### 1-on-1 support

Admin manages packages, prices, duration, availability, blocked dates, capacity, booking window, cancellation/rescheduling rules, and meeting links.

Students choose package/date/time, pay through an available provider, receive a confirmed appointment after verified payment, and view appointment history. Hold capacity temporarily during checkout using an expiring reservation; avoid double booking with database transactions/constraints. Use UTC storage with explicit local-time display. Meeting links are visible only to authorized participants and administrators.

### Community and notifications

Build member-gated WhatsApp access, AI drops, resources, events, and announcements. Admin creates and updates publication dates, audience, status, links, media/resources, event schedules, recordings, and cancellations.

WhatsApp is a configurable communication link within the platform, not the product itself. A basic shared invite link cannot prevent an expired member from retaining a previously copied invite; document this limitation and support invite rotation/admin moderation rather than claiming automatic WhatsApp removal.

Implement in-app notifications and a durable notification outbox for purchases, enrollments, reviews, membership state changes, appointments, events, AI drops, and announcements. Configure reminder timing. Add customer email delivery only after a suitable sender/provider and domain are available; an in-app record must not be reported as a delivered email. Automated WhatsApp messaging is out of scope.

### Admin control center

Provide management screens for:

- users and their course, purchase, membership, review, and appointment histories;
- products, pricing, basic promotional prices;
- courses, modules, lessons, resources;
- membership plans, benefits, subscribers;
- reviews, credit adjustments, scoring criteria, settings;
- appointment packages, availability, bookings;
- AI drops, events, announcements;
- transactions, orders, subscriptions;
- typed business settings, countries, currencies, provider availability, notification and storage policies;
- audit history and basic operational analytics.

Account suspension, manual credit adjustments, publication, and configuration changes require admin authorization and audit records. Payment records cannot be marked successful to bypass provider verification. Any manual access grant is a distinct, audited admin entitlement action.

Analytics use actual database aggregates, filter by date, and separate revenue by currency rather than adding unlike currencies together. Include user totals/activity, paying users, active members, revenue by product, pending/overdue reviews, upcoming appointments, and popular courses.

### Recognition foundation

Create points ledgers, activity-rule configuration, badge definitions, and user award records with idempotent event identifiers. Include a minimal admin-managed foundation and basic profile display where useful. Points have no cash value. Elaborate challenges, leaderboards, reward programs, and advanced achievements are deferred in accordance with the V1.5/V2 scope.

## 4. Architecture and data ownership

Use a modular application, not microservices.

### Main database groups

| Domain | Main records |
| --- | --- |
| Identity | profiles, roles/permissions, onboarding preferences |
| Commerce | products, product_prices, orders/order_items, payments, payment_events, entitlements |
| Membership | membership_plans, plan_benefits, subscriptions, subscription_periods |
| Learning | courses, course_modules, lessons, course_resources, enrollments, lesson_progress |
| Reviews | review_categories, scoring_criteria, review_credit_grants/ledger, review_submissions, review_feedback, category_scores |
| Support | support_packages, availability, blocked_dates, booking_holds, appointments |
| Community | ai_drops, resources, events, announcements |
| Operations | business_settings/categories, countries, currencies, provider/country eligibility, notification_rules, notifications/outbox, audit_logs, job_runs |
| Recognition | points_rules, points_transactions, badges, user_badges |

Use foreign keys, unique constraints, indexed query paths, timestamps, integer monetary minor units with currency metadata, and validated state transitions. Add only tables needed to support these responsibilities.

### Configuration source of truth

Typed configuration validates ranges, units, URLs, and permitted values. Specialized records own prices, plan allowances, countries, and benefits; the generic settings table must not become a conflicting second source.

Define explicit precedence: global operational defaults → applicable product or plan overrides → eligible country-specific configuration. Promotional prices are selected only when their status, dates, and eligibility match. Ambiguous overlapping price rules are rejected by admin validation rather than selected unpredictably.

All security-sensitive operations re-read effective configuration server-side. Public caching is invalidated after relevant admin updates; private access decisions are never taken from a stale browser setting.

### Authentication and security

- RLS on every exposed business table and appropriate storage policies.
- Students can read/write only permitted personal records and cannot alter payments, entitlements, credit balances, membership state, points, badges, or roles.
- Admin authorization is checked on the server and in database policy/functions.
- Use user-scoped Supabase clients for normal access. Restrict service credentials to trusted backend operations; never bundle them in frontend code.
- Cookie-backed HTTPS preview sessions use compatible `SameSite=None; Secure` handling with CSRF/origin protections. Provide standalone login guidance if third-party cookies are blocked.
- Private files use short-lived authorized signed URLs. Member-only downloads must not be stored as permanently public assets.
- Apply input validation, rate limits, safe rich-text rendering, pagination, human-readable errors, and redacted operational logs.
- Audit significant admin changes with actor, action, target, previous/new values, and timestamp.

### Payments

Implement provider adapters for checkout initialization, verification, webhook authentication, supported payment methods, subscription/renewal capabilities, and cancellation where supported.

The backend creates orders and derives price/currency/provider eligibility from the database. Verify webhook signatures and independently verify transaction reference, amount, currency, success status, and order association. Fulfillment is transactional and idempotent with unique provider references/event handling and replay protection.

Payment return pages show pending/verified/failed outcomes but cannot grant access. Add reconciliation for missing/delayed webhooks. Handle refunds without deleting payment history and apply the configured access policy.

Recurring billing depends on the provider, merchant account, country, currency, and payment method. Confirm current capabilities during execution and expose only supported renewal options. Where auto-renew is unsupported, clearly label any pay-to-renew option; never present it as an automatic subscription or claim unsupported recurring billing is complete.

### Storage and application-owned jobs

Use separate Supabase buckets for course assets, review videos, AI drops, avatars, and protected resources. Separate public thumbnails from protected instructional/download content.

Use Supabase-native scheduled execution and Edge Functions/SQL functions for membership expiry, period reconciliation, configurable reminders, outbox delivery, publication, booking-hold release, and retention cleanup. No detached sandbox process or recurring Manus task is the production scheduler. Jobs are authenticated, idempotent, retryable, logged, and bounded in batches. Access expiry is also enforced at request time, so a delayed job cannot extend membership access.

## 5. Initial database seeds

These are editable database records, never frontend constants.

| Configuration | Initial value |
| --- | --- |
| Community Monthly | GHS 75/month; active; 2 included reviews per billing cycle |
| Community Quarterly / Annual | GHS 200 / GHS 700; inactive examples |
| Free reviews | 1 per month |
| Additional review | GHS 20 |
| Maximum review video duration | 90 seconds |
| Maximum review upload size | 50 MB, provisional editable value from the specification’s example |
| Review turnaround | 72 hours |
| Raw video retention | 30 days after review completion |
| 1-on-1 package | 30 minutes, GHS 100 |
| Launch countries | Ghana, Nigeria, Kenya, South Africa |
| Payment provider records | Paystack, Kora; checkout availability requires configured credentials and valid country/currency support |

Seed country/currency/provider associations only after verifying provider support. Do not invent non-Ghana product prices or apply unapproved exchange-rate conversions. A launch country can be present for accounts while paid checkout remains unavailable until an eligible price/provider is configured.

Do not fabricate a finished course library. Build authoring functionality and clearly labeled draft starter content; publication requires actual lesson material. WhatsApp links, meeting links, contact details, and testimonials remain unset/hidden until supplied.

## 6. Design direction

**Design movement:** contemporary editorial learning platform with restrained African creative-tech character—not a crypto/wealth dashboard.

**Core principles:** beginner-first clarity; one obvious next action; trustworthy proof over hype; content and progress before decoration.

**Color philosophy:** warm ivory surfaces make learning approachable, deep forest text/navigation communicates trust, and vivid chartreuse gives the brand energy. Use muted neutrals and semantic feedback colors with accessible contrast.

**Signature brand color:** chartreuse `#C8F45A`, paired with forest `#12382E` and ivory `#F6F5EF`. Use chartreuse with dark text, not low-contrast white text.

**Layout paradigm:** an asymmetrical public hero with a strong editorial headline and a purposeful creative-learning visual. Follow with clear learning pathways and alternating content bands. Student pages use a compact sidebar on desktop and a mobile drawer/bottom-action pattern; the dashboard leads with a next-step panel rather than a wall of statistics. Admin screens prioritize tables, filters, and focused edit forms.

**Signature elements:** a connected ascending-path mark; numbered Learn/Practice/Grow markers; restrained progress arcs and pill-shaped topic labels.

**Typography:** Space Grotesk for major headlines and wordmark; DM Sans for body, forms, and navigation. Keep headlines concise, body text readable, numerical data aligned, and labels in plain language.

**Wordmark/logo:** custom “AI RICHES” wordmark with a small “NETWORK” descriptor and a three-step connected path symbol. It should suggest learning progress and connection, not guaranteed financial returns.

**Brand essence:** a guided AI skills ecosystem helping beginners learn, practice, receive support, and build toward income. Personality: **encouraging, capable, energetic**.

**Brand voice:** direct and supportive. Example lines: “Turn what you learn into something you can build.” and “Your next step: finish your first AI project.” CTAs describe the action: “Explore free courses,” “Submit your work,” and “Book expert help.”

**Interaction:** visible loading/success/error states, forgiving forms, clear access explanations, keyboard support, large tap targets, and confirmations for meaningful admin actions.

**Animation:** brief 150–220 ms transitions for menus, buttons, and progress updates; optional subtle public-page entrances; respect reduced motion. No autoplay background video, excessive parallax, or distracting dashboard animation.

**Assets:** after approval, source or generate only visuals with defined placements—public hero/brand assets and relevant thumbnails. Do not generate decorative dashboard art or fake testimonial portraits. Optimize media for mobile bandwidth.

## 7. Project structure and serving

```text
/home/ubuntu/airiches/
  src/app/
    (public)/                 Marketing, catalog, membership, about/contact
    (auth)/                   Registration, login, recovery, callbacks
    (student)/                Dashboard, learning, reviews, support, community/account
    admin/                    Protected business control center
    api/                      Secure app endpoints, media validation, health
  src/components/
    ui/                       Accessible shared primitives
    layouts/                  Public, student, admin navigation/layouts
    learning/ reviews/        Domain-specific interface components
  src/lib/
    supabase/                 Browser, user-scoped server, privileged clients
    auth/                     Identity and authorization helpers
    configuration/            Typed settings and eligibility resolution
    payments/                 Paystack/Kora adapters and order orchestration
    entitlements/             Central access checks
    validation/               Shared schemas and file constraints
  src/server/
    services/                 Domain operations and transactional workflows
    queries/                  Paginated reads and analytics
  supabase/
    migrations/               Versioned schema, functions, RLS, storage policies
    functions/                Webhooks, jobs, notification delivery
    seed.sql                  Editable initial business values and draft starter content
  tests/                      Unit and integration/security checks
  public/                     Brand assets and manus-routes.json
  docs/                       Setup, admin operations, handoff, requirement coverage
  Dockerfile                  Reproducible Next.js production container
  app.config.ts               Project logo metadata
  TODO.md                     Full outcome criteria and tracked implementation status
```

Pin dependencies/package manager, configure language diagnostics before application coding, and maintain a synchronized route manifest. Run preview on the configured port 3000. Production serves Next.js public SSR pages, authenticated pages, and API endpoints from the container; Supabase owns persistent data/auth/storage/functions. Use runtime secrets, an unauthenticated health endpoint, and a production build that does not require access to privileged data during compilation.

Public pages have meaningful initial HTML and route-specific metadata. Exclude private pages from indexing and caching. Canonical/social/sitemap absolute URLs use the actual selected public domain, not an internal preview host.

## 8. Implementation sequence

1. **Provision and scaffold:** resolve the chosen organization, create the isolated Supabase project subject to any approval requirement, connect protected credentials, establish Next.js/configuration/diagnostics, and create detailed outcome tracking from the specification.
2. **Secure foundations:** migrations, RLS, storage policies, owner bootstrap, authentication, onboarding, typed settings, countries/currencies, products/prices, and audit logging.
3. **Learning vertical slice:** public site/catalog, admin course authoring, free enrollment, lesson player/progress, student dashboard, and authoritative content/access rules.
4. **Commerce and membership:** both payment adapters, test-mode checkout/webhooks, transactional fulfillment, course purchases, membership periods/benefits, cancellation/expiry, purchase history, and extra-review purchases.
5. **Practice and support:** secure review uploads/validation/credits/admin feedback/retention, appointment availability/reservations/payment confirmation/history/admin management.
6. **Community and operations:** AI drops/events/resources/announcements, WhatsApp gating, in-app notifications/outbox/reminders, native jobs, recognition foundation, and actual-data analytics.
7. **Integrated verification and handoff:** correct confirmed defects, document dependencies and unresolved items, save a recoverable checkpoint, and deliver the working preview plus setup/admin guidance. Prepare deployment without silently launching live payments or publishing broadly.

External credentials/content can block particular outcomes, but not justify replacing real behavior with a fake success flow. Track those outcomes explicitly as blocked rather than completed.

## 9. Verification plan

Completion is measured by the specification’s end-to-end behavior, not by page count.

- Run TypeScript diagnostics, linting, unit/integration checks, and the production build.
- Verify registration/login/onboarding, free enrollment, authorized lesson access, completion/resume, and correct dashboard state with real test users.
- Demonstrate that admin changes to prices, plan benefits, review limits/duration/retention, content, countries, and provider status take effect without a source edit.
- Exercise Paystack and Kora in available test environments: success, failure, pending, forged return parameters, mismatched amount/currency, duplicate webhook, and concurrent fulfillment. Verify exactly-once entitlements and no frontend unlock.
- Check membership cancellation/end-of-period access, expiry, renewal periods, non-rollover credits, and preserved purchased courses/history using controlled test fixtures.
- Check credit-consumption concurrency, invalid/oversized/over-duration uploads, private video ownership, feedback publication, and cleanup that removes only due raw files while preserving history.
- Check appointment conflicts, expired holds, payment retries, rescheduling/cancellation policy, timezone display, and private meeting links.
- Test RLS using two student identities and an admin; attempt cross-user reads and unauthorized writes to roles, credits, payment states, memberships, points, and badges.
- Verify native jobs are actually deployed/scheduled and inspect execution evidence; a function file alone is not an active scheduler.
- Verify representative public HTML/metadata, missing-page status, route manifest, private caching/indexing, and mobile accessibility/layout through automated checks and targeted interaction checks where needed.
- Use one read-only implementation review to trace requirements and integration boundaries, then fix confirmed gaps. Avoid treating unavailable provider/email credentials or unprovided course content as passed tests.

## 10. Assumptions, dependencies, and launch boundaries

### Explicit working assumptions

- Free review periods use calendar months in UTC. Membership allowances use the actual paid billing period; membership allowance replaces, rather than adds to, the free allowance.
- Included credits do not roll over. Purchased additional-review credits remain available until consumed unless the administrator introduces an explicit expiry policy. Credit consumption prioritizes included credits that expire sooner.
- Reminder offsets, accepted file formats, booking-hold lifetime, and appointment policy thresholds are editable records. Provisional operational seeds are documented rather than embedded in code.
- Existing paid membership terms remain valid for the purchased period; subsequent changes apply to new periods according to explicit policy.
- Begin in payment test mode. Live activation is a separate readiness decision, not automatic upon implementation.

### Dependencies and risks

- The **Ai Riches Network** organization must exist, be visible through the connector, and allow project creation. If not, you will need to create/select it or provide appropriate access; do not silently create an organization or change its membership/billing.
- Supabase provisioning may require a provider confirmation or paid capacity. Any such commitment pauses for your approval.
- Paystack/Kora merchant accounts, protected test/live credentials, enabled methods, webhook settings, and recurring-billing eligibility are needed for complete provider validation.
- Supabase runtime credentials and any email-provider secrets go through protected input/configuration, never chat, source files, or logs.
- Production email delivery needs sender/domain configuration; real course media/content, instructor/contact details, WhatsApp invitation, support availability, and meeting links need owner input.
- Private video validation/retention and gated downloads require careful storage and server coordination; storage costs and throughput should be monitored against actual usage, not promised upfront.
- Browser privacy settings may restrict embedded authentication; keep security intact and provide standalone access where required.
- Income positioning must stay aspirational, not a claim that users are guaranteed earnings.

### Not in V1

Creator marketplace/directory, certification, client matching, elaborate social networking, advanced AI tutor, complex referrals/CRM, advanced reward economy, leaderboards, and excessive microservices or animations.

### Delivery and approval boundary

Deliver a functioning, database-backed preview, versioned source/migrations, recoverable checkpoint, setup/admin guide, and a transparent requirement-status record. Public production publication, custom-domain changes, paid service commitments, and live-payment activation are not implied by this plan approval and will follow their applicable authorization steps.

**Approval of this plan authorizes implementation of the scoped V1 and creation/configuration of its isolated Supabase project in the specified organization, subject to provider permission and cost-confirmation gates.**

## Execution update
The owner supplied existing project zjnpckryymbjmxhauoux in organization tpqjafasmzazlqzubbqn. Direct discovery verified Ai Riches Network, ACTIVE_HEALTHY, London eu-west-2. Reuse this project and preserve its region; do not create another project.


# Riches AI Network Refinement — October 7, 2026

## Goal
Refine the existing private-beta platform into **Riches AI Network**, improve the learner dashboard and learning discovery flow, add a dedicated **AI Marketplace**, give Expert Support a lively non-photorealistic profile treatment, and replace the current resource-only community view with a basic member social feed for text, images, comments, reactions, and reporting.

## Confirmed product decisions

- Rename user-facing **AI Riches Network** to **Riches AI Network** across metadata, navigation, wordmark, footer, auth fallbacks, health copy, and learner/admin copy. Preserve backend project identifiers and storage/database names unless they are user-visible.
- Learner top header keeps one notification control only; remove the message icon, non-functional three-dot control, and the “Your space” breadcrumb. The search control becomes full-width and comfortably tappable on mobile.
- Public navigation detects a signed-in session: hide **Log in** and change **Get started** to **Dashboard**. Add **AI Marketplace** to public and learner navigation.
- Dashboard and My learning cards show course thumbnails. The overview adds a strategic catalogue strip: enrolled courses first, then featured purchasable courses, then free courses. No course is shown as available if it is not published.
- Expert Support gets a warm, illustrated monogram avatar treatment rather than an invented photorealistic portrait. A supplied real photo can replace it later without changing the component contract.
- Community is authenticated-only and basic by design: text posts, optional image upload only, comments, likes, delete-own-post, reporting, pagination, and clear empty/loading/error states. Videos are not accepted for community uploads. Admin access is retained through server authorization and moderation records.

## Implementation approach

### Branding and navigation
- Update `src/components/site.tsx`, `src/app/layout.tsx`, auth/admin/health copy, and relevant public copy.
- Add session-aware public header state using the existing `getData("me")` endpoint.
- Remove the redundant learner header controls and add responsive mobile rules in `globals.css`.

### Marketplace and course discovery
- Add `/marketplace` with a client catalogue component receiving published course data from the existing public catalogue query.
- Use an editorial marketplace layout: featured course rail, search, category/level/access filters, thumbnail-rich cards, and empty states. Keep `/courses` intact for backward compatibility.
- Extend dashboard data with a bounded list of published courses and filter already-enrolled courses in the learner UI.

### Community backend
- Add migration `20261007000100_member_community.sql` with `community_posts`, `community_comments`, `community_reactions`, and `community_reports`.
- Add strict RLS, indexes, ownership rules, admin moderation access, and a private `community-media` image bucket with authenticated-owner upload policy.
- Extend `/api/data` with a bounded `community_feed` response that joins safe author fields server-side, signs permitted image paths, counts reactions, and marks the current user’s reaction.
- Extend `/api/action` with validated create/comment/react/report/delete actions. Never trust client-supplied author IDs or storage paths.
- Extend the upload route to allow only authenticated image uploads to `community-media`, with per-file size/type limits and user-owned folders.

### Community frontend
- Replace the `type="all"` resource-only view with a basic feed while preserving Events and AI drops views.
- Add post composer, image preview/upload, feed cards, reaction toggle, comments, report action, and delete-own-post control.
- Keep the interface friendly and lightweight; no video upload, public indexing, or real-time subscription is required for this first community slice.

## Design direction

- **Design movement:** editorial creator-community workspace: calm, useful, and social without becoming a noisy social network.
- **Core principles:** one obvious action; content-first cards; comfortable mobile touch targets; visible trust and moderation boundaries.
- **Color philosophy:** the existing indigo/lavender/cool-grey palette remains the signature system; social feedback uses restrained rose, cyan, and violet semantic accents, with no return to green/brown brand colors.
- **Layout paradigm:** asymmetric desktop dashboard with a wide feed and compact context rail; mobile collapses to one readable column and places secondary support content below primary progress.
- **Signature elements:** thumbnail-led course cards, soft avatar rings, and small reaction/comment metadata rows.
- **Interaction:** optimistic-feeling but server-confirmed actions, disabled submit states, inline errors, accessible labels, and no hidden destructive actions.
- **Animation:** use existing short transitions only; respect reduced motion; no autoplay media.
- **Typography:** Space Grotesk for headings/metrics and DM Sans for body, controls, and metadata.
- **Brand essence:** practical AI learning and peer momentum for people building their next chapter. Personality: capable, encouraging, connected.
- **Brand voice:** direct and warm. Examples: “Find your next useful skill.” and “Share what you’re building.”
- **Wordmark:** ascending connected path remains, with the wordmark reordered to **RICHES AI / NETWORK**.
- **Signature color:** indigo `#6657E8`, supported by lavender `#D8D4FF` and cool ivory `#F5F7FB`.

## Project structure additions

```text
src/app/(public)/marketplace/page.tsx   Dedicated AI Marketplace route
src/components/marketplace.tsx          Search/filter/thumbnail catalogue UI
supabase/migrations/20261007000100_member_community.sql
                                             Social tables, RLS, indexes, private image bucket
src/components/portal.tsx               Learner header, dashboard, learning, support, community UI
src/app/api/data/route.ts                Dashboard and community feed reads
src/app/api/action/route.ts              Community mutations
src/app/api/assets/upload/route.ts       Community image upload validation
public/manus-routes.json                 Marketplace route declaration
```

The work remains a managed WebDev change. Supabase remains the source of truth for posts, comments, reactions, reports, course data, entitlements, and media authorization; the Next.js server remains the authorization and API boundary.


## Paid-member community management extension

The community is a paid-membership entitlement, not a general logged-in feature. Server-side access checks use the existing `has_membership` function and an additional community control layer; administrators retain access for moderation and operations.

The backend adds typed community settings for membership gating, enable/disable state, posts-per-day, comments-per-day, post cooldown, maximum active posts, post/comment length, and image size. A per-member control record supports active, suspended, and banned states, posting blocks, reasons, and moderator ownership. Moderation actions are append-only and audited for member, post, comment, settings, and report changes.

Supabase RLS and server routes enforce the rules independently of the UI: non-paid members cannot read or mutate community posts, comments, reactions, reports, or member-only events/drops/announcements; suspended or banned members cannot participate; rate and cooldown limits are evaluated server-side; image uploads remain private and bounded. The access snapshot returns a safe explanation and current usage for the learner paywall.

The admin operations sidebar gains a Community Control Center with settings, member search and suspension/ban controls, moderation queue, post/comment moderation, report resolution, and visible usage/limit summaries. Specialized admin actions use server authorization, service-role data access only after administrator verification, and moderation audit records.

Design remains restrained and operational: white/slate workspace surfaces, indigo controls, status chips for membership/moderation state, a clear settings panel, and compact moderation tables rather than a decorative social dashboard.


## Community visibility and AI support direction

Community is now a reversible product feature, not a permanent navigation commitment. The administrator can disable it from the Community Control Center; disabling must hide community navigation, dashboard cards, public marketing copy, WhatsApp/community links, and learner-facing community pages, while retaining the admin control so the feature can be re-enabled without a deployment. Server/API/RLS access remains blocked when disabled.

The next product priority is an AI support agent that strengthens the learning and practice journey. The first release should be FAQ and course-help focused: public visitors receive platform and published-course information; signed-in learners receive account-aware guidance; protected course answers require an entitlement/access check; paid community membership can be used as an eligibility signal but must never be inferred from client state. The answer pipeline should retrieve approved FAQ/course context first, apply authorization before protected retrieval, then use a low-cost model only when a grounded answer is available. Unknown, sensitive, or account-specific requests should route to a human/support workflow rather than being guessed.

The agent should be prepared as a replaceable service boundary with durable conversation/audit records, source citations, rate limits, prompt-injection defenses, and a clear distinction between public, learner, and administrator context. WhatsApp can remain a future communication channel, but the web platform should continue focusing on courses, assignments, reviews, and support until the community product decision is settled.


## AI support implementation

The first release will use the platform-provided OpenAI-compatible LLM service from the server only, with `gpt-5-mini` as the cost-aware default. The application will not expose provider credentials in the browser. A server-owned AI support route will accept public and authenticated learner questions, retrieve only published approved sources allowed for the current audience and entitlement, include a minimal learner context when signed in, and store conversation/message audit records. When the model is unavailable, the route will fail safely with a support message rather than inventing an answer.

The administrator gets a dedicated AI Support control center with a kill switch, public/learner availability controls, model selection, welcome/fallback copy, system guidance, rate limits, FAQ/course/policy source management, and recent conversation review. The source editor will support public FAQs, learner guidance, course-specific sources, drafts, publication, archiving, and optional course ownership. The agent will explicitly refuse to reveal protected course content when the learner is not entitled to that course.

The learner and public experience will use a compact indigo assistant panel with clear citations and an escalation path. It will be available to visitors when public assistance is enabled and to signed-in learners when learner assistance is enabled. Admin-only configuration and conversation review remain behind the existing server administrator boundary.


## Superseding product decision — 6-week AI-to-Income Mentorship

The AI Marketplace/course-discovery route is removed from the Riches AI Network interface and route manifest. Courses remain accessible through the normal Courses and membership-learning journeys; the learner header search routes to the existing Courses catalogue instead of a marketplace.

The new premium offer is **AI-to-Income Mentorship**, a fixed **6-week one-on-one application programme**. It is not an instant checkout product and no price is invented until the owner supplies the investment amount and payment policy. The public route `/mentorship` explains the transformation without promising income, presents six practical weekly stages, and collects an application with name, contact, current situation, AI experience, goals, current project, weekly capacity, motivation, support needs, and consent.

Applications are stored privately in Supabase with statuses NEW, REVIEWING, NEEDS_INFO, ACCEPTED, DECLINED, or WITHDRAWN. A separate event table records status changes and admin notes. The public action route uses server validation, a honeypot, rate limiting, and a generic success response. The admin operations centre gains a Mentorship Applications section where authorized administrators can review applicant details, update status, add internal notes, and see the six-week programme context. No applicant is accepted, charged, or promised a place automatically.

Design remains calm and premium: indigo accents, cool ivory surfaces, a high-contrast editorial hero, a six-step timeline, and a focused form. The offer should feel selective and personal rather than like another catalogue card. Brand voice is direct and grounded: “Turn your AI capability into a focused offer.” and “Apply for a six-week working partnership.”

Project additions: `src/app/(public)/mentorship/page.tsx`, `src/components/mentorship-application.tsx`, `src/components/admin-mentorship.tsx`, migration `20261008000100_ai_income_mentorship.sql`, and the updated public/admin API boundaries and route manifest.


## Paid-member community video activation — Bunny Stream

The community remains enabled for eligible paid members. It will expand from text-and-image posts to short **Bunny Stream** video posts while retaining the existing paid-membership gate, administrator kill switch, reporting, suspension, banning, moderation, and audit trail.

The first video release uses a deliberately constrained, mobile-friendly policy: **one video upload per member per UTC day**, **three active video posts per member**, a **250 MB source-file maximum**, a **three-minute maximum duration**, and one video attachment per post. Supported uploads are MP4, QuickTime MOV, and WebM. Text remains required as the context/caption for every video; image and video attachments are mutually exclusive. These limits are administrator-configurable within safe bounds, are checked before Bunny creates an upload slot, and are rechecked when Bunny reports processing completion.

The upload architecture is direct-to-Bunny, not browser-to-application: an authenticated paid member requests a server-authorized upload session; the server creates a Bunny Stream video object and returns a short-lived, scoped TUS signature; the browser uploads resumably through `tus-js-client`; then the app finalizes the pending record. Bunny’s API key and security keys remain server-only. A signed Bunny webhook updates processing states and rejects/deletes files that violate the applied size or duration rules. Incomplete uploads expire from the application workflow and never appear in the member feed.

Member playback is signed server-side using Bunny Embed View Token Authentication, with short-lived iframe URLs returned only to eligible community viewers. All uploaded videos remain unavailable until they are processed and linked to a published post; hidden, deleted, or owner-removed posts lose their playback path. The Bunny library should enable embed token authentication and restrict allowed embed domains to the current Preview domain and the future production domain.

The Community Control Center will gain video enablement and limit settings, a recent-video moderation queue, visibility controls, delete controls that remove Bunny assets, and auditable video moderation actions. The normal community feed will offer upload progress, encoding state, contextual media labels, and a compact Bunny player once a video is ready. The webhook endpoint is `/api/webhooks/bunny-stream`; it verifies Bunny’s HMAC v1 signature against the library read-only API key before changing a record.

New modules include a server-only Bunny client, the direct-upload session route, the verified Bunny webhook route, database migration for community video records/settings, and client-side resumable upload integration. No Bunny credential or playback-signing key is exposed to the browser.
