const fields = "url,kind,data,updated_at";
const tokens = (s:string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(t=>!['the','and','for','with','from','your','our','shop','online'].includes(t)) || []);
const shared = (a:Set<string>,b:Set<string>) => [...a].filter(t=>b.has(t)).length;
function canonical(raw:string, domain:string) {
  try { const u=new URL(raw); if(u.protocol!=='https:' || u.hostname.replace(/^www\./,'')!==domain.replace(/^www\./,''))return ''; return u.origin+u.pathname.replace(/\/$/,''); } catch { return ''; }
}
export async function seoEvidence(db:any, site:any, slug:string, note:string) {
  const cutoff=new Date(Date.now()-28*86400000).toISOString();
  const {data,error}=await db.from('pages').select(fields).eq('site_id',site.id).gte('updated_at',cutoff).order('updated_at',{ascending:false}).order('url').limit(200);
  if(error)throw error;
  const inventory=new Map();
  for(const row of data||[]) {
    const url=canonical(row.url,site.domain);
    const title=String(row.data?.title||row.data?.name||'').trim();
    const excerpt=String(row.data?.bodyText||row.data?.metaDescription||'').replace(/\s+/g,' ').slice(0,650);
    if(url&&title&&excerpt&&!inventory.has(url)) inventory.set(url,{url,title,excerpt,kind:row.kind,observed:row.updated_at});
  }
  const focus=tokens(note);
  let pages=[...inventory.values()].map(p=>({...p,score:shared(focus,tokens(p.title+' '+p.url+' '+p.excerpt))})).sort((a,b)=>b.score-a.score);
  if(!pages.length||focus.size&&!pages[0].score)throw Error('No recent matching page evidence. Refresh the website audit or select another focus.');
  if(slug==='seo-search-opportunity'){
    const last=await db.from('gsc_pages').select('period_end').eq('site_id',site.id).gte('period_end',cutoff.slice(0,10)).order('period_end',{ascending:false}).limit(1).maybeSingle();
    if(last.error)throw last.error;
    if(!last.data)throw Error('A recent Search Console page report is required.');
    const report=await db.from('gsc_pages').select('page,clicks,impressions,position,period_end').eq('site_id',site.id).eq('period_end',last.data.period_end).gt('impressions',0).order('impressions',{ascending:false}).limit(200);
    if(report.error)throw report.error;
    for(const metric of report.data||[]){const page=pages.find(p=>p.url===canonical(metric.page,site.domain)&&(!focus.size||p.score));if(page)return {page,searchConsole:metric};}
    throw Error('No reported search page matches this audited inventory and focus.');
  }
  if(pages.length<2)throw Error('Two distinct audited pages are required.');
  const anchor=pages[0];
  const words=tokens(anchor.title);
  const candidates=pages.slice(1).map(p=>({...p,overlap:shared(words,tokens(p.title))})).sort((a,b)=>b.overlap-a.overlap);
  if(slug==='seo-internal-links'){
    const related=candidates.filter(p=>p.overlap>0).slice(0,2);
    if(!related.length)throw Error('No related destination supported by the sampled page titles.');
    return {source:anchor,destinations:related};
  }
  // Nearest-neighbour retrieval on normalized embeddings, bounded to six candidate pages.
  // @ts-ignore Hosted Supabase runtime provides the inference session.
  const model=new Supabase.ai.Session('gte-small');
  const embed=async(p:any):Promise<number[]>=>Array.from(await model.run(p.title+' '+p.excerpt,{mean_pool:true,normalize:true}));
  const vector=await embed(anchor); let best:any=null;
  for(const candidate of candidates.slice(0,6)){
    const other=await embed(candidate);
    if(!vector.length||other.length!==vector.length)throw Error('Page comparison returned an incomplete embedding.');
    const similarity=vector.reduce((sum,v,i)=>sum+v*other[i],0);
    if(Number.isFinite(similarity)&&(!best||similarity>best.similarity))best={page:candidate,similarity};
  }
  if(!best)throw Error('Insufficient evidence to compare pages.');
  return {source:anchor,nearestCandidate:best,scope:'Closest in this sample. Compare actual intent before suggesting a revision.'};
}
