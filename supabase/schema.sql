-- VE School Readiness Portal
-- Run this file in the Supabase SQL editor for project yhaloppwmvdyzssknkpc.

create extension if not exists pgcrypto;

create table if not exists public.schools (
  id text primary key,
  name text not null,
  district text,
  grades text,
  current_engagement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id text references public.schools(id) on delete set null,
  school_name text not null,
  district text,
  grade_band text not null check (grade_band in ('1-5','1-8','1-10')),
  assessor_name text,
  assessment_date date not null default current_date,
  current_engagement text,
  status text not null default 'draft' check (status in ('draft','complete')),
  responses jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessments_school_id_idx on public.assessments(school_id);
create index if not exists assessments_date_idx on public.assessments(assessment_date desc);

alter table public.schools enable row level security;
alter table public.assessments enable row level security;

-- Portal users must sign in through Supabase Auth before these policies allow access.
create policy "authenticated users can read schools"
on public.schools for select to authenticated using (true);

create policy "authenticated users can manage schools"
on public.schools for all to authenticated using (true) with check (true);

create policy "authenticated users can read assessments"
on public.assessments for select to authenticated using (true);

create policy "authenticated users can create assessments"
on public.assessments for insert to authenticated with check (auth.uid() = created_by);

create policy "authors can update assessments"
on public.assessments for update to authenticated
using (auth.uid() = created_by) with check (auth.uid() = created_by);

create policy "authors can delete draft assessments"
on public.assessments for delete to authenticated
using (auth.uid() = created_by and status = 'draft');

