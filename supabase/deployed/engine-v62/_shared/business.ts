import { SERVICE_SCOPE } from "./service-scope.ts";
import { SEO_POLICY } from "./seo-policy.ts";
export function brandBrief(site: any) {
  const b = site.brand || {}, p = site.profile || {};
  return [
    SEO_POLICY, SERVICE_SCOPE,
    `Business: ${site.name} (${site.domain})`,
    p.industry && `Industry: ${p.industry}`,
    b.facts && `Business facts: ${b.facts}`,
    p.customers && `Customers: ${p.customers}`,
    p.goal && `Growth goal: ${p.goal}`,
    b.currentPriority && (!b.currentPriority.target_date || b.currentPriority.target_date >= new Date().toISOString().slice(0,10)) && `Active client priority (guide the next research, recommendations and content; do not claim tasks are already running): ${JSON.stringify(b.currentPriority)}`,
    (b.voice || p.voice) && `Voice: ${b.voice || p.voice}`,
    b.rules?.length && `Business rules and client corrections (apply to every suggestion; corrections override conflicting older facts or source text):\n${b.rules.map((r: string) => `- ${r}`).join("\n")}`,
    b.keywords?.length && `Keywords: ${b.keywords.join(", ")}`,
    b.bannedWords?.length && `Literal excluded phrases: ${JSON.stringify(b.bannedWords)}. Never include these phrases, even with different capitalization or qualifying conditions. If a business fact or source page contains one, rephrase it while preserving the fact. These exclusions take priority over source wording.`,
  ].filter(Boolean).join("\n");
}

// Literal exclusions are enforced after generation as well as included in the prompt.
// Free-form business rules still require review; a prompt is not a factual guarantee.
export function normalizedClaim(value: string) {
 return String(value||'').normalize('NFKC').replace(/<[^>]*>/g,' ').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu,' ').trim();
}
export function permittedCopy(text: string, site: any) {
 const value=normalizedClaim(text);
 return !(site.brand?.bannedWords||[]).some((word:string)=>normalizedClaim(word)&&value.includes(normalizedClaim(word)));
}
// Re-read current rules at execution time so old approvals cannot bypass a correction.
export async function assertCurrentBusinessCopy(db:any,fix:any) {
 if(fix.status==='rollback_requested')return;
 const {data:site,error}=await db.from('sites').select('brand').eq('id',fix.site_id).single();
 if(error||!site)throw new Error('Current business rules could not be checked.');
 if(!permittedCopy(String(fix.after||''),site))throw new Error('This proposal contains a phrase excluded by a business correction. Prepare new copy and review it again.');
}

export function indexingValue(value: unknown) {
  return ["noindex", "1"].includes(String(value ?? "").toLowerCase()) ? "1" : "";
}


