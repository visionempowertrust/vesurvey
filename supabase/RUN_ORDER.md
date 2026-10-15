# Supabase SQL run order

Use the SQL Editor for project `yhaloppwmvdyzssknkpc`.

1. Run `01_schema.sql` to create tables, indexes, timestamps, grants, and row-level security policies.
2. Run `02_seed_schools.sql` to insert or update the 28 Odisha schools.
3. Run `03_verify.sql` to confirm the tables, school counts, and policies.

`schema.sql` is a compatibility copy of `01_schema.sql`; do not run both during the same setup.

The policies require signed-in Supabase users. Do not replace the authenticated policies with public anonymous write access, and never put the service-role key in browser code.
