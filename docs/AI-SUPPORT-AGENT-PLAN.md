# Riches AI Network — AI Support Agent Preparation

## Product direction

The next support feature should help visitors and learners get fast, trustworthy answers without pretending to replace an instructor. The first release should focus on platform FAQs, published course information, onboarding guidance, and course-specific learning questions.

Community is intentionally optional. If the administrator disables the community, the AI agent remains available for learning and support; it must not depend on the community feed or WhatsApp.

## Three answer modes

| Mode | Allowed context | Example questions |
|---|---|---|
| Public | Approved platform FAQ, published course catalogue, membership explanations, contact/support guidance | “What courses are available?” “How do reviews work?” |
| Signed-in learner | Public context plus the learner’s own profile, enrollments, entitlements, progress, review balance, and appointments | “Which lesson should I continue?” “Can I access this course?” |
| Administrator | Operational diagnostics and moderation context only after admin authorization | “How many review submissions are pending?” |

## Authorization rule

Before retrieving protected course lessons, private resources, progress, payments, appointments, review submissions, or community information, the server must verify the current session and the relevant entitlement. A learner’s browser must never decide whether protected context is available. If access is missing, the assistant should explain the access requirement and offer a safe next step without revealing protected content.

## Recommended architecture

1. **Approved knowledge base:** FAQ entries, course summaries, course objectives, lesson summaries, membership policies, review guidance, and support policies. Each source has status, audience, version, owner, and review date.
2. **Retrieval boundary:** a server route retrieves only sources allowed for the current mode and entitlement. Start with structured keyword/search retrieval; add embeddings only if the FAQ/course corpus grows enough to justify them.
3. **Answer service:** a replaceable LLM adapter receives the user question, authorized context, response rules, and source identifiers. Use a low-cost model for routine answers and reserve stronger reasoning for difficult, clearly scoped questions.
4. **Safety and quality:** cite the source title, refuse unsupported claims, detect prompt injection in retrieved content, limit account-specific disclosure, and escalate uncertain or high-impact requests to human support.
5. **Conversation records:** store minimal conversation metadata, answer sources, feedback, and model/version identifiers. Give administrators controls for retention, review, and disabling the assistant.

## Suggested build order

Build the FAQ/course source manager and authorization-aware retrieval contract first. Then add a read-only public assistant, followed by signed-in learner context, feedback/escalation, and only later richer conversation history or WhatsApp delivery. Do not expose payment, account changes, moderation, or certificate decisions to an autonomous assistant in the first release.


## First release implemented

The first release now includes a server-only `/api/ai-support` route backed by the managed platform LLM service, with `gpt-5-mini` as the default model. The public and learner widgets expose only the assistant response and safe source titles; provider credentials and system guidance remain server-side.

The agent loads approved published sources, filters learner and course-specific sources by the signed-in learner's actual enrollment, includes a small learner context, rejects common prompt-injection attempts, applies per-person hourly limits, records minimal question/answer/source/model history, and falls back to administrator-configured copy if the model is unavailable.

Administrators manage the feature at **Admin → Learner support → AI support**. The control center includes the global kill switch, public/learner availability, model, rate and context limits, welcome/fallback copy, system guidance, source creation/editing/publishing/archiving, recent conversation review, and management audit history. The next optional iteration is conversation threading and learner feedback, not autonomous account or payment actions.
