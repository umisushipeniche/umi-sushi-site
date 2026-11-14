import { voucherApi } from "./api.js";
import adminPage from "./admin.html";
import printPage from "./print.html";
import qrSource from "./qr-code.txt";

const headers = {
  "cache-control": "private, no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000; includeSubDomains"
};
const htmlHeaders = {
  ...headers,
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' https://umisushipeniche.pt data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};

export default {
  async fetch(request, env, ctx) {
    // Fail closed even if someone disables Cloudflare Access in the dashboard.
    if (!env.VOUCHER_DB || !env.VOUCHER_ADMIN_EMAIL || !ctx.access?.getIdentity) {
      return new Response("Voucher administration unavailable. Cloudflare Access and D1 are required.", {status: 503, headers});
    }
    let email;
    try {
      const ident = await ctx.access.getIdentity();
      email = String(ident?.email || "").toLowerCase().trim();
    } catch {
      return new Response("Access authentication failed.", {status: 403, headers});
    }
    if (!email || email !== env.VOUCHER_ADMIN_EMAIL.toLowerCase().trim()) {
      return new Response("Not authorized.", {status: 403, headers});
    }

    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith("/api/vouchers")) {
      return voucherApi(request, env, url, ctx);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {status: 405, headers});
    }
    if (path === "/" || path === "/voucher-admin.html") {
      return new Response(request.method === "HEAD" ? null : adminPage, {headers: htmlHeaders});
    }
    if (path === "/print" || path === "/voucher-print.html") {
      return new Response(request.method === "HEAD" ? null : printPage, {headers: htmlHeaders});
    }
    if (path === "/qrcode.js") {
      return new Response(request.method === "HEAD" ? null : qrSource, {headers:{...headers, "content-type":"text/javascript; charset=utf-8"}});
    }
    return new Response("Not found", {status:404, headers});
  }
};
