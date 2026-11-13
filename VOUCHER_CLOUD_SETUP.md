# UMI SUSHI Voucher V3 cloud activation — test-v3 only

The code is committed but cloud infrastructure is NOT yet configured. Do not sell vouchers before smoke testing.

## Services and pages
- Existing Cloudflare Worker: src/worker.js; voucher API: src/vouchers.js
- Database schema: migrations/0001_vouchers.sql
- Admin UI: /voucher-admin.html
- A4 portrait PDF with two 210×90 mm sides on the same sheet: /voucher-print.html?code=UMI-...
- Customer read-only verification: /voucher-verify.html?code=UMI-...
- Old simulation: /voucher-preview.html (local-only demo, NOT cloud-backed)

## Cloudflare configuration

1. Create a new Cloudflare D1 database named e.g. umi-vouchers-v3. Open its SQL Console and run migrations/0001_vouchers.sql.

2. Bind this database to the test-v3 Worker under binding name VOUCHER_DB. If deploying via Wrangler, provide actual database_name and database_id in the d1_databases configuration (preview database bindings may need preview_database_id depending on deployment method).

3. Create a Cloudflare Access self-hosted application for the preview admin UI and ADMIN API, authorizing only the administrator email by One-time PIN. Protect /voucher-admin.html, /voucher-print.html and /api/vouchers*; do NOT protect /api/voucher/verify (customers need to scan without login). Ensure that the Cloudflare Access JWT audience (AUD) is consistent for the API and admin UI. If using multiple Access applications, configure routing carefully so that the API receives a JWT for the expected AUD.

4. Configure these Worker variables:
   VOUCHER_ADMIN_EMAIL — exact administrator email
   VOUCHER_ACCESS_TEAM_DOMAIN — the team domain (example: team.cloudflareaccess.com)
   VOUCHER_ACCESS_AUD — the JWT AUD tag for the Cloudflare Access application authorizing the admin APIs

5. Confirm the Cloudflare Workers static-asset routing includes /api/*; the existing wrangler.jsonc already has run_worker_first on /api/*.

## Critical smoke tests
- Unauthorized browser cannot create, redeem, cancel or list cloud vouchers.
- Authorized email receives OTP and /api/vouchers/me returns the correct administrator.
- €1 test voucher creates a row and audit event in D1.
- The QR scans from a DIFFERENT phone and shows Disponível.
- Redeem once; second redemption returns conflict and public QR then shows Utilizado.
- Cancel an unused test voucher and see Anulado.
- A4 portrait PDF contains BOTH sides on one page without cropping or extra pages.
- Existing public website and contact form remain unaffected.

## Limitations
The old local simulation remains separate from cloud records. Cloud voucher codes start UMI- followed by 32 random hexadecimal characters. Manual payment confirmation is required before issuance. Automated customer email delivery is NOT implemented yet. Meal prices are €17.95 lunch / €22.95 dinner per person. Monetary vouchers remain single-use without carryover. Review Portuguese voucher terms, invoice/VAT, and local consumer rights before selling.
