# VE School Readiness Portal

A responsive portal for collecting school readiness evidence, applying the Odisha grade-band rubrics, and planning differentiated Vision Empower engagement.

## Included

- Portfolio overview for the 28 schools in the concept note
- Rubrics for grades 1-5, 1-8, and 1-10 extracted from the Odisha workbook
- Evidence-led scoring across six readiness domains
- Provisional status when any domain has less than 75% evidence coverage
- Separate readiness and VE engagement recommendations
- Local draft saving and JSON export
- Supabase REST integration for project `yhaloppwmvdyzssknkpc`

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Copy `dist/config.example.js` to `dist/config.js` if needed.
3. Add the project's public anon or publishable key to `supabaseAnonKey` in `dist/config.js`.
4. Do not put a service-role key in browser code or commit it to Git.

Until the public key and authentication flow are configured, the portal runs in local-workspace mode and stores assessments in the browser.

