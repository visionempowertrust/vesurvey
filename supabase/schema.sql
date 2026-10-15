-- VE School Readiness Portal
-- Run first in the Supabase SQL editor for project yhaloppwmvdyzssknkpc.

create extension if not exists pgcrypto;

create table if not exists public.schools (
  id text primary key,
  name text not null,
  district text,
  grades text not null,
  current_engagement text check (current_engagement is null or current_engagement in (
    'High dependency', 'Assisted Competency', 'Operational Autonomy', 'Full sustainability'
  )),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id text references public.schools(id) on update cascade on delete set null,
  school_name text not null,
  district text,
  grade_band text not null check (grade_band in ('1-5', '1-8', '1-10')),
  assessor_name text,
  assessment_date date not null default current_date,
  current_engagement text check (current_engagement is null or current_engagement in (
    'High dependency', 'Assisted Competency', 'Operational Autonomy', 'Full sustainability'
  )),
  status text not null default 'draft' check (status in ('draft', 'complete')),
  responses jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schools_district_idx on public.schools(district);
create index if not exists assessments_school_id_idx on public.assessments(school_id);
create index if not exists assessments_date_idx on public.assessments(assessment_date desc);
create index if not exists assessments_created_by_idx on public.assessments(created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schools_set_updated_at on public.schools;
create trigger schools_set_updated_at
before update on public.schools
for each row execute function public.set_updated_at();

drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at
before update on public.assessments
for each row execute function public.set_updated_at();

alter table public.schools enable row level security;
alter table public.assessments enable row level security;

drop policy if exists "authenticated users can read schools" on public.schools;
create policy "authenticated users can read schools"
on public.schools for select to authenticated using (true);

drop policy if exists "authenticated users can manage schools" on public.schools;
create policy "authenticated users can manage schools"
on public.schools for all to authenticated using (true) with check (true);

drop policy if exists "authenticated users can read assessments" on public.assessments;
create policy "authenticated users can read assessments"
on public.assessments for select to authenticated using (true);

drop policy if exists "authenticated users can create assessments" on public.assessments;
create policy "authenticated users can create assessments"
on public.assessments for insert to authenticated
with check (auth.uid() = created_by);

drop policy if exists "authors can update assessments" on public.assessments;
create policy "authors can update assessments"
on public.assessments for update to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists "authors can delete draft assessments" on public.assessments;
create policy "authors can delete draft assessments"
on public.assessments for delete to authenticated
using (auth.uid() = created_by and status = 'draft');

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.schools to authenticated;
grant select, insert, update, delete on public.assessments to authenticated;

