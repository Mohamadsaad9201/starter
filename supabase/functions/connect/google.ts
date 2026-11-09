import { selectGoogleProperty } from "../_shared/reliability.ts";

export async function completeGoogleConnection(p: URLSearchParams, st: any, deps: any) {
  const { db, credentials, redirectUri, upsertConnector, markConnected } = deps;
  if (p.get("error")) throw new Error(p.get("error") === "access_denied" ? "Google access was declined." : `Google said: ${p.get("error")}`);
  if (!p.get("code")) throw new Error("Google did not return an authorization code. Start again from Connections.");
  const gc = await credentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: p.get("code")!, client_id: gc.id, client_secret: gc.secret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const tok = await res.json();
  if (!res.ok) throw new Error(tok.error_description || tok.error || "Google sign-in failed");
  const scopes = String(tok.scope || "").split(/\s+/).filter(Boolean);
  if (!scopes.some((s: string) => /^https:\/\/www\.googleapis\.com\/auth\/webmasters(?:\.readonly)?$/.test(s))) throw new Error("Search Console access wasn't granted. Connect again and approve Search Console access.");
  const infoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!infoResponse.ok) throw new Error("Could not confirm the Google account. Start the connection again.");
  const info = await infoResponse.json();
  if (!info.email) throw new Error("Google did not identify the connected account. Reconnect and allow email access.");
  const { data: existing, error: existingError } = await db.from("connectors").select("id,config").eq("site_id", st.site_id).eq("type", "gsc").maybeSingle();
  if (existingError) throw new Error(existingError.message);
  let refresh = tok.refresh_token;
  // Never borrow a different Google account's existing authorization.
  if (!refresh && existing?.config?.account === info.email && existing.config.auth === "oauth") {
    const saved = await db.rpc("get_connector_secret", { p_connector: existing.id });
    if (saved.error) throw new Error(saved.error.message);
    refresh = saved.data;
  }
  if (!refresh) throw new Error("Google did not grant lasting access. Reconnect and approve access again.");
  // Persist the credential before dependent API discovery. A disabled API or a transient
  // property-list failure must not lose a successfully granted refresh token.
  const analytics = existing?.config?.account===info.email ? {ga4_property:existing.config.ga4_property||null,ga4_name:existing.config.ga4_name||null} : {};
  const id = await upsertConnector(st.site_id, "gsc", "Google", {
    ...analytics, auth: "oauth", account: info.email, scopes, property: null,
    authorizedAt: new Date().toISOString(), connectionStage: "discovering_property",
  }, refresh);
  try {
    const siteResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${tok.access_token}` } });
    const sites = await siteResponse.json().catch(() => ({}));
    if (!siteResponse.ok) throw new Error(sites.error?.message || `Search Console returned HTTP ${siteResponse.status}. Enable the Search Console API for Impackt Media's Google app, then use Test.`);
    const props = (sites.siteEntry || []).filter((s: any) => s.permissionLevel !== "siteUnverifiedUser");
    const { data: site, error } = await db.from("sites").select("domain").eq("id", st.site_id).single();
    if (error || !site) throw new Error(error?.message || "The business no longer exists.");
    const property = selectGoogleProperty(props, site.domain, existing?.config?.property);
    if (property) {
      await markConnected(id, { permission: props.find((x: any) => x.siteUrl === property)?.permissionLevel, account: info.email }, { property, connectionStage: "awaiting_sync" });
      return "Google authorization saved. Importing your search data next.";
    }
    const message = props.length ? "Google authorization saved. Choose the Search Console property for this business." : "Google authorization saved, but this account has no Search Console properties. Use an account with access to this business.";
    const saved = await db.from("connectors").update({ status: "pending", last_error: message, last_checked_at: new Date().toISOString(), config: { ...analytics, auth: "oauth", account: info.email, scopes, property: null, authorizedAt: new Date().toISOString(), connectionStage: "choose_property" } }).eq("id", id);
    if (saved.error) throw new Error(saved.error.message);
    return message;
  } catch (e) {
    const message = "Google authorization is saved, but setup needs attention: " + (e as Error).message;
    const saved = await db.from("connectors").update({ status: "error", last_error: message.slice(0, 500), last_checked_at: new Date().toISOString() }).eq("id", id);
    if (saved.error) throw new Error("Google authorization was saved, but its status could not be updated: " + saved.error.message);
    throw new Error(message);
  }
}

