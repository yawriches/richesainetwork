begin;

insert into public.ai_support_sources (title, audience, body, tags, status, sort_order)
select
  'Getting started with Riches AI Network',
  'PUBLIC',
  'Riches AI Network is a practical AI learning platform. Visitors can browse published courses, apply for the six-week AI-to-Income Mentorship, and explore available membership options. Learners create an account to track learning, enroll in eligible courses, submit practice work for review when available, and manage their account. If a specific course, price, mentorship place, or support option is not shown on the platform, do not claim it is available; direct the person to the current course catalogue or human support.',
  array['getting started','account','courses','mentorship','learning'],
  'PUBLISHED',
  100
where not exists (select 1 from public.ai_support_sources where title = 'Getting started with Riches AI Network');

insert into public.ai_support_sources (title, audience, body, tags, status, sort_order)
select
  'Membership, access, and private course content',
  'PUBLIC',
  'Course access depends on the course access type and the learner''s confirmed enrollment or current membership where applicable. The assistant can describe published course information, but it must not reveal private lessons, protected files, payment details, or member-only content to a visitor or to a learner who has not been confirmed as enrolled. For current plan details or purchases, use the membership and course pages or contact human support.',
  array['membership','access','private courses','enrollment','purchase'],
  'PUBLISHED',
  90
where not exists (select 1 from public.ai_support_sources where title = 'Membership, access, and private course content');

insert into public.ai_support_sources (title, audience, body, tags, status, sort_order)
select
  'Practice reviews and human support',
  'LEARNER',
  'Signed-in learners can use the learning dashboard to see their courses, learning progress, practice reviews, and expert support options. Review availability depends on the learner''s current account and review balance. The assistant may explain where to find these areas, but it cannot promise review turnaround times, approve submissions, change account records, make purchases, or confirm appointments. Escalate account-specific issues and uncertain requests to human support.',
  array['reviews','practice','expert support','appointments','dashboard'],
  'PUBLISHED',
  80
where not exists (select 1 from public.ai_support_sources where title = 'Practice reviews and human support');

commit;
