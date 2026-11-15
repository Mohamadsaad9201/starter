// Read-only Google Ads access for the agent. Same OAuth flow and API version as
// engine/index.ts connectorToken() and _shared/paid-api.ts googleSearch().
// This file has no mutate path: the agent can only read.
export const GOOGLE_ADS_VERSION = 'v26';

export function numericId(value: any) {
  const id = String(value || '').replaceAll('-', '');
  if (!/^\d{1,24}$/.test(id)) throw new Error('Invalid advertising account or campaign ID.');
  return id;
}

const cache: Record<string, { token: string; exp: number }> = {};

export async function connectorToken(db: any, c: any): Promise<string> {
  if (c?.config?.auth !== 'oauth') throw new Error('This Google Ads connection is not an OAuth connection.');
  const hit = cache[c.id];
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const { data: refresh } = await db.rpc('get_connector_secret', { p_connector: c.id });
  if (!refresh) throw new Error('Google is not connected for this workspace. Reconnect Google.');
  let cid = Deno.env.get('GOOGLE_CLIENT_ID') || '', csec = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  if (!cid || !csec) {
    const { data } = await db.rpc('get_platform_app', { p_provider: 'google' });
    const row = Array.isArray(data) ? data[0] : data;
    cid = row?.client_id || ''; csec = row?.client_secret || '';
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cid, client_secret: csec, refresh_token: String(refresh), grant_type: 'refresh_token' }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error === 'invalid_grant' ? 'Google access was revoked or expired. Reconnect Google.' : 'Google sign-in failed: ' + (body.error_description || body.error));
  cache[c.id] = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

/** Read-only GAQL. Rejects anything that is not a single SELECT. Caps rows. */
export async function gaqlRead(token: string, account: string, query: string, manager?: string, maxRows = 200) {
  const q = query.trim();
  if (!/^select\s/i.test(q) || /;\s*\S/.test(q)) throw new Error('Only a single SELECT query is allowed.');
  const rows: any[] = [];
  let next = '';
  for (let n = 0; n < 5 && rows.length < maxRows; n++) {
    const res = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_VERSION}/customers/${numericId(account)}/googleAds:search`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(manager ? { 'login-customer-id': numericId(manager) } : {}) },
      body: JSON.stringify({ query: q, ...(next ? { pageToken: next } : {}) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw new Error(`Google Ads ${res.status}: ${String(body.error?.message || 'request failed').slice(0, 400)}`);
    rows.push(...(body.results || []));
    next = body.nextPageToken;
    if (!next) break;
  }
  return { rowCount: rows.length, truncated: rows.length >= maxRows, rows: rows.slice(0, maxRows) };
}

/** Landing-page check, limited to the client's own domain (no open fetching). */
export async function inspectLandingPage(url: string, allowedHosts: string[]) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  if (u.protocol !== 'https:' || !allowedHosts.some((h) => host === h || host.endsWith('.' + h))) {
    throw new Error(`Only pages on the client's own site can be inspected (${allowedHosts.join(', ')}).`);
  }
  const started = Date.now();
  const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; SamaritanPaidAgent/1.0)' } });
  const html = (await res.text()).slice(0, 2_000_000);
  const pick = (re: RegExp) => html.match(re)?.[1]?.replace(/\s+/g, ' ').trim();
  return {
    url, finalUrl: res.url, status: res.status, responseMs: Date.now() - started, htmlKb: Math.round(html.length / 1024),
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 5),
    hasForm: /<form\b/i.test(html),
    telLinks: (html.match(/href=["']tel:/gi) || []).length,
    tracking: {
      gtm: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/.test(html),
      ga4: /gtag\/js\?id=G-|['"]G-[A-Z0-9]{6,}['"]/.test(html),
      googleAdsTag: /AW-\d{6,}/.test(html),
      metaPixel: /fbevents\.js|fbq\(/.test(html),
    },
    note: 'Tags injected after page load (e.g. by GTM) may not appear in raw HTML; absence here is a lead, not proof.',
  };
}
