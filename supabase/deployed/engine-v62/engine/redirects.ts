export const REDIRECT_STATE_QUERY = `query RedirectState($id:ID!,$query:String!){product(id:$id){id status}urlRedirects(first:20,query:$query){nodes{id path target}pageInfo{hasNextPage}}}`;
export async function redirectState(shopify: any, shop: string, token: string, id: string, path: string) {
  const d = await shopify(shop, token, REDIRECT_STATE_QUERY, { id, query: `path:${JSON.stringify(path)}` });
  if (!d.product) throw new Error("The product no longer exists.");
  if (d.urlRedirects.pageInfo.hasNextPage) throw new Error("Redirect lookup was ambiguous. Review the existing redirects first.");
  const matches = d.urlRedirects.nodes.filter((r: any) => r.path === path);
  if (matches.length > 1) throw new Error("Multiple redirects use this path. Review them before continuing.");
  return { product: d.product, redirect: matches[0] || null };
}
function errors(d: any) {
  const issues = Object.values(d).flatMap((v: any) => v?.userErrors || []);
  if (issues.length) throw new Error(issues.map((e: any) => e.message).join("; "));
}
// The operation journal is saved before mutations and after each completed step.
// A retry can finish an interrupted operation without creating a second redirect.
export async function applyRedirect(shopify: any, shop: string, token: string, f: any, rollback: boolean, persist: any) {
  const path = new URL(f.url).pathname;
  const target = String(f.after).match(/\/products\/[^\s]+/)?.[0];
  if (!target || target === path) throw new Error("A different product redirect target is required.");
  let state = await redirectState(shopify, shop, token, f.ref, path);
  let journal = f.data?.redirectOperation;
  if (rollback && !journal) throw new Error("This older redirect has no recorded original redirect state. A manual review is required before rollback; no changes were made.");
  if (!journal) {
    if (state.redirect && state.redirect.target !== target) throw new Error("This path already has a different redirect. Review it before replacing anything.");
    journal = { version: 1, path, target, originalStatus: state.product.status, originalRedirect: state.redirect, createdRedirectId: null, phase: "prepared" };
    f.data = { ...(f.data || {}), redirectOperation: journal }; await persist(f.data);
  }
  if (journal.path !== path || journal.target !== target) throw new Error("The approved redirect changed after the operation started. Review it before retrying.");
  const save = async (phase: string) => { journal.phase = phase; await persist({ ...f.data, redirectOperation: journal }); };
  if (rollback) {
    if (!["DRAFT", journal.originalStatus].includes(state.product.status)) throw new Error("The product status changed outside Impackt Media. Review it before rollback.");
    if (journal.originalRedirect) {
      if (state.redirect?.id !== journal.originalRedirect.id || state.redirect?.target !== journal.originalRedirect.target) throw new Error("The original redirect changed outside Impackt Media. Review it before rollback.");
    } else if (state.redirect) {
      if (!journal.createdRedirectId || state.redirect.id !== journal.createdRedirectId || state.redirect.target !== target) throw new Error("The redirect cannot be confirmed as Impackt Media's unchanged redirect. Review it before rollback.");
      const d = await shopify(shop, token, `mutation RemoveImpactfulRedirect($id:ID!){urlRedirectDelete(id:$id){deletedUrlRedirectId userErrors{field message}}}`, { id: journal.createdRedirectId });
      errors(d); await save("redirect_removed");
    }
    if (state.product.status !== journal.originalStatus) {
      const d = await shopify(shop, token, `mutation RestoreProductStatus($product:ProductUpdateInput!){productUpdate(product:$product){product{id status}userErrors{field message}}}`, { product: { id: f.ref, status: journal.originalStatus } });
      errors(d);
    }
    await save("rolled_back"); return;
  }
  if (![journal.originalStatus, "DRAFT"].includes(state.product.status)) throw new Error("The product status changed outside Impackt Media. Review it before publishing.");
  if (state.redirect) {
    const expectedId = journal.originalRedirect?.id || journal.createdRedirectId;
    if (!expectedId || state.redirect.id !== expectedId || state.redirect.target !== target) throw new Error("The redirect changed or a previous create was interrupted. Review the redirect before retrying.");
  } else {
    if (journal.originalRedirect || journal.createdRedirectId) throw new Error("The recorded redirect was removed outside Impackt Media. Review it before publishing.");
    const d = await shopify(shop, token, `mutation CreateImpactfulRedirect($redirect:UrlRedirectInput!){urlRedirectCreate(urlRedirect:$redirect){urlRedirect{id path target}userErrors{field message}}}`, { redirect: { path, target } });
    errors(d);
    journal.createdRedirectId = d.urlRedirectCreate.urlRedirect?.id;
    if (!journal.createdRedirectId) throw new Error("The redirect API did not return an ID. Review the platform before retrying.");
    await save("redirect_created");
  }
  if (state.product.status !== "DRAFT") {
    const d = await shopify(shop, token, `mutation DraftDuplicateProduct($product:ProductUpdateInput!){productUpdate(product:$product){product{id status}userErrors{field message}}}`, { product: { id: f.ref, status: "DRAFT" } });
    errors(d);
  }
  await save("published");
}


