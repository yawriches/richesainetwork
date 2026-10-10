begin;

create table if not exists public.mentorship_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 320),
  phone text not null check (char_length(phone) between 7 and 40),
  country_code text not null references public.countries(code),
  current_situation text not null check (char_length(current_situation) between 30 and 2400),
  ai_experience text not null check (ai_experience in ('BEGINNER','FOUNDATIONAL','PRACTICAL','ADVANCED')),
  primary_goal text not null check (char_length(primary_goal) between 10 and 2000),
  project_idea text not null check (char_length(project_idea) between 10 and 2400),
  weekly_hours text not null check (weekly_hours in ('UNDER_5','FIVE_TO_TEN','TEN_TO_FIFTEEN','FIFTEEN_PLUS')),
  motivation text not null check (char_length(motivation) between 30 and 2400),
  support_needs text not null check (char_length(support_needs) between 2 and 1200),
  consent_at timestamptz not null default now(),
  status text not null default 'NEW' check (status in ('NEW','REVIEWING','NEEDS_INFO','ACCEPTED','DECLINED','WITHDRAWN')),
  status_updated_by uuid references public.profiles(id) on delete set null,
  status_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentorship_applications_status_created_idx
  on public.mentorship_applications(status, created_at desc);
create index if not exists mentorship_applications_email_created_idx
  on public.mentorship_applications(lower(email), created_at desc);
create index if not exists mentorship_applications_user_created_idx
  on public.mentorship_applications(user_id, created_at desc)
  where user_id is not null;

create table if not exists public.mentorship_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.mentorship_applications(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('SUBMITTED','STATUS_CHANGED','NOTE_ADDED')),
  from_status text check (from_status is null or from_status in ('NEW','REVIEWING','NEEDS_INFO','ACCEPTED','DECLINED','WITHDRAWN')),
  to_status text check (to_status is null or to_status in ('NEW','REVIEWING','NEEDS_INFO','ACCEPTED','DECLINED','WITHDRAWN')),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists mentorship_application_events_application_created_idx
  on public.mentorship_application_events(application_id, created_at desc);

alter table public.mentorship_applications enable row level security;
alter table public.mentorship_application_events enable row level security;

-- Applicant records are private. The public application endpoint and protected
-- administrator controls use the server-only service role after validation.

update public.ai_support_sources
set
  body = 'Riches AI Network is a practical AI learning platform. Visitors can browse published courses, apply for the six-week AI-to-Income Mentorship, and explore available membership options. Learners create an account to track learning, enroll in eligible courses, submit practice work for review when available, and manage their account. If a specific course, price, mentorship place, or support option is not shown on the platform, do not claim it is available; direct the person to the current course catalogue or human support.',
  tags = array['getting started','account','courses','mentorship','learning']
where title = 'Getting started with Riches AI Network';

insert into public.ai_support_sources (title, audience, body, tags, status, sort_order)
select
  'AI-to-Income Mentorship applications',
  'PUBLIC',
  'AI-to-Income Mentorship is a focused six-week, one-on-one application programme. Anyone can read the public offer and submit an application; the application does not promise acceptance, reserve a place, confirm a price, create a payment, or guarantee income. The platform team reviews applications privately and may follow up if there is a potential fit. Do not invent investment terms, availability, acceptance criteria, outcomes, or follow-up timing.',
  array['mentorship','application','six weeks','one-on-one','ai-to-income'],
  'PUBLISHED',
  85
where not exists (select 1 from public.ai_support_sources where title = 'AI-to-Income Mentorship applications');

commit;
