// One service boundary shared by generation, revisions and queue planning.
export const SERVICE_SCOPE = 'Services: SEO, GEO/AEO and paid advertising, including website articles and landing-page copy that support these channels. Do not propose or create email, SMS, organic social posts, sales follow-ups or customer-service work. Prepare deliverables for review; never give the client a manual marketing chore. Unknown facts and unsupported publishing destinations require agency review.';
export const DRAFT_TYPES = new Set(['Blog post','FAQ section','Collection page copy','Product description','Content brief','Ad copy','Campaign brief','Offer ideas','Landing page copy','Homepage section','About page']);
export function assertServiceDraft(kind:string,workspace:string) {
 if(!DRAFT_TYPES.has(kind)||!['seo','ads','website'].includes(workspace))throw new Error('This service is outside this workspace. Choose SEO, AI-search content or paid advertising.');
}


