export const PAGE_CONTENT_READ='query($id:ID!){node(id:$id){id ... on Product{descriptionHtml onlineStoreUrl} ... on Collection{descriptionHtml handle} ... on Page{body handle}} shop{primaryDomain{url}}}';
export const PAGE_CONTENT_WRITE={
 product:'mutation($p:ProductUpdateInput!){productUpdate(product:$p){product{id} userErrors{field message}}}',
 collection:'mutation($p:CollectionInput!){collectionUpdate(input:$p){collection{id} userErrors{field message}}}',
 page:'mutation($p:PageUpdateInput!,$id:ID!){pageUpdate(id:$id,page:$p){page{id} userErrors{field message}}}'
};


