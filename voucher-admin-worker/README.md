# UMI SUSHI — Independent private Voucher Worker (test-v3)

Status: code is in GitHub branch **test-v3**, directory **voucher-admin-worker/**. This is **not deployed yet** to a new Cloudflare Worker. Do not issue paid vouchers until tested.

## What is retained
- UMI gift voucher design and A4 portrait sheet with front and conditions back on one page, each face 210 × 90 mm.
- Cloudflare D1 `umi-vouchers-v3`; binding `VOUCHER_DB`.
- Only admin `umisushi.peniche@gmail.com`.
- Voucher issuance, lookup, one-time redemption, cancellation and audit history.
- QR printed on the voucher contains **the code only**; it does NOT link to a guest website.
- No customer-facing voucher verification endpoint in this independent Worker.

## Crucial technical details
The independent Worker DOES NOT declare a static `assets` binding. Instead, it serves its HTML and local QR-code JavaScript directly through the Worker and imports them as Wrangler `Text` modules. This matters because Cloudflare documents that `ctx.access` is not propagated from the Static Assets internal router to the user Worker.

All routes (including `/qrcode.js`) first require Cloudflare Access authenticated identity via `ctx.access.getIdentity()` AND the exact administrator email. If Access is turned off, the Worker returns 503 and cannot issue or redeem vouchers. Cloudflare Access must be configured to cover the **whole independent Worker**, not URL paths.

## Deploy via Cloudflare dashboard and connected GitHub

1. Go to **Workers & Pages** → **Create** → connect GitHub repository `umisushipeniche/umi-sushi-site` (or create a Worker first, then **Settings → Builds → Connect**).
2. Create **a new Worker**, name EXACTLY: `umi-voucher-admin-v3`.
3. Set the connected repository's **production branch** to `test-v3` (it is only this new Worker; do not change your existing site's branch).
4. Set the repository **Root directory** to `voucher-admin-worker`. It must pick up `voucher-admin-worker/wrangler.jsonc`, NOT the website-root `wrangler.jsonc`.
5. Deploy command: `npx wrangler deploy`. No custom build command required. Build must show success.
6. Worker D1 binding must show `VOUCHER_DB` → `umi-vouchers-v3` (already specified in this Worker's Wrangler config).
7. **Before any real voucher use**, go to the NEW Worker's **Access** tab → **Protect this Worker behind Access** → **All traffic** (not preview only). Use a policy that Allows **only** `umisushi.peniche@gmail.com` and the configured Cloudflare email one-time PIN identity provider. Check that the policy is NOT an email domain or Everyone. One may create a new Access application for this Worker instead of reusing the old path-based application. Do not protect the existing `umi-sushi-site` Worker.
8. Check that an incognito browser opens Cloudflare Access login before it serves ANY route. Confirm authorized administrator access; confirm wrong email is denied. Check `GET /api/vouchers/me` returns only the approved admin, not a publicly usable response.

No requirement to add existing Access AUD or team-domain Worker variables to this independent Worker: Access identity is read from `ctx.access` after Cloudflare authentication. These existing variables can remain on the OLD V3 website until clean-up, but the new Worker does not depend on them.

## Administrator URLs (only AFTER deployment)
- Admin: `https://umi-voucher-admin-v3.umisushi-peniche.workers.dev/`
- PDF print: `https://umi-voucher-admin-v3.umisushi-peniche.workers.dev/print?code=UMI-...`
- Admin APIs: `/api/vouchers`, `/api/vouchers/me`, `/api/vouchers/{code}`, `/api/vouchers/{code}/redeem`, `/api/vouchers/{code}/cancel`
- No `/api/voucher/verify` guest endpoint.
Actual URL must be confirmed after deployment; it is not currently live.

## Mandatory tests
1. Open homepage in incognito: Access login must appear; no visible management HTML before login.
2. With wrong email: Access must deny. With `umisushi.peniche@gmail.com`: email OTP authenticates, admin UI opens.
3. Check private `/api/vouchers/me` shows email.
4. Create **€1** test voucher only after accepting that its record is persistent in `umi-vouchers-v3`.
5. Print A4 portrait PDF with front/back on one page. Scan QR — it should show code TEXT, not a guest website.
6. Search by code in manager; redeem; confirm second redemption fails and history records actor/time.
7. Cancel a new unused test voucher; confirm can't redeem it. Test expired voucher behavior.
8. Check Cloudflare D1 rows and logs. Test original restaurant website and contact forms.
9. Review voucher terms and accounting/invoice treatment before paid issuance.

## Important
- The old V3 website's public voucher API has been disabled in `test-v3`; guest viewing is deliberately dropped from this version.
- Do not migrate test vouchers to production. When ready for main release, use a separate production D1 database and a separate private Worker.
- Sending PDF as an email attachment automatically is **not yet implemented**. Print or save PDF in the browser.
- Staff can scan the QR to see its code, then search that code in the admin manager; automated camera-to-query may be added later.
- This repository change does not create the independent Cloudflare Worker automatically. Cloudflare GitHub build integration must be configured for this additional Worker.
