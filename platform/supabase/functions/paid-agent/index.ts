// Paid Ads Agent - test harness (dry run).
// Runs the agent for one client against the latest saved Google Ads observation,
// validates its candidate actions with the same rules the engine uses, and stores
// the result in public.paid_agent_runs. It never creates proposals and never writes
// to Google Ads. Auth: x-engine-key (same internal key the cron jobs use).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { runPaidAgent, MODEL } from './agent.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const must = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data; };

async function authorized(req: Request) {
  const key = req.headers.get('x-engine-key');
  if (!key) return false;
  const { data } = await db.rpc('get_engine_key');
  return !!data && data === key;
}

async function work(runId: string, siteId: string) {
  const deadlineMs = Number(Deno.env.get('PAID_AGENT_DEADLINE_MS') || 330_000);
  try {
    const site = must(await db.from('sites').select('*').eq('id', siteId).single());
    const connector = must(await db.from('connectors').select('*').eq('site_id', siteId).eq('type', 'google_ads').maybeSingle());
    if (!connector?.config?.account_id) throw new Error('No Google Ads account selected for this client.');
    const obs = must(await db.from('paid_observations').select('id,payload,observed_at,account_id,account_epoch').eq('connector_id', connector.id).order('observed_at', { ascending: false }).limit(1).maybeSingle());
    if (!obs) throw new Error('No saved observation yet; let one paid cycle run first.');
    if (obs.account_id !== connector.config.account_id || (obs.account_epoch || null) !== (connector.config.account_epoch || null)) throw new Error('The selected account changed since the last observation.');
    const saved = must(await db.from('paid_configurations').select('*').eq('connector_id', connector.id).maybeSingle());
    const configuration = saved?.account_id === connector.config.account_id && (saved.account_epoch || null) === (connector.config.account_epoch || null) ? saved : null;
    const pending = must(await db.from('paid_proposals').select('id,plan,status,created_at').eq('connector_id', connector.id).in('status', ['proposed', 'approved', 'applying', 'uncertain']).limit(5));
    const preferences = must(await db.from('recommendation_preferences').select('kind,value').eq('site_id', siteId).eq('active', true));

    must(await db.from('paid_agent_runs').update({ observation_id: obs.id, connector_id: connector.id }).eq('id', runId));
    const result = await runPaidAgent({
      db, site, connector, configuration, observation: { ...obs.payload, observed_at: obs.observed_at }, pending, preferences, deadlineMs,
      onProgress: async (trace) => { await db.from('paid_agent_runs').update({ trace }).eq('id', runId); },
    });
    must(await db.from('paid_agent_runs').update({
      status: result.submitted ? 'completed' : 'incomplete',
      result: { ...result, trace: undefined }, trace: result.trace, finished_at: new Date().toISOString(),
    }).eq('id', runId));
  } catch (e) {
    await db.from('paid_agent_runs').update({ status: 'failed', error: String((e as Error)?.message || e).slice(0, 2000), finished_at: new Date().toISOString() }).eq('id', runId);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!(await authorized(req))) return json({ error: 'Unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const siteId = String(body.site_id || '');
  if (!siteId) return json({ error: 'site_id is required' }, 400);
  const run = must(await db.from('paid_agent_runs').insert({ site_id: siteId, mode: 'dry_run', status: 'running', model: MODEL }).select('id').single());
  // Respond right away; the agent keeps running in the background.
  // @ts-ignore EdgeRuntime is provided by the Supabase runtime.
  EdgeRuntime.waitUntil(work(run.id, siteId));
  return json({ run_id: run.id, status: 'running' }, 202);
});
