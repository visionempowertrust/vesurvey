-- VE School Readiness Portal verification queries
-- Run after 01_schema.sql and 02_seed_schools.sql. This file is read-only.

select
  to_regclass('public.schools') as schools_table,
  to_regclass('public.assessments') as assessments_table;

select count(*) as seeded_school_count
from public.schools;

select grades, count(*) as school_count
from public.schools
group by grades
order by grades;

select current_engagement, count(*) as school_count
from public.schools
group by current_engagement
order by current_engagement;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('schools', 'assessments')
order by tablename, policyname;

