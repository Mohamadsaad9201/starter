/* Impackt Media: your business has a pulse. Static SPA on Supabase. */
(() => {
const CFG = window.SEO_ENGINE;
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
const $root = document.getElementById("root");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const displayDate = d => new Date(/^\d{4}-\d{2}-\d{2}$/.test(d)?d+"T12:00:00":d);
const fmtDate = (d) => d ? displayDate(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "–";
const fmtShort = (d) => d ? displayDate(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "–";
const fmtTime = (d) => d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "–";
const num = (n) => (n ?? 0).toLocaleString();
const money = (n) => n == null || !isFinite(n) ? "–" : (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: n !== 0 && Math.abs(n) < 100 ? 2 : 0 });
const plural = (n, w) => `${num(n)} ${n === 1 ? w : /(x|s|ch|sh)$/.test(w) ? w + "es" : w + "s"}`;
const pct = (n) => n == null ? "–" : (n * 100).toFixed(1) + "%";
const FIELD = { "seo.title": "Search title", "seo.description": "Search description", "seo.hidden": "Hide from Google", "image.alt": "Image alt text", "description.replace": "Product copy", "status.draft_redirect": "Duplicate product" };
const PRI = { critical: "Critical", high: "High", normal: "Normal", medium: "Normal", low: "Low" };
const PRI_ORDER = { critical: 0, high: 1, normal: 2, medium: 2, low: 3 };

const IC = {
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  checks: '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  megaphone: '<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z"/>',
  building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  bot: '<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4M8 14h.01M16 14h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
};
const icon = (k, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
const beatSvg = (w = 26) => `<svg class="beatmark" width="${w}" height="${Math.round(w * .72)}" viewBox="0 0 26 19" fill="none" aria-hidden="true"><path d="M1 11h6l2.6-7.5L13.4 17l2.8-8.5L18 11h7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const scanner = (key) => `<span class="samaritan-mark" data-scanner-key="${esc(key)}" aria-hidden="true"><img src="/assets/samaritan/scanner.webp" width="64" height="64" alt=""></span>`;
const wordmark = (href = "#/") => `<a class="wordmark" href="${href}" aria-label="Impackt Media home"><img src="/assets/wordmark.svg" alt="Impackt Media" width="887" height="232"></a>`;
const markSvg = () => beatSvg(20);

const WS = {
  seo: { label: "Search & AI", icon: "search", blurb: "How people find you on Google and in AI answers." },
  ads: { label: "Ads", icon: "megaphone", blurb: "Plan campaigns and check the numbers before you spend." },
  website: { label: "Website", icon: "globe", blurb: "Site health, live changes and rollback." },

};
const PAGES = { ask:"Ask Samaritan", email:"Email", scorecard:"Scorecard", sentiment:"Sentiment", factcheck:"FactCheck", traffic:"Search traffic", visibility:"AI visibility", citations:"Citations", benchmarks:"Benchmarks", leadgen:"Lead generation", work:"Work history", playbooks:"Playbooks", inbox:"Approvals", seo:"Google search queue", geo:"AI answers queue", paid:"Paid channels", team:"Your team", access: "Workspace access", today: "Today", fixes: "Fixes", growth: "Analytics", content: "Content", activity: "Activity log", connections: "Connections", business: "Business details", apps: "Impackt Media apps" };
const ALIAS = { pulse: ["today"], review: ["fixes"], tasks: ["fixes", "hand"], website: ["fixes", "live"], ads: ["growth", "ads"], integrations: ["connections"], profile: ["business"] };
const DRAFT_KINDS = { seo: ["Blog post", "FAQ section", "Collection page copy", "Product description", "Content brief", "Email campaign", "Social posts"], ads: ["Ad copy", "Campaign brief", "Offer ideas", "Landing page copy"], website: ["Landing page copy", "Homepage section", "About page", "Product description"] };
const CONNECTOR_TYPES = {
  shopify: { name: "Shopify", icon: "S", cls: "shopify", blurb: "Applies approved titles, meta descriptions, alt text and noindex changes within 10 minutes of approval." },
  wordpress: { name: "WordPress", icon: "W", cls: "wordpress", blurb: "Read access to posts and pages, and detects Yoast or Rank Math." },
  gsc: { name: "Google Search Console", icon: "G", cls: "gsc", blurb: "Clicks, impressions, top queries and top pages, synced every morning." },
  framer: { name: "Website reading", icon: "W", cls: "crawl", blurb: "Impackt Media reads your live site (sitemap and pages) every week and turns every gap into a fix with agency review." },
  webflow: { name: "Webflow", icon: "W", cls: "webflow", blurb: "Page titles and descriptions go live automatically." },
  netlify: { name: "Netlify", icon: "N", cls: "netlify", blurb: "Audit a Netlify website and publish approved static HTML changes." },
  framer_key: { name: "Framer", icon: "F", cls: "framer", blurb: "Framer project access for CMS updates." },
};
const LOGO = {"google":"<svg viewBox=\"0 0 48 48\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#EA4335\" d=\"M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z\"/><path fill=\"#4285F4\" d=\"M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z\"/><path fill=\"#FBBC05\" d=\"M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z\"/><path fill=\"#34A853\" d=\"M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z\"/></svg>","shopify":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#7AB55C\" d=\"M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z\"/></svg>","wordpress":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#21759B\" d=\"M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0\"/></svg>","meta":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#0467DF\" d=\"M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z\"/></svg>","gads":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#4285F4\" d=\"M3.9998 22.9291C1.7908 22.9291 0 21.1383 0 18.9293s1.7908-3.9998 3.9998-3.9998 3.9998 1.7908 3.9998 3.9998-1.7908 3.9998-3.9998 3.9998zm19.4643-6.0004L15.4632 3.072C14.3586 1.1587 11.9121.5028 9.9988 1.6074S7.4295 5.1585 8.5341 7.0718l8.0009 13.8567c1.1046 1.9133 3.5511 2.5679 5.4644 1.4646 1.9134-1.1046 2.568-3.5511 1.4647-5.4644zM7.5137 4.8438L1.5645 15.1484A4.5 4.5 0 0 1 4 14.4297c2.5597-.0075 4.6248 2.1585 4.4941 4.7148l3.2168-5.5723-3.6094-6.25c-.4499-.7793-.6322-1.6394-.5878-2.4784z\"/></svg>","ga":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#E37400\" d=\"M22.84 2.9982v17.9987c.0086 1.6473-1.3197 2.9897-2.967 2.9984a2.9808 2.9808 0 01-.3677-.0208c-1.528-.226-2.6477-1.5558-2.6105-3.1V3.1204c-.0369-1.5458 1.0856-2.8762 2.6157-3.1 1.6361-.1915 3.1178.9796 3.3093 2.6158.014.1201.0208.241.0202.3619zM4.1326 18.0548c-1.6417 0-2.9726 1.331-2.9726 2.9726C1.16 22.6691 2.4909 24 4.1326 24s2.9726-1.3309 2.9726-2.9726-1.331-2.9726-2.9726-2.9726zm7.8728-9.0098c-.0171 0-.0342 0-.0513.0003-1.6495.0904-2.9293 1.474-2.891 3.1256v7.9846c0 2.167.9535 3.4825 2.3505 3.763 1.6118.3266 3.1832-.7152 3.5098-2.327.04-.1974.06-.3983.0593-.5998v-8.9585c.003-1.6474-1.33-2.9852-2.9773-2.9882z\"/></svg>","woocommerce":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#96588A\" d=\"M.754 9.58a.754.754 0 00-.754.758v2.525c0 .42.339.758.758.758h3.135l1.431.799-.326-.799h2.373a.757.757 0 00.758-.758v-2.525a.757.757 0 00-.758-.758H.754zm2.709.445h.03c.065.001.124.023.179.067a.26.26 0 01.103.19.29.29 0 01-.033.16c-.13.239-.236.64-.322 1.199-.083.541-.114.965-.094 1.267a.392.392 0 01-.039.219.213.213 0 01-.176.12c-.086.006-.177-.034-.263-.124-.31-.316-.555-.788-.735-1.416-.216.425-.375.744-.478.957-.196.376-.363.568-.502.578-.09.007-.166-.069-.233-.228-.17-.436-.352-1.277-.548-2.524a.297.297 0 01.054-.222c.047-.064.116-.095.21-.102.169-.013.265.065.288.238.103.695.217 1.284.336 1.766l.727-1.387c.066-.126.15-.192.25-.199.146-.01.237.083.273.28.083.441.188.817.315 1.136.086-.844.233-1.453.44-1.828a.255.255 0 01.218-.147zm1.293.36c.056 0 .116.006.18.02.232.05.411.177.53.386.107.18.161.395.161.654 0 .343-.087.654-.26.94-.2.332-.459.5-.781.5a.88.88 0 01-.18-.022.763.763 0 01-.531-.384 1.287 1.287 0 01-.158-.659c0-.342.085-.655.258-.937.202-.333.462-.498.78-.498zm2.084 0c.056 0 .116.006.18.02.236.05.411.177.53.386.107.18.16.395.16.654 0 .343-.086.654-.259.94-.2.332-.459.5-.781.5a.88.88 0 01-.18-.022.763.763 0 01-.531-.384 1.287 1.287 0 01-.16-.659c0-.342.087-.655.26-.937.202-.333.462-.498.78-.498zm4.437.047c-.305 0-.546.102-.718.304-.173.203-.256.49-.256.856 0 .395.086.697.256.906.17.21.418.316.744.316.315 0 .559-.107.728-.316.17-.21.256-.504.256-.883s-.087-.673-.26-.879c-.176-.202-.424-.304-.75-.304zm-1.466.002a1.13 1.13 0 00-.84.326c-.223.22-.332.499-.332.838 0 .362.108.658.328.88.22.223.505.336.861.336.103 0 .22-.016.346-.052v-.54c-.117.034-.216.051-.303.051a.545.545 0 01-.422-.177c-.106-.12-.16-.278-.16-.48 0-.19.053-.348.156-.468a.498.498 0 01.397-.181c.103 0 .212.015.332.049v-.537a1.394 1.394 0 00-.363-.045zm12.414 0a1.135 1.135 0 00-.84.326c-.223.22-.332.499-.332.838 0 .362.108.658.328.88.22.223.506.336.861.336.103 0 .22-.016.346-.052v-.54c-.116.034-.216.051-.303.051a.545.545 0 01-.422-.177c-.106-.12-.16-.278-.16-.48 0-.19.053-.348.156-.468a.498.498 0 01.397-.181c.103 0 .212.015.332.049v-.537a1.394 1.394 0 00-.363-.045zm-9.598.06l-.29 2.264h.579l.156-1.559.395 1.559h.412l.379-1.555.164 1.555h.603l-.304-2.264h-.791l-.12.508c-.03.13-.06.264-.087.4l-.067.352a29.97 29.97 0 00-.258-1.26h-.771zm2.768 0l-.29 2.264h.579l.156-1.559.396 1.559h.412l.375-1.555.165 1.555h.603l-.305-2.264h-.789l-.119.508c-.03.13-.06.264-.086.4l-.066.352c-.063-.352-.15-.771-.26-1.26h-.771zm3.988 0v2.264h.611v-1.031h.012l.494 1.03h.645l-.489-1.019a.61.61 0 00.37-.552.598.598 0 00-.25-.506c-.167-.123-.394-.186-.68-.186h-.713zm3.377 0v2.264H24v-.483h-.63v-.414h.54v-.468h-.54v-.416h.626v-.483H22.76zm-4.793.004v2.264h1.24v-.483h-.627v-.416h.541v-.468h-.54v-.415h.622v-.482h-1.236zm2.025.432c.146.003.25.025.313.072.063.046.091.12.091.227 0 .156-.135.236-.404.24v-.54zm-15.22.011c-.104 0-.205.069-.301.211a1.078 1.078 0 00-.2.639c0 .096.02.2.06.303.049.13.117.198.196.215.083.016.173-.02.27-.106.123-.11.205-.273.252-.492.016-.077.023-.16.023-.246 0-.097-.02-.2-.06-.303-.05-.13-.116-.198-.196-.215a.246.246 0 00-.045-.006zm2.083 0c-.103 0-.204.069-.3.211a1.078 1.078 0 00-.2.639c0 .096.02.2.06.303.049.13.117.198.196.215.083.016.173-.02.27-.106.123-.11.205-.273.252-.492.013-.077.023-.16.023-.246 0-.097-.02-.2-.06-.303-.05-.13-.116-.198-.196-.215a.246.246 0 00-.045-.006zm4.428.006c.233 0 .354.218.354.66-.004.273-.038.46-.098.553a.293.293 0 01-.262.139.266.266 0 01-.242-.139c-.056-.093-.084-.28-.084-.562 0-.436.11-.65.332-.65Z\"/></svg>","webflow":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#146EF5\" d=\"m24 4.515-7.658 14.97H9.149l3.205-6.204h-.144C9.566 16.713 5.621 18.973 0 19.485v-6.118s3.596-.213 5.71-2.435H0V4.515h6.417v5.278l.144-.001 2.622-5.277h4.854v5.244h.144l2.72-5.244H24Z\"/></svg>","framer":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#0055FF\" d=\"M4 0h16v8h-8zM4 8h8l8 8H4zM4 16h8v8z\"/></svg>","wix":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#0C6EFC\" d=\"m0 7.354 2.113 9.292h.801a1.54 1.54 0 0 0 1.506-1.218l1.351-6.34a.171.171 0 0 1 .167-.137c.08 0 .15.058.167.137l1.352 6.34a1.54 1.54 0 0 0 1.506 1.218h.805l2.113-9.292h-.565c-.62 0-1.159.43-1.296 1.035l-1.26 5.545-1.106-5.176a1.76 1.76 0 0 0-2.19-1.324c-.639.176-1.113.716-1.251 1.365l-1.094 5.127-1.26-5.537A1.33 1.33 0 0 0 .563 7.354H0zm13.992 0a.951.951 0 0 0-.951.95v8.342h.635a.952.952 0 0 0 .951-.95V7.353h-.635zm1.778 0 3.158 4.66-3.14 4.632h1.325c.368 0 .712-.181.918-.486l1.756-2.59a.12.12 0 0 1 .197 0l1.754 2.59c.206.305.55.486.918.486h1.326l-3.14-4.632L24 7.354h-1.326c-.368 0-.712.181-.918.486l-1.772 2.617a.12.12 0 0 1-.197 0L18.014 7.84a1.108 1.108 0 0 0-.918-.486H15.77z\"/></svg>","squarespace":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#000000\" d=\"M22.655 8.719c-1.802-1.801-4.726-1.801-6.564 0l-7.351 7.35c-.45.45-.45 1.2 0 1.65.45.449 1.2.449 1.65 0l7.351-7.351c.899-.899 2.362-.899 3.264 0 .9.9.9 2.364 0 3.264l-7.239 7.239c.9.899 2.362.899 3.263 0l5.589-5.589c1.836-1.838 1.836-4.763.037-6.563zm-2.475 2.437c-.451-.45-1.201-.45-1.65 0l-7.354 7.389c-.9.899-2.361.899-3.262 0-.45-.45-1.2-.45-1.65 0s-.45 1.2 0 1.649c1.801 1.801 4.726 1.801 6.564 0l7.351-7.35c.449-.487.449-1.239.001-1.688zm-2.439-7.35c-1.801-1.801-4.726-1.801-6.564 0l-7.351 7.351c-.45.449-.45 1.199 0 1.649s1.2.45 1.65 0l7.395-7.351c.9-.899 2.371-.899 3.27 0 .451.45 1.201.45 1.65 0 .421-.487.421-1.199-.029-1.649h-.021zm-2.475 2.437c-.45-.45-1.2-.45-1.65 0l-7.351 7.389c-.899.9-2.363.9-3.265 0-.9-.899-.9-2.363 0-3.264l7.239-7.239c-.9-.9-2.362-.9-3.263 0L1.35 8.719c-1.8 1.8-1.8 4.725 0 6.563 1.801 1.801 4.725 1.801 6.564 0l7.35-7.351c.451-.488.451-1.238 0-1.688h.002z\"/></svg>","bigcommerce":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#121118\" d=\"M12.645 13.663h3.027c.861 0 1.406-.474 1.406-1.235 0-.717-.545-1.234-1.406-1.234h-3.027c-.1 0-.187.086-.187.172v2.125c.015.1.086.172.187.172zm0 4.896h3.128c.961 0 1.535-.488 1.535-1.35 0-.746-.545-1.35-1.535-1.35h-3.128c-.1 0-.187.087-.187.173v2.34c.015.115.086.187.187.187zM23.72.053l-8.953 8.93h1.464c2.281 0 3.63 1.435 3.63 3 0 1.235-.832 2.14-1.722 2.541-.143.058-.143.259.014.316 1.033.402 1.765 1.48 1.765 2.742 0 1.78-1.19 3.202-3.5 3.202h-6.342c-.1 0-.187-.086-.187-.172V13.85L.062 23.64c-.13.13-.043.359.143.359h23.631a.16.16 0 0 0 .158-.158V.182c.043-.158-.158-.244-.273-.13z\"/></svg>","godaddy":"<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" aria-hidden=\"true\"><path fill=\"#1BDBDB\" d=\"M20.702 2.29c-2.494-1.554-5.778-1.187-8.706.654C9.076 1.104 5.79.736 3.3 2.29c-3.941 2.463-4.42 8.806-1.07 14.167 2.47 3.954 6.333 6.269 9.77 6.226 3.439.043 7.301-2.273 9.771-6.226 3.347-5.361 2.872-11.704-1.069-14.167zM4.042 15.328a12.838 12.838 0 01-1.546-3.541 10.12 10.12 0 01-.336-3.338c.15-1.98.956-3.524 2.27-4.345 1.315-.822 3.052-.87 4.903-.137.281.113.556.24.825.382A15.11 15.11 0 007.5 7.54c-2.035 3.255-2.655 6.878-1.945 9.765a13.247 13.247 0 01-1.514-1.98zm17.465-3.541a12.866 12.866 0 01-1.547 3.54 13.25 13.25 0 01-1.513 1.984c.635-2.589.203-5.76-1.353-8.734a.39.39 0 00-.563-.153l-4.852 3.032a.397.397 0 00-.126.546l.712 1.139a.395.395 0 00.547.126l3.145-1.965c.101.306.203.606.28.916.296 1.086.41 2.214.335 3.337-.15 1.982-.956 3.525-2.27 4.347a4.437 4.437 0 01-2.25.65h-.101a4.432 4.432 0 01-2.25-.65c-1.314-.822-2.121-2.365-2.27-4.347-.074-1.123.039-2.251.335-3.337a13.212 13.212 0 014.05-6.482 10.148 10.148 0 012.849-1.765c1.845-.733 3.586-.685 4.9.137 1.316.822 2.122 2.365 2.271 4.345a10.146 10.146 0 01-.33 3.334z\"/></svg>"};
const PROVIDERS = {
 google_ads:{name:'Google Ads',sub:'Campaign reports & approved status changes',type:'google_ads',logo:'gads',blurb:'Read campaign spend, clicks and delivery. Review and approve bounded status changes.'},
 meta_ads:{name:'Meta Ads',sub:'Facebook & Instagram campaigns',type:'meta_ads',logo:'meta',blurb:'Read campaign spend and delivery, with exact approval and provider verification for status changes.'},
  google: { name: "Google", sub: "Search Console", type: "gsc", logo: "google", blurb: "Clicks, impressions, top queries and pages, synced daily. Choose a Google Analytics property to add website traffic and geographic reporting.", manual: ["gsc", "Use a service account instead"] },
  shopify: { name: "Shopify", sub: "Store edits with rollback", type: "shopify", logo: "shopify", blurb: "Applies approved SEO titles, meta descriptions, alt text and redirects within minutes, and rolls them back on request.", manual: ["shopify", "Use an access token instead"] },
  wordpress: { name: "WordPress", sub: "Posts, pages and SEO plugin", type: "wordpress", logo: "wordpress", blurb: "Reads every post and page and checks your Yoast or Rank Math setup. Fixes come with the exact WordPress steps.", manual: ["wordpress", "Use an application password instead"] },
  webflow: { name: "Webflow", sub: "Pages and SEO settings", type: "webflow", logo: "webflow", blurb: "Saves approved SEO titles and descriptions straight into Webflow, with rollback. They show on the live site the next time you publish." },
  framer: { name: "Framer", sub: "CMS and page copy · reviewed publishing", type: "framer", logo: "framer", blurb: "Connect the Framer Server API to edit CMS text and page copy, create a preview and publish after review." },
  netlify: {name:"Netlify",sub:"Website access and static page publishing",type:"netlify",logo:"netlify",blurb:"Connect a hosted website. Manual static deployments support approved titles, descriptions and answer sections while preserving all other files."},
};
const SOON = [];

const PLATFORMS = {
  shopify: { name: "Shopify", logo: "shopify", mode: "edit", line: "Fixes go live automatically", seo: "Online Store → Pages or Products → open the item → Search engine listing → Edit", alt: "Products → open the product → click the image → Add alt text" },
  wordpress: { name: "WordPress", logo: "wordpress", mode: "read", line: "Reads posts and pages; fixes come with agency review", seo: "Pages or Posts → Edit → scroll to the Yoast or Rank Math box → SEO title and Meta description", alt: "Media → Library → click the image → Alternative Text" },
  woocommerce: { name: "WooCommerce", logo: "woocommerce", mode: "read", line: "Connects through WordPress", seo: "Products → Edit → Yoast or Rank Math box → SEO title and Meta description", alt: "Media → Library → click the image → Alternative Text" },
  webflow: { name: "Webflow", logo: "webflow", mode: "edit", line: "SEO fixes saved straight into Webflow", seo: "Designer → Pages panel → hover the page → ⚙ Settings → SEO settings", alt: "Assets panel → click the image → ⚙ → Alt text" },
  framer: { name: "Framer", logo: "framer", mode: "read", line: "Project access enables reviewed CMS and page copy edits", seo: "Pages panel → ⋯ next to the page → Settings → Title and Description", alt: "Select the image on the canvas → right panel → Alt text" },
  wix: { name: "Wix", logo: "wix", mode: "read", line: "Reads your site; fixes come with agency review", seo: "Editor → Pages & Menu → ⋯ next to the page → SEO basics", alt: "Click the image → ⚙ Settings → What's in the image? (alt text)" },
  squarespace: { name: "Squarespace", logo: "squarespace", mode: "read", line: "Reads your site; fixes come with agency review", seo: "Pages → ⚙ next to the page → SEO tab → SEO title and description", alt: "Edit the image block → Content → Image alt text" },
  bigcommerce: { name: "BigCommerce", logo: "bigcommerce", mode: "read", line: "Reads your store; fixes come with agency review", seo: "Products → Edit → SEO section → Page title and Meta description", alt: "Products → Edit → Images & Videos → click the image → Description (alt text)" },
  godaddy: { name: "GoDaddy", logo: "godaddy", mode: "read", line: "Reads your site; fixes come with agency review", seo: "Website builder → Settings → Search engine optimization → choose the page", alt: "Click the image → Image alt text" },
  netlify: {name:"Netlify",logo:"netlify",mode:"read",line:"Connect website access and reviewed static page publishing",seo:"Integrations → Netlify → Website changes",alt:"Edit through the source project"},
  other: { name: "Other / custom", logo: null, mode: "read", line: "Reads your live site; fixes come with agency review", seo: "Your site's page settings, or the page's <title> and meta description tags", alt: "The image's alt attribute" },
};
const platformOf = (s) => PLATFORMS[s?.platform] || PLATFORMS.other;
function howTo(t) {
  const s = siteById(S.siteId), P = platformOf(s);
  const k = `${t.kind} ${t.target || ""}`.toLowerCase();
  const where = /alt/.test(k) ? P.alt : /title|meta|description|seo|social/.test(k) ? P.seo : null;
  return where ? `<div class="howto"><b>Where to change it in ${esc(P.name)}:</b> ${esc(where)}</div>` : "";
}
const ENGINE_LABEL = { chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude" };
const STAGES = [["new", "New"], ["qualified", "Qualified"], ["contacted", "Contacted"], ["won", "Won"], ["lost", "Lost"]];

const S = {
  session: null, isAdmin: false, sites: [], siteId: null, page: "pulse", sub: null,
  data: {}, filter: { status: "pending", field: "all" }, taskFilter: "open", showN: 40, confirmBulk: false, busy: new Set(),
  gscInfo: null, gscList: null, connectInfo: null, sales: {}, beatOnce: false, freshData: true, setup: null, gscProps: {}, adding: null, toast: null, aeoInfo: null, openCheck: null, modal: null, addingLead: false,
};
const store = { get(k, d) { try { const v = localStorage.getItem("pulse:" + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem("pulse:" + k, JSON.stringify(v)); } catch { /* private mode */ } } };

// ---------- routing ----------
const href = (page, sub) => {
  if (page === "seo" && sub === "drafts") return `#/w/${encodeURIComponent(S.siteId)}/content`;
  const al = ALIAS[page]; if (al) { page = al[0]; sub = sub || al[1]; }
  return `#/w/${encodeURIComponent(S.siteId)}/${page}${sub ? "/" + sub : ""}`;
};
function parseHash() {
  const previousPage=S.page;
  const h = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  S.sub = null;
  const legacy = { overview: ["growth"], ai: ["growth", "ai"], approvals: ["fixes"], todo: ["fixes", "hand"], history: ["fixes", "live"], connectors: ["connections"] };
  if (h[0] === "w" && h[1]) {
    S.siteId = h[1]; let pg = h[2], sub = h[3] || null;
    if (pg === "seo" && sub === "drafts") { pg = "content"; sub = null; }
    if (ALIAS[pg]) { sub = sub || ALIAS[pg][1] || null; pg = ALIAS[pg][0]; }
    S.page = PAGES[pg] ? pg : (!pg && !S.isAdmin ? "ask" : "today"); S.sub = sub;
  } else if (h[0] === "site" && h[1]) { S.siteId = h[1]; [S.page, S.sub] = legacy[h[2]] || ["today"]; }
  else if (h[0] === "new-workspace" || h[0] === "onboarding") { S.page = "onboarding"; S.obSite = h[1] || null; }
  else if (h[0] === "add-site") S.page = "new";
  else if (h[0] === "agency") { S.page = "agency"; S.sub = h[1] === "messages" ? "messages" : null; S.messagePage = Math.max(1,parseInt(h[2],10)||1); }
  else S.page = "today";
  if(S.page==='content'&&previousPage!=='content'){S.contentFilter='review';S.contentFocus=null;}
}
const go = (hash) => { if (location.hash !== hash) location.hash = hash; else route(); };
window.addEventListener("hashchange", () => { document.querySelectorAll("details[open]").forEach((x) => x.removeAttribute("open")); route(); });

function toast(msg, now) {
  if (!now && window.fbHoldToast?.(msg)) return; // feedback.js shows it once the action has visibly finished
  S.toast = msg; renderToast();
  clearTimeout(toast.t); toast.t = setTimeout(() => { S.toast = null; renderToast(); }, 4200);
  window.fbToastShown?.(msg);
}
// Read-only bridge for feedback.js (it lives outside this closure).
window.SamaritanApp = {
  toast: (m) => toast(m, true),
  siteId: () => S.siteId,
  queueLeft: () => { const s = siteById(S.siteId), d = S.data[S.siteId]; if (!s || !d) return null; try { return reviewGroups(s, d).reduce((n, g) => n + g.count, 0); } catch { return null; } },
};
function renderToast() {
  let el = document.querySelector(".toast");
  if (!S.toast) { el?.remove(); return; }
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.getElementById("feedback-stack").appendChild(el); }
  const u = S.undo;
  el.innerHTML = esc(S.toast) + (u ? ` <button class="toast-undo" data-undo>Undo</button>` : "");
}
// Undo window: the change shows immediately, the database write waits 5 seconds. Undo cancels it;
// leaving the page commits it straight away so nothing is lost.
function undoable(msg, apply, revert, commit) {
  flushUndo();
  apply(); render();
  const u = { revert, commit, timer: 0 };
  u.timer = setTimeout(async () => { if (S.undo === u) { S.undo = null; S.toast = null; renderToast(); } await commit(); }, 5000);
  S.undo = u; S.toast = msg; renderToast(); clearTimeout(toast.t);
}
function flushUndo() { const u = S.undo; if (!u) return; clearTimeout(u.timer); S.undo = null; u.commit(); }
document.addEventListener("click", (e) => { const m = e.target.closest?.("[data-aie-more]"); if (m) { S.aieMore ||= {}; S.aieMore[m.dataset.aieMore] = !S.aieMore[m.dataset.aieMore]; render(); } });
document.addEventListener("toggle", (e) => { if (e.target.matches?.("details[data-aie]")) S.aiOpen = e.target.open ? e.target.dataset.aie : ""; }, true);
document.addEventListener("click", (e) => { if (!e.target.closest?.("[data-undo]") || !S.undo) return; const u = S.undo; clearTimeout(u.timer); S.undo = null; u.revert(); S.toast = "Undone"; renderToast(); clearTimeout(toast.t); toast.t = setTimeout(() => { S.toast = null; renderToast(); }, 1800); render(); });
window.addEventListener("pagehide", flushUndo);

// ---------- Agency workspace ----------
S.results = {}; S.resultDays=28; S.resultEnd=null;
S.workspace = {}; S.workspaceBusy = new Set(); S.chatInput = {}; S.pendingChat = {}; S.chatErrors = {}; S.chatVersion = {};
async function loadWorkspace(id, autoTopics = false) {
  const userId=S.session?.user?.id,version=S.chatVersion[id]||0;
  const assign=fresh=>{if(S.session?.user?.id!==userId)return false;if(version!==(S.chatVersion[id]||0)){for(const m of S.workspace[id]?.messages||[]){if(!(fresh.messages||[]).some(x=>x.question===m.question&&x.answer===m.answer))(fresh.messages||=[]).push(m);}}S.workspace[id]=fresh;return true;};
  try {
    if(!assign(await engine('workspace_load',{site_id:id})))return;

  } catch(e) {if(S.session?.user?.id===userId)S.workspace[id]={...(S.workspace[id]||{topics:[],publications:[],messages:[]}),error:e.message};}
}
// Text, rule and pulse presentation adapted from goncalomb/Samaritan's MIT-licensed CSS.
// Original notice: /licenses/samaritan-MIT.txt. Status values remain real workspace state.
function systemReadout(text,state='idle'){
 return `<span class="system-readout" data-signal="${esc(state)}"><span class="readout-text">${esc(text)}</span><span class="readout-line" aria-hidden="true"></span><span class="readout-pointer" aria-hidden="true"></span></span>`;
}
function assistantPanel(s) {
  const w=S.workspace[s.id],busy=S.workspaceBusy.has('chat:'+s.id);
  const signal=busy?'Reviewing your question':S.chatErrors[s.id]||w?.error?'Attention required':w?.messages?.length?'Response available':'Ready for your question';
  const signalState=busy?'working':S.chatErrors[s.id]||w?.error?'attention':'idle';
  const labels={visibility:'Improve AI visibility',content:'Explore blog topics',fixes:'Review suggested fixes',analytics:'Open analytics',connections:'Manage connections',audit:'Check my website'};
  return `<div class="pulse-assistant command-panel" data-mode="${signalState}"><div class="command-topline"><span class="command-brand">${scanner('assistant')}Samaritan intelligence</span><span class="command-business" title="${esc(s.name||'Your business')}">${esc(s.name||'Your business')}</span></div><div class="assistant-label command-stage"><span class="command-caption">Your agency, in motion</span>${systemReadout(signal,signalState)}<span class="command-description">AI assistant · business context · marketer-backed</span></div>
  <div class="chat-thread" aria-live="polite">${(w?.messages||[]).slice(-4).map(m=>`<div class="chat-question">${esc(m.question)}</div><div class="chat-answer">${esc(m.answer)}<div class="actions">${(m.actions||[]).filter(a=>labels[a]).map(a=>a==='audit'?`<button class="btn" data-act="checkup">${labels[a]}</button>`:`<a class="btn" href="${(a==='visibility'?href('geo'):href(a==='analytics'?'growth':a))}">${labels[a]}</a>`).join('')}</div></div>`).join('')}${S.pendingChat[s.id]?`<div class="chat-question">${esc(S.pendingChat[s.id])}</div>`:''}${busy?'<div class="chat-thinking" role="status"><span class="readout-pointer" aria-hidden="true"></span> Reviewing your question and available business evidence…</div>':''}${S.chatErrors[s.id]?`<p class="chat-failed" role="alert">${esc(S.chatErrors[s.id])} Your question is restored below; you can try again.</p>`:''}</div>
  ${w?.error?`<p role="alert">The assistant is unavailable: ${esc(w.error)}</p>`:''}
  <form id="pulse-chat" class="chat-compose"><label class="sr-only" for="pulse-question">Ask Samaritan</label><textarea id="pulse-question" rows="2" maxlength="2000" placeholder="What should we work on today?" required ${busy?'disabled':''}>${esc(S.chatInput[s.id]||'')}</textarea><button class="btn primary" ${busy?'disabled':''}>${busy?'Thinking…':'Ask Samaritan ↗'}</button></form>
  <div class="prompt-chips">${['What should I focus on today?','What should we write next?','Explain my recent results.'].map((q,i)=>`<button class="chip" data-prompt="${esc(q)}" ${busy?'disabled':''}><span class="prompt-index" aria-hidden="true">0${i+1}</span>${esc(q)}<span class="prompt-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>
  <p class="assistant-note">Ideas become actions when you choose them. Review finished content before publishing. Enter to send · Shift+Enter for a new line.</p></div>`;
}
function recommendedTopics(s){
 const w=S.workspace[s.id],busy=S.workspaceBusy.has('topics:'+s.id),drafts=S.data[s.id]?.drafts||[],pubs=[...(w?.publications||[]),...(S.results[s.id]?.page_publications||[])];
 const rows=(w?.topics||[]).filter(t=>t.status==='suggested'&&!t.draft_id&&t.ranking_evidence?.version==='ranking-v1').sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 const batch=w?.discovery,planning=batch?.status==='planning',blocked=batch?.status==='blocked',latest=batch?.finished_at||batch?.started_at;
 const note=batch?blocked?'Research needs attention: '+batch.reason:planning?'Samaritan is researching the next batch.':batch.reason:'Research surfaces supported search opportunities. No daily quota or filler topics.';
 return `<section class="card topics-section"><div class="card-head"><div><div class="eyebrow">Search opportunities</div><h2>Work backed by ranking evidence</h2><p class="muted">Each proposal needs a real query, an observed page and a specific relevance gap. No filler. Completed drafts stay in history.</p></div><button class="btn" data-work="topics" ${busy||planning?'disabled':''}>${busy?'Researching…':planning?'Research in progress':'Check today’s topics'}</button></div><div class="topic-discovery-note ${blocked?'attention':''}" role="status"><span class="h-dot ${planning?'live':blocked?'warn':''}"></span><div>${esc(note||'Research completed.')}${latest?`<small>Last research · ${esc(fmtTime(latest))}${batch.status==='completed'&&batch.created_count!=null?' · '+batch.created_count+' new topics':''}</small>`:''}</div></div>${w?.error?`<p role="alert">${esc(w.error)}</p>`:''}<div class="topic-grid">${rows.slice(0,10).map(t=>`<article class="topic-card"><span class="topic-source">${esc(t.source)}</span><small class="topic-date">${esc(fmtDate(t.created_at))} · ${esc(t.draft_kind||'Blog post')}</small><h3>${esc(t.title)}</h3><p>${esc(t.reason)}</p>${t.error?`<p role="alert">${esc(t.error)}</p>`:''}<button class="btn primary" data-work="draft" data-id="${esc(t.id)}">Prepare draft →</button></article>`).join('')||`<p class="muted">${planning||busy?'Checking current pages, customer questions and earlier work…':'No new topic is ready. Check today’s research status above; approved articles stay in history.'}</p>`}</div>${rows.length>10?`<details class="topic-backlog"><summary>${rows.length-10} more researched ideas</summary><div class="topic-grid">${rows.slice(10,40).map(t=>`<article class="topic-card"><span class="topic-source">${esc(t.source)}</span><h3>${esc(t.title)}</h3><p>${esc(t.reason)}</p><button class="btn" data-work="draft" data-id="${esc(t.id)}">Prepare draft →</button></article>`).join('')}</div></details>`:''}</section>`;
}

function impactView(s,d) {
  const verified=d.fixes.filter(f=>f.status==='deployed'&&f.data?.verification?.state==='verified');
  const published=(S.workspace[s.id]?.publications||[]).filter(p=>p.status==='published');
  const g=gsc28(d),complete=g?.cur.days===28&&g?.prev?.days===28;
  const insight=!g?'Connect Google Search Console to establish your search baseline.':!complete?`We have ${g.cur.days} of 28 days in the latest window. A trend comparison will appear when both 28-day windows are complete.`:g.prev.clicks===0?'The earlier period had no clicks. Percentage growth would be misleading.':`Search clicks ${g.cur.clicks>=g.prev.clicks?'increased':'decreased'} ${Math.abs((g.cur.clicks-g.prev.clicks)/g.prev.clicks*100).toFixed(0)}% across the latest two complete 28-day windows.`;
  const opportunity=d.queries.filter(q=>q.impressions>=100&&q.clicks/q.impressions<.02).sort((a,b)=>b.impressions-a.impressions)[0];
  return `<div class="grid two" style="margin-top:18px"><section class="card"><div class="eyebrow">What we can see</div><h2>Insights worth acting on</h2><p>${esc(insight)}</p>${opportunity?`<p><b>${esc(opportunity.query)}</b> appeared ${num(opportunity.impressions)} times but received ${num(opportunity.clicks)} clicks. Review the page’s relevance and search snippet.</p><a class="btn" href="${href('content')}">Explore content ideas</a>`:''}${g?`<p class="muted">Google Search Console · through ${fmtDate(g.last)}${Date.now()-Date.parse(g.last)>7*86400000?' · Data is more than a week old; refresh the connection.':''}</p>`:`<a class="btn primary" href="${href('connections')}">Connect your data</a>`}</section>
  <section class="card"><div class="eyebrow">Impackt Media’s work</div><h2>Progress you can verify</h2><div class="impact-counts"><div><b>${num(verified.length)}</b><span>Changes verified live</span></div><div><b>${num(published.length)}</b><span>Articles published</span></div><div><b>${num(d.fixes.filter(readyFix).length)}</b><span>Awaiting review</span></div></div><p>Track completed work alongside search performance. Changes in traffic can also reflect seasonality, demand and other marketing activity.</p><p class="muted">These are observed results, not revenue or traffic attributed to Impackt Media. Article totals cover the new publishing workflow.</p><a class="btn" href="${href('activity')}">View the work history</a></section></div>`;
}
function ecommerceSite(s,d){return ['shopify','woocommerce','bigcommerce'].includes(s?.platform)||(d?.connectors||[]).some(c=>c.type==='shopify');}
function leadPlan(text){try{const p=JSON.parse(text);return p?.format==='leadgen-v1'?p:null;}catch{return null;}}
function planSummary(p){return `<div class="lead-plan"><p>${esc(p.brief)}</p><p><b>Landing page</b> ${esc(p.landing_url)}</p><div class="lead-groups">${p.groups.map(g=>`<section><h3>${esc(g.name)}</h3><ul>${g.keywords.map(k=>`<li>${esc(k)}</li>`).join('')}</ul></section>`).join('')}</div><h3>Negative keywords</h3><p>${p.negatives.map(esc).join(' · ')||'None selected'}</p><small>Campaign proposal for marketer review. Saving or approving this brief does not launch ads.</small></div>`;}
function leadgenView(s,d){
 ;
 const drafts=(d.drafts||[]).filter(x=>leadPlan(x.body));
 return `<section class="card"><span class="eyebrow">New acquisition</span><h2>A focused plan for your next leads.</h2><p>Describe the service, target area and offer. Samaritan prepares two or three ad groups, seven or eight keywords per group and relevant exclusions for review. Budgets and campaign launch stay with your marketers.</p>${S.isAdmin?`<form class="leadgen-prepare"><label class="field">Campaign direction<textarea name="brief" required minlength="30" maxlength="5000" placeholder="Service, locations served, offer and the kind of enquiry you want."></textarea></label><label class="field">Published landing page<input name="landing_url" type="url" value="https://${esc(String(s.domain).replace(/^https?:\/\//,''))}" required></label><button class="btn primary">Prepare campaign proposal</button><p class="muted">Your marketers review the proposal before launch. The same brief reopens its existing draft.</p></form>`:'<p>Your team prepares the campaign structure here and shares it for your review.</p>'}</section>${drafts.map(x=>{const p=leadPlan(x.body);return `<section class="card lead-plan-card"><span class="eyebrow">${esc(x.status.replaceAll('_',' '))}</span><h2>${esc(x.title)}</h2>${S.isAdmin&&x.status==='needs_review'?`<form class="leadgen-save" data-id="${esc(x.id)}" data-revision="${x.revision_version}"><p>${esc(p.brief)}</p><label class="field">Landing page<input name="landing_url" type="url" value="${esc(p.landing_url)}" required></label><div class="lead-groups">${p.groups.map((g,i)=>`<section><label class="field">Ad group name<input name="group-${i}" value="${esc(g.name)}" required maxlength="100"></label><label class="field">Keywords · one per line<textarea name="keywords-${i}" rows="9" required>${esc(g.keywords.join('\n'))}</textarea></label></section>`).join('')}</div><label class="field">Negative keywords · one per line<textarea name="negatives" rows="5">${esc(p.negatives.join('\n'))}</textarea></label><p class="muted">Edit the proposal before approval. Saving updates this draft only.</p><button class="btn primary">Save campaign changes</button></form>`:planSummary(p)}</section>`;}).join('')}`;
}
function measurementSettings(s,d){if(!S.isAdmin)return '';return (d.connectors||[]).filter(c=>['google_ads','meta_ads'].includes(c.type)&&c.config?.account_id).map(c=>{const report=(S.results[s.id]?.reports||[]).find(r=>r.source===c.type)?.payload,options=report?.account_id===c.config.account_id?report.action_options||[]:[];return `<details class="card measurement-settings"><summary>${esc(c.label)} · lead & booking measurement</summary>${options.length?`<form class="ads-measurement" data-connector="${esc(c.id)}"><p>Choose the precise conversion actions this account uses. Counts reflect attributed events and may include repeat customers. Google uses primary conversions. Meta action aliases overlap, so choose one per outcome.</p>${[['lead_action','Lead action'],['booking_action','Booking action']].map(([key,label])=>`<label class="field">${label}<select name="${key}"><option value="">Not measured</option>${options.map(o=>`<option value="${esc(o.id)}" ${c.config[key]===o.id?'selected':''}>${esc(o.name)}${o.category?' · '+esc(o.category):''}</option>`).join('')}</select></label>`).join('')}<button class="btn">Save measurement & sync</button></form>`:'<p>Sync this account to load its reported conversion actions.</p>'}</details>`;}).join('');}
function analyticsPicker(c){const options=S.analyticsProps?.[c.id];return `<details class="analytics-picker"><summary>Google Analytics · ${esc(c.config?.ga4_name||'choose a property')}</summary><p>Website sessions, traffic sources and countries. Reconnect Google to grant Analytics access if needed. Enable the Analytics Data and Admin APIs in your Google Cloud project.</p><button class="btn" data-analytics="properties" data-connector="${esc(c.id)}">Load Analytics properties</button>${c.config?.ga4_property?'<button class="btn" data-analytics="sync">Sync Analytics</button>':''}${options?`<form class="analytics-select"><label class="field">Property<select name="property_id" required><option value="">Select this business’s property</option>${options.map(p=>`<option value="${esc(p.id)}">${esc(p.account)} · ${esc(p.name)} (${esc(p.id)})</option>`).join('')}</select></label><button class="btn primary" ${!options.length?'disabled':''}>Use this property & sync</button></form>${!options.length?'<p>No accessible Analytics properties returned.</p>':''}`:''}</details>`;}
function readableDraft(text) {
  const plan=leadPlan(text);if(plan)return planSummary(plan);
  return globalThis.ImpactfulArticle.renderArticleHtml(text||'(empty)');
}
function articleLinkReview(text) {
  const links=globalThis.ImpactfulArticle.articleLinks(text),valid=links.filter(x=>x.url),invalid=links.length-valid.length;
  const host=url=>{try{return new URL(/^https?:/.test(url)?url:'https://'+url).hostname.replace(/^www\./,'');}catch{return '';}};
  const own=host(siteById(S.siteId)?.domain||''),internal=valid.filter(x=>host(x.url)===own).length;
  if(!links.length)return '<p class="article-link-note">No linked sources in this draft. Add relevant references when they support the article.</p>';
  return `<details class="article-links"><summary>Links to review <span>${internal} on-site · ${valid.length-internal} external${invalid?' · '+invalid+' need fixing':''}</span></summary><p>Check that each source supports the nearby claim and is useful for your customers.</p>${invalid?'<p role="alert">Some destinations are unsupported or unsafe. Edit them before publishing.</p>':''}<ul>${links.map(x=>`<li><span class="link-type">${x.url?(host(x.url)===own?'On-site':'External'):'Fix link'}</span><div>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)} ↗</a><small>${esc(x.url)}</small>`:`<b>${esc(x.label)}</b><small>Use a public HTTP or HTTPS destination.</small>`}</div></li>`).join('')}</ul></details>`;
}

function publicationControls(x) {
  if(excludedCopy(x.title+' '+x.body))return '<p class="note err">A saved business correction excludes wording in this draft. Edit or regenerate it, then review the new version before publishing.</p>';
  if(x.kind==='FAQ section'){const o=oppFor(x.id);if(o&&o.publishable&&o.target_kind==='article')return articleControls(x,o);if(o&&!o.publishable)return `<div class="actions"><button class="btn primary" data-copy-draft="${esc(x.id)}" data-copy-format="html">Copy HTML</button><span class="kind">Paste it on <a href="${esc(o.target_url)}" target="_blank" rel="noopener">${esc(o.target_url.replace(/^https?:\/\//,''))}</a>. We confirm it's live automatically.</span></div>`;return pageContentControls(x);}
  if(x.kind!=='Blog post')return '';
  const pub=S.workspace[S.siteId]?.publications?.find(p=>p.draft_id===x.id);
  const queued=S.operations?.[S.siteId]?.jobs?.find(j=>j.kind==='blog_publish'&&['queued','running'].includes(j.status)&&j.draft_id===x.id);
  if(queued)return `<p class="publication-status">Publication ${esc(queued.status)}. Open Your team to follow the job.</p>`;
  if(pub)return `<div class="publication-status" role="status"><b>${({published:'Published to Shopify',publishing:'Publishing · confirmation pending',failed:'Shopify rejected this article',uncertain:'Agency review needed'})[pub.status]||esc(pub.status)}</b>${pub.published_at?` · ${fmtTime(pub.published_at)}`:''}${pub.error?`<p>${esc(pub.error)}</p>`:''}${pub.verification?.state?`<p>Verification: ${esc(pub.verification.state.replaceAll('_',' '))}</p>`:''}${pub.measurement?.measured_at?`<p>First 28 days: ${num(pub.measurement.clicks)} search clicks · ${num(pub.measurement.impressions)} impressions. Observed performance, not attributed growth.</p>`:''}<p class="muted">This publishing record preserves the approved version. Later draft edits do not change the live article.</p></div>`;
  if(S.publishDraft===x.id)return `<form id="blog-publish" data-id="${esc(x.id)}" class="publish-review"><h3>Approve this exact article for publication</h3><p>Read the title and full draft below before continuing. Publishing makes this article visible on your connected Shopify website.</p><label for="publish-blog">Destination blog</label><select id="publish-blog" required><option value="">Choose a blog</option>${(S.publishBlogs||[]).map(b=>`<option value="${esc(b.id)}">${esc(b.title)}</option>`).join('')}</select><label for="publish-at">Publish time (optional · your local time)</label><input id="publish-at" type="datetime-local"><label class="approval-check"><input type="checkbox" required> I reviewed this article and approve publishing it.</label><button class="btn primary" ${S.workspaceBusy.has('publish:'+x.id)?'disabled':''}>${S.workspaceBusy.has('publish:'+x.id)?'Saving approval…':'Approve & queue publication'}</button><button type="button" class="btn ghost" data-work="cancel-publish">Cancel</button></form>`;
  return `<div class="actions"><button class="btn primary" data-work="publish-review" data-id="${esc(x.id)}">Review & publish to Shopify</button><span class="muted">Your agency manages the publishing connection and verifies the live result.</span></div>`;
}
function articleControls(x,o){
 const busy=S.articleBusy===o.id,link=`<a href="${esc(o.target_url)}" target="_blank" rel="noopener">${esc(o.target_url.replace(/^https?:\/\/(www\.)?/,''))}</a>`;
 if(o.evidence?.publish&&['approved','live','measured'].includes(o.stage))return `<div class="actions"><span class="pill wl-${o.stage==='approved'?'live':'ok'}">${o.stage==='approved'?'Published · confirming on the live page':'Live & verified'}</span><a class="btn ghost sm" href="${esc(o.target_url)}" target="_blank" rel="noopener">View article</a>${o.stage!=='measured'?`<button class="btn ghost sm" data-article="undo" data-opp="${esc(o.id)}" ${busy?'disabled':''}>${busy?'Removing…':'Remove from article'}</button>`:''}</div>`;
 if(x.status!=='needs_review')return '';
 return `<div class="actions"><button class="btn primary" data-article="publish" data-opp="${esc(o.id)}" ${busy?'disabled':''}>${busy?'Publishing…':'Approve & add to article'}</button><span class="kind">Adds this section to the end of ${link} in Shopify. Nothing else on the article changes, and you can remove it in one click.</span></div>`;
}
function pageContentControls(x){
 const p=(S.results[S.siteId]?.page_publications||[]).find(p=>p.draft_id===x.id),review=S.pagePublish?.id===x.id?S.pagePublish:null;
 if(p&&['approved','applying','published','uncertain','reverted'].includes(p.status))return `<div class="publication-status"><b>Answer section · ${esc(p.status)}</b><p>${esc(p.verification?.state||'Awaiting verification')} · ${esc(p.url)}</p>${p.error?`<p role="alert">${esc(p.error)}</p>`:''}${['published','uncertain'].includes(p.status)?`<button class="btn" data-page-content="verify" data-id="${esc(x.id)}">Verify current page</button><details><summary>Restore the previous page content</summary><p>Rollback is blocked if anyone has changed this page since the approved addition.</p><label class="approval-check"><input type="checkbox" id="page-rollback-${esc(x.id)}"> Remove the approved answer section and restore the saved page version.</label><button class="btn" data-page-content="reverse" data-hash="${esc(p.approval_hash)}" data-id="${esc(x.id)}">Queue this rollback</button></details>`:''}</div>`;
 if(review)return `<div class="publish-review"><h3>Review the destination and addition</h3><p><b>${esc(review.url)}</b></p><p>The existing page content stays in place. The answer section below will be appended, then checked on the public website.</p><details><summary>Existing page text</summary><p class="review-copy">${esc(review.existing_text)}</p></details><label class="approval-check"><input id="page-approve-${esc(x.id)}" type="checkbox"> I reviewed the destination, existing content and full answer section.</label><button class="btn primary" data-page-content="approve" data-id="${esc(x.id)}" data-hash="${esc(review.approval_hash)}">Approve & queue page update</button><button class="btn ghost" data-page-content="cancel">Cancel</button></div>`;
 return `<div class="actions"><button class="btn primary" data-page-content="prepare" data-id="${esc(x.id)}">Review page publication</button><span class="kind">Adds the approved answer section to its supported Shopify destination.</span></div>`;
}
async function workspaceClick(b) {
  const siteId=S.siteId, action=b.dataset.work; b.disabled=true;
  try {
    if(action==='cancel-publish'){S.publishDraft=null;return render();}
    if(action==='read'){S.contentFocus=b.dataset.id;S.contentFilter='review';S.page='content';S.sub='drafts';window.history?.replaceState(null,'',href('content','drafts'));render();document.getElementById('draft-'+b.dataset.id)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(action==='publish-review') {
      const r=await engine('blog_destinations',{site_id:siteId});
      if(S.siteId!==siteId)return;
      if(!r.canPublish)throw new Error('The Shopify connection needs permission to publish blog content. Ask the agency to update its content permissions and reconnect.');
      if(!r.blogs.length)throw new Error('Create a blog in Shopify first, then return here.');
      S.publishBlogs=r.blogs;S.publishDraft=b.dataset.id;render();return;
    }
    const key=action==='topics'?'topics:'+siteId:'draft:'+b.dataset.id;S.workspaceBusy.add(key);
    if(action==='draft'){const topic=S.workspace[siteId]?.topics.find(t=>t.id===b.dataset.id);if(topic)topic.status='writing';}
    render();
    let result;try {result=await engine(action==='topics'?'topics_refresh':'topic_draft',{site_id:siteId,topic_id:b.dataset.id});await loadWorkspace(siteId);await loadSite(siteId);}
    finally {S.workspaceBusy.delete(key);}
    if(S.siteId===siteId){render();toast(action==='topics'?(result?.reason||'Today’s topics refreshed'):'Your draft is ready to review');}
  }catch(e){if(S.siteId===siteId){toast(e.message);await loadWorkspace(siteId);render();}}finally{b.disabled=false;}
}
async function submitChat(siteId,question,repaint=render,request=engine){
  question=question.trim();if(!question||S.workspaceBusy.has('chat:'+siteId))return;
  const userId=S.session?.user?.id;
  S.pendingChat[siteId]=question;S.chatInput[siteId]='';delete S.chatErrors[siteId];
  S.workspaceBusy.add('chat:'+siteId);repaint();
  try{
    const result=await request('assistant',{site_id:siteId,question});
    if(S.session?.user?.id!==userId)return;
    if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('No complete answer was returned.');
    const w=S.workspace[siteId]||{topics:[],publications:[],messages:[]};
    S.chatVersion[siteId]=(S.chatVersion[siteId]||0)+1;
    S.workspace[siteId]={...w,error:null,messages:[...(w.messages||[]),{question,answer:result.answer,actions:result.actions||[],created_at:new Date().toISOString()}]};
  }catch(err){if(S.session?.user?.id===userId){S.chatInput[siteId]=question;S.chatErrors[siteId]=err.message||'The response failed.';}}
  finally{if(S.session?.user?.id===userId){delete S.pendingChat[siteId];S.workspaceBusy.delete('chat:'+siteId);if(S.siteId===siteId){repaint();document.getElementById('pulse-question')?.focus?.();}}}
}
function pulseKeydown(e){
 if(e.target.id==='pulse-question'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(!e.repeat)e.target.form?.requestSubmit();}
}
document.addEventListener('keydown',pulseKeydown);
async function workspaceSubmit(e) {
  e.preventDefault(); const siteId=S.siteId;
  if(e.target.id==='pulse-chat') {
    const question=document.getElementById('pulse-question').value.trim();if(!question||S.workspaceBusy.has('chat:'+siteId))return;
    await submitChat(siteId,question);
  } else {
    const id=e.target.dataset.id,blog_id=document.getElementById('publish-blog').value;
    const draft=S.data[siteId].drafts.find(x=>x.id===id);if(!draft||S.workspaceBusy.has('publish:'+id))return;
    S.workspaceBusy.add('publish:'+id);
    try {
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([draft.title,draft.body]))))).map(x=>x.toString(16).padStart(2,'0')).join('');
      const planned=document.getElementById('publish-at')?.value;const run_after=planned?new Date(planned).toISOString():undefined;render();await engine('publication_schedule',{site_id:siteId,draft_id:id,blog_id,approved_hash:hash,run_after});S.publishDraft=null;toast('Approved publication queued. View Your team for its status.');
    }catch(err){toast(err.message);}finally{S.workspaceBusy.delete('publish:'+id);await loadWorkspace(siteId);await loadSite(siteId);if(S.siteId===siteId)render();}
  }
}

// ---------- data ----------
async function engine(action, extra = {}) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${CFG.supabaseUrl}/functions/v1/engine`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: CFG.supabaseAnonKey },
    body: JSON.stringify({ action, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Engine error ${res.status}`);
  return body;
}
async function loadSites() {
  if(!S.isAdmin){const {data,error}=await sb.rpc("client_sites");if(error)throw error;S.sites=data||[];return;}
  const { data, error } = await sb.from("sites").select("*").order("sort_order").order("name");
  if (error) throw error;
  S.sites = data || [];
}
async function loadOperations(id) {
 const userId=S.session?.user?.id;
 const [{data,error},paid,pilot,inbox,experiments,chatInbox,health]=await Promise.all([sb.rpc('operations_snapshot',{p_site:id}),sb.rpc('paid_snapshot',{p_site:id}),sb.rpc('pilot_snapshot',{p_site:id}),S.isAdmin?sb.rpc('support_inbox'):Promise.resolve({data:[]}),S.isAdmin?sb.from('search_experiments').select('*').eq('site_id',id).order('created_at',{ascending:false}).limit(50):Promise.resolve({data:[]}),S.isAdmin?sb.from('chat_threads').select('id,site_id,title,status,owner_name,channel,last_message_at').eq('mode','human').neq('status','resolved').order('last_message_at',{ascending:false}).limit(40):Promise.resolve({data:[]}),S.isAdmin?sb.rpc('system_health'):Promise.resolve({data:null})]);
 if(S.session?.user?.id!==userId)return;
 S.experiments ||= {};S.experiments[id]=experiments.error?{error:experiments.error.message}:{rows:experiments.data||[]};
 S.operations ||= {};S.operations[id]=error?{error:error.message}:data;S.paid||={};S.paid[id]=paid.error?{error:paid.error.message}:paid.data;S.pilots||={};S.pilots[id]=pilot.error?{error:pilot.error.message}:pilot.data;S.inbox=inbox.data||[];S.inboxError=inbox.error?.message;S.chatInbox=chatInbox?.data||[];S.health=health?.data||null;
}
async function loadOpps(id) {
 const {data,error}=await sb.from('opportunities').select('*').eq('site_id',id).order('created_at',{ascending:false}).limit(80);
 const EN={chatgpt:'ChatGPT',claude:'Claude',gemini:'Gemini',perplexity:'Perplexity'},nice=t=>typeof t==='string'?t.replace(/\b(chatgpt|claude|gemini|perplexity)\b/g,m=>EN[m]):t;
 S.opps=S.opps||{};S.opps[id]=error?{error:error.message,rows:[]}:{rows:(data||[]).map(o=>({...o,why:nice(o.why),title:nice(o.title)}))};
}
const oppFor=(draftId)=>(S.opps?.[S.siteId]?.rows||[]).find(o=>o.draft_id===draftId);
async function loadResults(id) {
 const identity=S.session?.user?.id;
 const {data,error}=await sb.rpc('marketing_results',{p_site:id});
 if(S.session?.user?.id!==identity)return;
 S.results[id]=error?{error:error.message}:data;
}
// client_workspace omits drafts.workspace; derive it from the kind so client reviewers still see their drafts.
const withWorkspace=x=>x.workspace?x:{...x,workspace:DRAFT_KINDS.ads.includes(x.kind)?'ads':DRAFT_KINDS.seo.includes(x.kind)?'seo':DRAFT_KINDS.website.includes(x.kind)?'website':x.workspace};
// Gate fields carried on each draft: lane (approval | production | attention | closed), readiness and production stage.
const GATE_FIELDS=['lane','ready','adapter','payload_hash','reasons','stage','blocker','prepared_by','checked_at','source_draft_id','deliverable_id'];
const withGate=(x,g)=>g?{...x,...Object.fromEntries(GATE_FIELDS.map(k=>[k,g[k]])),gate_at:g.updated_at}:x;
const inScopeDraft=x=>['seo','ads','website'].includes(x.workspace)&&['Blog post','FAQ section','Collection page copy','Product description','Content brief','Email campaign','Social posts','Ad copy','Campaign brief','Offer ideas','Landing page copy','Homepage section','About page'].includes(x.kind);
async function loadKnowledge(id) {
 S.knowledge||={};
 try{const {data,error}=await sb.rpc('business_knowledge',{p_site:id});if(error)throw error;S.knowledge[id]=data||{};}catch(e){S.knowledge[id]={error:e.message};}
}
function excludedCopy(text){
 const normalize=v=>String(v||'').normalize('NFKC').replace(/<[^>]*>/g,' ').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu,' ').trim();
 const value=normalize(text);return (S.knowledge?.[S.siteId]?.excluded_phrases||[]).some(p=>normalize(p)&&value.includes(normalize(p)));
}
function knowledgeCorrectionForm(kind='',id='') {
 const role=S.data[S.siteId]?.role||siteById(S.siteId)?.role;
 if(!S.isAdmin&&role!=='reviewer')return '';
 return `<details class="knowledge-correction"><summary>Correct agent knowledge</summary><p>Tell the agents what is inaccurate and what to use instead. This becomes a rule for this business’s future work. Existing live pages are not changed.</p><form class="knowledge-form" data-kind="${esc(kind)}" data-item="${esc(id)}"><label class="field">What should the agents know?<textarea name="note" required minlength="15" maxlength="2000" placeholder="Not all products are hand slaughtered. Do not make this claim across the catalogue."></textarea></label><label class="field">Phrase to exclude from generated copy (optional)<input name="phrase" maxlength="100" placeholder="hand slaughtered"><span class="hint">Excludes the phrase even when capitalized or hyphenated. New copy and pending publication are checked against this rule.</span></label><button class="btn primary" type="submit">Save correction for agents</button><p class="kind" role="status"></p></form></details>`;
}
function priorityPanel(s) {
 const rows=S.knowledge?.[s.id]?.priorities||[],active=rows.find(p=>p.status==='active'),canRequest=S.isAdmin||(S.data[s.id]?.role||s.role)==='reviewer';
 return `<details class="card priority-panel"><summary>${active?`Current team priority: ${esc(active.objective)}`:'Set a priority for your team'}</summary><p>Tell us where the business should focus. Your agency prepares and reviews the plan; activating it guides future agent recommendations and content. Website and ad changes keep their own approval steps.</p>${canRequest?`<details><summary>Send a new priority brief</summary><form class="priority-request"><label class="field">What should the team focus on?<input name="objective" required minlength="8" maxlength="200" placeholder="Ramadan campaign / local Monroe search visibility"></label><label class="field">What matters for this work?<textarea name="context" required minlength="20" maxlength="3000" placeholder="Products, audiences, channels, constraints, stock or shipping cutoffs. Tell us what you want to accomplish."></textarea></label><div class="row2"><label class="field">Location or market (optional)<input name="location" maxlength="200" placeholder="Monroe, Michigan"></label><label class="field">Target date (optional)<input name="target_date" type="date"></label></div><label class="field">How should progress be measured?<textarea name="measure" required minlength="10" maxlength="500" placeholder="Qualified Monroe search visits and direction requests; or campaign sales against an agreed baseline."></textarea></label><button type="submit" class="btn primary">Send priority to my team</button><p role="status" class="kind"></p></form></details>`:''}${rows.slice(0,5).map(p=>`<article class="priority-brief"><div class="card-head"><h3>${esc(p.objective)}</h3><span class="pill state">${esc(({requested:'Requested · agency plan needed',planned:'Plan ready for review',active:'Active direction',paused:'Paused',completed:'Completed'})[p.status]||p.status)}</span></div><p>${esc(p.context)}</p><p class="kind">${p.location?`Market: ${esc(p.location)} · `:''}${p.target_date?`Target: ${esc(p.target_date)} · `:''}Success measure: ${esc(p.success_measure)}</p>${p.plan?.tasks?.length?`<ol class="priority-tasks">${p.plan.tasks.map(t=>`<li><span class="eyebrow">${esc(t.channel)} · Planned task</span><b>${esc(t.title)}</b><p>${esc(t.why)}</p><details><summary>Evidence &amp; measurement</summary><p>Verify first: ${esc(t.evidence_needed)}</p><p>Measure: ${esc(t.measure)}</p></details></li>`).join('')}</ol><p class="kind">${esc(p.plan.notice||'Planning guidance; execution requires its own approvals.')}</p>`:''}${S.isAdmin&&['requested','planned'].includes(p.status)?`<div class="actions"><button class="btn" data-priority-action="plan" data-id="${esc(p.id)}">${p.plan?'Prepare a new plan':'Prepare action plan'}</button>${p.status==='planned'?`<button class="btn primary" data-priority-action="activate" data-id="${esc(p.id)}">Use this reviewed plan as team priority</button>`:''}</div>`:''}</article>`).join('')||'<p class="kind">No priority brief saved yet. Examples: a seasonal campaign or visibility in a specific local market.</p>'}</details>`;
}
function knowledgePanel(s) {
 const k=S.knowledge?.[s.id];
 return `<details class="card knowledge-panel"><summary>What your agents know · business corrections</summary><p>Correct a fact once so it guides future SEO, content and other agent work for this business.</p>${k?.error?'<p role="alert">Saved knowledge could not be loaded. Refresh before reviewing current rules.</p>':''}${(k?.excluded_phrases||[]).length?`<p><b>Excluded phrases:</b> ${k.excluded_phrases.map(esc).join(' · ')}</p>`:''}${knowledgeCorrectionForm()}${(k?.corrections||[]).length?`<h3>Recent corrections</h3><ul>${k.corrections.slice(0,5).map(c=>`<li>${esc(c.note)}${c.excluded_phrase?`<small>Excluded: ${esc(c.excluded_phrase)}</small>`:''}<small>${esc(fmtTime(c.created_at))}</small></li>`).join('')}</ul>`:'<p class="kind">No saved corrections in this history yet.</p>'}</details>`;
}
// ---------- Freshness: realtime invalidation + revalidate on focus ----------
// The database sends a tiny "this business changed" signal (Supabase Realtime); the app then re-fetches through its
// normal loaders. Debounced and single-flight, so a burst of background writes causes one refresh, never a stampede.
const LIVE_TABLES = ["opportunities", "drafts", "draft_pipeline", "fixes", "tasks", "page_content_publications", "operation_jobs", "analytics_sync", "connectors", "playbook_runs", "site_checks"];
let liveCh = null, liveSite = null, liveTimer = null, liveBusy = false, livePending = false, lastRevalidate = 0;
const userBusy = () => { const a = document.activeElement; return !!S.modal || !!(a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName)); };
function scheduleLive(sid, ms = 1500) { clearTimeout(liveTimer); liveTimer = setTimeout(() => liveRefresh(sid), ms); }
async function liveRefresh(sid) {
  if (!sid || S.siteId !== sid) return;
  if (liveBusy || document.hidden || userBusy()) { livePending = true; return; }
  liveBusy = true;
  try { await loadSite(sid); if (S.siteId === sid && !userBusy()) render(); } catch { /* next signal retries */ }
  liveBusy = false; lastRevalidate = Date.now();
  if (livePending) { livePending = false; scheduleLive(sid, 2000); }
}
function watchSite(sid) {
  if (!sid || liveSite === sid || typeof sb.channel !== "function") return;
  if (liveCh) sb.removeChannel(liveCh);
  liveSite = sid; liveCh = sb.channel("site-" + sid);
  for (const table of LIVE_TABLES) liveCh.on("postgres_changes", { event: "*", schema: "public", table, filter: "site_id=eq." + sid }, () => scheduleLive(sid));
  liveCh.subscribe();
}
function revalidate() { if (!S.session || !S.siteId || Date.now() - lastRevalidate < 15000) return; scheduleLive(S.siteId, 200); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (livePending) { livePending = false; scheduleLive(S.siteId, 200); } else revalidate(); } });
window.addEventListener("focus", revalidate);
window.addEventListener("online", () => { lastRevalidate = 0; revalidate(); });
document.addEventListener("focusout", () => { if (livePending) setTimeout(() => { if (!userBusy() && livePending) { livePending = false; scheduleLive(S.siteId, 300); } }, 300); });
// Per-question AI answer evidence (latest completed check): who AI names instead, and which page it cites instead.
async function loadTools(id){S.tools||={};try{const {data,error}=await sb.rpc('tool_audits_data',{p_site:id});S.tools[id]=error?{connections:[],audits:[]}:(data||{connections:[],audits:[]});}catch{S.tools[id]={connections:[],audits:[]};}}
async function loadClaims(id){S.claims||={};try{const {data,error}=await sb.rpc('ai_claims_data',{p_site:id});S.claims[id]=error?[]:(data||[]);}catch{S.claims[id]=[];}}
async function loadAiEvidence(id){S.aiEv||={};try{const {data,error}=await sb.rpc('ai_answer_evidence',{p_site:id});S.aiEv[id]=error?{error:error.message}:data;}catch(e){S.aiEv[id]={error:e.message};}}
const AI_STAGE={drafting:['Samaritan is writing the answer','work'],ready:['Answer prepared · waiting for your review','ready'],publishing:['Publishing','work'],live:['Answer is live · being measured','live'],measured:['Answer is live · measured','live'],blocked:['Needs your agency','warn'],dismissed:['Set aside','off']};
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return u;}};
const pathOf=u=>{try{const x=new URL(u);return (x.pathname==='/'?x.hostname.replace(/^www\./,''):x.pathname).replace(/\/$/,'');}catch{return u;}};
// "Your page vs the page AI cites instead" for one question.
function aiEvidenceDetail(s,p,{inline=false}={}){
 const src=p.source,y=p.yours,st=y?AI_STAGE[y.stage]||[y.stage,'off']:null;
 const yourSide=y?.url?`<a href="${esc(y.url)}" target="_blank" rel="noopener">${esc(pathOf(y.url))}</a><span class="aie-n">Cited in ${p.cited} of ${p.answers} answers</span>${st?`<span class="aie-stage ${st[1]}">${esc(st[0])}</span>`:''}${y.stage==='ready'&&!inline?`<a class="btn sm" href="${href('inbox','geo')}">Review the answer</a>`:''}`:`<span class="muted">None of your pages answers this yet.</span><span class="aie-n">Named in ${p.named} of ${p.answers} answers</span>`;
 const theirSide=src?`<a href="${esc(src.url)}" target="_blank" rel="noopener"><b>${esc(src.domain)}</b> ${esc(pathOf(src.url)===src.domain?'':pathOf(src.url))}</a><span class="aie-n">Cited in ${src.n} of ${p.answers} answers</span>${src.excerpt?`<blockquote>“${esc(src.excerpt.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[*_#]+/g,'').slice(0,220))}${src.excerpt.length>220?'…':''}”</blockquote><small class="muted">What AI quoted from them</small>`:''}`:`<span class="muted">AI didn't cite a page for this answer.</span>`;
 return `<div class="aie-vs"><div class="aie-side you"><span class="eyebrow">Your page</span>${yourSide}</div><div class="aie-arrow" aria-hidden="true">vs</div><div class="aie-side them"><span class="eyebrow">What AI cites instead</span>${theirSide}</div></div>${p.rivals?.length?`<p class="aie-rivals"><span class="muted">Named or cited instead:</span> ${p.rivals.map(r=>`<span class="aie-chip">${esc(r.name)}${r.n>1?` <b>×${r.n}</b>`:''}</span>`).join('')}${p.rival_count>p.rivals.length?`<span class="muted"> +${p.rival_count-p.rivals.length} more</span>`:''}</p>`:''}`;
}
// Two lists: where AI names you, and where others win, ranked by how many others AI named or cited.
function aiAnswerBoard(s){
 const ev=S.aiEv?.[s.id];
 if(!ev)return '';
 if(ev.error)return `<div class="banner">AI answer evidence couldn't load: ${esc(ev.error)}</div>`;
 if(!ev.run)return `<section class="card aie-empty"><h2>Who AI recommends</h2><p class="muted">This appears after the first completed AI answer check.</p></section>`;
 const ps=ev.prompts||[],wins=ps.filter(p=>p.named>0).sort((a,b)=>b.named-a.named||b.cited-a.cited),loss=ps.filter(p=>!p.named).sort((a,b)=>b.rival_count-a.rival_count||(b.source?.n||0)-(a.source?.n||0));
 const eng=(ev.run.engines||[]).map(e=>ENGINE_LABEL[e]||e).join(' & '),SHOW=6;
 const winRow=p=>`<li><span class="aie-q">${esc(p.prompt)}</span><span class="aie-score good">${p.named} of ${p.answers}</span><span class="aie-cite">${p.cited?`Cited ${p.cited}×`:'<span class="muted">Not cited</span>'}</span></li>`;
 const lossRow=(p,i)=>`<li><details ${(S.aiOpen==null?i===0:S.aiOpen===p.prompt)?'open':''} data-aie="${esc(p.prompt)}"><summary><span class="aie-q">${esc(p.prompt)}</span><span class="aie-score bad">0 of ${p.answers}</span><span class="aie-others"><b>${p.rival_count}</b> others</span></summary>${aiEvidenceDetail(s,p)}</details></li>`;
 const more=(n,key)=>n>SHOW?`<button class="btn ghost sm" data-aie-more="${key}">${S.aieMore?.[key]?'Show fewer':`Show all ${n}`}</button>`:'';
 const cut=(rows,key)=>S.aieMore?.[key]?rows:rows.slice(0,SHOW);
 return `<section class="aie" aria-label="Who AI recommends"><header class="aie-head"><div><h2>Who AI recommends for your customers' questions</h2><p class="muted">${eng} · ${plural(ps.length,'question')} · checked ${esc(fmtDate(ev.run.finished_at))}. Ranked by how many other businesses AI named or cited instead of you.</p></div></header>
  <div class="aie-grid">
   <div class="aie-card win"><h3><span class="aie-sw good"></span>Where AI names you <span class="muted">${wins.length}</span></h3>${wins.length?`<ul class="aie-list">${cut(wins,'w').map(winRow).join('')}</ul>${more(wins.length,'w')}`:'<p class="muted">Not named in any answer yet.</p>'}</div>
   <div class="aie-card loss"><h3><span class="aie-sw bad"></span>Where others win instead <span class="muted">${loss.length}</span></h3>${loss.length?`<ul class="aie-list">${cut(loss,'l').map(lossRow).join('')}</ul>${more(loss.length,'l')}`:'<p class="muted">AI names you in every tracked question.</p>'}</div>
  </div></section>`;
}
async function loadSite(id) {
  watchSite(id);
  const t=window.fbLoad?window.fbLoad(S.isAdmin?23:13):(p)=>p; // real progress for the loading screen: one step per data source
  await Promise.all([loadOperations(id),loadKnowledge(id),loadResults(id),loadOpps(id),loadShop(id),loadMetrics(id),loadSaved(id),loadRuns(id),loadReady(id),loadAiEvidence(id),loadClaims(id),loadTools(id)].map(t));
  if(!S.isAdmin){const {data,error}=await t(sb.rpc("client_workspace",{p_site:id}));if(error)throw error;S.data[id]={...data,drafts:(data.drafts||[]).map(withWorkspace).filter(inScopeDraft)};return;}
  const since = new Date(Date.now() - 200 * 86400_000).toISOString().slice(0, 10);
  const [fixes, tasks, audits, conns, daily, queries, pages, aeoRuns, aeoPrompts, leads, drafts, clientReviews] = await Promise.all([
    t(sb.from("fixes").select("id,site_id,url,ref,kind,page_name,field,target,before,restore,after,reasons,status,error,priority,note,decided_at,deployed_at,created_at,source,data").eq("site_id", id).neq("status", "superseded").limit(2000)),
    t(sb.from("tasks").select("*").eq("site_id", id)),
    t(sb.from("audits").select("id,score,prev_score,run_type,page_count,highlights,applied,created_at").eq("site_id", id).order("created_at", { ascending: false })),
    t(sb.from("connectors").select("id,type,label,config,status,last_checked_at,last_error,created_at,secret_id").eq("site_id", id).order("created_at")),
    t(sb.from("gsc_daily").select("date,clicks,impressions,ctr,position").eq("site_id", id).gte("date", since).order("date")),
    t(sb.from("gsc_queries").select("period_end,query,clicks,impressions,ctr,position").eq("site_id", id).order("period_end", { ascending: false }).order("clicks", { ascending: false }).limit(250)),
    t(sb.from("gsc_pages").select("period_end,page,clicks,impressions,ctr,position").eq("site_id", id).order("period_end", { ascending: false }).order("clicks", { ascending: false }).limit(250)),
    t(sb.from("aeo_runs").select("*").eq("site_id", id).order("started_at", { ascending: false }).limit(16)),
    t(sb.from("aeo_prompts").select("*").eq("site_id", id).order("sort_order").order("created_at")),
    t(sb.from("leads").select("*").eq("site_id", id).order("created_at", { ascending: false })),
    t(sb.from("drafts").select("*").eq("site_id", id).order("created_at", { ascending: false })),
    t(sb.from("client_reviews").select("item_kind,item_id,decision,snapshot,created_at").eq("site_id", id).order("created_at", { ascending: false }).limit(200)),
  ]);
  // The readiness gate's verdict per draft and the shared work counts: the same records every surface reads.
  const [pipeline, work] = await Promise.all([t(sb.from("draft_pipeline").select("*").eq("site_id", id).limit(5000)), t(sb.rpc("work_status", { p_site: id }))]);
  const gate = new Map((pipeline.data || []).map((g) => [g.draft_id, g]));
  for (const r of [fixes, tasks, audits, conns, daily, queries, pages]) if (r.error) throw r.error;
  let runs = aeoRuns.error ? [] : aeoRuns.data;
  let reportError=null;
  let checks = [];
  try {const report=await t(engine('aeo_report',{site_id:id}));runs=report.runs;checks=report.checks;}
  catch(e){runs=[];checks=[];reportError=e.message;}
  const latest = (rows, k) => rows.length ? rows.filter((r) => r[k] === rows[0][k]) : [];
  S.data[id] = {
    fixes: fixes.data, tasks: tasks.data, audits: audits.data, connectors: conns.data,
    daily: daily.data, queries: latest(queries.data, "period_end"), pages: latest(pages.data, "period_end"),
    aeoRuns: runs, aeoChecks: checks, aeoPrompts: aeoPrompts.error ? [] : aeoPrompts.data, aeoReady: !aeoRuns.error && !reportError, aeoReportError: reportError,
    leads: leads.error ? [] : leads.data, drafts: drafts.error ? [] : drafts.data.filter(inScopeDraft).map((x) => withGate(x, gate.get(x.id))),
    work: work.error ? null : work.data, pipelineError: pipeline.error ? pipeline.error.message : null,
    // Client decisions shown to the agency. Not stored as d.reviews: that list hides client-approved work from the queue.
    clientReviews: clientReviews.error ? [] : clientReviews.data,
  };
}
const siteById = (id) => S.sites.find((s) => s.id === id);
const errorBox = (e) => `<div class="banner" role="alert">Something went wrong: ${esc(e.message || e)}. Reload the page to try again.</div>`;
// A pending row is not necessarily an evidence-backed proposal ready to publish.
function searchReviewHold(f, now=Date.now()) {
 if(excludedCopy(f.after)&&f.status!=='rollback_requested'&&f.data?.failedOperation!=='rollback')return 'This copy contains a phrase excluded by a saved business correction.';
 if(!['seo.title','seo.description'].includes(f.field)||f.status==='rollback_requested'||f.data?.failedOperation==='rollback')return '';
 if(f.data?.experiment_id)return 'Review this exact change in Search experiments.';
 if(f.field==='seo.description')return 'Search appearance housekeeping is excluded from ranking decisions.';
 const e=f.data?.search_strategy;
 if(e?.version!=='2026-11-05.2')return 'This older suggestion has no current evidence review.';
 const prepared=Date.parse(e.reviewed_at);
 if(!Number.isFinite(prepared)||prepared>now+60000||now-prepared>7*DAY)return 'The page evidence needs to be refreshed.';
 if(!e.ranking_mechanism)return 'No verified ranking-improvement mechanism is recorded.';
 if(e.decision!=='draft_for_review'||(String(f.before||'').trim()&&!(e.rewrite&&e.defects?.length)))return 'Existing metadata needs a reviewed search experiment before it can change.';
 return '';
}
// Suggestions reach the queue through the daily release (up to 10 per business per day), so the list is always today's work.
const releasedOn = f => f.data?.released_on || '';
const readyFix = f => f.status==='pending'&&!!releasedOn(f)&&!searchReviewHold(f);
const RELEASE_TZ = 'America/Detroit'; // must match goodbeat_private.release_daily_suggestions
const releaseDay = (v = Date.now()) => new Date(v).toLocaleDateString('en-CA', { timeZone: RELEASE_TZ });
const isNewToday = f => releasedOn(f) === releaseDay();
function pendingDraft(x,d,siteId=S.siteId){
 if(x.status!=='needs_review'||x.ranking_hold)return false;
 // The approval queue holds only work the server's readiness gate passed: complete, validated and publishable.
 if(x.lane!=='approval')return false;
 const publications=[...(S.workspace[siteId]?.publications||[]),...(S.results[siteId]?.page_publications||[]),...(d?.publications||[])];
 if(publications.some(p=>p.draft_id===x.id&&['approved','publishing','applying','published','uncertain','reverted'].includes(p.status)))return false;
 return !(d.reviews||[]).some(r=>r.item_kind==='draft'&&r.item_id===String(x.id)&&r.decision==='approved'&&Object.entries(clientSnapshot('draft',x)).every(([k,v])=>r.snapshot?.[k]===v));
}
function counts(d) {
  const pendingFixes = d.fixes.filter(readyFix).length;
  const reviewDrafts = d.drafts.filter(x=>inScopeDraft(x)&&pendingDraft(x,d)).length;
  const openTasks = d.tasks.filter((t) => t.status === "pending").length;
  const openLeads = d.leads.filter((l) => ["new", "qualified", "contacted"].includes(l.stage)).length;
  const newLeads = d.leads.filter((l) => l.stage === "new").length;
  return { pendingFixes, reviewDrafts, review: pendingFixes + reviewDrafts, openTasks, open: openTasks + reviewDrafts, openLeads, newLeads, waiting: pendingFixes + reviewDrafts };
}

// ---------- boot ----------
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if(S.loadedUser!==session?.user?.id){S.agency=null;S.agencyMessages=null;S.sites=[];S.data={};S.results={};S.pagePublish=null;S.knowledge={};S.operations={};S.paid={};S.adAccounts={};S.pilots={};S.support={};S.supportDrafts={};S.supportSending=new Set();S.inbox=[];S.workspace={};S.chatInput={};S.pendingChat={};S.chatErrors={};S.chatVersion={};S.workspaceBusy.clear();S.access={};S.loadedUser=session?.user?.id;}
  S.session = session;
  if (!boot.listening) { boot.listening = true; sb.auth.onAuthStateChange((_e, s) => { const previous=S.session?.user?.id; S.session=s; if(s?.user?.id!==previous)setTimeout(()=>boot().catch(renderError),0); }); }
  if (!session) return renderLogin();
  const { data: admin } = await sb.rpc("is_admin");
  S.isAdmin = admin === true;

  try { await loadSites(); } catch (e) { return renderError(e); }
  const claimed = await claimSignup(session);
  if (claimed) { try { await loadSites(); } catch (e) { return renderError(e); } location.hash = "#/onboarding/" + encodeURIComponent(claimed); }
  if(!S.isAdmin&&!S.sites.length)return renderNoAccess();
  if(S.isAdmin){loadAeoInfo(); loadConnectInfo();}
  const result = readConnectResult();
  await route();
  if (result) {
    const name = PROVIDERS[result.provider]?.name || result.provider;
    toast(result.ok ? (result.msg || `${name} connected.`) : `${name} didn't connect: ${result.msg || "please try again."}`);
    const g = S.data[S.siteId]?.connectors.find((c) => c.type === "gsc");
    if (result.ok && ["shopify", "webflow", "wordpress"].includes(result.provider)) runCheckup(S.siteId, true);
    if (result.ok && result.provider === "google" && g?.status === "connected") { try { const x = await syncGoogle(S.siteId); await refresh(); toast(x.days ? `Google connected. Synced ${x.days} days of search data.` : "Google connected, but Search Console returned no data for this property yet."); } catch (e) { await refresh(); toast("Google authorized, but sync failed: " + e.message); } }
  }
}
async function route() {
  parseHash();
  const nav = (route.n = (route.n || 0) + 1), stale = () => nav !== route.n; // a newer navigation wins; a finished slow load never pulls the user back
  if (!S.session) return;
  const ownerOnboarding = S.page === "onboarding" && !S.isAdmin && !!S.obSite && siteById(S.obSite)?.role === "owner";
  if ((S.page === "new" || S.page === "onboarding") && !S.isAdmin && !ownerOnboarding) return go(S.siteId ? href("ask") : "#/");
  if (S.page === "onboarding") { window.SamaritanChat?.unmount(); if (ownerOnboarding) S.siteId = S.obSite; return window.ImpacktOnboarding ? window.ImpacktOnboarding.mount($root, S.isAdmin ? onboardingCtx : ownerOnboardingCtx, S.obSite) : renderShell(addSiteView()); }
  if (S.page === "new") { if (!S.siteId && S.sites[0]) S.siteId = S.sites[0].id; return renderShell(addSiteView()); }
  if (S.page === "agency" || (S.isAdmin && !location.hash.replace(/^#\/?/, ""))) {
    if (!S.isAdmin) return go(href("today"));
    if (S.page !== "agency") return go("#/agency");
    window.SamaritanChat?.unmount();
    refreshAgencyMessages();
    renderShell(agencyView()); window.scrollTo(0, 0);
    if (!S.agency || Date.now() - S.agency.at > 60000) { try { await loadAgency(); } catch (e) { if (!stale()) renderShell(errorBox(e)); return; } if (!stale() && S.page === "agency") renderShell(agencyView()); }
    return;
  }
  if (!S.siteId || !S.sites.some((s) => s.id === S.siteId)) {
    const last = store.get("site"); const pick = S.sites.find((s) => s.id === last) || S.sites[0];
    if (pick) { S.siteId = pick.id; return go(href(S.isAdmin ? "today" : "ask")); }
    return go("#/new-workspace");
  }
  store.set("site", S.siteId);
  if (!S.data[S.siteId]) {
    const id = S.siteId;
    renderShell(skeletonHome(siteById(id)?.name));
    // One load per business, shared by every navigation that needs it.
    S.loading ||= {};
    try { await (S.loading[id] ||= loadSite(id).finally(() => delete S.loading[id])); } catch (e) { if (!stale()) renderShell(errorBox(e)); return; }
    if (stale()) return;
  }
  S.showN = 40; S.confirmBulk = false;
  render(); window.scrollTo(0, 0);
  if(S.isAdmin){pollAeo(); pollCheckup();}
}

// ---------- login ----------
function renderLogin(msg) {
  $root.innerHTML = `<div class="login"><form class="card" id="login-form">
    ${wordmark("/")}
    <div><h1>Built to <span>move forward.</span></h1><span class="login-kicker">A marketing collective for ambitious builders</span></div>
    <p class="muted" style="margin:0">Your strategy, your results and every change we make, in one place. We'll email you a one-time sign-in link.</p>
    <label class="field">Email<input type="email" id="login-email" required autocomplete="email" value="${esc(store.get("email", ""))}"></label>
    <button class="btn primary lg" type="submit" id="login-btn" style="justify-content:center">Email me a sign-in link</button>
    ${msg ? `<div class="banner ${msg.startsWith("Could") ? "" : "ok"}" role="status">${esc(msg)}</div>` : ""}
  </form></div>`;
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("login-btn"); btn.disabled = true; btn.textContent = "Sending…";
    const email = document.getElementById("login-email").value.trim();
    store.set("email", email);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) { btn.disabled = false; btn.textContent = "Email me a sign-in link"; return renderLogin(`Could not send the link: ${error.message}`); }
    renderLogin(`Check ${email} for your sign-in link. It opens Impackt Media already signed in.`);
  });
}
// Self-serve sign-up hand-off (/signup/ → email link → here): create the workspace from the saved analysis.
async function signupFn(action, body = {}) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${CFG.supabaseUrl}/functions/v1/signup`, { method: "POST", headers: { "Content-Type": "application/json", apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ action, ...body }) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(out.error || `Sign-up error ${res.status}`); e.status = res.status; throw e; }
  return out;
}
async function claimSignup(session) {
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem("impackt:signup") || "null"); } catch { /* private mode */ }
  if (!pending?.token || !session?.access_token) return null;
  if (Date.now() - (pending.at || 0) > 7 * 86400_000) { try { localStorage.removeItem("impackt:signup"); } catch { /* */ } return null; }
  try {
    const r = await signupFn("claim", { token: pending.token, edits: pending.edits || {} });
    try { localStorage.removeItem("impackt:signup"); sessionStorage.removeItem("impackt:signup-draft"); } catch { /* */ }
    return r.site_id;
  } catch (e) {
    // Permanent problems (already used, website taken, workspace limit): stop retrying and say why.
    if ([403, 404, 409].includes(e.status)) { try { localStorage.removeItem("impackt:signup"); } catch { /* */ } }
    setTimeout(() => toast("We couldn't finish setting up your workspace: " + e.message, true), 400);
    return null;
  }
}
function renderNoAccess() {
  $root.innerHTML = `<div class="login"><div class="card">${wordmark("/")}<h2 style="font-size:22px">This account doesn't have access yet</h2><p class="muted" style="margin:0">${esc(S.session?.user?.email)} is signed in, but no workspace has been shared with it.</p><button class="btn" id="signout">Sign out</button></div></div>`;
  document.getElementById("signout").onclick = () => sb.auth.signOut();
}
function renderError(e) { $root.innerHTML = `<div class="content"><div class="wrap">${errorBox(e)}</div></div>`; }

// ---------- shell ----------
// Related pages share one menu item and switch with tabs, so the menu stays short.
const SECTIONS = [
 { key: "ai", label: "AI visibility", pages: [["visibility", "Visibility"], ["citations", "Citations"], ["sentiment", "Sentiment"], ["factcheck", "FactCheck"], ["benchmarks", "Competitors"]] },
 { key: "leads", label: "Leads & ads", pages: [["leadgen", "Leads"], ["paid", "Google Ads campaigns", true]] },
 { key: "work", label: "Work history", pages: [["work", "Work history"], ["content", "Content"], ["seo", "Google search queue", true], ["geo", "AI answers queue", true]] },
];
const sectionPages = (key) => (SECTIONS.find((g) => g.key === key)?.pages || []).filter(([, , admin]) => !admin || S.isAdmin);
function sectionTabs() {
 const g = SECTIONS.find((x) => x.pages.some(([p]) => p === S.page)); if (!g) return "";
 const pages = sectionPages(g.key); if (pages.length < 2) return "";
 return `<nav class="dx-tabs" aria-label="${esc(g.label)}">${pages.map(([p, l]) => `<a href="${href(p)}" aria-current="${S.page === p ? "page" : "false"}">${esc(l)}</a>`).join("")}</nav>`;
}
function renderShell(content) {
  const input=document.activeElement?.id==='pulse-question'?document.activeElement:null;const cursor=input?[input.selectionStart,input.selectionEnd]:null;
  const s = S.page === "agency" ? null : siteById(S.siteId), d = s ? S.data[S.siteId] : null;
  const initials = (n) => esc(String(n || "?").trim()[0] || "?").toUpperCase();
  const D = window.ImpacktDash, ic = (k) => D ? D.icon(k, 18) : "";
  const cur = (page) => S.page === page || (page === "today" && ["traffic","visibility","citations","sentiment","factcheck","benchmarks","leadgen","growth","scorecard","email"].includes(S.page)) || (page === "inbox" && S.page === "fixes" && !S.isAdmin);
  const link = (page, label, k, badge, sub) => `<a href="${href(page, sub)}" aria-current="${cur(page) ? "page" : "false"}">${ic(k)}<span>${label}</span>${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  const review = d ? reviewGroups(s, d).reduce((n, g) => n + g.count, 0) : 0;
  const service = s && !ecommerceSite(s, d);
  const grp = (page) => (SECTIONS.find((g) => g.pages.some(([p]) => p === page)) || {}).key;
  const lnk = (page, label, k, badge) => `<a href="${href(page)}" aria-current="${cur(page) || (grp(page) && grp(page) === grp(S.page) && sectionPages(grp(page))[0]?.[0] === page) ? "page" : "false"}">${ic(k)}<span>${label}</span>${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  const hasEmail = !!(s && (S.tools?.[s.id]?.connections || []).some((c) => c.tool === "klaviyo" && c.status === "connected"));
  // Reviews and recorded work retain their separate, direct destinations.
  const nav = s ? `<nav class="dx-nav dx-nav-top" aria-label="Samaritan">${link("ask","Samaritan","visibility")}</nav><nav class="dx-nav" aria-label="Main">${lnk("today","Overview","overview")}${lnk("inbox","Approvals","review",review)}${lnk("work","Work history","work")}${lnk("team","Your team","team")}</nav>
    ${S.isAdmin ? `<details class="collective-agency-tools" ${["visibility","traffic","citations","sentiment","factcheck","benchmarks","leadgen","email","scorecard","playbooks","connections"].includes(S.page)?"open":""}><summary>Agency tools</summary><nav class="dx-nav" aria-label="Agency tools">${lnk("visibility","AI visibility","citations")}${lnk("traffic","Google search","traffic")}${lnk("leadgen","Leads & ads","leadgen")}${hasEmail ? lnk("email","Email","mail") : ""}${lnk("scorecard","Scorecard","benchmarks")}${lnk("playbooks","Playbooks","book")}${lnk("connections","Connections","plug")}</nav></details>` : ""}`
    : `<nav class="dx-nav" aria-label="Agency">${S.isAdmin ? `<a href="#/agency" aria-current="${S.page === "agency" ? "page" : "false"}">${ic("overview")}<span>All clients</span></a><a href="#/new-workspace">${D ? D.icon("seo", 18) : ""}<span>Add a business</span></a>` : ""}</nav>`;
  const sw = s ? `<details class="ws-switch"><summary aria-label="Switch business"><span class="ws-av">${initials(s.name)}</span><span class="ws-name"><b>${esc(s.name)}</b><small>${esc(s.domain.replace(/^www\./, ""))}</small></span>${icon("chev", 14)}</summary>
      <div class="menu-pop">${S.isAdmin ? `<a href="#/agency">${icon("building", 15)} All clients</a><hr>` : ""}${S.sites.map((x) => `<a href="#/w/${encodeURIComponent(x.id)}/${S.page === "new" ? "today" : S.page}" aria-current="${x.id === S.siteId}"><span class="ws-av">${initials(x.name)}</span><span class="ws-name"><b>${esc(x.name)}</b><small>${esc(x.domain.replace(/^www\./, ""))}</small></span></a>`).join("")}${S.isAdmin ? `<hr><a href="#/new-workspace">${icon("plus", 15)} Add a business</a>` : ""}</div></details>` : "";
  const settings = `<details class="menu"><summary>${icon("gear", 17)}<span>Settings</span></summary><div class="menu-pop">${s ? `<a href="${href("connections")}">${icon("plug", 15)} Connections</a>${s.role === "reviewer" ? '<button class="btn" data-market-open>Business profile</button>' : ""}${!S.isAdmin ? `<a href="${href("growth")}">${icon("activity", 15)} Full results report</a>` : ""}${S.isAdmin ? `<a href="${href("business")}">${icon("building", 15)} Business details</a><a href="${href("activity")}">${icon("activity", 15)} Activity log</a><a href="${href("access")}">${icon("users", 15)} Workspace access</a><a href="${href("growth")}">${icon("activity", 15)} Full results report</a><a href="${href("apps")}">${icon("shield", 15)} Impackt Media apps (owner)</a><hr>` : ""}` : ""}<div class="who">${esc(S.session?.user?.email)}</div><button data-act="signout">${icon("arrow", 15)} Sign out</button></div></details>`;
  const wasOpen = document.querySelector(".dx-shell")?.classList.contains("nav-open");
  $root.innerHTML = `<a class="skip-link" href="#main-content">Skip to content</a><div class="shell dx-shell ${S.motionPaused ? 'motion-paused' : ''}">
    <aside class="dx-side" aria-label="Workspace navigation">
      <a class="dx-brand" href="${S.isAdmin ? "#/agency" : s ? href("today") : "#/"}" aria-label="Impackt Media home"><img src="/assets/wordmark.svg" alt="Impackt Media" width="887" height="232"></a>
      ${S.isAdmin && s ? `<nav class="dx-nav"><a href="#/agency">${ic("overview")}<span>All clients</span></a></nav>` : ""}
      ${sw}
      ${s ? `<button type="button" class="dx-search" data-workspace-search>${icon("search", 16)}<span>Search</span><kbd>/</kbd></button>` : ""}
      ${nav}
      <div class="dx-side-foot"><button type="button" data-dx-theme aria-label="Switch between day and night mode">${D ? D.themeButton() : ""}</button>${settings}</div>
    </aside>
    <div class="dx-scrim" data-dx-menu></div>
    <div class="dx-main">
      <div class="dx-mobile"><button type="button" data-dx-menu aria-label="Open navigation">${icon("menu", 18)}</button><b>${esc(s?.name || "Impackt Media")}</b></div>
      <main class="content" id="main-content"><div class="wrap">${S.page === "leads" ? workNav() : ""}${s ? sectionTabs() : ""}${content}</div></main>
    </div>
  </div>${S.modal ? modalHTML() : ""}`;
  if (wasOpen && window.innerWidth <= 960) document.querySelector(".dx-shell")?.classList.remove("nav-open");
  if(cursor){const next=document.getElementById('pulse-question');if(next&&!next.disabled){next.focus();next.setSelectionRange?.(...cursor);}}
  S.beatOnce = false;
}
function pageHead(eyebrow, title, sub, actions = "") {
  return `<header class="page-head"><div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="head-actions">${actions}</div></header>`;
}
const subtabs = (page, items, cur) => `<nav class="subtabs" aria-label="Sections">${items.map(([k, l, n]) => `<a class="subtab" href="${href(page, k)}" aria-current="${cur === k}">${l}${n ? `<span class="n">${n}</span>` : ""}</a>`).join("")}</nav>`;
const newTaskBtn = (ws) => `<button class="btn primary" data-act="new-task" ${ws ? `data-ws="${ws}"` : ""}>${icon("plus", 14)} New draft</button>`;

function agentRoster(s,d,now=Date.now()){
 const a=d.agentStatus||{},c=a.checkup||s.checkup||{},w=S.workspace[s.id]||{},runs=a.aeoRuns||d.aeoRuns||[],audit=(a.audits||d.audits||[])[0],r=runs[0];
 const recent=t=>!!t&&Number.isFinite(Date.parse(t))&&now-Date.parse(t)>=0&&now-Date.parse(t)<15*60*1000;
 const pending=(d.fixes||[]).filter(readyFix).length, drafts=(d.drafts||[]).filter(x=>x.status==='needs_review').length;
 const topics=a.topics||w.topics||[],writing=topics.find(t=>t.status==='writing'),findingTopics=S.workspaceBusy.has('topics:'+s.id),writingRequest=topics.some(t=>S.workspaceBusy.has('draft:'+t.id));
 const jobs=(d.aeoChecks||[]).map(x=>x.checked_at).filter(Boolean).sort();const aiAt=a.aiUpdatedAt||jobs.at(-1)||r?.started_at;
 const telemetryUnavailable=!S.isAdmin&&!d.agentStatus;
 const seoRunning=c.status==='running'&&recent(c.updated_at),aiRunning=r?.status==='running'&&recent(aiAt),contentRunning=findingTopics||writingRequest||!!writing&&recent(writing.started_at);
 const roster=[
 {key:'seo',name:'SEO agent',scope:'Search Console · website health',state:telemetryUnavailable?'Status unavailable':c.status==='failed'?'Needs attention':seoRunning?'Working':c.status==='running'?'Check status':c.status==='queued'?'Queued':pending?'Awaiting approval':'Standing by',active:seoRunning,last:telemetryUnavailable?'Live audit history is not shared in this client view':audit?`${audit.page_count||0} pages in the latest saved audit`:'No completed website audit recorded',now:seoRunning?`${c.pages||0} pages checked · ${c.stage==='writing'?'preparing proposals':'auditing pages'}`:c.status==='failed'?'Audit interrupted; progress is saved':c.status==='running'?'No recent progress confirmation':pending?`${plural(pending,"proposed change")} ready for review`:'No active audit confirmed',next:pending?'Review proposals, then verify approved changes':s.next_run_at||a.nextRunAt?`Scheduled website check: ${fmtTime(s.next_run_at||a.nextRunAt)}`:'Start a website check when ready',time:c.updated_at||audit?.created_at,page:'fixes'},
 {key:'visibility',name:'GEO / AEO agent',scope:'AI answers · citations · competitors',state:telemetryUnavailable?'Status unavailable':d.aeoReportError?'Needs attention':aiRunning?'Working':r?.status==='running'?'Check status':r?.status==='failed'?'Needs attention':r?'Ready for review':'Not started',active:aiRunning,last:telemetryUnavailable?'Live visibility history is not shared in this client view':r?.status==='done'?`Latest visibility check completed ${fmtTime(r.finished_at)}`:'No completed check in the current snapshot',now:aiRunning?'Collecting answers for the current question set':r?.status==='running'?'Run unfinished; inspect progress':d.aeoReportError?'Results unavailable; refresh to retry':r?'Recorded answers are ready to inspect':'No visibility run in this snapshot',next:'Review question-level gaps, make useful changes, then recheck',time:aiAt||r?.finished_at,page:'geo'},
 {key:'content',name:'Content agent',scope:'Articles · website copy · campaign drafts',state:contentRunning?'Working':writing?'Check status':drafts?'Awaiting approval':'Standing by',active:contentRunning,last:drafts?`${drafts} draft${drafts===1?'':'s'} prepared for review`:'No drafts awaiting review',now:findingTopics?'Reviewing business context and search queries for the next topic batch':contentRunning?`Writing: ${writing?.title||'your selected topic'}`:writing?'Draft request has no recent completion confirmation':drafts?'Waiting for a decision on prepared drafts':'No active writing request',next:drafts?'Review the copy and supporting facts':topics.find(t=>t.status==='suggested')?`Ready to draft: ${topics.find(t=>t.status==='suggested').title}`:'Choose a recommended topic or create a brief',time:writing?.started_at||(d.drafts||[])[0]?.created_at,page:'content'},
 {key:'ads',name:'Paid media agent',scope:'Google Ads · Meta Ads',state:'Not connected',active:false,last:'No campaign execution recorded',now:'Campaign and ad-copy planning is available to the agency',next:'Prepare a campaign brief and confirm account access before launch',page:'paid'},
 {key:'strategy',name:'Growth strategist',scope:'Business priorities · cross-channel direction',state:'On demand',active:false,last:(w.messages||[]).length?'Business questions answered in your workspace':'Uses your business profile and available evidence',now:'Ready to help the agency evaluate priorities',next:'Review goals and available data before choosing the next move',page:'today'}
 ];
 const paidAgent=roster.find(a=>a.key==='ads'),paidRows=S.paid?.[s.id]?.reports||[],paidHealth=(S.operations?.[s.id]?.health||[]).filter(h=>['google_ads','meta_ads'].includes(h.channel));
 if(paidHealth.some(h=>h.state!=='not_connected')||paidRows.length){paidAgent.state=paidHealth.some(h=>h.state==='needs_attention')?'Needs attention':paidRows.length?'Reporting ready':'Sync pending';paidAgent.last=paidRows.length?`${paidRows.length} campaign reports saved`:'No completed ad report';paidAgent.now=paidAgent.state==='Needs attention'?'Review account access or the last reporting error':'Available campaign reports are ready to inspect';paidAgent.next='Review reporting and account limits before preparing a specific change';paidAgent.time=paidRows[0]?.observed_at;}
 const recorded=S.operations?.[s.id]?.jobs||[];for(const a of roster){const channels={seo:['search','connections'],content:['content'],ads:['paid'],strategy:['results','strategy']};const j=recorded.find(j=>(channels[a.key]||[]).includes(j.channel)&&['running','queued','blocked','uncertain'].includes(j.status));if(j){const state=operationState(j);a.active=state==='running';a.state=state==='running'?'Working':state==='queued'?'Queued':'Needs attention';a.now=j.error||(state==='check_status'?'No recent progress confirmation. Check the work queue.':state==='queued'?'Waiting in the work queue':state==='blocked'||state==='uncertain'?'Work needs a review before continuing':({channel_health:'Checking account connections',gsc_sync:'Refreshing search reporting',content_plan:'Researching content topics',topic_draft:'Preparing selected website content',blog_publish:'Publishing the approved article',page_content_publish:'Applying an approved answer section',page_content_verify:'Verifying the published answer section',page_content_reverse:'Restoring the approved previous page',commerce_sync:'Refreshing store reporting',publication_verify:'Checking the article on the live website',content_measure:'Measuring published content',ads_sync:'Refreshing campaign reports',ads_execute:'Applying an approved campaign change'}[j.kind]||j.kind.replaceAll('_',' ')));a.time=j.heartbeat_at||j.created_at;}}return roster;
}
function pulseLine(active=false){return `<svg class="team-pulse ${active?'is-working':''}" viewBox="0 0 180 36" aria-hidden="true"><path d="M0 18H45L55 18L63 7L72 30L82 2L93 26L101 18H180"/></svg>`;}
function agencyActivity(s,d){
 if(!s||!d)return '';const agents=agentRoster(s,d),working=agents.filter(a=>a.active),attention=agents.filter(a=>a.state==='Needs attention'||a.state==='Check status');
 return `<aside class="team-strip" aria-label="Impackt Media agency activity"><div class="team-strip-title"><div class="command-reactor" aria-hidden="true"><i></i><i></i>${scanner('team-strip')}</div><div><b>Your Impackt Media team · Samaritan</b>${systemReadout(working.length?`${working.length} agent${working.length===1?'':'s'} working`:attention.length?'Some work needs attention':'Ready for the next move',working.length?'working':attention.length?'attention':'idle')}</div></div><div class="team-strip-summary">${agents.slice(0,3).map(a=>`<span><i class="team-dot ${a.active?'active':''}"></i>${esc(a.name)} <b>${esc(a.state)}</b><em title="${esc(a.now)}">${esc(a.now)}</em></span>`).join('')}</div><div class="team-strip-controls"><a class="team-strip-link" href="${href('team')}">See the work →</a><button class="motion-toggle" data-motion-toggle aria-pressed="${!!S.motionPaused}">${S.motionPaused?'Resume motion':'Pause motion'}</button></div></aside>`;
}
function agentWorkFeed(s,d){
 const rows=[];
 for(const f of d.fixes||[]){if(f.status!=='deployed')continue;const verified=(f.data?.verification||f.verification)?.state==='verified';rows.push({at:f.deployed_at,agent:'SEO agent',title:f.page_name||f.url||'Website update',detail:verified?'Change verified on the live page':'Change saved; live-page verification not confirmed',page:'fixes',sub:'live',label:verified?'Verified':'Saved'});}
 for(const draft of d.drafts||[]){rows.push({at:draft.created_at,agent:'Content agent',title:draft.title||'Content draft',detail:draft.status==='needs_review'?'Draft prepared and waiting for your review':`Draft status: ${draft.status||'recorded'}`,page:'content',label:'Draft'});}
 for(const run of d.aeoRuns||d.agentStatus?.aeoRuns||[]){if(run.status==='done')rows.push({at:run.finished_at,agent:'GEO / AEO agent',title:'AI visibility check completed',detail:'Open the recorded answers and question-specific improvement plan',page:'geo',label:'Checked'});}
 const recent=rows.filter(r=>r.at&&Number.isFinite(Date.parse(r.at))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,6);
 return `<section class="work-evidence"><div class="card-head"><div><div class="eyebrow">The output behind the activity</div><h2>Your team’s latest work</h2></div><span class="kind">Saved records · newest first</span></div>${recent.length?`<ol>${recent.map(r=>`<li>${scanner('work-'+r.at+'-'+r.title)}<div><small>${esc(r.agent)} · ${esc(r.label)}</small><h3>${esc(r.title)}</h3><p>${esc(r.detail)}</p><time datetime="${esc(r.at)}">${esc(fmtTime(r.at))}</time></div><a class="btn" href="${href(r.page,r.sub||'')}">Open work →</a></li>`).join('')}</ol>`:'<div class="empty"><b>No completed output recorded yet.</b>Run a website check or prepare a draft to start building your work history.</div>'}</section>`;
}

function operationState(j){return j.status==='running'&&(!(Date.parse(j.lease_expires_at)>Date.now())||!(Date.parse(j.heartbeat_at)>Date.now()-120000)||Date.parse(j.heartbeat_at)>Date.now())?'check_status':j.status;}
function operationsHealth(s){
 const o=S.operations?.[s.id];if(!o)return '';if(o.error)return `<div class="banner" role="alert">Work status unavailable: ${esc(o.error)}</div>`;
 return `<div class="operation-health">${(o.health||[]).map(h=>`<article><b>${esc(({shopify:'Shopify',gsc:'Search Console',google_ads:'Google Ads',meta_ads:'Meta Ads'})[h.channel]||h.channel)}</b><span>${esc(h.state.replaceAll('_',' '))}</span><small>${h.channel==='shopify'?'Access '+(h.last_attempt_at?'checked '+esc(fmtTime(h.last_attempt_at)):'not checked'):h.last_success_at?'Data synced '+esc(fmtTime(h.last_success_at)):'No successful reporting sync'}${h.data_through?' · data through '+esc(h.data_through):''}</small>${h.error?`<p>${esc(h.error)}</p>`:''}</article>`).join('')}</div>`;
}
function operationsPanel(s){
 const o=S.operations?.[s.id];if(!o)return '';if(o.error)return operationsHealth(s);
 const jobs=o.jobs||[],labels={channel_health:'Check connections',gsc_sync:'Refresh search reporting',content_plan:'Research content topics',topic_draft:'Write article',blog_publish:'Publish approved article',publication_verify:'Verify published article',content_measure:'Measure article performance',ads_sync:'Refresh ad reporting',ads_execute:'Apply approved campaign change',pilot_snapshot:'Record pilot results'};
 return `<section class="card operations-panel" aria-label="Background work"><div class="card-head"><div><div class="eyebrow">Your team’s work queue</div><h2>${o.policy&&!o.policy.paused?'Work queue enabled':'Work queue paused'}</h2><p>Work continues when you close this dashboard. Publishing and campaign changes require approval.</p></div>${S.isAdmin?`<button class="btn" data-operation="${o.policy&&!o.policy.paused?'pause':'resume'}">${o.policy&&!o.policy.paused?'Pause new jobs':'Enable scheduled work'}</button>`:''}</div>${operationsHealth(s)}${S.isAdmin?`<label class="approval-check"><input type="checkbox" data-weekly-content ${o.policy?.weekly_content?'checked':''}> Prepare ${o.policy?.content_per_week||1} article draft each week for review</label>`:''}${S.isAdmin?'<div class="operation-actions"><button class="btn" data-operation="channel_health">Check connections</button><button class="btn" data-operation="gsc_sync">Refresh search data</button><button class="btn" data-operation="content_plan">Prepare content topics</button></div>':''}<ol class="operation-list">${jobs.slice(0,12).map(j=>`<li><span class="team-dot ${operationState(j)==='running'?'active':''}"></span><div><b>${esc(labels[j.kind]||j.kind)}</b><p>${esc(j.error||j.result?.summary||('Scheduled '+fmtTime(j.run_after)))}</p><small>${esc(fmtTime(j.finished_at||j.heartbeat_at||j.created_at))}</small>${S.isAdmin&&j.status==='queued'?`<button class="btn" data-job-cancel="${j.id}">Cancel queued work</button>`:''}${S.isAdmin&&j.status==='blocked'&&j.result?.retryable?`<button class="btn" data-job-retry="${j.id}">Retry this job</button>`:''}</div><span class="status">${esc(operationState(j).replaceAll('_',' '))}</span></li>`).join('')||'<li>No background jobs recorded. Enable scheduled work to begin.</li>'}</ol></section>`;
}
function teamView(s,d){return `${pageHead('Your marketing operation','Meet your Impackt Media team','What has been done, what is happening now and what comes next.', '<button class="btn" data-client-refresh>Refresh status</button>')}${operationsPanel(s)}<div class="team-policy"><span>${icon('shield')} Approval required for publishing</span><span>${icon('activity')} Status comes from saved work records</span><span>${icon('users')} Message your marketing team</span></div>${agentWorkFeed(s,d)}<div class="agent-grid">${agentRoster(s,d).map(a=>`<article class="agent-card ${a.active?'active':''}"><header><div class="agent-avatar">${scanner('team-'+a.key)}</div><div><h2>${esc(a.name)}</h2><p>${esc(a.scope)}</p></div><span class="agent-state">${esc(a.state)}</span></header>${pulseLine(a.active)}<dl><div><dt>Last recorded</dt><dd>${esc(a.last)}</dd></div><div><dt>Now</dt><dd>${esc(a.now)}</dd></div><div><dt>Next</dt><dd>${esc(a.next)}</dd></div></dl><footer><small>${a.time?'Last signal '+esc(fmtTime(a.time)):'No live job signal'}</small><a href="${href(!S.isAdmin&&['ads','visibility'].includes(a.key)?'connections':a.page,S.isAdmin?a.sub||'':'')}">${!S.isAdmin&&['ads','visibility'].includes(a.key)?'View connections':a.state==='Not connected'?'View channel plans':'Open workspace'} →</a></footer></article>`).join('')}</div><details class="card" style="margin-top:20px"><summary>How to read your team’s status</summary><p>Working requires an active job and a recent signal. Old or interrupted jobs show Check status. Standing by means no active job is confirmed. Scheduled work continues through the backend when automation is enabled. Publishing always requires an exact-version approval. Each channel shows the work confirmed by its own records.</p></details>${pilotPanel(s)}${specialistInbox()}`;}
function workNav(){return `<nav class="subtabs work-navigation" aria-label="Work categories">${[['fixes','Website'],['content','Content'],...(S.isAdmin?[['leads','Pipeline']]:[])].map(([p,n])=>`<a class="subtab" href="${href(p)}" aria-current="${S.page===p}">${n}</a>`).join('')}${S.isAdmin?`<a class="subtab" href="${href('growth','ads')}">Campaign planning</a>`:''}</nav>`;}
async function loadSupport(id){const identity=S.session?.user?.id;const {data,error}=await sb.rpc('support_snapshot',{p_site:id});if(S.session?.user?.id!==identity)return;S.support||={};S.support[id]=error?{error:error.message}:data;}
function supportPreview(){
 const id=S.siteId,h=S.support?.[id],draft=S.supportDrafts?.[id]?.body||'',busy=S.supportSending?.has(id);
 return `<button class="support-launcher" aria-label="Message your human marketing team" data-support-toggle aria-expanded="${!!S.supportOpen}" aria-controls="support-preview">${icon('users',18)} Your human team</button><aside id="support-preview" class="support-panel" aria-label="Human team messages" ${S.supportOpen?'':'hidden'}><header><div><b>Real people. In your corner.</b><small>${h?.thread?.assigned?'Assigned to a marketing specialist':'Send a question to your marketing team'}</small></div><button class="icon-btn" data-support-toggle aria-label="Close team messages">×</button></header><div class="support-intro">${esc(siteById(id)?.name||'Your business')} · ${h?.thread?.status==='resolved'?'Resolved — a new message reopens the conversation.':'Messages are handled by your team. A saved message does not mean someone is online.'}</div>${h?.error?`<p class="banner" role="alert">${esc(h.error)}</p>`:''}<div class="support-thread" aria-live="polite">${(h?.messages||[]).map(m=>`<article class="support-bubble ${m.mine?'mine':'response'}"><b>${m.mine?'You':m.author_role==='specialist'?'Marketing team':'Client'}</b><p>${esc(m.body).replaceAll('\n','<br>')}</p><small>${esc(fmtTime(m.created_at))}</small></article>`).join('')||'<p>Ask about your business, request a review or discuss the next decision.</p>'}${busy?'<p role="status">Saving your message…</p>':''}</div>${S.isAdmin&&h?.thread?`<div class="operation-actions"><button class="btn" data-support-manage="claim">${h.thread.assigned_to_me?'Assigned to you':'Take ownership'}</button><button class="btn" data-support-manage="${h.thread.status==='resolved'?'open':'resolved'}">${h.thread.status==='resolved'?'Reopen':'Mark resolved'}</button></div>`:''}<form id="human-message"><label class="field">Message your team<textarea name="message" maxlength="4000" required rows="3" ${busy?'disabled':''}>${esc(draft)}</textarea></label><button class="btn primary" ${busy?'disabled':''}>${busy?'Saving…':'Send message'}</button></form><small>Latest 100 messages · visible only in this business’s workspace and the specialist inbox.</small></aside>`;
}
function healthCard(){const h=S.health;if(!S.isAdmin||!h)return '';const JOB={uncertain:'Outcome unconfirmed',needs_review:'Needs a person',failed:'Failed',blocked:'Blocked'};const items=(h.jobs_needing_review||[]).slice(0,8);const stat=(n,l,bad)=>`<div class="hc-stat ${bad&&n?'bad':''}"><b>${n??0}</b><span>${l}</span></div>`;return `<section class="card health-card" style="margin:20px 0"><div class="card-head"><div><div class="eyebrow">Background work</div><h2>${items.length||h.clients_waiting_over_1_day||h.cron_failures_24h?'Needs attention':'Running normally'}</h2></div><small class="muted">Checked ${esc(fmtTime(h.checked_at))}</small></div><div class="hc-stats">${stat(h.jobs_running,'jobs running')}${stat(h.jobs_queued_due,'due now',h.oldest_due_minutes>15)}${stat((h.jobs_needing_review||[]).length,'need a person',1)}${stat(h.clients_waiting,'clients waiting')}${stat(h.clients_waiting_over_1_day,'waiting over a day',1)}${stat(h.paid_requests_awaiting,'ad requests to decide',1)}${stat(h.cron_failures_24h,'scheduler failures (24h)',1)}${stat(h.edge_errors_24h,'server errors (24h)',1)}</div>${items.length?`<ul class="hc-list">${items.map(j=>`<li><span class="pill">${esc(JOB[j.status]||j.status)}</span><b>${esc(siteById(j.site_id)?.name||j.site_id)} · ${esc(String(j.kind).replaceAll('_',' '))}</b><small>${esc(j.error||'')}${j.since?' · '+esc(fmtTime(j.since)):''}</small></li>`).join('')}</ul>`:''}<p class="kind">Publishing jobs whose result can't be confirmed are never retried automatically. Check the live page, then retry or close them.</p></section>`;}
function specialistInbox(){if(!S.isAdmin)return '';const ci=S.chatInbox||[];return healthCard()+`<section class="card" style="margin:20px 0"><div class="eyebrow">Client messages</div><h2>Conversations waiting on the team</h2>${ci.length?ci.map(t=>`<a class="support-inbox-row" data-chat-thread="${esc(t.id)}" data-chat-site="${esc(t.site_id)}" href="#/w/${encodeURIComponent(t.site_id)}/team"><b>${esc(siteById(t.site_id)?.name||t.site_id)} · ${esc(t.title||'Conversation')}</b><span>${t.status==='waiting'?'Client is waiting':'Answered'} · ${t.owner_name?esc(t.owner_name):'No owner yet'}${t.channel==='samaritan'?' · handed off by Samaritan':''} · ${esc(fmtTime(t.last_message_at))}</span></a>`).join(''):'<p>No open client conversations.</p>'}</section><section class="card" style="margin:20px 0"><div class="eyebrow">Human support</div><h2>Earlier support messages</h2>${S.inboxError?`<p role="alert">${esc(S.inboxError)}</p>`:(S.inbox||[]).map(t=>`<a class="support-inbox-row" data-open-thread="${esc(t.site_id)}" href="#/w/${encodeURIComponent(t.site_id)}/team"><b>${esc(t.name)}</b><span>${esc(t.status)} · ${t.last_author==='client'?'Client sent the latest message':'Team replied'}${t.assigned_to_me?' · assigned to you':''}</span></a>`).join('')||'<p>No client conversations yet.</p>'}</section>`;}
function pilotPanel(s){
 const p=S.pilots?.[s.id];if(!p)return '';if(p.error)return errorBox(p.error);const program=p.program;
 if(!program)return S.isAdmin?`<section class="card" style="margin:20px 0"><h2>Measured pilot</h2><p>Enroll this business in a 30-day review of reliability, content, channel reporting and specialist support. Starting a pilot does not authorize publishing or ad spend.</p><button class="btn" data-pilot="pilot_start">Start this business’s pilot</button></section>`:'';
 const first=p.snapshots?.[0],latest=p.snapshots?.at(-1),m=latest?.metrics;
 return `<section class="card" style="margin:20px 0"><div class="eyebrow">Measured pilot</div><h2>Evidence before expansion.</h2><p>${esc(program.status)} · ${esc(fmtTime(program.started_at))} to ${esc(fmtTime(program.ends_at))}</p>${m?`<div class="grid two"><div><b>${m.jobs_last_24h.succeeded} jobs completed</b><p>Of ${m.jobs_last_24h.total} created in the last 24 hours · ${m.jobs_last_24h.blocked_or_uncertain} need attention.</p></div><div><b>${m.publications.verified} public articles verified</b><p>${m.publications.accepted} accepted by the publishing platform · ${m.drafts_awaiting_review} drafts awaiting review.</p></div><div><b>${m.search.clicks===null?'Search baseline unavailable':num(m.search.clicks)+' reported search clicks'}</b><p>${m.search.from?esc(m.search.from)+' – '+esc(m.search.to):'Connect Search Console to establish the baseline.'}</p></div><div><b>${m.verified_website_changes} website changes verified</b><p>First snapshot ${esc(first.snapshot_date)} · latest ${esc(latest.snapshot_date)}</p></div></div>`:'<p>Baseline recording is queued.</p>'}<details><summary>Pilot acceptance criteria</summary><ul>${Object.values(program.criteria||{}).map(v=>`<li>${esc(v)}</li>`).join('')}</ul></details><p>These are operational results and observed performance. They do not prove incremental sales, profit or that the pilot has passed.</p>${S.isAdmin?`<div class="operation-actions"><button class="btn" data-operation="pilot_snapshot">Record evidence now</button><button class="btn" data-pilot="pilot_status" data-state="${program.status==='active'?'paused':'active'}">${program.status==='active'?'Pause pilot snapshots':'Resume pilot snapshots'}</button></div>`:''}</section>`;
}


function clientDecision(d,kind,item){return (d.clientReviews||[]).find(r=>r.item_kind===kind&&r.item_id===String(item.id)&&Object.entries(clientSnapshot(kind,item)).every(([k,v])=>r.snapshot?.[k]===v))?.decision||null;}
function clientSnapshot(kind,item){return kind==='fix'?{before:item.before,after:item.after,field:item.field}:{title:item.title,body:item.body};}
function clientView(s,d){
 const role=d.role||s.role, review=role==='reviewer', rows=S.page==='content'?d.drafts.filter(x=>pendingDraft(x,d)&&(!S.sub||!/^[-0-9a-f]{36}$/i.test(S.sub)||x.id===S.sub)):d.fixes.filter(readyFix);
 const kind=S.page==='content'?'draft':'fix';
 if(S.page==='team')return teamView(s,d);
 if(S.page==='geo')return pageHead('AI search','GEO / AEO','Recorded evidence becomes reviewed content, not a client to-do list.')+channelSignal(s,d,'visibility')+aiAnswerBoard(s)+visibilityPlan(s,d);
 
 if(S.page==='paid')return pageHead('Lead generation','Account performance','Reported campaign metrics and the change journal.')+channelSignal(s,d,'ads')+paidConsole(s,d)+channelPriorities('Campaign work in production',(d.drafts||[]).filter(x=>(x.workspace==='ads'||['Ad copy','Campaign brief','Offer ideas'].includes(x.kind))&&x.status==='needs_review').map(x=>({title:x.title,detail:x.kind,page:'content',action:'Read draft'})),'No campaign drafts awaiting review.');
 if(['seo','geo'].includes(S.page))return clientChannelOverview(s,d,S.page);
 if(S.page==='connections')return `${pageHead('Your business context','Connect your accounts','Connect the tools relevant to your business. Your team can help with access or setup.')}<div class="actions"><a class="btn primary" href="${href('ask')}">Continue to Samaritan →</a><a class="btn" href="${href('team')}">Ask your team for help</a></div>${setupBar(s,d)}<details class="card"><summary>Connection details</summary><div class="list">${d.connectors.map(c=>`<div class="card"><b>${esc(CONNECTOR_TYPES[c.type]?.name||c.type)}</b><p>${esc(c.status)} · ${esc(fmtTime(c.last_checked_at))}</p></div>`).join('')||'<p>No connections recorded.</p>'}</div></details>${nangoSection(s)}`;
 if(S.page==='growth')return growthView(s,d);
 if(S.page==='inbox')return inboxView(s,d);
 if(S.page==='playbooks')return playbooksView(s,d);
 if(!['fixes','content'].includes(S.page))return homeView(s,d);
 const owner=role==='owner';
 return `${pageHead('Review workspace',kind==='draft'?'Content to review':'Website improvements',owner?'Approve a change to publish it on your website. Every change is checked on the live page and can be rolled back.':review?(kind==='draft'?'Read the finished work, then approve it or request changes. Approving publishes this exact version and we check the live page.':'Review the complete proposal, then approve it or request changes. Your agency publishes approved website changes.'):'Read-only access to proposed work.')}<div class="list">${rows.slice(0,100).map(item=>{
 if(owner)return ownerReviewCard(s,d,kind,item);
 // JSONB key order differs from browser insertion order; compare fields, not serialization.
 const matching=d.reviews.find(r=>r.item_kind===kind&&r.item_id===String(item.id)&&Object.entries(clientSnapshot(kind,item)).every(([k,v])=>r.snapshot[k]===v));
 return `<article class="card"><div class="card-head"><h3>${esc(kind==='draft'?item.title:item.page_name||item.url)}</h3><span class="client-role">${matching?esc(matching.decision.replaceAll('_',' ')):'Needs review'}</span></div>${kind==='fix'?`<p class="kind">${esc(FIELD[item.field]||item.field)}</p><div class="row2"><div><b>Current</b><p class="review-copy">${esc(item.before)}</p></div><div><b>Proposed</b><p class="review-copy">${esc(item.after)}</p></div></div>`:`<div class="review-copy">${readableDraft(item.body)}</div>${item.kind==='Blog post'?articleLinkReview(item.body):''}`}${review?suggestBox(kind,item):knowledgeCorrectionForm(kind,item.id)}${review&&kind==='draft'?`${pipelineNote(item,d)}<div class="actions"><button class="btn primary" data-approve-work="${esc(item.id)}" ${S.busy.has('d:'+item.id)?'disabled':''}>${S.busy.has('d:'+item.id)?'Publishing…':'Approve &amp; publish'}</button><button class="btn" data-client-decision="changes_requested" data-kind="draft" data-id="${esc(item.id)}">Request changes</button></div>`:review?`<details><summary>Record your decision</summary><p>This records your review of this exact version. The agency must still approve execution.</p><label class="approval-check"><input type="checkbox" id="client-read-${esc(item.id)}"> I have read this complete proposal.</label><div class="actions"><button class="btn primary" data-client-decision="approved" data-kind="${kind}" data-id="${esc(item.id)}">Approve this version</button><button class="btn" data-client-decision="changes_requested" data-kind="${kind}" data-id="${esc(item.id)}">Request changes</button></div></details>`:''}</article>`;}).join('')||'<div class="empty">No items awaiting review. Your agency will prepare the next steps.</div>'}</div>${owner&&kind==='fix'?ownerPublished(s,d):''}`;
}
function accessView(s){
 if(!S.isAdmin)return '<div class="empty">Agency access required.</div>';
 const state=S.access?.[s.id];
 if(!state){loadAccess(s.id);return '<p role="status">Loading workspace access…</p>';}
 if(state.error)return errorBox(state.error);
 return `${pageHead('Agency controls','Workspace access','Invite clients into this business only. No invitation email is sent automatically.')}<div class="card"><h3>Add a client</h3><p>They sign in using this exact email and verify it through the normal sign-in link. Viewer can read; reviewer can record approvals and requests for changes. Neither can publish, change credentials or invite other users.</p><form id="access-form" class="access-form"><label class="field">Client email<input name="email" type="email" required autocomplete="email"></label><label class="field">Role<select name="role"><option value="viewer">Viewer</option><option value="reviewer">Reviewer</option></select></label><button class="btn primary">Grant workspace access</button></form><p class="kind">Share your regular sign-in URL after adding access: ${esc(location.origin+'/app/')}</p></div><div class="card" style="margin-top:20px"><h3>Workspace members</h3>${state.members.map(m=>`<div class="access-row"><div><b>${esc(m.email)}</b><p class="kind">${esc(m.role)} · ${m.revoked_at?'Revoked':'Access enabled'}</p></div>${!m.revoked_at?`<button class="btn" data-revoke-access="${esc(m.id)}">Revoke access</button>`:''}</div>`).join('')||'<p>No clients added yet.</p>'}</div><div class="card" style="margin-top:20px"><h3>Client review history</h3><p class="kind">A decision applies only to the saved version below. Review the current item before execution.</p>${state.reviews.slice(0,30).map(r=>`<details><summary>${esc(r.item_kind)} · ${esc(r.decision.replaceAll('_',' '))} · ${esc(fmtTime(r.created_at))}</summary><p class="mono">Item ${esc(r.item_id)}</p><pre class="review-copy">${esc(JSON.stringify(r.snapshot,null,2))}</pre><a href="${href(r.item_kind==='draft'?'content':'fixes')}">Open current work →</a></details>`).join('')||'<p>No client decisions yet.</p>'}</div>`;
}
async function loadAccess(id){S.access=S.access||{};S.access[id]={members:[],reviews:[]};try{const [m,r]=await Promise.all([sb.from('workspace_access').select('*').eq('site_id',id).order('created_at'),sb.from('client_reviews').select('*').eq('site_id',id).order('created_at',{ascending:false}).limit(30)]);if(m.error||r.error)throw m.error||r.error;S.access[id]={members:m.data,reviews:r.data};}catch(e){S.access[id]={error:e.message};}if(S.siteId===id&&S.page==='access')render();}

// ---------- Simple workspace: Home + To review ----------
const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
function plainProblem(s, d) {
  const c = s.checkup || {}, out = [];
  if (c.status === "failed") {
    const credit = /credit balance|billing|quota|insufficient/i.test(c.error || "");
    out.push({ t: !S.isAdmin ? "Your weekly website check needs attention from your agency." : credit ? "Your website check is paused: the AI account is out of credits." : "Your last website check stopped before it finished.", cta: S.isAdmin ? "Run it again" : "", act: "checkup", detail: c.error });
  }
  for (const x of (d.connectors || []).filter((x) => x.status === "error")) out.push({ t: `${CONNECTOR_TYPES[x.type]?.name || PROVIDERS[x.type]?.name || x.type} is disconnected.`, cta: "Reconnect", h: href("connections"), detail: x.last_error });
  const failed = (d.fixes || []).filter((f) => f.status === "failed").length;
  if (failed) out.push({ t: `${plural(failed, "change")} couldn't go live.`, cta: "See why", h: href("fixes", "failed") });
  return out;
}
function problemStrip(s, d) {
  const p = plainProblem(s, d);
  if (!p.length) return ["running", "queued"].includes(s.checkup?.status) ? `<div class="h-alert info"><span class="h-dot live"></span><span>${s.checkup.status==='queued'?'Website audit queued':'Website audit running'} · ${num(s.checkup.pages || 0)} pages recorded. You can leave this page.</span></div>` : "";
  return p.slice(0, 2).map((x) => `<div class="h-alert"><span class="h-dot warn"></span><span><b>${esc(x.t)}</b>${x.detail && S.isAdmin ? ` <details><summary>Details</summary><code>${esc(x.detail)}</code></details>` : ""}</span>${x.cta ? x.h ? `<a class="btn" href="${x.h}">${esc(x.cta)}</a>` : `<button class="btn" data-act="${x.act}">${esc(x.cta)}</button>` : ""}</div>`).join("");
}
function kpiTiles(s,d) {
 const R=window.ImpacktResults,r=R.range(S.resultEnd||new Date(Date.now()-DAY).toISOString().slice(0,10),28),snap=S.results[s.id]||{};
 const store=(snap.reports||[]).find(r=>r.source==='shopify')?.payload,commerce=R.summary(store?.rows||[],r),search=R.summary(snap.search||[],r),ai=R.aiCohort(snap.ai||[],r);
 const revenue=commerce.value('revenue'),currency=store?.currency;
 const tiles=[['Store performance',revenue!==null&&currency?new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:0}).format(revenue):'—',store?`${commerce.days}/28 days · ${store.mode==='total_sales'?'total sales':'order value'}`:'Connect store reporting','commerce'],['Organic search',search.value('clicks')===null?'—':num(search.value('clicks')),`${search.days}/28 days · Google clicks`,'search'],['AI citations',ai.current.n?pct(ai.current.citations/ai.current.n):'—',ai.current.n?`${ai.current.n} sampled question/provider pairs`:'No completed samples in this period','ai'],['Verified work',num(R.workRows(snap,r).length+R.publicationRows(snap,r).length),'Live changes & articles · 28 days','work']];
 if(!store||revenue===null||!currency)tiles.shift();
 const analytics=(S.results[s.id]?.reports||[]).find(r=>r.source==='ga4')?.payload;if(analytics){const rows=(analytics.rows||[]).filter(x=>x.date>=r.start&&x.date<=r.end);tiles.unshift(['Website sessions',rows.length?num(rows.reduce((n,r)=>n+Number(r.sessions||0),0)):'—',rows.length+'/28 days · Google Analytics','traffic']);}
 return `<section class="h-kpis" aria-label="Key numbers">${tiles.map(([label,value,note,tab])=>`<a class="h-kpi" href="${href('growth',tab)}"><span class="h-kpi-l">${label}</span><strong>${value}</strong><span class="h-kpi-s">${esc(note)}</span></a>`).join('')}</section>`;
}

function needsYou(s,d) {
 return `<section class="h-card h-needs"><div class="h-card-head"><h2>Ready for your review</h2><a class="h-link" href="${href('inbox')}">Open review hub →</a></div>${reviewCards(s,d,true)}</section>`;
}

function plainAgentLine(s,d,a){return a.now;}
function teamRows(s, d) {
  const names = { seo: "SEO", visibility: "AI search", content: "Content", ads: "Lead generation" };
  const pages = { seo: href("seo"), visibility: href("geo"), content: href("content"), ads: href("paid") };
  const tone = (st) => /Working/.test(st) ? "live" : /attention|Check status/i.test(st) ? "warn" : /Not connected|Not started|unavailable/i.test(st) ? "off" : "ok";
  return `<section class="h-card h-team"><div class="h-card-head"><h2>Your agents</h2><a class="h-link" href="${href("team")}">See all work →</a></div><ul>${agentRoster(s, d).filter((a) => names[a.key]&&(!ecommerceSite(s,d)||a.key!=="ads")).map((a) => ({ ...a, now: plainAgentLine(s, d, a) })).map((a) => `<li><a href="${pages[a.key]}"><span class="h-dot ${tone(a.state)}"></span><b>${names[a.key]}</b>${/unavailable/i.test(a.state) ? "<span></span>" : `<span class="h-state">${esc(a.state)}</span>`}<small>${esc(a.now)}</small><span class="h-go">→</span></a></li>`).join("")}</ul></section>`;
}
function askBar(s) {
  const w = S.workspace[s.id], busy = S.workspaceBusy.has("chat:" + s.id), last = (w?.messages || []).at(-1);
  return `<section class="h-ask"><form id="pulse-chat" class="h-ask-form"><label class="sr-only" for="pulse-question">Ask your marketing team</label><span class="h-ask-ic">${icon("sparkle", 18)}</span><textarea id="pulse-question" rows="1" maxlength="2000" placeholder="Ask anything about your marketing…" required ${busy ? "disabled" : ""}>${esc(S.chatInput[s.id] || "")}</textarea><button class="btn primary" ${busy ? "disabled" : ""}>${busy ? "Thinking…" : "Ask"}</button></form>
    ${S.pendingChat[s.id] ? `<div class="h-answer"><b>${esc(S.pendingChat[s.id])}</b><p class="muted">Thinking…</p></div>` : last ? `<div class="h-answer"><b>${esc(last.question)}</b><p>${esc(last.answer)}</p></div>` : `<div class="h-chips">${["What should I focus on this week?", "Why did my traffic change?", "What should we write next?"].map((q) => `<button class="chip" data-prompt="${esc(q)}" ${busy ? "disabled" : ""}>${esc(q)}</button>`).join("")}</div>`}
    ${S.chatErrors[s.id] ? `<p class="h-err" role="alert">${esc(S.chatErrors[s.id])}</p>` : ""}</section>`;
}
function confirmedStrip(s, d) {
  const wk = Date.now() - 7 * DAY;
  const tasks = [];
  const fixes = (d.fixes || []).filter((f) => verifiedLive(f) && Date.parse(f.data?.verification?.checked_at || f.deployed_at) > wk);
  const n = tasks.length + fixes.length; if (!n) return "";
  const ai = tasks.filter((t) => t.kind === "AI visibility").length;
  return `<div class="h-alert ok"><span class="h-dot"></span><span><b>${plural(n, "improvement")} confirmed this week.</b> ${ai ? `${plural(ai, "AI question")} now name${ai === 1 ? "s" : ""} you · ` : ""}checked on your live site automatically.</span>${tasks.length ? `<button class="btn ghost" data-see-confirmed>See them</button>` : `<a class="btn ghost" href="${href("fixes", "live")}">See them</a>`}</div>`;
}
// Daily Pulse: what happened since the last visit (min. 24h window), built only from recorded work.
function pulseSince(siteId) {
  const k = "gb-seen:" + siteId; let prev = 0;
  try {
    let p = sessionStorage.getItem(k + ":prev");
    if (p === null) { p = localStorage.getItem(k) || "0"; sessionStorage.setItem(k + ":prev", p); localStorage.setItem(k, String(Date.now())); }
    prev = Number(p) || 0;
  } catch { /* storage unavailable: fall back to 24h */ }
  const dayAgo = Date.now() - DAY;
  return prev && prev < dayAgo && prev > Date.now() - 30 * DAY ? { t: prev, label: "Since your last visit" } : { t: dayAgo, label: "In the last 24 hours" };
}
function dailyPulse(s, d) {
  const { t, label } = pulseSince(s.id), after = (v) => v && Date.parse(v) > t;
  const live = (d.fixes || []).filter((f) => verifiedLive(f) && after(f.data?.verification?.checked_at || f.deployed_at)).length
    ;
  const drafts = (d.drafts || []).filter((x) => after(x.created_at));
  const found = (d.fixes || []).filter((f) => f.status === "pending" && after(f.created_at)).length + (d.tasks || []).filter((x) => x.status === "pending" && after(x.created_at)).length;
  const failed = (d.fixes || []).filter((f) => f.status === "failed" && after(f.updated_at || f.created_at)).length;
  const run = (d.aeoRuns || []).find((r) => after(r.finished_at || r.started_at) && r.summary?.visibility != null);
  const checked = after(s.last_run_at);
  const waiting = (d.fixes || []).filter(readyFix).length + (d.drafts || []).filter((x) => x.status === "needs_review").length;
  const kinds = [...new Set(drafts.map((x) => x.kind))].slice(0, 3).join(", ").toLowerCase();
  const rows = [
    live && { ic: "check", tone: "ok", t: `${plural(live, "change")} confirmed live on your site`, h: href("fixes", "live") },
    drafts.length && { ic: "file", tone: "", t: `${plural(drafts.length, "new draft")} written for you${kinds ? ` (${kinds})` : ""}`, h: href("content") },
    checked && { ic: "search", tone: "", t: `Website re-checked ${fmtTime(s.last_run_at)}${found ? `: ${plural(found, "new issue")} found` : ": audit completed"}`, h: href("fixes") },
    run && { ic: "globe", tone: "", t: `AI search re-asked: you're named in ${run.summary.visibility}% of answers`, h: href("geo") },
    failed && { ic: "alert", tone: "warn", t: `${plural(failed, "change")} didn't go through. We'll retry or flag it`, h: href("fixes") },
  ].filter(Boolean);
  return `<section class="h-card h-pulse"><div class="h-card-head"><h2>${label}</h2><span class="h-pulse-when">${esc(new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }))} → now</span></div>
    ${rows.length ? `<ul>${rows.map((r) => `<li class="${r.tone}"><a href="${r.h}"><span class="h-pulse-ic">${icon(r.ic, 15)}</span><span>${esc(r.t)}</span><span class="h-arrow">→</span></a></li>`).join("")}</ul>` : `<p class="muted">Quiet stretch: no new results recorded yet. Your next website check is ${s.next_run_at ? esc(fmtTime(s.next_run_at)) : "not yet scheduled"}.</p>`}
    ${waiting ? `<a class="h-pulse-next" href="${href("inbox")}"><b>${plural(waiting, "decision")} waiting on you</b><span>Review →</span></a>` : ""}</section>`;
}
// Samaritan work loop: every supported problem from evidence to measured result.
const OPP_STAGE={drafting:['Writing the fix','live'],ready:['Ready for you','warn'],approved:['Approved · publishing','live'],live:['Live & verified','ok'],measured:['Measured','ok'],blocked:['Needs agency','err'],dismissed:['Dismissed','off']};
function oppResult(o){
 const r=o.result||{},b=o.baseline||{};
 if(o.kind==='ai_answer_gap'){if(r.ai)return `AI answers now name you ${r.ai.named} of ${r.ai.total} (was ${b.ai?.named??0} of ${b.ai?.total??'?'}) · checked ${fmtShort(r.ai.at)}`;if(o.stage==='live')return 'Waiting for the next AI-search check to compare.';}
 if(r.sales){const d=(x)=>x.days?(x.units/x.days*7).toFixed(1):'0';return `Units sold per week: ${d(r.sales.before)} before → ${d(r.sales.after)} after (${r.sales.after.days} days)`;}
 if(o.stage==='live')return o.target_kind==='product'?'Sales comparison starts 7 days after going live.':'';
 return '';
}
function workLoop(s){
 const st=S.opps?.[s.id];if(!st)return '';
 const rows=(st.rows||[]).filter(o=>o.stage!=='dismissed'&&(S.isAdmin||o.publishable)),c=k=>rows.filter(o=>k.includes(o.stage)).length;
 const steps=[['Writing',c(['drafting'])],['Ready for you',c(['ready'])],['Publishing',c(['approved'])],['Live & verified',c(['live'])],['Measured',c(['measured'])]];
 const list=rows.slice().sort((a,b)=>({ready:0,blocked:1,approved:2,drafting:3,live:4,measured:5}[a.stage]??9)-({ready:0,blocked:1,approved:2,drafting:3,live:4,measured:5}[b.stage]??9)||Date.parse(b.updated_at)-Date.parse(a.updated_at)).slice(0,6);
 const act=o=>o.stage==='ready'&&o.draft_id?`<a class="btn ${o.publishable?'accent':''} sm" href="${href('content','drafts')}" data-open-draft="${esc(o.draft_id)}">${o.publishable?'Review & publish':'Review & copy'}</a>`:o.stage==='live'||o.stage==='measured'?`<a class="btn ghost sm" href="${esc(o.target_url)}" target="_blank" rel="noopener">View live</a>`:'';
 return `<section class="h-card wl"><div class="h-card-head"><h2>Samaritan's work</h2>${S.isAdmin?`<button class="btn ghost sm" data-wl-run ${S.wlBusy?'disabled':''}>${S.wlBusy?'Looking…':'Find more work now'}</button>`:''}</div>${S.wlBusy?`<p class="wl-live"><span class="wl-spin"></span>Samaritan is checking AI answers and your pages for the next fixes. They'll appear below as they're written.</p>`:''}
  <p class="wl-sub">Every item starts from evidence, ships only with a yes, and is checked after it goes live.</p>
  <ol class="wl-steps">${steps.map(([l,n])=>`<li class="${n?'on':''}"><strong>${num(n)}</strong><span>${l}</span></li>`).join('')}</ol>
  ${list.length?`<ul class="wl-list">${list.map(o=>{const [lab,tone]=OPP_STAGE[o.stage]||[o.stage,''];const res=oppResult(o);return `<li><div class="wl-top"><span class="pill wl-${tone}">${lab}</span><b>${esc(o.title)}</b>${act(o)}</div><p>${esc(o.why)}</p>${res?`<p class="wl-res">${esc(res)}</p>`:''}${o.stage==='blocked'&&S.isAdmin&&o.last_error?`<p class="wl-err">${esc(o.last_error)}</p>`:''}</li>`;}).join('')}</ul>`:`<p class="muted">Samaritan is checking AI answers and your pages for the next supported problem.</p>`}
 </section>`;
}
function awaitingFirstAudit(s,d) {
 return !!s && s.active!==false && Object.hasOwn(s,'last_run_at') && !s.last_run_at && !d.audits?.length && s.checkup?.status!=='done';
}
function firstAuditView(s,d){
 const audit=s.checkup||{}, status=audit.status||'pending';
 const stages={sitemaps:'Discovering website pages',products:'Reading product listings',collections:'Checking collection pages',shop_pages:'Reading store pages',articles:'Checking published articles',media:'Checking product images',pages:'Checking website pages',writing:'Preparing suggested changes',finish:'Saving the audit results'};
 const stale=status==='running' && Date.now()-Date.parse(audit.updated_at)>6*60000;
 const title=status==='failed'?'Your first audit needs attention':status==='running'?'Samaritan is learning your business':status==='queued'?'Your first audit is queued':'Your workspace is set up';
 const activity=status==='failed'?'The website check stopped before it finished.':stale?'Waiting for the audit worker to resume.':status==='running'?(stages[audit.stage]||'Reading your website'):status==='queued'?'Waiting for the next audit worker.':'Waiting for the first website check.';
 const pages=Number(audit.pages)||0,found=Number(audit.found)||0,queued=Number(audit.queued)||0;
 const connected=(d.connectors||[]).filter(c=>c.status==='connected').length;
 return `<section class="first-audit"><header><div class="fa-mark">${scanner('first-audit')}</div><p class="eyebrow">First website audit</p><h1>${title}</h1><p>${esc(s.name)} · ${esc(s.domain)}</p></header>
 <div class="fa-body"><section><h2>Workspace ready</h2><p>Business profile saved · ${plural(connected,'connected account')}</p></section>
 <section role="status"><h2>${esc(activity)}</h2><p>${pages?plural(pages,'page')+' checked so far.':'Page counts appear after Samaritan saves its first checks.'}${found?' '+plural(found,'finding')+' recorded.':''}</p>
 ${audit.updated_at?`<small>Last audit update · ${esc(fmtTime(audit.updated_at))}</small>`:''}</section>
 <section><h2>Your first recommendations</h2><p>${queued?plural(queued,'suggestion')+' queued so far.':"Samaritan checks for supported improvements. The audit can finish with no changes needed."}</p></section>
 <footer><p>${status==='failed'?'Your agency can restart the check from this workspace.':'You can leave this screen. Home will show your dashboard when the first audit finishes.'}</p>
 ${S.isAdmin&&['failed','pending'].includes(status)?'<button class="btn primary" data-act="checkup">Start website check</button>':''}
 <a class="btn" href="${href('connections')}">View integrations</a></footer></div></section>`;
}
let firstPollBusy=false;
async function updateFirstAudit(){
 const id=S.siteId,identity=S.session?.user?.id;
 if(firstPollBusy||!identity||document.hidden||S.page!=='today'||!S.data[id]||!awaitingFirstAudit(siteById(id),S.data[id]))return;
 firstPollBusy=true;
 try{
  const {data,error}=await sb.rpc('client_sites');if(error)throw error;
  if(S.session?.user?.id!==identity||S.siteId!==id||S.page!=='today')return;
  const current=data?.find(row=>row.id===id);if(!current){await boot();return;}
  if(!Object.hasOwn(current,'last_run_at'))return;
  const site=siteById(id);
  if(current.last_run_at||current.checkup?.status==='done'){
   await loadSite(id);
   if(S.session?.user?.id!==identity||S.siteId!==id||S.page!=='today')return;
  }
  Object.assign(site,{last_run_at:current.last_run_at,checkup:current.checkup});render();
 }catch{/* Keep the last saved status and retry on the next visible poll. */}
 finally{firstPollBusy=false;}
}
setInterval(updateFirstAudit,8000);

function homeView(s, d) {
  const prompt=!S.isAdmin&&s.role==="reviewer"&&!s.market_client_confirmed?'<section class="card"><h2>Is our understanding of your business accurate?</h2><p>Check your services, locations and reach before reviewing the work.</p><button class="btn primary" data-market-open>Review business profile</button></section>':"";
  if(awaitingFirstAudit(s,d))return prompt+firstAuditView(s,d);
  const series = overviewSeries(d, S.overviewMetric);
  // Ordered by the owner's questions: what needs me → is it working → what got done → what's next.
  const zone = (id, label, body) => body.trim() ? `<section class="h-zone" id="z-${id}" aria-label="${label}">${body}</section>` : "";
  const chart = series.total != null ? `<section class="card overview-chart h-chart" id="overview-chart" aria-label="Search performance">${overviewChart(d)}</section>` : "";
  const storeTrend=window.ImpacktResults.homeStoreTrend(S.results[s.id],S.resultEnd||isoDay(Date.now()-DAY));
  const primaryTrend=storeTrend||(series.reported>=2?chart:"");
  const secondarySearch=chart&&chart!==primaryTrend?`<details class="home-search-detail"><summary>Organic search performance</summary>${chart}</details>`:"";
  const hasChart=!!primaryTrend;
  const performance=`<div class="workspace-pair">${primaryTrend||goalCard(s,d)}${commandHero(s,d)}</div>`+kpiTiles(s,d)+(hasChart?goalCard(s,d):"")+secondarySearch;
  return `<header class="h-head"><div><p class="h-hello">${greet()}</p><h1>${esc(s.name)}</h1></div></header>
    <nav class="workspace-actions" aria-label="Quick actions"><a class="lead" href="${href('inbox')}">${icon('checks',15)} Review work</a><a href="${href('growth')}">${icon('activity',15)} Results</a><a href="${href('team')}">${icon('users',15)} Your team</a><button type="button" data-client-refresh>${icon('refresh',15)} Refresh</button></nav>
    ${prompt}${zone("decide","Your next decisions",decisionBanner(s,d))}${problemStrip(s,d)}${zone("results","Performance and reviews",performance)}
    ${zone("done", "What got done", doneForYou(s, d))}
    ${zone("motion", "What's in motion", workLoop(s) + teamRows(s, d))}`;
}
function reviewGroups(s,d) {
 const topics=S.results[s.id]?.topics||S.workspace[s.id]?.topics||[],geoIds=new Set([...topics.filter(t=>t.source_task_id).map(t=>t.draft_id),...(S.opps?.[s.id]?.rows||[]).filter(o=>['ai_answer_gap','article_aeo','thin_page'].includes(o.kind)&&o.draft_id).map(o=>o.draft_id)]);
 const undecided=(kind,item)=>!(d.reviews||[]).some(r=>r.item_kind===kind&&r.item_id===String(item.id)&&(r.decision==='approved'||!S.isAdmin)&&Object.entries(clientSnapshot(kind,item)).every(([k,v])=>r.snapshot?.[k]===v));
 const publishing=new Set([...(S.workspace[s.id]?.publications||[]),...(S.results[s.id]?.page_publications||[])].filter(p=>['approved','applying','publishing','published','uncertain','reverted'].includes(p.status)).map(p=>p.draft_id));
 const pending=d.drafts.filter(x=>pendingDraft(x,d,s.id)&&inScopeDraft(x)&&undecided('draft',x)),groups=[
 {key:'seo',name:'Google search',icon:'search',description:'Page improvements with evidence and a before / after review.',fixes:d.fixes.filter(x=>readyFix(x)&&undecided('fix',x)),drafts:[]},
 {key:'geo',name:'AI answers',icon:'globe',description:'Content prepared from recorded AI search opportunities.',fixes:[],drafts:pending.filter(x=>geoIds.has(x.id))},
 {key:'content',name:'Content',icon:'file',description:'Website articles and page copy, ready for your feedback.',fixes:[],drafts:pending.filter(x=>x.workspace!=='ads'&&!geoIds.has(x.id))},
 {key:'paid',name:'Paid ads',icon:'megaphone',description:'Campaign proposals and creative. People control the spend.',fixes:[],drafts:pending.filter(x=>x.workspace==='ads')}
 ];
 const changes=(S.paid?.[s.id]?.changes||[]).filter(x=>x.status==='proposed');
 for(const g of groups){g.count=g.fixes.length+g.drafts.length+(g.key==='paid'?changes.length:0);g.changes=g.key==='paid'?changes:[];}
 return groups;
}
function reviewCards(s,d,compact=false) {
 return `<div class="review-grid ${compact?'compact':''}">${reviewGroups(s,d).map(g=>`<a class="review-channel ${g.count?'has-work':''}" href="${href('inbox',g.key)}"><span class="review-icon">${icon(g.icon,22)}</span><span class="review-count" aria-label="${g.count} pending">${g.count}</span><h3>${g.name}</h3>${compact?'':`<p>${g.description}</p>`}<span class="review-cta">${g.count?'Review prepared work':'Nothing awaiting approval'} <span aria-hidden="true">↗</span></span></a>`).join('')}</div>`;
}
async function articleRequest(id,act){const sid=S.siteId;S.articleBusy=id;render();try{const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${CFG.supabaseUrl}/functions/v1/samaritan`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,apikey:CFG.supabaseAnonKey},body:JSON.stringify({action:act==='undo'?'article_undo':'article_publish',opp_id:id})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||'Shopify did not accept the change.');toast(act==='undo'?'Removed from the article. The article is back to how it was.':'Added to the article. We confirm it on the live page within a few minutes.');await Promise.all([loadOpps(sid),typeof loadSite==='function'?loadSite(sid):null]);}catch(err){toast(err.message);}S.articleBusy=null;if(S.siteId===sid)render();}




// ======================= AI & search readiness (rules from the ai-seo, schema, technical-seo and llms-txt skills) =======================
async function loadReady(id){S.ready||={};try{const [{data:c},{data:h}]=await Promise.all([sb.from('site_checks').select('*').eq('site_id',id).maybeSingle(),sb.from('site_check_history').select('checked_at,score').eq('site_id',id).order('checked_at',{ascending:false}).limit(12)]);S.ready[id]={...(c||{}),history:h||[]};}catch{S.ready[id]=S.ready[id]||null;}}
const PILLAR={access:'Can AI reach your site',discovery:'Can AI find your pages',parseability:'Can AI understand your pages',content:'Is your content quotable'};
function readinessCard(s,d,compact){
 const r=S.ready?.[s.id];
 const head=(sc)=>`<div class="st-head"><div><h2>Can AI assistants read your site?</h2><p>${r?.checked_at?`Checked ${esc(fmtTime(r.checked_at))} · ${r.checks?.length||0} checks from proven AI-search and technical SEO playbooks`:'Checks robots.txt, bot walls, page structure and structured data, the way ChatGPT, Perplexity and Claude see it'}</p></div>${sc}</div>`;
 const runBtn=`<button class="btn sm" data-ready-run ${r?.status==='checking'?'disabled':''}>${r?.status==='checking'?'<span class="wl-spin"></span> Checking…':r?.checked_at?'Check again':'Run the check'}</button>`;
 if(!r?.checked_at)return `<section class="st-card rd">${head(runBtn)}<p class="st-note">${r?.status==='checking'?'Checking your site now. This takes under a minute.':'No check has run yet.'}</p></section>`;
 const prev=r.history?.[1]?.score,delta=prev!=null?r.score-prev:null;
 const ring=`<div class="rd-score" style="--p:${r.score}"><b>${r.score}</b><small>of 100</small></div>`;
 const fails=(r.checks||[]).filter(c=>['fail','warn'].includes(c.status)).sort((a,b)=>(a.status==='fail'?0:1)-(b.status==='fail'?0:1)||b.weight-a.weight);
 const passes=(r.checks||[]).filter(c=>c.status==='pass');
 const pills=Object.entries(r.pillars||{}).filter(([,v])=>v!=null).map(([k,v])=>`<div class="rd-pill"><span>${esc(PILLAR[k]||k)}</span><i><b style="width:${v}%"></b></i><em>${v}</em></div>`).join('');
 if(compact)return `<div class="rd-mini">${ring}<div><b>AI readiness</b><small>${fails.filter(f=>f.status==='fail').length?`${plural(fails.filter(f=>f.status==='fail').length,'issue')} to fix`:'No blocking issues'}</small></div></div>`;
 const item=(c)=>`<li class="rd-item ${c.status}"><span class="rd-dot"></span><div><b>${esc(c.title)}</b><p>${esc(c.detail)}</p>${c.fix?`<p class="rd-fix"><strong>Fix:</strong> ${esc(c.fix)}</p>`:''}${c.pages?.length?`<details><summary>${plural(c.pages.length,'page')}</summary><ul>${c.pages.slice(0,8).map(u=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/[^/]+/,'')||'/')}</a></li>`).join('')}</ul></details>`:''}${c.file?`<details class="rd-file"><summary>Prepared ${esc(c.file.name)}</summary><pre>${esc(c.file.body)}</pre><button class="btn sm" data-ready-copy="${esc(c.id)}">Copy</button>${c.publishable&&(d.connectors||[]).some(x=>x.type==='shopify'&&x.status==='connected')?`<button class="btn primary sm" data-ready-llms="publish" ${S.readyBusy?'disabled':''}>Publish to Shopify</button>`:''}</details>`:''}${c.id==='llms_txt'&&r.files?.published?`<p class="rd-fix">Published ${esc(fmtTime(r.files.published.at))}. <button class="linkish" data-ready-llms="remove">Remove it</button></p>`:''}<small class="rd-src">Based on ${esc(String(c.source||'').replace(/\bkm\s+/g,'').replace(/seo\/(on-page|technical)\//g,'').replace(/\//g,' › '))}</small></div></li>`;
 return `<section class="st-card rd">${head(runBtn)}<div class="rd-top">${ring}<div class="rd-pills">${pills}${delta!=null&&delta!==0?`<p class="rd-delta">${delta>0?'+':''}${delta} since the last check</p>`:''}</div></div>
  ${fails.length?`<h3 class="rd-h">To fix</h3><ul class="rd-list">${fails.map(item).join('')}</ul>`:`<p class="rd-allgood">${icon('check',14)} Nothing blocking AI assistants from reading your site.</p>`}
  ${passes.length?`<details class="rd-pass"><summary>${plural(passes.length,'check')} passed</summary><ul class="rd-list">${passes.map(item).join('')}</ul></details>`:''}
  ${(r.checks||[]).filter(c=>c.status==='info').map(c=>`<p class="st-note"><b>${esc(c.title)}:</b> ${esc(c.detail)}</p>`).join('')}</section>`;
}
document.addEventListener('click',async e=>{
 const t=e.target.closest?.('[data-ready-run],[data-ready-copy],[data-ready-llms]');if(!t)return;const sid=S.siteId;
 const call=async(body)=>{const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${CFG.supabaseUrl}/functions/v1/site-checks`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,apikey:CFG.supabaseAnonKey},body:JSON.stringify({site_id:sid,...body})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||'The check could not start.');return j;};
 if(t.dataset.readyRun!==undefined){S.ready||={};S.ready[sid]={...(S.ready[sid]||{}),status:'checking'};render();try{await call({});toast('Checking your site the way AI assistants see it. Results in under a minute.');}catch(err){toast(err.message);S.ready[sid].status='ready';render();}return;}
 if(t.dataset.readyCopy){const c=(S.ready?.[sid]?.checks||[]).find(x=>x.id===t.dataset.readyCopy);try{await navigator.clipboard.writeText(c?.file?.body||'');toast('Copied.');}catch{toast('Select the text and copy it.');}return;}
 if(t.dataset.readyLlms){S.readyBusy=true;render();try{const j=await call({action:t.dataset.readyLlms==='remove'?'remove_llms':'publish_llms'});toast(t.dataset.readyLlms==='remove'?'Removed llms.txt from Shopify.':j.redirectError?`Published the page, but the /llms.txt redirect failed: ${j.redirectError}`:'Published llms.txt. Rechecking your site now.');await loadReady(sid);}catch(err){toast(err.message);}S.readyBusy=false;if(S.siteId===sid)render();}
});

// ======================= Playbooks: proven frameworks, filled in with the client's own data =======================
async function loadPlaybooks(){if(S.pbLib||loadPlaybooks.busy)return;loadPlaybooks.busy=1;try{const r=await fetch('/playbooks.json',{cache:'no-cache'});S.pbLib=r.ok?await r.json():{playbooks:[]};}catch{S.pbLib={playbooks:[]};}loadPlaybooks.busy=0;if(S.page==='playbooks'||S.page==='today')render();}
async function loadRuns(id){S.pbRuns||={};try{const {data}=await sb.from('playbook_runs').select('*').eq('site_id',id).order('created_at',{ascending:false}).limit(40);S.pbRuns[id]=data||[];}catch{S.pbRuns[id]=S.pbRuns[id]||[];}}
function pbRunFor(s,slug){return (S.pbRuns?.[s.id]||[]).find(r=>r.slug===slug&&Date.now()-Date.parse(r.created_at)<6*3600e3);}
// Autopilot: playbooks prepared automatically every hour (8am-7pm Detroit) and measured 28 days later.
function autopilotPanel(s){
 const runs=S.pbRuns?.[s.id]||[],day=new Date().toLocaleDateString('en-CA',{timeZone:'America/Detroit'}),onDay=r=>new Date(r.created_at).toLocaleDateString('en-CA',{timeZone:'America/Detroit'})===day;
 const auto=runs.filter(r=>r.auto),todayRuns=auto.filter(onDay),writing=todayRuns.filter(r=>r.status==='writing').length,ready=todayRuns.filter(r=>r.status==='ready').length;
 const off=s.profile?.autopilot?.enabled===false,cap=Number(s.profile?.autopilot?.daily)||10;
 const label=slug=>(S.pbLib?.playbooks||[]).find(p=>p.slug===slug)?.title||slug;
 const METRIC={ai_named_share:['AI mention rate','%'],orders:['Orders (28 days)',''],sales:['Sales (28 days)','$'],search_clicks:['Google clicks (28 days)','']};
 const fmt=(v,u)=>v==null?'–':u==='$'?money(v):u==='%'?v+'%':num(v);
 const measured=auto.filter(r=>r.measured_at&&r.measure?.outcome==='measured').slice(0,5).map(r=>{const m=r.measure,[name,u]=METRIC[m.metric]||[m.metric,''],b=m.baseline?.[m.metric],a=m.after?.[m.metric];return `<li><b>${esc(label(r.slug))}</b><span>${esc(name)}: ${fmt(b,u)} → ${fmt(a,u)}</span></li>`;}).join('');
 const recent=todayRuns.slice(0,6).map(r=>`<li><b>${esc(label(r.slug))}</b>${r.note?` <span class="muted">· ${esc(r.note)}</span>`:''}<span class="pb-auto-state ${esc(r.status)}">${r.status==='ready'?'In your queue':r.status==='writing'?'Writing…':'Didn\'t finish'}</span></li>`).join('');
 return `<section class="card pb-autopilot"><div class="pb-auto-head"><div><span class="eyebrow">Autopilot</span><h2>${off?'Autopilot is off for this business':`${plural(ready,'item')} prepared today${writing?` · ${writing} writing now`:''}`}</h2><p class="muted">${off?'Playbooks run only when someone starts them.':`Every hour from 8am to 7pm, your agents pick the playbooks this business's evidence supports and prepare them for approval. Up to ${cap} a day; nothing publishes without approval. Each result records a baseline and is measured 28 days after it goes live.`}</p></div>${ready?`<a class="btn primary" href="${href('inbox')}">Review prepared work</a>`:''}</div>${recent?`<ul class="pb-auto-list">${recent}</ul>`:''}${measured?`<h3>Measured results</h3><ul class="pb-auto-list">${measured}</ul>`:''}</section>`;
}
function pbCard(s,p,why){
 const r=pbRunFor(s,p.slug),writing=r?.status==='writing'&&Date.now()-Date.parse(r.created_at)<8*60e3,open=S.pbAsk===p.slug;
 const state=writing?`<p class="pb-state"><span class="wl-spin"></span>Writing with your data… usually under 2 minutes. It lands in your review queue.</p>`:r?.status==='ready'?`<p class="pb-state ok">${icon('check',14)} ${r.auto?'Prepared automatically. ':''}Ready in your queue. <a href="${href('inbox')}">Review it</a></p>`:r?.status==='failed'?`<p class="pb-state err">${esc(r.error||'It didn\'t finish.')}</p>`:'';
 const ask=open&&p.ask?`<label class="pb-ask">${esc(p.ask)}<input type="text" id="pb-note-${esc(p.slug)}" maxlength="300" autocomplete="off"></label>`:'';
 const btn=writing?'':open||!p.ask?`<button class="btn primary sm" data-pb-run="${esc(p.slug)}">${r?.status==='ready'?'Make another':'Make it'}</button>`:`<button class="btn primary sm" data-pb-open="${esc(p.slug)}">${r?.status==='ready'?'Make another':'Make it'}</button>`;
 return `<article class="pb ${why?'rec':''} ${writing?'busy':''}">${why?`<p class="pb-why">${esc(why)}</p>`:''}<h3>${esc(p.title)}</h3><p>${esc(p.gets)}</p><div class="pb-meta"><span>${esc(p.kind)}</span></div>${ask}${state}<div class="pb-act">${btn}${open?`<button class="btn ghost sm" data-pb-cancel>Cancel</button>`:''}</div></article>`;
}
const playbookCollections = [
  {id:"search", label:"Search visibility", icon:"search", headline:"Help buyers find the right page", description:"Samaritan compares search evidence with the pages you already have. Your team can improve a listing, connect related pages or give similar pages distinct purposes.", slugs:["seo-search-opportunity","seo-internal-links","seo-content-overlap","local-page"]},
  {id:"answers", label:"AI answers", icon:"globe", headline:"Answer the questions buyers actually ask", description:"Samaritan compares sampled AI answers with your site, finds a relevant destination and prepares content when the evidence supports an addition.", slugs:["ai-answer-plan","snippet-answers","answer-article","content-plan"]},
  {id:"website", label:"Website content", icon:"file", headline:"Help visitors make a buying decision", description:"Your team uses verified product details and customer questions to prepare clearer product pages, collections and comparisons.", slugs:["product-page-cro","collection-copy","comparison-page","landing-page","homepage-refresh","copy-polish","about-page"]},
  {id:"paid", label:"Paid campaigns", icon:"megaphone", headline:"Build a campaign around a real offer", description:"Your team can develop campaign briefs, creative angles and ad copy around your offer and landing page. A marketer reviews the plan and authorizes spend.", slugs:["campaign-plan","ad-copy-set","seasonal-campaign","offer-free-delivery"]},
  {id:"specialists", label:"SEO specialists", icon:"bot", headline:"Twelve SEO specialists, each with one job", description:"Each specialist reads your page inventory, site audit, AI-answer checks and Search Console data, then delivers one focused plan for review.", slugs:["seo-agent-strategy","seo-agent-keywords","seo-agent-performance","seo-agent-competitors","seo-agent-writer","seo-agent-onpage","seo-agent-internal-links","seo-agent-backlinks","seo-agent-indexing","seo-agent-schema","seo-agent-brand","seo-agent-local"]},
  {id:"site", label:"Search & site", icon:"target", headline:"Fix what holds your site back", description:"Audits, structured data, site structure, scaled pages, links and listings, prepared from your site's evidence.", slugs:["seo-audit","schema","site-architecture","programmatic-seo","link-building","directory-submissions"]},
  {id:"convert", label:"Conversion", icon:"cart", headline:"Turn more visitors into customers", description:"Tests, popups, lead magnets, free tools, signup and checkout, first-week onboarding, pricing and upgrade prompts.", slugs:["ab-testing","popups","lead-magnets","free-tools","signup","onboarding","pricing","paywalls"]},
  {id:"messaging", label:"Email & SMS", icon:"activity", headline:"Messages customers are glad to get", description:"Email sequences, texts, outreach and retention, written for your customers and ready to review.", slugs:["emails","sms","cold-email","churn-prevention"]},
  {id:"brand", label:"Social & brand", icon:"users", headline:"Get your business talked about", description:"Social posts, video and image briefs, creators, community, press, events, partners and referrals.", slugs:["social","video","image","influencer-marketing","community-marketing","public-relations","events","co-marketing","referrals"]},
  {id:"strategy", label:"Strategy & research", icon:"pulse", headline:"Decide with evidence", description:"Positioning, competitor research, expert perspectives, routines, tracking, attribution, sales process and app store listings.", slugs:["product-marketing","competitor-profiling","reverse-engineer-marketing","marketing-council","marketing-loops","analytics","conversion-tracking","attribution","revops","sales-enablement","prospecting","aso"]}
];
function playbookLens(s,d,category){
 const opportunity=(S.opps?.[s.id]?.rows||[]).find(o=>o.publishable&&['ready','live','measured'].includes(o.stage)&&o.why&&
   (category==='answers'?['article_aeo','ai_answer_gap'].includes(o.kind):category==='website'&&o.kind==='thin_page'));
 if(opportunity)return {label:'From your workspace',title:opportunity.title,copy:opportunity.why};
 if(category==='search'){
  const gsc=gsc28(d);
  if(gsc?.cur?.imps>0)return {label:'Your search signal',title:num(gsc.cur.clicks)+' Google clicks',copy:num(gsc.cur.imps)+' reported impressions in the 28-day window through '+fmtShort(gsc.last)+'. Page-level evidence guides which pages your team investigates.'};
 }
 const priority=s.brand?.currentPriority;
 if(priority?.objective&&(!priority.target_date||priority.target_date>=new Date().toISOString().slice(0,10)))return {label:'Your current brief',title:priority.objective,copy:[priority.location,priority.success_measure].filter(Boolean).join(' · ')||'Your team uses this priority when choosing relevant work.'};
 if(s.profile?.goal)return {label:'Your business goal',title:s.profile.goal,copy:'This is the objective recorded for '+s.name+'.'};
 return {label:'How work is selected',title:'Start with the business evidence',copy:'Your team uses connected accounts, approved facts and recent page evidence to choose relevant work.'};
}
function playbooksView(s,d){
 loadPlaybooks();
 const selected=playbookCollections.find(c=>c.id===S.sub)||playbookCollections[0];
 const lens=playbookLens(s,d,selected.id);
 const catalog=S.pbLib?.playbooks;
 const entries=selected.slugs.map(slug=>catalog?.find(p=>p.slug===slug)).filter(Boolean);
 const titles={'answer-article':'Buyer question article','snippet-answers':'Concise answers for search','product-page-cro':'Product page improvement','offer-free-delivery':'Order-size offer design'};
 const summaries={'answer-article':'An article answering a specific buyer question, with relevant sources and links.','snippet-answers':'Short, factual answers written for the page where buyers need them.'};
 const nav=playbookCollections.map(c=>`<a class="studio-nav-item" href="${href('playbooks',c.id)}" ${c.id===selected.id?'aria-current="page"':''}>${icon(c.icon,20)}<span>${c.label}</span></a>`).join('');
 const cards=entries.map(p=>{
   if(S.isAdmin||isOwner())return pbCard(s,{...p,title:titles[p.slug]||p.title,gets:summaries[p.slug]||p.gets});
   return `<article class="pb studio-example"><small>${esc(p.kind)}</small><h3>${esc(titles[p.slug]||p.title)}</h3><p>${esc(summaries[p.slug]||p.gets)}</p></article>`;
 }).join('');
 return `<section class="pb-studio"><header class="r-header"><div><h1>Playbooks</h1><p class="muted">Explore what your marketing team can do for ${esc(s.name)}.</p></div></header>
 ${autopilotPanel(s)}
 <nav class="studio-nav" aria-label="Explore playbook capabilities">${nav}</nav>
 <section class="studio-feature"><div class="studio-lead"><small>${esc(selected.label)} / Samaritan</small><h2>${esc(selected.headline)}</h2><p>${esc(selected.description)}</p></div>
 <aside class="studio-lens"><small>${esc(lens.label)}</small><h3>${esc(lens.title)}</h3><p>${esc(lens.copy)}</p></aside></section>
 <header class="studio-group-head"><h2>What your team can prepare</h2><p>${S.isAdmin?'Select a playbook to prepare a draft for this business.':'Your agency selects the playbook. Prepared changes that need your decision appear in To review.'}</p></header>
 <div class="pb-grid">${cards||`<p role="status">${catalog?'The playbook catalog could not be loaded. Refresh to try again.':'Loading playbooks…'}</p>`}</div></section>`;
}
document.addEventListener('click',async e=>{
 const t=e.target.closest?.('[data-pb-run],[data-pb-open],[data-pb-cancel]');if(!t)return;
 if(t.dataset.pbOpen){S.pbAsk=t.dataset.pbOpen;render();setTimeout(()=>document.getElementById('pb-note-'+t.dataset.pbOpen)?.focus(),30);return;}
 if(t.dataset.pbCancel!==undefined){S.pbAsk=null;return render();}
 const slug=t.dataset.pbRun,sid=S.siteId,note=(document.getElementById('pb-note-'+slug)?.value||'').trim();
 t.disabled=true;
 try{const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${CFG.supabaseUrl}/functions/v1/playbooks`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,apikey:CFG.supabaseAnonKey},body:JSON.stringify({action:'run',site_id:sid,slug,note})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||'Could not start the playbook.');
  S.pbRuns||={};S.pbRuns[sid]=[{id:j.id,site_id:sid,slug,status:'writing',created_at:new Date().toISOString()},...(S.pbRuns[sid]||[]).filter(x=>x.id!==j.id)];S.pbAsk=null;toast('Writing it with your data. It will appear in your review queue.');
 }catch(err){toast(err.message);t.disabled=false;}
 if(S.siteId===sid)render();
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id?.startsWith('pb-note-')){e.preventDefault();document.querySelector(`[data-pb-run="${e.target.id.slice(8)}"]`)?.click();}});

// ======================= Store analytics + data setup =======================
const ymd=(dt)=>{const x=new Date(dt);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
// One definition of every headline number (marketing_metrics): the Overview and Samaritan both read it.
async function loadMetrics(id){S.metrics||={};try{const {data,error}=await sb.rpc('marketing_metrics',{p_site:id});S.metrics[id]=error?null:data;}catch{S.metrics[id]=null;}}
async function loadSaved(id){S.saved||={};try{const {data,error}=await sb.from('saved_insights').select('id,title,question,body,created_at,thread_id').eq('site_id',id).order('created_at',{ascending:false}).limit(12);S.saved[id]=error?[]:(data||[]);}catch{S.saved[id]=[];}}
addEventListener('samaritan:saved',async e=>{const id=e.detail?.siteId;if(!id)return;await loadSaved(id);if(S.siteId===id&&S.page==='today')render();});
document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-saved-del]');if(!b)return;e.preventDefault();const id=S.siteId;b.disabled=true;const {error}=await sb.from('saved_insights').delete().eq('id',b.dataset.savedDel);if(error){b.disabled=false;return toast('Could not remove: '+error.message);}await loadSaved(id);if(S.siteId===id)render();});
async function loadShop(id){
 S.shop||={};const prev=S.shop[id];
 const {data:sync}=await sb.from('analytics_sync').select('*').eq('site_id',id);
 const sy=(sync||[]).find(x=>x.source==='shopify')||null;
 if(prev?.rows&&prev.sync?.finished_at===sy?.finished_at){S.shop[id]={...prev,sync:sy};return;}
 const {data:rows}=await sb.from('shop_daily').select('day,orders,sales,returning_orders,returning_sales,sub_orders,sub_sales,free_ship_orders,refunds,buckets,states,channels,products,landings').eq('site_id',id).gte('day',ymd(Date.now()-400*DAY)).order('day');
 S.shop[id]={sync:sy,rows:rows||[]};
}
async function storeImport(sid){
 S.shopStart||={};if(S.shopStart[sid])return;S.shopStart[sid]=Date.now();
 try{const {data:{session}}=await sb.auth.getSession();await fetch(`${CFG.supabaseUrl}/functions/v1/store-analytics`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,apikey:CFG.supabaseAnonKey},body:JSON.stringify({site_id:sid})});S.shop[sid]={...(S.shop[sid]||{}),sync:{...(S.shop[sid]?.sync||{}),status:'importing',started_at:new Date().toISOString()}};}catch{/* the daily job retries */}
 if(S.siteId===sid)render();
}
function shopAgg(rows,from,to){
 const a={orders:0,sales:0,ret:0,retSales:0,sub:0,subSales:0,free:0,refunds:0,days:0,buckets:{},states:{},channels:{},products:{},landings:{}};
 for(const r of rows){if(r.day<from||r.day>to)continue;a.days++;a.orders+=r.orders;a.sales+=+r.sales;a.ret+=r.returning_orders;a.retSales+=+r.returning_sales;a.sub+=r.sub_orders;a.subSales+=+r.sub_sales;a.free+=r.free_ship_orders;a.refunds+=+r.refunds;
  for(const [k,v] of Object.entries(r.buckets||{}))a.buckets[k]=(a.buckets[k]||0)+v;
  for(const [k,v] of Object.entries(r.states||{}))a.states[k]=(a.states[k]||0)+v;
  for(const [k,v] of Object.entries(r.channels||{})){const x=a.channels[k]||(a.channels[k]={o:0,s:0});x.o+=v.o;x.s+=v.s;}
  for(const [k,v] of Object.entries(r.landings||{})){const x=a.landings[k]||(a.landings[k]={o:0,s:0});x.o+=v.o;x.s+=v.s;}
  for(const [k,v] of Object.entries(r.products||{})){const x=a.products[k]||(a.products[k]={t:v.t,u:0,s:0,ru:0});x.u+=v.u;x.s+=v.s;x.ru+=v.ru;}}
 return a;
}
function shopWindows(sh,days=S.resultDays||28,endDay=S.resultEnd||ymd(Date.now()-DAY)){
 const e=Date.parse(endDay+'T12:00:00'),today=ymd(Date.now()),end=endDay,start=ymd(e-(days-1)*DAY),pEnd=ymd(e-days*DAY),pStart=ymd(e-(2*days-1)*DAY);
 const from=sh.sync?.window_from||sh.rows[0]?.day||today;
 return {cur:shopAgg(sh.rows,start,end),prev:shopAgg(sh.rows,pStart,pEnd),comparable:from<=pStart,start,end,pStart,pEnd,from,days,label:`${new Date(start+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${new Date(end+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}`};
}
const fmtCur=(v,c='USD')=>v==null||!isFinite(v)?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:0}).format(v);
const stChg=(a,b)=>b>0?(a-b)/b:null;
function dPill(cur,prev,ok,kind='pct'){
 if(!ok||prev==null)return '';const d=kind==='pts'?cur-prev:stChg(cur,prev);if(d==null||!isFinite(d))return '';
 const v=kind==='pts'?`${d>=0?'+':''}${Math.round(d*100)} pts`:`${d>=0?'+':''}${Math.round(d*100)}%`;
 return `<span class="dp ${d>0.004?'up':d<-0.004?'down':'flat'}">${v}</span>`;
}
function freeThreshold(s){const m=JSON.stringify(s.brand||{}).match(/free[^"]{0,60}?\$\s?(\d{2,4})|\$\s?(\d{2,4})[^"]{0,60}?free/i);return m?Number(m[1]||m[2]):null;}
function storeMilestones(sh,w){
 const out=[],rows=sh.rows;
 if(w.comparable&&w.prev.sales>0){const d=stChg(w.cur.sales,w.prev.sales);if(d>=0.08)out.push(`Sales are up ${Math.round(d*100)}% on the previous ${w.days} days.`);}
 if(rows.length>=35){const wk=i=>rows.slice(Math.max(0,i-6),i+1).reduce((n,r)=>n+r.returning_orders,0);const last=wk(rows.length-1);let best=0;for(let i=6;i<rows.length-1;i++)best=Math.max(best,wk(i));if(last>best&&last>0)out.push(`Best week for repeat orders since ${new Date(rows[0].day+'T12:00').toLocaleDateString(undefined,{month:'long',day:'numeric'})}: ${last} returning-customer orders.`);}
 const st=Object.keys(w.cur.states).filter(k=>k.length===2).length,pst=Object.keys(w.prev.states).filter(k=>k.length===2).length;
 if(w.comparable&&st>pst&&Math.floor(st/10)>Math.floor(pst/10))out.push(`Shipped to ${st} states in this period, a new high.`);
 return out.slice(0,2);
}
function improvedPages(s,d){
 const out=[];const add=(url,at,label)=>{if(!url||!at)return;try{const u=new URL(url);const m=u.pathname.match(/\/products\/([^/?#]+)/);out.push({url,path:u.pathname.replace(/\/$/,''),handle:m?m[1]:null,at,label});}catch{/* skip */}};
 for(const o of S.opps?.[s.id]?.rows||[])if(['live','measured'].includes(o.stage))add(o.target_url,o.live_at,o.title);
 for(const f of d.fixes||[])if(verifiedLive(f))add(f.url,f.data?.verification?.checked_at||f.deployed_at,`${FIELD[f.field]||f.field} · ${f.page_name||''}`);
 const by=new Map();for(const p of out){const k=p.handle||p.path;const x=by.get(k);if(!x||Date.parse(p.at)<Date.parse(x.at))by.set(k,{...p,changes:(x?.changes||0)+1});else x.changes++;}
 return [...by.values()];
}
function impactRows(s,d,sh){
 const res=[];const today=Date.now();
 for(const p of improvedPages(s,d)){if(!p.handle)continue;const live=Date.parse(p.at),days=Math.floor((today-live)/DAY);if(days<7)continue;const span=Math.min(28,days);
  const after=shopAgg(sh.rows,ymd(live+DAY),ymd(live+span*DAY)).products[p.handle],before=shopAgg(sh.rows,ymd(live-span*DAY),ymd(live-DAY)).products[p.handle];
  if(ymd(live-span*DAY)<(sh.sync?.window_from||'9999'))continue;
  if(!after&&!before)continue;const b=before||{u:0,s:0},a=after||{u:0,s:0};res.push({...p,span,before:b,after:a,title:(after||before).t,thin:(b.u+a.u)<20});}
 return res.sort((a,b)=>(b.after.s-b.before.s)-(a.after.s-a.before.s));
}
function storeSection(s,d,tab){
 if(tab==='ai')return readinessCard(s,d);
 if(!['overview','commerce'].includes(tab))return paidGuide(s,d,tab);
 const sh=S.shop?.[s.id],shopConn=(d.connectors||[]).find(c=>c.type==='shopify');
 if(!shopConn||shopConn.status!=='connected')return previewCard('Your store results','Connect Shopify to see sales, repeat customers, subscriptions, where orders come from and which products sell.', 'shopify');
 if(sh&&!sh.sync&&!S.shopStart?.[s.id])storeImport(s.id);
 if(!sh||!sh.rows?.length){const imp=sh?.sync?.status==='importing'||S.shopStart?.[s.id];return `<section class="st-card st-import"><span class="wl-spin"></span><div><b>${imp?'Importing your store history…':'Preparing your store results'}</b><p>${imp?'Usually under a minute. Sales, repeat customers and products appear here as soon as they’re ready.':'Your store results will appear after the first import.'}</p></div></section>`;}
 const w=shopWindows(sh),c=w.cur,p=w.prev,ok=w.comparable,cur=sh.sync?.currency||'USD',goal=s.profile?.goal;
 const retShare=c.orders?c.ret/c.orders:null,pRet=p.orders?p.ret/p.orders:null,states=Object.keys(c.states).filter(k=>k.length===2).length,pStates=Object.keys(p.states).filter(k=>k.length===2).length;
 const tile=(label,value,delta,sub)=>`<div class="st-tile"><span>${esc(label)}</span><strong>${value}</strong><small>${delta}${esc(sub)}</small></div>`;
 const ms=storeMilestones(sh,w);
 const head=`<section class="st-card st-score"><div class="st-head"><div><h2>${goal?esc(goal):'Your store'}</h2><p>${goal?'Your goal, measured from Shopify orders':'From Shopify orders'} · ${esc(w.label)}${ok?` · compared with the ${w.days} days before`:''}</p></div><span class="st-sync">${sh.sync?.status==='importing'?'<span class="wl-spin"></span> Updating…':'Updated '+esc(fmtTime(sh.sync?.finished_at))}</span></div>
  ${ms.length?`<div class="st-wins">${ms.map(m=>`<p><span>${icon('check',14)}</span>${esc(m)}</p>`).join('')}</div>`:''}
  <div class="st-tiles">${tile('Total sales',fmtCur(c.sales,cur),dPill(c.sales,p.sales,ok),`${num(c.orders)} orders`)}${tile('Orders from returning customers',retShare==null?'—':Math.round(retShare*100)+'%',dPill(retShare,pRet,ok&&pRet!=null,'pts'),`${num(c.ret)} of ${num(c.orders)} orders`)}${tile('Subscription orders',num(c.sub),dPill(c.sub,p.sub,ok),fmtCur(c.subSales,cur)+' in sales')}${tile('States shipped to',num(states),ok&&states!==pStates?`<span class="dp ${states>pStates?'up':'down'}">${states>pStates?'+':''}${states-pStates}</span>`:'','across the US')}</div></section>`;
 const chs=Object.entries(c.channels).sort((a,b)=>b[1].s-a[1].s),maxS=chs[0]?.[1].s||1;
 const sources=`<section class="st-card"><div class="st-head"><div><h2>Where your orders came from</h2><p>First visit before each order, as Shopify recorded it · ${esc(w.label)}</p></div></div><ul class="st-bars">${chs.slice(0,8).map(([k,v])=>`<li><span>${esc(k)}</span><i><b style="width:${Math.max(2,v.s/maxS*100)}%"></b></i><em>${fmtCur(v.s,cur)}</em><small>${num(v.o)} orders${ok&&p.channels[k]?' · '+dPill(v.o,p.channels[k].o,true).replace(/<[^>]+>/g,'')+' orders':''}</small></li>`).join('')}</ul>${channelNudges(s,d,c)}</section>`;
 const imp=impactRows(s,d,sh),improved=improvedPages(s,d);
 const since=improved.length?Math.min(...improved.map(x=>Date.parse(x.at))):null;
 let land=0,landS=0;if(since){const la=shopAgg(sh.rows,ymd(since),w.end).landings;const paths=new Set(improved.map(x=>x.path));for(const [k,v] of Object.entries(la))if(paths.has(k)){land+=v.o;landS+=v.s;}}
 const impact=`<section class="st-card"><div class="st-head"><div><h2>Samaritan's work, measured</h2><p>Pages Samaritan improved, compared before and after the change went live</p></div></div>${improved.length?`<div class="st-tiles three">${tile('Pages improved',num(improved.length),'','verified live on your site')}${tile('Orders that started on an improved page',num(land),'',since?`${fmtCur(landS,cur)} since ${new Date(since).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:'')}${tile('Products measured',num(imp.length),'','live 7+ days with before/after data')}</div>${imp.length?`<table class="st-table"><thead><tr><th>Product</th><th>Before</th><th>After</th><th></th></tr></thead><tbody>${imp.slice(0,6).map(r=>`<tr><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><small>${r.span} days each side · ${plural(r.changes,'change')}</small></td><td>${fmtCur(r.before.s,cur)}<small>${num(r.before.u)} units</small></td><td>${fmtCur(r.after.s,cur)}<small>${num(r.after.u)} units</small></td><td>${r.thin?'<span class="dp flat" title="Fewer than 20 units across both windows">Too few sales to read</span>':dPill(r.after.s,r.before.s,r.before.s>0)}</td></tr>`).join('')}</tbody></table>`:`<p class="st-note">Before/after results appear once an improved product page has been live for 7 days.</p>`}<p class="st-note">Observed results, not proof of cause: seasonality, ads and stock also move sales. Products with fewer than 20 units across both windows get no verdict.</p>`:`<p class="st-note">When Samaritan's fixes go live, their before/after results show here.</p>`}</section>`;
 if(tab==='overview')return head+sources+impact;
 // Business tab: customer health, what sells, where it ships
 const T=freeThreshold(s),aov=c.orders?c.sales/c.orders:null,pAov=p.orders?p.sales/p.orders:null;
 const near=T?Object.entries(c.buckets).filter(([k])=>+k>=T-25&&+k<T).reduce((n,[,v])=>n+v,0):0,over=T?Object.entries(c.buckets).filter(([k])=>+k>=T).reduce((n,[,v])=>n+v,0):0;
 const newO=c.orders-c.ret;
 const health=`<section class="st-card"><div class="st-head"><div><h2>Customers</h2><p>${esc(w.label)}</p></div></div><div class="st-split"><div class="st-splitbar"><b style="width:${c.orders?newO/c.orders*100:0}%"></b><i style="width:${c.orders?c.ret/c.orders*100:0}%"></i></div><div class="st-legend"><span><b class="k-new"></b>New customers · ${num(newO)} orders · ${fmtCur(c.sales-c.retSales,cur)}</span><span><b class="k-ret"></b>Returning customers · ${num(c.ret)} orders · ${fmtCur(c.retSales,cur)}</span></div></div>
  <div class="st-tiles three">${tile('Average order',fmtCur(aov,cur),dPill(aov,pAov,ok&&pAov!=null),'total sales ÷ orders')}${T?tile(`Orders over $${T}`,c.orders?Math.round(over/c.orders*100)+'%':'—','',`${num(near)} orders were within $25 of free delivery`):tile('Free delivery orders',c.orders?Math.round(c.free/c.orders*100)+'%':'—','','no shipping charged')}${tile('Refunded',fmtCur(c.refunds,cur),'',c.sales?`${(c.refunds/c.sales*100).toFixed(1)}% of sales`:'')}</div></section>`;
 const prods=Object.entries(c.products).sort((a,b)=>b[1].s-a[1].s).slice(0,10);
 const sells=`<section class="st-card"><div class="st-head"><div><h2>What sells</h2><p>Top products by sales · share bought by returning customers</p></div></div><table class="st-table"><thead><tr><th>Product</th><th>Sales</th><th>Units</th><th>Bought again</th></tr></thead><tbody>${prods.map(([h,v])=>`<tr><td>${esc(v.t)}</td><td>${fmtCur(v.s,cur)}</td><td>${num(v.u)}</td><td>${v.u?Math.round(v.ru/v.u*100)+'%':'—'}</td></tr>`).join('')}</tbody></table></section>`;
 const st=Object.entries(c.states).filter(([k])=>k.length===2).sort((a,b)=>b[1]-a[1]);
 const ships=`<section class="st-card"><div class="st-head"><div><h2>Where you ship</h2><p>${num(st.length)} states · ${esc(w.label)}</p></div></div><div class="st-states">${st.map(([k,v])=>`<span title="${v} orders" style="--w:${Math.min(1,v/(st[0]?.[1]||1))}">${esc(k)}<small>${v}</small></span>`).join('')}</div></section>`;
 return head+health+sells+ships;
}
function channelNudges(s,d,c){
 const has=t=>(d.connectors||[]).some(x=>x.type===t&&x.status==='connected'),tips=[];
 if(c.channels['Google Ads']&&!has('google_ads'))tips.push(['google_ads',`Connect Google Ads to see what those ${num(c.channels['Google Ads'].o)} orders cost.`]);
 if((c.channels['Meta ads']||c.channels['Facebook & Instagram (organic)'])&&!has('meta_ads'))tips.push(['meta_ads','Connect Meta Ads to see spend and which ads sold.']);
 if(c.channels['Search (organic)']&&!has('gsc'))tips.push(['google','Connect Google Search Console to see which searches bring these customers.']);
 return tips.length?`<div class="st-nudges">${tips.map(([k,txt])=>`<p>${esc(txt)} ${connectButtons(s,d,k,true)}</p>`).join('')}</div>`:'';
}
function previewCard(title,text,k){const s=siteById(S.siteId),d=S.data[S.siteId];return `<section class="st-card st-preview"><div class="st-ghost" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="st-preview-body"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions">${connectButtons(s,d,k)}</div></div></section>`;}
function paidGuide(s,d,tab){
 const need=tab==='paid'?['google_ads','meta_ads']:tab==='search'?['google']:[];
 const miss=need.filter(k=>!provState(s,d,k).ok);
 return miss.map(k=>{const P=SETUP[k];return previewCard(P.name,P.unlock,k);}).join('');
}

// ---------- data setup: what's connected, what each connection unlocks, and the next step ----------
const SETUP={google_analytics:{name:'Google Analytics 4',unlock:'Website sessions, traffic sources and geography',type:'gsc',mins:'Choose an Analytics property'},shopify:{name:'Shopify',unlock:'Sales, repeat customers, subscriptions and products',type:'shopify',mins:'about 1 minute'},google:{name:'Google Search Console',unlock:'Which Google searches bring customers, and how your rankings move',type:'gsc',mins:'about 1 minute'},google_ads:{name:'Google Ads',unlock:'Ad spend, tracked leads, bookings and cost per result',type:'google_ads',mins:'about 2 minutes'},meta_ads:{name:'Meta Ads',unlock:'Campaign spend, clicks and tracked lead actions',type:'meta_ads',mins:'about 2 minutes'}};
function provState(s,d,k){
 if(k==='google_analytics'){const c=(d.connectors||[]).find(c=>c.type==='gsc'),p=(S.results[s.id]?.reports||[]).find(r=>r.source==='ga4')?.payload;return c?.config?.ga4_property&&p?{state:'ok',ok:true,text:'Synced '+fmtTime(p.synced_at)}:{state:'attention',act:'pick',text:c?.config?.ga4_property?'Property selected. Complete the first reporting sync in Integrations.':'Choose this business’s Analytics property in Integrations.'};}
 const P=SETUP[k],c=(d.connectors||[]).find(x=>x.type===P.type),link=(S.links?.[s.id]||[]).find(l=>l.provider===k&&!l.used_at&&Date.parse(l.expires_at)>Date.now());
 const appOk=!S.connectInfo?.providers||S.connectInfo.providers[k]!==false;
 if(c&&c.status==='connected'){
  if(k==='shopify'){const sy=S.shop?.[s.id]?.sync;if(!(c.config?.scopes||['read_orders']).includes('read_orders'))return {state:'attention',text:'Connected, but sales access is missing. Reconnect to show sales.',act:'reconnect'};if(sy?.status==='importing'||S.shopStart?.[s.id]&&!sy?.finished_at)return {state:'importing',text:'Importing your order history… usually under a minute.',ok:true};if(sy?.status==='error')return {state:'attention',text:'The last import stopped: '+String(sy.error||'').slice(0,120),act:'retry'};return {state:'ok',ok:true,text:sy?.finished_at?`Synced ${fmtTime(sy.finished_at)}`:'Connected'};}
  if(k==='google'&&!c.config?.property)return {state:'attention',text:'Connected. Pick which Search Console property is this business.',act:'pick'};
  if(k==='google'&&!c.config?.lastSync)return {state:'importing',ok:true,text:'Importing your search history… usually a few minutes.'};
  if(['google_ads','meta_ads'].includes(k)&&!c.config?.account_id)return {state:'attention',text:'Connected. Pick the ad account to report on.',act:'pick'};
  return {state:'ok',ok:true,text:c.config?.lastSync?`Synced ${fmtTime(c.config.lastSync)}`:'Connected'};
 }
 if(c&&c.status==='error')return {state:'attention',text:/expired|revoked|invalid_grant|reauth/i.test(c.last_error||'')?`${P.name} stopped sharing data. Your earlier numbers are safe.`:String(c.last_error||'Needs attention').slice(0,140),act:'reconnect'};
 if(c&&c.status==='pending')return {state:'attention',text:String(c.last_error||'Almost done. Finish the last step.').slice(0,140),act:'pick'};
 if(link)return {state:'waiting',text:`Waiting on ${link.sent_to||'the account owner'} · link sent ${new Date(link.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`,link};
 if(!appOk)return {state:'unavailable',text:S.isAdmin?'One-time setup: register Impackt Media with this platform first.':'Your agency is setting this up.'};
 return {state:'none',text:`${P.unlock} · ${P.mins}`};
}
function connectButtons(s,d,k,compact){
 const st=provState(s,d,k),busy=S.linkBusy===k;
 if(st.ok)return '';
 if(st.state==='unavailable')return S.isAdmin?`<a class="btn sm" href="${href('apps')}">Set up ${esc(SETUP[k].name)}</a>`:'';
 if(st.act==='pick')return `<a class="btn sm" href="${href('connections')}">Finish setup</a>`;
 if(st.act==='retry')return `<button class="btn sm" data-store-retry>Try again</button>`;
 const main=S.isAdmin?`<button class="btn primary sm" data-oauth="${k}">${st.act==='reconnect'?'Reconnect':'Connect'}</button>`:`<button class="btn primary sm" data-link-self="${k}" ${busy?'disabled':''}>${busy?'Opening…':st.act==='reconnect'?'Reconnect':'Connect'}</button>`;
 if(k==='shopify'&&S.isAdmin)return `<a class="btn primary sm" href="${href('connections')}">${st.act==='reconnect'?'Reconnect':'Connect'} Shopify</a>`;
 const send=st.state==='waiting'?`<button class="btn ghost sm" data-link-copy="${esc(st.link.token)}">Copy link again</button>`:`<button class="btn ghost sm" data-link-send="${k}">${compact?'Send to owner':'Send to the account owner'}</button>`;
 return main+send;
}
function setupBar(s,d,tab){
 const requested=tab==='search'?['google']:tab==='traffic'?['google_analytics']:tab==='commerce'?['shopify']:tab==='paid'?['google_ads','meta_ads']:['ai','work'].includes(tab)?[]:['shopify','google','google_analytics',...(d.connectors||[]).filter(c=>['google_ads','meta_ads'].includes(c.type)).map(c=>c.type)];
 const keys=[...new Set(requested)].filter(k=>k!=='shopify'||ecommerceSite(s,d));
 if(!keys.length)return '';
 const st=keys.map(k=>[k,provState(s,d,k)]),done=st.filter(([,x])=>x.ok).length;
 if(done===keys.length&&!st.some(([,x])=>x.state==='importing'))return S.setupCelebrated?.[s.id]?'':`<section class="setup done"><span>${icon('check',16)}</span><b>All your data is connected.</b><small>Every number on this page comes straight from your accounts.</small></section>`;
 const dot=x=>x.ok?(x.state==='importing'?'imp':'ok'):x.state==='attention'?'warn':x.state==='waiting'?'wait':'off';
 return `<section class="setup"><div class="setup-head"><div><b>Your data: ${done} of ${keys.length} connected</b><small>Each connection adds real numbers to this page. Nothing is estimated.</small></div><div class="setup-bar" aria-hidden="true">${keys.map((k,i)=>`<i class="${dot(st[i][1])}"></i>`).join('')}</div></div>
 <ul class="setup-list">${st.map(([k,x])=>`<li class="s-${dot(x)}"><span class="setup-dot"></span><div><b>${esc(SETUP[k].name)}</b><small>${esc(x.text)}</small></div><div class="setup-act">${x.ok?(x.state==='importing'?'<span class="wl-spin"></span>':`<span class="pill ok">Connected</span>`):connectButtons(s,d,k)}</div></li>`).join('')}
</ul>
 ${S.linkShare?.site===s.id?linkShareBox():''}</section>`;
}
function linkShareBox(){const L=S.linkShare,P=SETUP[L.provider],msg=`Hi${L.to?' '+L.to.split(/[\s@]/)[0]:''}, could you connect our ${P.name} so we can see our results? It takes ${P.mins} and you don't need an account: ${L.url}`;
 return `<div class="link-box" role="dialog" aria-label="Send a connect link"><div><b>Send this link to whoever owns ${esc(P.name)}</b><small>They sign in with ${esc(P.name)} and approve access there. No login needed on their side. The link works for 14 days.</small></div><div class="link-row"><input readonly value="${esc(L.url)}" aria-label="Connect link" id="link-url"><button class="btn primary sm" data-link-copy="${esc(L.token)}">Copy link</button><a class="btn sm" href="mailto:${esc(L.to&&L.to.includes('@')?L.to:'')}?subject=${encodeURIComponent('Connect '+P.name+' for our results')}&body=${encodeURIComponent(msg)}">Email it</a><button class="btn ghost sm" data-link-close>Done</button></div></div>`;}
async function linkFn(action,extra){const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${CFG.supabaseUrl}/functions/v1/connect-link`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,apikey:CFG.supabaseAnonKey},body:JSON.stringify({action,...extra})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||'Could not create the link.');return j;}
async function loadLinks(sid){S.links||={};try{S.links[sid]=(await linkFn('list',{site_id:sid})).links;}catch{S.links[sid]=S.links[sid]||[];}}
document.addEventListener('click',async e=>{
 const t=e.target.closest?.('[data-link-send],[data-link-self],[data-link-copy],[data-link-close],[data-store-retry]');if(!t)return;
 const sid=S.siteId;
 if(t.dataset.storeRetry!==undefined){S.shopStart&&delete S.shopStart[sid];return storeImport(sid);}
 if(t.dataset.linkClose!==undefined){S.linkShare=null;return render();}
 if(t.dataset.linkCopy){const L=S.linkShare?.token===t.dataset.linkCopy?S.linkShare:null;const url=L?.url||`${location.origin}/link/?t=${t.dataset.linkCopy}`;try{await navigator.clipboard.writeText(url);toast('Link copied. Paste it into a text or email.');}catch{toast(url);}return;}
 const k=t.dataset.linkSend||t.dataset.linkSelf;if(!k||S.linkBusy)return;
 S.linkBusy=k;render();
 try{const j=await linkFn('create',{site_id:sid,provider:k,sent_to:''});
  if(t.dataset.linkSelf){location.href=j.url;return;}
  S.linkShare={site:sid,provider:k,token:j.token,url:j.url,to:''};await loadLinks(sid);
 }catch(err){toast(err.message);}
 S.linkBusy=null;if(S.siteId===sid)render();
});

// ---------- One decision queue: everything waiting on a yes, keyboard-first ----------
const Q_SNOOZE=sid=>'gb-snooze:'+sid;
function qSnoozed(sid){try{const m=JSON.parse(localStorage.getItem(Q_SNOOZE(sid))||'{}'),now=Date.now();return Object.fromEntries(Object.entries(m).filter(([,until])=>until>now));}catch{return {};}}
function qSnooze(sid,key){const m=qSnoozed(sid);m[key]=Date.now()+20*3600e3;try{localStorage.setItem(Q_SNOOZE(sid),JSON.stringify(m));}catch{/* per-viewer convenience only */}}
function qClearSnooze(sid){try{localStorage.removeItem(Q_SNOOZE(sid));}catch{/* */}}
const qClip=(v,n=150)=>{const x=String(v||'').replace(/[#*_>`]/g,'').replace(/\s+/g,' ').trim();return x.length>n?x.slice(0,n-1)+'…':x;};
function queueAll(s,d){
 const out=[];
 for(const g of reviewGroups(s,d)){
  for(const f of g.fixes){const exp=!!f.data?.experiment_id;out.push({key:'fix:'+f.id,kind:'fix',id:f.id,ch:g.key,chName:g.name,item:f,
   title:`${FIELD[f.field]||f.field} · ${f.page_name||f.url||'page'}`,why:f.before?`Now: “${qClip(f.before,70)}” → “${qClip(f.after,90)}”`:`Adds: “${qClip(f.after,140)}”`,
   direct:(S.isAdmin||isOwner())&&!exp,quick:(S.isAdmin||isOwner())&&!exp,label:'Publish',note:'Single change, checked on the live page, one-click rollback.'});}
  for(const x of g.drafts){const o=oppFor(x.id);let direct=S.isAdmin||isOwner(),label='Approve & publish',act='draft';
   if(o&&o.publishable&&o.target_kind==='article'){act='article';label='Add to article';}
   else if(o&&o.publishable){direct=false;label='Review publication';}
   else if(o&&!o.publishable){direct=false;label='Review & copy';}
   if(excludedCopy(x.title+' '+x.body))direct=false;
   if(isOwner()&&(o||act==='article'))direct=false; // page and article publishing stay with the agency flow
   out.push({key:'draft:'+x.id,kind:'draft',act,id:x.id,opp:o,ch:g.key,chName:g.name,item:x,title:x.title,why:o?qClip(o.why,170):`${x.kind} · ${qClip(x.body,140)}`,direct:(S.isAdmin||isOwner())&&direct,quick:false,label});}
  if(g.changes.length)out.push({key:'paid:all',kind:'paid',ch:'paid',chName:g.name,title:`${plural(g.changes.length,'ad change')} proposed`,why:'Budget and bid changes stay under human control. Open the paid console to decide.',direct:false,quick:false,label:'Open paid console'});
 }
 return out;
}
// Plain-language brief for every decision: why it matters, exactly what approving does, and what it should improve.
const FIELD_PLAIN={'seo.title':['the headline Google shows for this page','A clear, specific headline helps the right searchers click your result instead of a competitor\'s.'],'seo.description':['the short summary under your link in Google','A useful summary answers “is this what I need?” before the click, so more of the right people visit.'],'image.alt':['the hidden image description','Search engines and screen readers can understand the image, which helps image search and accessibility.'],'description.replace':['the product description','Shoppers and AI assistants get the details they need to choose you.'],'seo.hidden':['whether Google can show this page','Keeps duplicate or thin pages out of Google so your main pages rank instead.'],'status.draft_redirect':['a duplicate product page','Removes a duplicate so Google sends shoppers to the main product.']};
function decisionBrief(s,d,q){
 if(q.kind==='paid')return '';
 const P=platformOf(s),plat=P?.name&&P.name!=='Other'?P.name:'website',it=q.item,rows=[];
 if(q.kind==='fix'){
  const [what,result]=FIELD_PLAIN[it.field]||[FIELD[it.field]||'this setting','Small, checked improvements add up across your pages.'];
  const e=it.data?.search_strategy,defects=(e?.defects||[]).map(x=>typeof x==='string'?x:x?.label||x?.reason||'').filter(Boolean);
  rows.push(['Why',defects.length?esc(defects.slice(0,2).join(' · ')):it.before?`The current version is “${esc(qClip(it.before,90))}”.`:`This page has no ${what} yet, so Google makes one up.`]);
  rows.push(['If you approve',`Samaritan updates ${what} on ${esc(it.page_name||'this page')} in your ${esc(plat)}${it.before?`, from “${esc(qClip(it.before,60))}” to “${esc(qClip(it.after,80))}”`:''}. Nothing else on the page changes.`]);
  rows.push(['What it should improve',e?.ranking_mechanism?esc(String(e.ranking_mechanism)):esc(result)]);
 }else{
  const o=q.opp,x=it;
  if(o){
   const ev=o.evidence||{},prompt=ev.prompt||(/“([^”]+)”/.exec(o.title||'')||[])[1],b=o.baseline?.ai;
   rows.push(['Why',b&&prompt?`When customers ask AI assistants “${esc(prompt)}”, ${esc(s.name)} was named in ${b.named} of ${b.total} answers.`:esc(qClip(o.why,200))]);
   const where=o.target_url?String(o.target_url).replace(/^https?:\/\/[^/]+/,'')||'/':'';
   rows.push(['If you approve',o.publishable?(o.target_kind==='article'?`This answer is added to the article at ${esc(where)}.`:`A short questions-and-answers section is added to ${esc(where)} on your ${esc(plat)}. The rest of the page stays the same.`):`You get the finished text to paste onto ${where?esc(where):'your page'} yourself: your website can't be edited automatically yet.`]);
   rows.push(['What it should improve',prompt?`AI assistants get a clear answer to quote, so they're more likely to name you the next time someone asks “${esc(prompt)}”. Samaritan rechecks that question after it's live.`:'Gives AI assistants a clear answer to quote about your business.']);
  }else{
   rows.push(['Why',`${esc(x.kind||'Content')} written for ${esc(s.name)} from your saved business facts.`]);
   rows.push(['If you approve','It\'s marked ready to publish. Nothing goes on your website until it\'s published.']);
   rows.push(['What it should improve','Fresh, specific content gives Google and AI assistants more reasons to show your business.']);
  }
 }
 return `<section class="q-brief" aria-label="What this decision does">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}<p class="q-brief-foot">${icon('check',13)} Verification is recorded after publishing · recovery options appear with the work record</p></section>`;
}
function queueView(s,d){
 S.qGone||=new Set();const all=queueAll(s,d),sn=qSnoozed(s.id),live=all.filter(q=>!sn[q.key]&&!S.qGone.has(q.key)),f=S.qFilter||'all',items=live.filter(q=>f==='all'||q.ch===f),snoozedN=all.length-live.length;
 const quick=live.filter(q=>q.quick),chs=[['all','All'],['seo','Google search'],['geo','AI answers'],['content','Content'],['paid','Paid ads']].map(([k,l])=>[k,l,k==='all'?live.length:live.filter(q=>q.ch===k).length]).filter(([k,,n])=>k==='all'||n);
 if(!items.find(q=>q.key===S.qFocus))S.qFocus=items[Math.min(S.qIdx||0,items.length-1)]?.key||null;
 const mins=Math.max(1,Math.round(live.reduce((n,q)=>n+(q.quick?.25:q.kind==='paid'?2:1),0)));
 const head=`<header class="r-header q-head"><div><h1>${live.length?`${plural(live.length,'decision')} waiting`:`You're all caught up`}</h1><p class="muted">${live.length?`${(()=>{const n=live.filter(q=>(q.kind==='fix'&&isNewToday(q.item))||(q.kind==='draft'&&!!q.item.created_at&&releaseDay(q.item.created_at)===releaseDay())).length;return n?`<b class="q-new">${plural(n,'new suggestion')} today.</b> `:'';})()}About ${plural(mins,'minute')}. Approve, skip or open anything. Review the exact version before approval. Publishing and recovery options depend on the connected platform.`:`Prepared work appears here when it is ready for review. Follow recorded progress in Work history.`}</p></div>${quick.length?(S.qConfirm?`<div class="q-confirm"><span>Publish ${plural(quick.length,'quick win')}? Each is checked on the live page and can be rolled back.</span><button class="btn primary" data-q-quick="yes">Publish ${quick.length}</button><button class="btn ghost" data-q-quick="no">Cancel</button></div>`:`<button class="btn primary" data-q-quick="ask">${icon('check',15)} Approve ${plural(quick.length,'quick win')}</button>`):''}</header>`;
 const today=Math.max(decidedToday(d),S.qWin||0),todo=live.length,pctDone=today+todo?Math.round(today/(today+todo)*100):100;
 const progress=`<div class="q-progress"><div><div class="q-prog-top"><b>${today?`${plural(today,'decision')} cleared today`:'Start clearing today\'s decisions'}</b><span>${todo?`${todo} to go`:'All done'}</span></div><div class="q-prog-bar"><i style="width:${pctDone}%"></i></div></div>${goalCard(s,d,true)}</div>`;
 const tabs=live.length?`<div class="q-bar"><nav class="q-tabs" aria-label="Filter decisions">${chs.map(([k,l,n])=>`<button data-q-filter="${k}" aria-pressed="${f===k}">${esc(l)} <span>${n}</span></button>`).join('')}</nav>${snoozedN?`<button class="btn ghost sm" data-q-unsnooze>${plural(snoozedN,'item')} set aside · show</button>`:''}</div>`:'';
 if(!live.length){const opps=(S.opps?.[s.id]?.rows||[]),drafting=opps.filter(o=>o.stage==='drafting').length,lv=opps.filter(o=>['live','measured'].includes(o.stage)).length;
  const cleared=Math.max(decidedToday(d),S.qWin||0);return head+`<section class="q-done"><span class="q-done-ic">${icon('check',26)}</span><div><h2>Inbox zero.</h2>${cleared?`<p class="q-done-win">You cleared ${plural(cleared,'decision')} today.</p>`:''}<p>${drafting?`Samaritan is writing ${plural(drafting,'more fix')} right now. `:''}${lv?`${plural(lv,'fix')} already live and being measured. `:''}${snoozedN?`${plural(snoozedN,'item')} set aside until tomorrow.`:''}</p>${goalCard(s,d,true)}<div class="actions"><a class="btn" href="${href('today')}">See what Samaritan did</a>${snoozedN?`<button class="btn ghost" data-q-unsnooze>Show set-aside items</button>`:''}<a class="btn ghost" href="${href('playbooks')}">Run a playbook</a>${S.isAdmin?`<button class="btn ghost" data-wl-run>Find more work now</button>`:''}</div></div></section>`;}
 const row=(q)=>{q.fresh=(q.kind==='fix'&&isNewToday(q.item));const on=q.key===S.qFocus,open=q.key===S.qOpen,busy=S.busy.has(q.id)||S.busy.has('d:'+q.id)||(!!q.opp&&S.articleBusy===q.opp.id);
  const evq=open&&q.opp?.evidence?.prompt&&(S.aiEv?.[s.id]?.prompts||[]).find(p=>p.prompt===q.opp.evidence.prompt);
  const detail=open?`<div class="q-detail">${decisionBrief(s,d,q)}${evq?`<section class="aie-why"><span class="eyebrow">The evidence · “${esc(evq.prompt)}”</span>${aiEvidenceDetail(s,evq,{inline:true})}</section>`:''}${q.kind==='fix'?(S.isAdmin?fixHTML(q.item):clientReviewCard(s,d,'fix',q.item).replace('<details><summary>Record','<details open><summary>Record')):q.kind==='draft'?(S.isAdmin?draftCard(q.item):clientReviewCard(s,d,'draft',q.item).replace('<details><summary>Record','<details open><summary>Record')):''}</div>`:'';
  const primary=q.kind==='paid'?`<a class="btn sm" href="${href('inbox','paid')}">${esc(q.label)}</a>`:q.direct?`<button class="btn primary sm" data-q-approve="${esc(q.key)}" ${busy?'disabled':''}>${busy?'Working…':esc(q.label)}</button>`:`<button class="btn sm" data-q-open="${esc(q.key)}">${open?'Close':esc(S.isAdmin?q.label:'Review')}</button>`;
  return `<li class="q-row ${on?'on':''} ${open?'open':''}" data-q-key="${esc(q.key)}"><div class="q-line"><button class="q-main" data-q-open="${esc(q.key)}" aria-expanded="${open}"><span class="q-ch q-${esc(q.ch)}">${esc(q.chName)}</span><b>${q.fresh?'<span class="q-fresh">New today</span>':''}${(()=>{const c=S.isAdmin&&q.kind!=='paid'?clientDecision(d,q.kind,q.item):null;return c?`<span class="q-client ${c==='approved'?'ok':'changes'}">${c==='approved'?'Client approved':'Client requested changes'}</span>`:'';})()}${esc(q.title)}</b><span class="q-why">${esc(q.why)}</span><span class="q-moves">Improves: ${q.kind==='fix'?'how this page shows up in Google':q.kind==='paid'?'ad spend efficiency':q.opp?'your chance of being named by AI assistants':'content on your site'}</span></button><div class="q-acts">${primary}${q.kind!=='paid'?`<button class="btn ghost sm" data-q-snooze="${esc(q.key)}" title="Set aside until tomorrow (S)">Not now</button>`:''}</div></div>${detail}</li>`;};
 return head+progress+tabs+`<ol class="q-list" aria-label="Decisions">${items.map(row).join('')}</ol><p class="q-keys" aria-hidden="true"><kbd>J</kbd><kbd>K</kbd> move · <kbd>Enter</kbd> open · <kbd>A</kbd> approve · <kbd>S</kbd> not now · <kbd>⌘K</kbd> jump anywhere</p>`;
}
async function qApprove(key){
 const s=siteById(S.siteId),d=S.data[S.siteId];if(!s||!d)return;const q=queueAll(s,d).find(x=>x.key===key);if(!q)return;
 if(!q.direct){S.qOpen=q.key;S.qFocus=q.key;render();return;}
 S.qIdx=Math.max(0,[...document.querySelectorAll('.q-row')].findIndex(r=>r.dataset.qKey===key));
 await qLeave([key]);
 S.qWin=(S.qWin||0)+1;
 const run=isOwner()?(q.kind==='fix'?ownerFix([q.id],'approved'):ownerDraft(q.id,'approved')):q.kind==='fix'?setFix([q.id],'approved'):q.act==='article'?articleRequest(q.opp.id,'publish'):setDraft(q.id,'approved');
 try{await run;}finally{S.qGone.delete(key);if(S.page==='inbox')render();}
}
function qLeave(keys){
 S.qGone||=new Set();keys.forEach(k=>document.querySelector(`.q-row[data-q-key="${CSS.escape(k)}"]`)?.classList.add('q-leaving'));
 return new Promise(r=>setTimeout(()=>{keys.forEach(k=>S.qGone.add(k));S.qOpen=null;render();r();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:220));
}
function qMove(step){const rows=[...document.querySelectorAll('.q-row')];if(!rows.length)return;let i=rows.findIndex(r=>r.dataset.qKey===S.qFocus);i=Math.max(0,Math.min(rows.length-1,(i<0?0:i)+step));S.qFocus=rows[i].dataset.qKey;S.qIdx=i;rows.forEach(r=>r.classList.toggle('on',r.dataset.qKey===S.qFocus));rows[i].scrollIntoView({block:'nearest',behavior:'smooth'});}
document.addEventListener('click',e=>{
 const t=e.target.closest?.('[data-q-open],[data-q-approve],[data-q-snooze],[data-q-filter],[data-q-quick],[data-q-unsnooze]');if(!t)return;
 if(t.dataset.qOpen){S.qFocus=t.dataset.qOpen;S.qOpen=S.qOpen===t.dataset.qOpen?null:t.dataset.qOpen;return render();}
 if(t.dataset.qApprove)return qApprove(t.dataset.qApprove);
 if(t.dataset.qSnooze){const sid=S.siteId,k=t.dataset.qSnooze;const rows=[...document.querySelectorAll('.q-row')];S.qIdx=Math.max(0,rows.findIndex(r=>r.dataset.qKey===k));return undoable('Set aside until tomorrow',()=>{qSnooze(sid,k);if(S.qOpen===k)S.qOpen=null;},()=>{const m=qSnoozed(sid);delete m[k];try{localStorage.setItem(Q_SNOOZE(sid),JSON.stringify(m));}catch{/* */}},()=>{});}
 if(t.dataset.qFilter){S.qFilter=t.dataset.qFilter;S.qIdx=0;S.qOpen=null;return render();}
 if(t.dataset.qUnsnooze!==undefined){qClearSnooze(S.siteId);return render();}
 if(t.dataset.qQuick==='ask'){S.qConfirm=true;return render();}
 if(t.dataset.qQuick==='no'){S.qConfirm=false;return render();}
 if(t.dataset.qQuick==='yes'){
   S.qConfirm=false;
   const s=siteById(S.siteId),d=S.data[S.siteId],sn=qSnoozed(s.id);
   const qs=queueAll(s,d).filter(q=>q.quick&&!sn[q.key]);
   if(!qs.length)return;
   qLeave(qs.map(q=>q.key)).then(async()=>{
     S.qWin=(S.qWin||0)+qs.length;
     try{await (isOwner()?ownerFix(qs.map(q=>q.id),'approved'):setFix(qs.map(q=>q.id),'approved'));}
     finally{qs.forEach(q=>S.qGone.delete(q.key));if(S.page==='inbox')render();}
   });
   return;
 }
});
document.addEventListener('keydown',e=>{
 if(S.page!=='inbox'||S.sub||!S.session||S.modal||document.querySelector('.cmdk')||e.metaKey||e.ctrlKey||e.altKey)return;
 const a=document.activeElement;if(a&&(['INPUT','TEXTAREA','SELECT'].includes(a.tagName)||a.isContentEditable))return;
 const k=e.key.toLowerCase();
 if(k==='j'||e.key==='ArrowDown'){e.preventDefault();qMove(1);}
 else if(k==='k'||e.key==='ArrowUp'){e.preventDefault();qMove(-1);}
 else if((e.key==='Enter'&&!(a&&/^(BUTTON|A|SUMMARY)$/.test(a.tagName)))||k==='o'){if(!S.qFocus)return;e.preventDefault();S.qOpen=S.qOpen===S.qFocus?null:S.qFocus;render();document.querySelector('.q-row.on')?.scrollIntoView({block:'start',behavior:'smooth'});}
 else if(k==='a'&&S.qFocus){e.preventDefault();qApprove(S.qFocus);}
 else if(k==='s'&&S.qFocus){e.preventDefault();document.querySelector(`.q-row.on [data-q-snooze]`)?.click();}
 else if(e.key==='Escape'&&S.qOpen){S.qOpen=null;render();}
});

// ---------- Progress toward the client's goal (only numbers we can verify) ----------
function goalSnapshot(s,d,extraFixed=0){
 const fx=d.fixes||[],live=fx.filter(verifiedLive).length,open=fx.filter(f=>readyFix(f)||f.status==='failed').length+fx.filter(f=>['approved','deployed'].includes(f.status)&&!verifiedLive(f)).length;
 const total=live+open,ready=total?Math.round(Math.min(total,live+extraFixed)/total*100):100;
 const opps=(S.opps?.[s.id]?.rows||[]).filter(o=>o.stage!=='dismissed'),answered=opps.filter(o=>['live','measured'].includes(o.stage)).length;
 const runs=(d.aeoRuns||[]).filter(r=>r.summary?.visibility!=null).sort((a,b)=>Date.parse(b.finished_at||b.started_at)-Date.parse(a.finished_at||a.started_at));
 const ai=runs[0]?.summary.visibility??null;
 return {ready,live,open,total,answered,found:opps.length,ai,aiNext:ai==null?null:Math.min(100,(Math.floor(ai/10)+1)*10)};
}
function decidedToday(d){const t0=new Date();t0.setHours(0,0,0,0);const on=v=>v&&Date.parse(v)>=t0.getTime();return (d.fixes||[]).filter(f=>on(f.decided_at)).length+(d.drafts||[]).filter(x=>on(x.decided_at)).length;}
function goalCard(s,d,compact){
 const g=goalSnapshot(s,d),goal=s.profile?.goal;
 const bar=(label,pctv,detail,next)=>`<div class="gl-row"><div class="gl-top"><b>${esc(label)}</b><span>${pctv==null?'—':pctv+'%'}</span></div><div class="gl-bar" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${pctv??0}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pctv??0}%"></i>${next!=null?`<em style="left:${next}%" title="Next milestone"></em>`:''}</div><small>${esc(detail)}</small></div>`;
 const rows=[
  bar('Website readiness',g.total?g.ready:null,g.total?`${num(g.live)} of ${num(g.total)} found issues fixed and verified live${g.open?` · ${plural(g.open,'fix')} to go`:''}`:'No issues found yet'),
  bar('Buyer questions answered',g.found?Math.round(g.answered/g.found*100):null,g.found?`${num(g.answered)} of ${num(g.found)} evidence-backed answers live on your site`:'Samaritan is collecting AI search evidence'),
  bar('AI-ready website',S.ready?.[s.id]?.score??null,S.ready?.[s.id]?.checked_at?`${(S.ready[s.id].checks||[]).filter(c=>c.status==='fail').length?plural((S.ready[s.id].checks||[]).filter(c=>c.status==='fail').length,'blocking issue')+' to fix':'No blocking issues'} · from ${S.ready[s.id].checks.length} AI-search checks`:'Runs after the first AI readiness check'),
  bar('Named by AI assistants',g.ai,g.ai==null?'Runs after your first AI search check':`Next milestone: ${g.aiNext}%. Answer sections and fixes move this number.`,g.ai==null?null:g.aiNext)
 ];
 if(compact)return `<div class="gl-mini">${rows[0]}</div>`;
 return `<section class="h-card goal"><div class="h-card-head"><div><p class="eyebrow">Your goal</p><h2>${esc(goal||'Grow with every approved fix')}</h2></div>${S.isAdmin&&!goal?`<a class="btn ghost sm" href="${href('business')}">Set goal</a>`:''}</div><div class="gl-grid">${rows.join('')}</div><p class="gl-foot">Every decision you make moves one of these. Numbers update only after a change is confirmed live.</p></section>`;
}
function skeletonHome(name){return `<div class="sk" aria-busy="true" aria-label="Loading ${esc(name||'')}"><p class="sk-name">${esc(name||'')}</p><div class="sk-load"><span data-sk-prog role="progressbar" aria-label="Loading"><i></i></span><span class="sk-step">Opening…</span></div><div class="sk-b sk-h"></div><div class="sk-b sk-hero"></div><div class="sk-grid"><div class="sk-b"></div><div class="sk-b"></div><div class="sk-b"></div><div class="sk-b"></div></div><div class="sk-b sk-tall"></div></div>`;}

// ---------- Home: what Samaritan did for you, from verified records only ----------
function doneForYou(s,d){
 const since=Date.now()-30*DAY,inWin=v=>v&&Date.parse(v)>since;
 const fixesLive=(d.fixes||[]).filter(f=>verifiedLive(f)&&inWin(f.data?.verification?.checked_at||f.deployed_at));
 const opps=(S.opps?.[s.id]?.rows||[]),oppLive=opps.filter(o=>['live','measured'].includes(o.stage)&&inWin(o.live_at));
 const decided=(d.fixes||[]).filter(f=>inWin(f.decided_at)).length+(d.drafts||[]).filter(x=>inWin(x.decided_at)).length;
 const runs=(d.aeoRuns||[]).filter(r=>r.summary?.visibility!=null).sort((a,b)=>Date.parse(b.finished_at||b.started_at)-Date.parse(a.finished_at||a.started_at));
 const ai=runs[0]?runs[0].summary.visibility:null,aiPrev=runs[1]?.summary?.visibility;
 const wins=[...oppLive.map(o=>({t:o.title,at:o.live_at,url:o.target_url,res:oppResult(o)})),...fixesLive.map(f=>({t:`${FIELD[f.field]||f.field} updated · ${f.page_name||''}`,at:f.data?.verification?.checked_at||f.deployed_at,url:f.url}))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,4);
 const tiles=[[num(fixesLive.length+oppLive.length),'Changes live & verified','checked on the real page'],[num(oppLive.length),'Answer sections added','for buyer & AI questions'],[ai==null?'—':ai+'%','Named by AI assistants',ai!=null&&aiPrev!=null&&runs.length>1?`${ai-aiPrev>=0?'+':''}${ai-aiPrev} pts vs previous check`:'latest AI search check'],[num(decided),'Decisions you made','approvals and skips']];
 return `<section class="h-card dfy"><div class="h-card-head"><h2>What Samaritan did for you</h2><span class="muted">Last 30 days</span></div><div class="dfy-tiles">${tiles.map(([v,l,n])=>`<div><strong>${v}</strong><b>${esc(l)}</b><small>${esc(n)}</small></div>`).join('')}</div>${wins.length?`<ul class="dfy-wins">${wins.map(w=>`<li><span class="dfy-ic">${icon('check',14)}</span><span><b>${esc(w.t)}</b>${w.res?`<small>${esc(w.res)}</small>`:''}</span><span class="dfy-when">${esc(fmtTime(w.at))}</span>${w.url?`<a class="btn ghost sm" href="${esc(w.url)}" target="_blank" rel="noopener">View live</a>`:''}</li>`).join('')}</ul>`:`<p class="muted">Your first verified changes will show up here as soon as they're live.</p>`}</section>`;
}
function decisionBanner(s,d){
 const all=queueAll(s,d),sn=qSnoozed(s.id),live=all.filter(q=>!sn[q.key]),quick=live.filter(q=>q.quick).length;
 const cleared=decidedToday(d);if(!live.length)return `<section class="cmd-hero done"><div><b>You're all caught up.${cleared?` ${plural(cleared,'decision')} cleared today.`:''}</b><span>Nothing is waiting on you. Samaritan is preparing the next batch.</span></div><a class="btn" href="${href('playbooks')}">Run a playbook</a></section>`;
 const mins=Math.max(1,Math.round(live.reduce((n,q)=>n+(q.quick?.25:q.kind==='paid'?2:1),0))),done=Math.max(decidedToday(d),S.qWin||0),beads=Math.min(done,24),left=Math.min(live.length,40);
 const strip=`<div class="beads" role="img" aria-label="${done} decided today, ${live.length} waiting">${'<i class="on"></i>'.repeat(beads)}${'<i></i>'.repeat(left)}</div>`;
 return `<section class="cmd-hero">${strip}<div><b>${plural(live.length,'decision')} ready for you</b><span>About ${plural(mins,'minute')}${quick?` · ${plural(quick,'quick win')} you can approve in one click`:''}. Review the prepared work and choose what moves forward.</span></div><a class="btn primary" href="${href('inbox')}">Start reviewing</a></section>`;
}

function commandHero(s,d){
 const all=queueAll(s,d),sn=qSnoozed(s.id),live=all.filter(q=>!sn[q.key]),quick=live.filter(q=>q.quick).length;
 const groups=reviewGroups(s,d),mins=Math.max(1,Math.round(live.reduce((n,q)=>n+(q.quick?.25:q.kind==='paid'?2:1),0)));
 return `<section class="review-ledger"><header><h2>To review</h2><span>${live.length} pending</span></header><div>${groups.map(g=>`<a href="${href('inbox',g.key)}"><span>${icon(g.icon,16)} ${esc(g.name)}</span><b>${num(live.filter(q=>q.ch===g.key).length)}</b></a>`).join('')}</div><p>${live.length?`About ${plural(mins,'minute')}${quick?' · '+plural(quick,'quick win'):''}`:"You're all caught up."}</p></section>`;

}

function inboxView(s,d) {
 S.filter.status='pending';const groups=reviewGroups(s,d),total=groups.reduce((n,g)=>n+g.count,0),selected=groups.find(g=>g.key===S.sub);
 const header=`<header class="r-header"><div><p class="eyebrow">Your decision desk</p><h1>${selected?selected.name+' to review':'A clear next decision.'}</h1><p class="muted">${selected?'Review the prepared work. Approve this version or suggest a change.':`${total} pending decisions, organized by channel. Your team handles the preparation.`}</p></div>${selected?`<a class="btn" href="${href('inbox')}">← All channels</a>`:''}</header>`;
 if(!selected)return queueView(s,d)+productionPanel(d);
 if(false)return header+reviewCards(s,d)+`<section class="review-reassurance"><span>${icon('shield',22)}</span><div><h2>Your approval has a boundary.</h2><p>Content and website changes are reviewed before publication. Ad spend remains under human control. Research and connection issues stay with your agency.</p><a href="${href('team')}">See what your team is doing →</a></div></section>`;
 if(!S.isAdmin){
  const items=selected.fixes.map(item=>({kind:'fix',item})).concat(selected.drafts.map(item=>({kind:'draft',item})));
  return header+`<div class="list">${items.slice(0,S.showN).map(({kind,item})=>clientReviewCard(s,d,kind,item)).join('')||'<section class="r-panel r-empty"><h2>No content decision needed here.</h2><p>Your team will share prepared work when it is ready.</p></section>'}</div>`+(selected.changes.length?paidConsole(s,d):'')+moreReview(items.length);
 }
 return header+`<div class="review-progress">${selected.count} pending · ${selected.key==='seo'?'Evidence checked before publishing':'Exact-version review'}</div><div class="list">${selected.fixes.slice(0,S.showN).map(fixHTML).join('')}${selected.drafts.slice(0,S.showN).map(draftCard).join('')}</div>`+(selected.changes.length?paidConsole(s,d):'')+moreReview(Math.max(selected.fixes.length,selected.drafts.length))+(selected.count?'':'<section class="r-panel r-empty"><h2>All caught up in this channel.</h2><p>New prepared work will appear here when it needs a decision.</p></section>');
}
// ---------- Business owners (self-serve sign-up): approve and publish their own work ----------
const isOwner=()=>!S.isAdmin&&((S.data[S.siteId]?.role||siteById(S.siteId)?.role)==='owner');
async function ownerFix(ids,decision){
 ids.forEach(id=>S.busy.add(id));render();
 try{
  const {data,error}=await sb.rpc('owner_decide_fix',{p_site:S.siteId,p_ids:ids,p_decision:decision});if(error)throw error;
  toast(decision==='approved'?(data?`Publishing ${plural(data,'change')}. Each is checked on your live page; you can roll it back from Website work.`:'Nothing was published: these changes need a fresh evidence review first.'):decision==='rollback_requested'?(data?'Rolling back. Your previous version is being restored.':'That change can no longer be rolled back.'):'Skipped');
 }catch(e){toast(e.message);}finally{ids.forEach(id=>S.busy.delete(id));await refresh();}
}
async function ownerDraft(id,decision){
 if(decision==='approved')return approveWork(id);
 S.busy.add('d:'+id);render();
 try{const {error}=await sb.rpc('owner_decide_draft',{p_site:S.siteId,p_id:id,p_decision:decision});if(error)throw error;toast(decision==='approved'?'Approved. Your team schedules it for publishing.':decision==='rejected'?'Rejected':'Back in review');}
 catch(e){toast(e.message);}finally{S.busy.delete('d:'+id);await refresh();}
}
function ownerReviewCard(s,d,kind,item){
 const busy=S.busy.has(item.id)||S.busy.has('d:'+item.id);
 const actions=kind==='fix'?`<button class="btn primary" data-owner-fix="approved" data-id="${esc(item.id)}" ${busy?'disabled':''}>${busy?'Working…':'Publish this change'}</button><button class="btn" data-owner-fix="rejected" data-id="${esc(item.id)}" ${busy?'disabled':''}>Skip</button><span class="kind">Checked on your live page after publishing. You can roll it back.</span>`
  :`<button class="btn primary" data-owner-draft="approved" data-id="${esc(item.id)}" ${busy?'disabled':''}>${busy?'Publishing…':'Approve &amp; publish'}</button><button class="btn" data-owner-draft="rejected" data-id="${esc(item.id)}" ${busy?'disabled':''}>Reject</button>`;
 return `<article class="card"><div class="card-head"><div><span class="kind">${esc(kind==='draft'?item.kind:FIELD[item.field]||item.field)}</span><h2>${esc(kind==='draft'?item.title:item.page_name||item.url)}</h2></div><span class="status">Needs your decision</span></div>${kind==='fix'?`<div class="row2"><div><b>Current</b><p class="review-copy">${esc(item.before)}</p></div><div><b>Proposed</b><p class="review-copy">${esc(item.after)}</p></div></div>`:`<div class="review-copy">${readableDraft(item.body)}</div>${pipelineNote(item,d)}`}${suggestBox(kind,item)}<div class="actions">${actions}</div></article>`;
}
function ownerPublished(s,d){
 const since=Date.now()-30*DAY,rows=(d.fixes||[]).filter(f=>['deployed','rollback_requested'].includes(f.status)&&Date.parse(f.deployed_at||f.decided_at||0)>since).slice(0,30);
 if(!rows.length)return '';
 return `<section class="card" style="margin-top:20px"><h3>Recently published</h3><p class="kind">Changes from the last 30 days. Rolling back restores the previous version on your website.</p>${rows.map(f=>`<div class="access-row"><div><b>${esc(FIELD[f.field]||f.field)} · ${esc(f.page_name||f.url)}</b><p class="kind">${f.status==='rollback_requested'?'Rollback in progress':`Published ${esc(fmtTime(f.deployed_at))}${f.verification?.state?` · ${esc(String(f.verification.state).replaceAll('_',' '))}`:''}`}</p></div>${f.status==='deployed'?`<button class="btn" data-owner-fix="rollback_requested" data-id="${esc(f.id)}" ${S.busy.has(f.id)?'disabled':''}>Roll back</button>`:''}</div>`).join('')}</section>`;
}
document.addEventListener('click',e=>{
 const f=e.target.closest?.('[data-owner-fix]'),dr=e.target.closest?.('[data-owner-draft]');
 if(f&&isOwner()){f.disabled=true;return ownerFix([f.dataset.id],f.dataset.ownerFix);}
 if(dr&&isOwner()){dr.disabled=true;return ownerDraft(dr.dataset.id,dr.dataset.ownerDraft);}
});
function moreReview(total){return total>S.showN?`<div class="more"><button class="btn" data-act="more">Show more prepared work</button></div>`:'';}
function clientReviewCard(s,d,kind,item){
 if((d.role||s.role)==='owner')return ownerReviewCard(s,d,kind,item);
 const review=(d.role||s.role)==='reviewer',matching=(d.reviews||[]).find(r=>r.item_kind===kind&&r.item_id===String(item.id)&&Object.entries(clientSnapshot(kind,item)).every(([k,v])=>r.snapshot[k]===v));
 return `<article class="card"><div class="card-head"><div><span class="kind">${esc(kind==='draft'?item.kind:FIELD[item.field]||item.field)}</span><h2>${esc(kind==='draft'?item.title:item.page_name||item.url)}</h2></div><span class="status">${matching?esc(matching.decision.replaceAll('_',' ')):'Needs review'}</span></div>${kind==='fix'?`<div class="row2"><div><b>Current</b><p class="review-copy">${esc(item.before)}</p></div><div><b>Proposed</b><p class="review-copy">${esc(item.after)}</p></div></div>`:`<div class="review-copy">${readableDraft(item.body)}</div>`}${review?suggestBox(kind,item):''}${review&&kind==='draft'?`${pipelineNote(item,d)}<div class="actions"><button class="btn primary" data-approve-work="${esc(item.id)}" ${S.busy.has('d:'+item.id)?'disabled':''}>${S.busy.has('d:'+item.id)?'Publishing…':'Approve &amp; publish'}</button><button class="btn" data-client-decision="changes_requested" data-kind="draft" data-id="${esc(item.id)}">Request changes</button></div>`:review?`<details><summary>Record your decision</summary><p>Your review applies to this exact copy. Your agency authorizes publication separately.</p><label class="approval-check"><input type="checkbox" id="client-read-${esc(item.id)}"> I reviewed this complete proposal.</label><div class="actions"><button class="btn primary" data-client-decision="approved" data-kind="${kind}" data-id="${esc(item.id)}">Approve this version</button><button class="btn" data-client-decision="changes_requested" data-kind="${kind}" data-id="${esc(item.id)}">Request changes</button></div></details>`:''}</article>`;
}

function businessView(s, d) { return '<section class="card"><h2>Locations and market coverage</h2><button class="btn" data-market-open>Review business profile</button></section>' + profileView(s) + priorityPanel(s) + knowledgePanel(s); }

// ---------- Agency HQ: every client on one screen (admins only) ----------
async function loadAgency() {
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const [sites, pend, live, failed, drafts, tasks, conns, runs, access] = await Promise.all([
    sb.from("sites").select("*").order("sort_order").order("name"),
    sb.from("fixes").select("id,site_id,field,status,after,before,data,source,created_at").eq("status", "pending").limit(5000),
    sb.from("fixes").select("site_id,deployed_at").eq("status", "deployed").gte("deployed_at", month.toISOString()).limit(10000),
    sb.from("fixes").select("site_id").eq("status", "failed").limit(5000),
    sb.from("draft_pipeline").select("site_id,lane").eq("lane", "approval"),
    sb.from("tasks").select("site_id,status").eq("status", "pending").limit(5000),
    sb.from("connectors").select("id,site_id,type,status,last_error,last_checked_at"),
    sb.from("aeo_runs").select("site_id,status,summary,finished_at,started_at").order("started_at", { ascending: false }).limit(400),
    sb.from("workspace_access").select("site_id,email,revoked_at").is("revoked_at", null),
  ]);
  if (sites.error) throw sites.error;
  S.sites = sites.data || S.sites;
  const by = (r) => { const m = {}; for (const x of r.data || []) (m[x.site_id] ||= []).push(x); return m; };
  S.agency = { at: Date.now(), pend: by(pend), live: by(live), failed: by(failed), drafts: by(drafts), tasks: by(tasks), conns: by(conns), runs: by(runs), access: by(access), accessError: !!access.error };
}
function clientHealth(s, a) {
  const issues = [], ck = s.checkup || {}, conns = a.conns[s.id] || [];
  if (ck.status === "failed") issues.push(/credit|billing|quota/i.test(ck.error || "") ? "AI credits ran out" : "Website check failed");
  for (const c of conns.filter((c) => c.status === "error")) issues.push(`${PROVIDERS[c.type]?.name || CONNECTOR_TYPES[c.type]?.name || c.type} disconnected`);
  if ((a.failed[s.id] || []).length) issues.push(`${plural(a.failed[s.id].length, "change")} failed to publish`);
  if (s.active && s.last_run_at && Date.now() - Date.parse(s.last_run_at) > 9 * DAY) issues.push("Weekly check overdue");
  if (!conns.some((c) => c.type === "gsc" && c.status === "connected")) issues.push("Google not connected");
  if (!conns.some((c) => ["shopify", "webflow", "wordpress", "framer", "framer_key", "netlify"].includes(c.type) && c.status === "connected")) issues.push("Website not connected");
  const severe = issues.filter((x) => !/not connected/.test(x));
  return { issues, tone: severe.length ? "warn" : issues.length ? "setup" : "ok" };
}
function agencyMessagesLink(){
 const box=S.agencyMessages;
 const count=box&&!box.error?box.waiting:null;
 return `<a class="btn" href="#/agency/messages">Messages <span class="h-count" data-waiting-count aria-label="Conversations waiting for a reply">${count==null?'…':num(count)}</span></a>`;
}
async function refreshAgencyMessages(){
 if(!S.isAdmin||S.page!=='agency'||!S.session)return;
 const identity=S.session.user.id,page=S.messagePage||1;
 const ticket=refreshAgencyMessages.ticket=(refreshAgencyMessages.ticket||0)+1;
 const base=()=>sb.from('chat_threads').select('id,site_id,title,status,owner_name,last_message_at',{count:'exact'}).eq('mode','human').neq('status','resolved');
 const offset=(page-1)*25;
 try{
   const [badge,list]=await Promise.all([
     sb.from('chat_threads').select('id',{count:'exact',head:true}).eq('mode','human').eq('status','waiting'),
     S.sub==='messages'?base().order('status',{ascending:false}).order('last_message_at',{ascending:false}).order('id').range(offset,offset+24):Promise.resolve({data:[],count:0})
   ]);
   if(badge.error||list.error)throw badge.error||list.error;
   if(ticket!==refreshAgencyMessages.ticket||S.session?.user?.id!==identity||S.page!=='agency'||!S.isAdmin)return;
   S.agencyMessages={listLoaded:S.sub==='messages',waiting:badge.count,rows:list.data,total:list.count,page};
 }catch(e){
   if(ticket!==refreshAgencyMessages.ticket||S.session?.user?.id!==identity||S.page!=='agency'||!S.isAdmin)return;
   S.agencyMessages={error:e.message};
 }
 if(S.sub==='messages')renderShell(agencyView());
 else{const badge=document.querySelector('[data-waiting-count]');if(badge)badge.textContent=S.agencyMessages.error?'—':num(S.agencyMessages.waiting);}
}
function agencyInboxView(){
 const box=S.agencyMessages,page=S.messagePage||1;
 const head=`<header class="h-head"><div><a href="#/agency">← All clients</a><h1>Messages</h1><p class="muted">Client conversations across your agency. Open a thread to reply as Impackt Media.</p></div><button class="btn" data-messages-refresh>Refresh</button></header>`;
 if(box?.error)return head+errorBox(box.error);
 if(!box||box.page!==page||!box.listLoaded)return head+'<p role="status">Loading conversations…</p>';
 const rows=box.rows.map(t=>`<a class="support-inbox-row" href="#/w/${encodeURIComponent(t.site_id)}/team/${encodeURIComponent(t.id)}"><b>${esc(siteById(t.site_id)?.name||t.site_id)} · ${esc(t.title||'Conversation')}</b><span>${t.status==='waiting'?'Waiting for reply':'Answered'} · ${esc(t.owner_name||'Unassigned')} · ${esc(fmtTime(t.last_message_at))}</span></a>`).join('');
 return head+`<section class="card"><h2>${num(box.waiting)} waiting for a reply</h2>${rows||'<p>No open conversations on this page.</p>'}</section><nav class="actions" aria-label="Conversation pages">${page>1?`<a class="btn" href="#/agency/messages/${page-1}">Previous</a>`:''}${page*25<box.total?`<a class="btn" href="#/agency/messages/${page+1}">Next</a>`:''}</nav>`;
}
document.addEventListener('click',e=>{if(e.target.closest('[data-messages-refresh]'))refreshAgencyMessages();});
setInterval(()=>{if(!document.hidden&&S.page==='agency'&&S.isAdmin)refreshAgencyMessages();},30000);
function agencyView() {
  if(S.isAdmin && S.sub==="messages")return agencyInboxView();
  const a = S.agency;
  if (!a) return skeletonHome('Your clients');
  const q = (S.agencyQ || "").toLowerCase(), f = S.agencyFilter || "all";
  const rows = S.sites.map((s) => {
    const ready = (a.pend[s.id] || []).filter(readyFix).length, drafts = (a.drafts[s.id] || []).length, tasks = (a.tasks[s.id] || []).length;
    const run = (a.runs[s.id] || []).find((r) => r.status === "done");
    return { s, h: clientHealth(s, a), review: ready + drafts, tasks, live: (a.live[s.id] || []).length, ai: run?.summary?.visibility, logins: (a.access[s.id] || []).length };
  });
  const attention = rows.filter((r) => r.h.tone === "warn");
  const totals = { clients: rows.length, attention: attention.length, review: rows.reduce((n, r) => n + r.review, 0), live: rows.reduce((n, r) => n + r.live, 0) };
  const shown = rows.filter((r) => (!q || `${r.s.name} ${r.s.domain}`.toLowerCase().includes(q)) && (f === "all" || (f === "attention" ? r.h.tone === "warn" : f === "review" ? r.review > 0 : f === "setup" ? r.h.tone === "setup" : true)));
  const pill = (k, l, n) => `<button class="chip" data-agency-filter="${k}" aria-pressed="${f === k}">${l}${n != null ? ` <b>${n}</b>` : ""}</button>`;
  const ago = (t) => { if (!t) return "Never"; const d = Math.round((Date.now() - Date.parse(t)) / DAY); return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`; };
  const logos = (s) => (a.conns[s.id] || []).filter((c) => c.status === "connected").map((c) => PROVIDERS[c.type]?.name || CONNECTOR_TYPES[c.type]?.name || c.type).filter((v, i, x) => x.indexOf(v) === i);
  return `<header class="h-head"><div><p class="h-hello">Impackt Media · Agency</p><h1>All clients</h1></div><div class="head-actions">${agencyMessagesLink()}<button class="btn ghost" data-agency-refresh>${icon("refresh", 14)} Refresh</button><a class="btn primary" href="#/new-workspace">${icon("plus", 14)} Add client</a></div></header>
    <section class="h-kpis" aria-label="Agency totals">
      <div class="h-kpi"><span class="h-kpi-l">Clients</span><strong>${num(totals.clients)}</strong><span class="h-kpi-s">${num(rows.filter((r) => r.logins).length)} with client logins</span></div>
      <button class="h-kpi" data-agency-filter="attention"><span class="h-kpi-l">Need attention</span><strong class="${totals.attention ? "warn" : ""}">${num(totals.attention)}</strong><span class="h-kpi-s">Failures &amp; stalled checks</span></button>
      <button class="h-kpi" data-agency-filter="review"><span class="h-kpi-l">Waiting for approval</span><strong>${num(totals.review)}</strong><span class="h-kpi-s">Fixes &amp; drafts, all clients</span></button>
      <div class="h-kpi"><span class="h-kpi-l">Changes live</span><strong>${num(totals.live)}</strong><span class="h-kpi-s">This month</span></div>
    </section>
    ${attention.length ? `<section class="h-card ag-attn"><div class="h-card-head"><h2>Fix these first</h2></div><ul>${attention.map((r) => `<li><span class="h-dot warn"></span><b>${esc(r.s.name)}</b><span>${esc(r.h.issues.filter((x) => !/not connected/.test(x)).join(" · "))}</span><a class="btn" href="#/w/${encodeURIComponent(r.s.id)}/today">Open</a></li>`).join("")}</ul></section>` : ""}
    <section class="ag-list">
      <div class="ag-tools"><input type="search" id="agency-q" placeholder="Search clients…" value="${esc(S.agencyQ || "")}" aria-label="Search clients"><div class="chips" role="group" aria-label="Filter">${pill("all", "All", rows.length)}${pill("attention", "Needs attention", totals.attention)}${pill("review", "Has approvals", rows.filter((r) => r.review).length)}${pill("setup", "Setup incomplete", rows.filter((r) => r.h.tone === "setup").length)}</div></div>
      <div class="ag-table" role="table" aria-label="Clients">
        <div class="ag-row ag-headrow" role="row"><span role="columnheader">Client</span><span role="columnheader">Health</span><span role="columnheader">To approve</span><span role="columnheader">Live / month</span><span role="columnheader">AI mentions</span><span role="columnheader">Last check</span><span role="columnheader">Client login</span><span></span></div>
        ${shown.map((r) => `<a class="ag-row" role="row" href="#/w/${encodeURIComponent(r.s.id)}/today">
          <span class="ag-client" role="cell"><span class="ws-av">${esc((r.s.name || "?")[0].toUpperCase())}</span><span><b>${esc(r.s.name)}</b><small>${esc(String(r.s.domain || "").replace(/^www\./, ""))}${logos(r.s).length ? ` · ${esc(logos(r.s).join(", "))}` : ""}</small></span></span>
          <span role="cell"><span class="ag-health ${r.h.tone}"><span class="h-dot ${r.h.tone === "ok" ? "" : r.h.tone === "warn" ? "warn" : "off"}"></span>${r.h.tone === "ok" ? "Healthy" : r.h.tone === "warn" ? "Needs attention" : "Setup incomplete"}</span>${r.h.issues.length ? `<small class="ag-why">${esc(r.h.issues[0])}${r.h.issues.length > 1 ? ` +${r.h.issues.length - 1}` : ""}</small>` : ""}</span>
          <span role="cell" data-label="To approve">${r.review ? `<span class="h-count">${num(r.review)}</span>` : `<span class="muted">0</span>`}${r.tasks ? `<small class="ag-why">${plural(r.tasks, "edit")}</small>` : ""}</span>
          <span role="cell" data-label="Live this month">${num(r.live)}</span>
          <span role="cell" data-label="AI mentions">${r.ai != null ? `${r.ai}%` : "—"}</span>
          <span role="cell" data-label="Last check">${ago(r.s.last_run_at)}${r.s.checkup?.status === "running" ? `<small class="ag-why">Running now</small>` : ""}</span>
          <span role="cell" data-label="Client login">${a.accessError ? "—" : r.logins ? `<span class="ag-yes">${icon("check", 13)} ${r.logins}</span>` : `<span class="muted">Not invited</span>`}</span>
          <span class="h-go" aria-hidden="true">→</span></a>`).join("") || `<div class="empty">No clients match.</div>`}
      </div>
    </section>`;
}

document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-agency-filter]"); if (f) { S.agencyFilter = S.agencyFilter === f.dataset.agencyFilter && f.classList.contains("h-kpi") ? "all" : f.dataset.agencyFilter; renderShell(agencyView()); return; }
  if (e.target.closest("[data-see-confirmed]")) { S.taskFilter = "done"; go(href("fixes", "hand")); return; }
  const r = e.target.closest("[data-agency-refresh]"); if (r) { r.disabled = true; loadAgency().then(() => renderShell(agencyView())).catch((x) => toast(x.message)); }
});
document.addEventListener("input", (e) => { if (e.target.id === "agency-q") { S.agencyQ = e.target.value; const pos = e.target.selectionStart; renderShell(agencyView()); const i = document.getElementById("agency-q"); if (i) { i.focus(); i.setSelectionRange(pos, pos); } } });
// Messages panel (Ask Samaritan + Your team): a React island loaded after the dashboard paints, mounted outside the re-rendered shell.
let chatLoading=null;
function mountChat(){
  const s=siteById(S.siteId);if(!S.session||!s){window.SamaritanChat?.unmount();return;}
  const go=()=>S.session&&S.siteId===s.id&&S.page!=="agency"&&window.SamaritanChat?.mount({sb,initialThread:S.isAdmin&&S.page==="team"&&/^[a-f0-9-]{36}$/i.test(S.sub||"")?S.sub:null,siteId:s.id,siteName:s.name,isAdmin:!!S.isAdmin,fnBase:CFG.supabaseUrl+'/functions/v1',anonKey:CFG.supabaseAnonKey,href,reviewCount:()=>{const st=siteById(S.siteId),dd=S.data[S.siteId];return st&&dd?reviewGroups(st,dd).reduce((n,g)=>n+g.count,0):null;}});
  if(window.SamaritanChat)return go();
  if(chatLoading)return chatLoading.then(go);
  chatLoading=new Promise(res=>{const start=()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/chat.css?v=6.7';document.head.appendChild(l);const sc=document.createElement('script');sc.src='/chat.js?v=12.2';sc.onload=res;sc.onerror=()=>{chatLoading=null;};document.head.appendChild(sc);};window.requestIdleCallback?requestIdleCallback(start,{timeout:1500}):setTimeout(start,600);}).then(go);
}
function mountSamaritanPage(s) {
  const run = () => {
    const el = document.getElementById("samaritan-page");
    if (S.page !== "ask" || !el || S.siteId !== s.id || !window.SamaritanChat?.page) return;
    window.SamaritanChat.page({ sb, siteId: s.id, siteName: s.name, isAdmin: !!S.isAdmin, fnBase: CFG.supabaseUrl + "/functions/v1", anonKey: CFG.supabaseAnonKey, href, reviewCount: () => { const dd = S.data[s.id]; return dd ? reviewGroups(s, dd).reduce((n, g) => n + g.count, 0) : null; },
      getItem: (kind, id) => { const d = S.data[s.id]; return kind === "fix" ? (d?.fixes || []).find((x) => String(x.id) === String(id)) || null : (d?.drafts || []).find((x) => String(x.id) === String(id)) || null; } }, el);
  };
  if (window.SamaritanChat) return run();
  mountChat(); (chatLoading || Promise.resolve()).then(run);
}
function dashView(s, d) {
  window.ImpacktDash.onRerender(() => render());
  const review = reviewGroups(s, d).reduce((n, g) => n + g.count, 0);
  return window.ImpacktDash.view(S.page, { s, d, snap: S.results?.[s.id], ev: S.aiEv?.[s.id], claims: S.claims?.[s.id], tools: S.tools?.[s.id], isAdmin: S.isAdmin, href, ecommerce: ecommerceSite(s, d), reviewCount: review, opps: S.opps?.[s.id]?.rows || [], shopDaily: S.shop?.[s.id]?.rows || [], metrics: S.metrics?.[s.id] || null, saved: S.saved?.[s.id] || [], ready: S.ready?.[s.id] || null, leadgenHTML: S.page === "leadgen" ? leadgenView(s, d) : "" });
}
function render() {
  // Background loaders call render() when they finish; they must not replace a page the user has since moved to.
  if (S.page === "agency") { renderShell(agencyView()); return; }
  if (S.page === "new" || S.page === "onboarding") return;
  const s = siteById(S.siteId), d = S.data[S.siteId];
  if (!s || !d) return;
  queueMicrotask(mountChat); window.fbSeen?.();
  if (S.page !== "ask") window.SamaritanChat?.unmountPage?.();
  if (["integrations", "connections"].includes(S.page) && !S.nango?.[S.siteId]) queueMicrotask(() => loadNango(S.siteId));
  if (S.page === "ask") { renderShell('<div id="samaritan-page" class="sp-host"></div>'); mountSamaritanPage(s); return; }
  if (window.ImpacktDash?.pages[S.page]) { renderShell(dashView(s, d)); return; }
  if(!S.isAdmin){renderShell(clientView(s,d));return;}
  const view = {seo:seoChannelView,geo:geoChannelView,paid:paidChannelView,team:teamView,access:accessView,today:homeView,inbox:inboxView,playbooks:playbooksView,fixes:fixesView,growth:growthView,content:contentChannelView,activity:activityView,connections:integrationsView,business:businessView,apps:appsView}[S.page]||homeView;
  renderShell(view(s, d));
  if (!S.workspace[s.id] && !S.workspaceBusy.has('load:'+s.id)) {
    S.workspaceBusy.add('load:'+s.id);
    loadWorkspace(s.id, true).finally(()=>{S.workspaceBusy.delete('load:'+s.id);if(S.siteId===s.id&&!S.modal)render();});
  }
  if (S.page === 'paid' && S.sub === 'economics') calcUpdate();
  const thread=document.querySelector('.chat-thread');if(thread)thread.scrollTop=thread.scrollHeight;
}

// ---------- shared bits ----------
function sumRange(rows, from, to) {
  const r = rows.filter((x) => x.date > from && x.date <= to);
  const clicks = r.reduce((a, x) => a + x.clicks, 0), imps = r.reduce((a, x) => a + x.impressions, 0);
  const pos = imps ? r.reduce((a, x) => a + x.position * x.impressions, 0) / imps : null;
  return { clicks, imps, ctr: imps ? clicks / imps : null, pos, days: r.length };
}
function gsc28(d) {
  if (!d.daily.length) return null;
  const last = d.daily[d.daily.length - 1].date;
  const dt = (n) => new Date(new Date(last).getTime() - n * 86400_000).toISOString().slice(0, 10);
  const prev = sumRange(d.daily, dt(56), dt(28));
  return { last, cur: sumRange(d.daily, dt(28), last), prev: prev.days === 28 && sumRange(d.daily, dt(28), last).days === 28 ? prev : null };
}
function deltaTag(cur, prev, invert = false) {
  if (prev == null || cur == null || prev === 0) return "";
  const ch = (cur - prev) / prev; const good = invert ? ch < 0 : ch > 0;
  return `<span class="delta ${good ? "up" : "down"}">${ch > 0 ? "+" : ""}${(ch * 100).toFixed(0)}%</span>`;
}
const deltaPts = (cur, prev) => cur == null || prev == null ? "" : `<span class="delta ${cur >= prev ? "up" : "down"}">${cur >= prev ? "+" : ""}${cur - prev} pts</span>`;
function gauge(score) {
  const r = 42, c = 2 * Math.PI * r, off = c * (1 - (score || 0) / 100);
  const color = score >= 70 ? "var(--ok)" : score >= 50 ? "var(--high)" : "var(--crit)";
  return `<div class="gauge" role="img" aria-label="On-page checks ${score ?? "unknown"} of 100"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="${r}" fill="none" stroke="var(--line)" stroke-width="10"/><circle class="v" cx="52" cy="52" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 52 52)"/></svg><div class="num"><b>${score ?? "–"}</b><small>of 100</small></div></div>`;
}
const kpi = (label, ic, value, note, extra = "") => `<div class="card kpi"><div class="k-top"><span>${label}</span>${icon(ic, 15)}</div><b class="mono">${value}</b>${extra}<div class="k-note">${note}</div></div>`;
const lastAeo = (d) => d.aeoRuns.find((r) => r.status === "done");
const successfulAnswers = (r) => r?.summary?.successful ?? Math.max(0, (r?.summary?.checks || 0) - (r?.summary?.failed || 0));
const partialAeo = (r) => !!r && successfulAnswers(r) < (r.summary?.checks || 0);
const comparableAeo = (a, b) => !!a && !!b && !partialAeo(a) && !partialAeo(b) && JSON.stringify(Object.keys(a.summary?.byEngine || {}).sort()) === JSON.stringify(Object.keys(b.summary?.byEngine || {}).sort()) && a.summary?.checks === b.summary?.checks;
const verifiedLive = (f) => f.status === "deployed" && f.data?.verification?.state === "verified";
function verificationBadge(f) {
  const v = f.data?.verification;
  const labels = { verified: "Verified on live page", pending: "Verification pending", mismatch: "Live page differs", unavailable: "Could not verify", manual_check: "Manual check needed" };
  return `<span class="pill ${v?.state === "verified" ? "ok" : "warn"}" title="${esc(v?.reason || "No independent page check recorded yet.")}">${labels[v?.state] || "Not yet verified"}</span>${v?.checkedAt ? `<div class="kind">Checked ${fmtShort(v.checkedAt)}</div>` : ""}`;
}
const aiProviderActive = k => k !== "gemini" || S.aeoInfo?.engines?.gemini?.paused === false;
function providerErrorCards(d) {
  const errors = Object.entries(ENGINE_LABEL).filter(([k])=>aiProviderActive(k)).map(([k, label]) => {
    const checks = d.aeoChecks.filter(c => c.engine === k);
    const failed = checks.filter(c => c.status === "failed");
    if (!failed.length) return "";
    const latest = [...failed].sort((a, b) => (b.checked_at || "").localeCompare(a.checked_at || ""))[0];
    const provider = S.aeoInfo?.engines?.[k];
    const error = (provider?.lastStatus === "failed" && provider.lastError) || latest.error || "The provider did not return an answer.";
    const billing = /credit|billing|quota/i.test(error);
    const billingLink = billing && k === "chatgpt" ? '<a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener">Review OpenAI billing ↗</a>' : billing && k === "gemini" ? '<a href="https://aistudio.google.com/" target="_blank" rel="noopener">Review Gemini billing and quota ↗</a>' : "";
    return `<div class="banner" style="margin-bottom:10px"><b>${esc(label)}: ${failed.length} checks failed.</b> ${esc(error)} ${billingLink} <button class="btn ghost" data-aeo-retry="${esc(k)}">Retry failed checks</button></div>`;
  });
  return errors.join("");
}
async function syncGoogle(siteId) {
  const r = await engine("gsc_sync", { site_id: siteId });
  const x = r.result?.[siteId];
  if (!x) throw new Error("Google is not connected to this business yet.");
  if (x.error) throw new Error(x.error);
  return x;
}
const conn = (d, t) => d.connectors.find((c) => c.type === t);
const connected = (d, t) => d.connectors.some((c) => c.type === t && c.status === "connected");
const draftStatus = { needs_review: ["Needs review", "review"], approved: ["Approved", "done"], rejected: ["Rejected", "bad"] };
const taskStatus = { pending: ["To do", "review"], done: ["Done", "done"], dismissed: ["Dismissed", "bad"] };

// ---------- Today: Your Daily Pulse ----------
const DAY = 86400_000;
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
function gscWeek(d) {
  if (!d.daily.length) return null;
  const last = d.daily[d.daily.length - 1].date;
  const back = (n) => isoDay(new Date(last).getTime() - n * DAY);
  const cur = sumRange(d.daily, back(7), last), prev = sumRange(d.daily, back(14), back(7));
  return { last, cur, prev: prev.days === 7 && cur.days === 7 ? prev : null };
}
const ECOM = ["shopify", "woocommerce", "bigcommerce", "wix", "squarespace"];
function change(cur, prev) { if (cur == null || prev == null || prev === 0) return null; return (cur - prev) / prev; }
function chg(cur, prev, invert = false) {
  const c = change(cur, prev); if (c == null) return "";
  if (Math.abs(c) < 0.03) return `<span class="delta flat">steady</span>`;
  const good = invert ? c < 0 : c > 0;
  return `<span class="delta ${good ? "up" : "down"}">${c > 0 ? "▲" : "▼"} ${Math.abs(c * 100).toFixed(0)}%</span>`;
}
function leadsWeek(d) {
  const now = Date.now();
  const n = (from, to) => d.leads.filter((l) => { const t = new Date(l.created_at).getTime(); return t > now - from * DAY && t <= now - to * DAY; }).length;
  return { cur: n(7, 0), prev: n(14, 7) };
}
function siteWrite(s, d) {
  if (s.platform === "shopify") return connected(d, "shopify");
  if (s.platform === "webflow") return connected(d, "webflow");
  return null;
}
function setupSteps(s, d) {
  const p = s.profile || {};
  const write = siteWrite(s, d);
  const steps = [
    ["Tell Impackt Media about the business", "Customers, voice and key facts, so every fix and draft sounds like you.", !!(p.industry || s.brand?.facts), href("business"), "Add details"],
    [write === null ? "Connect your website" : `Connect ${PLATFORMS[s.platform]?.name || "your website"}`, write === null ? "So Impackt Media can read every page and spot what's missing." : "So approved fixes go live on their own, with one-click rollback.", write === null ? d.connectors.some((c) => ["framer", "framer_key", "wordpress"].includes(c.type) && c.status === "connected") : write, href("connections"), "Connect"],
    ["Connect Google", "Search clicks, rankings and the queries that bring people in.", connected(d, "gsc"), href("connections"), "Connect"],
    ["Establish your AI visibility baseline", "Check real customer questions and inspect the answers.", (d.aeoRuns||[]).some(r=>r.status==="done"&&successfulAnswers(r)>0), href("geo"), "Review tracking"],
  ];
  return steps;
}
function attention(s, d) {
  const out = [], c = counts(d), w = gscWeek(d), run = lastAeo(d), prevRun = d.aeoRuns.filter((r) => r.status === "done")[1], sales = S.sales[s.id]?.data;
  d.connectors.filter((x) => x.status === "error").forEach((x) => out.push({ sev: "crit", t: `${CONNECTOR_TYPES[x.type]?.name || x.type} stopped working`, why: x.last_error || "The last check failed.", h: href("connections"), cta: "Fix it" }));
  const unverified = d.fixes.filter(f => ["deployed", "rolled_back"].includes(f.status) && ["mismatch", "unavailable", "manual_check"].includes(f.data?.verification?.state)).length;
  if (unverified) out.push({ sev: "warn", t: `${plural(unverified, "saved change")} needs verification`, why: "A saved platform value is not proof that the public page changed.", h: href("fixes", "live"), cta: "Review checks" });
  const latest = d.aeoRuns[0];
  if (latest?.status === "failed" || latest?.summary?.failed) out.push({ sev: "warn", t: "AI visibility has incomplete coverage", why: "One or more providers failed. The percentage only includes successful answers.", h: href("growth", "ai"), cta: "See failures" });
  if (!connected(d, "gsc")) out.push({ sev: "warn", t: "Google search data is not connected", why: "Traffic and ranking changes cannot be measured until Google is authorized and synced.", h: href("connections"), cta: "Connect Google" });
  const failed = d.fixes.filter((f) => f.status === "failed").length;
  if (failed) out.push({ sev: "crit", t: `${plural(failed, "approved fix")} couldn't be applied`, why: "Usually a page that changed or was deleted since the checkup.", h: href("fixes", "failed"), cta: "See why" });
  if (sales && change(sales.cur, sales.prev) <= -0.15) out.push({ sev: "warn", t: `Sales are down ${Math.abs(change(sales.cur, sales.prev) * 100).toFixed(0)}% this week`, why: `${money(sales.cur)} vs ${money(sales.prev)} the week before.`, h: href("growth"), cta: "Look closer" });
  if (w?.prev && change(w.cur.clicks, w.prev.clicks) <= -0.15) out.push({ sev: "warn", t: `Google clicks dropped ${Math.abs(change(w.cur.clicks, w.prev.clicks) * 100).toFixed(0)}%`, why: `${num(w.cur.clicks)} clicks in the last 7 days vs ${num(w.prev.clicks)} before.`, h: href("growth"), cta: "See which pages" });
  if (comparableAeo(run, prevRun) && (run.summary?.visibility ?? 0) - (prevRun.summary?.visibility ?? 0) <= -5) out.push({ sev: "warn", t: "AI answers mention you less", why: `Named in ${run.summary.visibility}% of answers, down from ${prevRun.summary.visibility}%.`, h: href("growth", "ai"), cta: "See the answers" });
  if (s.last_run_at && Date.now() - new Date(s.last_run_at).getTime() > 9 * DAY) out.push({ sev: "warn", t: "The weekly checkup is overdue", why: `Last ran ${fmtDate(s.last_run_at)}.`, h: href("fixes", "live"), cta: "Details" });
  return out;
}
function nextActions(s, d) {
  const c = counts(d), out = [];
  if (c.pendingFixes) out.push({ t: `Publish ${plural(c.pendingFixes, "fix")}`, p: `Written for you from the checkup on ${fmtDate(s.last_run_at)}. ${siteWrite(s, d) ? "Publish approved changes, then check their live-page verification." : `Connect ${platformOf(s).name} to publish with one click.`}`, h: href("fixes"), cta: "Review and publish" });
  if (c.reviewDrafts) out.push({ t: `Read ${plural(c.reviewDrafts, "draft")}`, p: "Approve the ones worth publishing, edit the rest.", h: href("content"), cta: "Open drafts" });
  setupSteps(s, d).filter((x) => !x[2]).forEach(([t, p, , h, cta]) => out.push({ t, p, h, cta }));
  return out.slice(0, 3);
}
function heartline(rows, key) {
  const W = 1000, H = 110, pad = 8;
  if (!rows || rows.length < 2) return `<svg class="heartline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line class="base" x1="0" x2="${W}" y1="${H - 30}" y2="${H - 30}"/></svg>`;
  const max = Math.max(1, ...rows.map((r) => r[key])), min = Math.min(...rows.map((r) => r[key]));
  const x = (i) => (i / (rows.length - 1)) * W, y = (v) => pad + (1 - (v - min) / Math.max(1, max - min)) * (H - pad * 2 - 6);
  const pts = rows.map((r, i) => [x(i), y(r[key])]);
  const line = pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join("");
  return `<svg class="heartline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily ${key} over the last ${rows.length} days"><path class="area" d="${line}L${W},${H}L0,${H}Z"/><path class="hl" d="${line}" vector-effect="non-scaling-stroke"/></svg>`;
}
function vital(label, value, sub, delta, link, cta) {
  const empty = value == null;
  return `<a class="vital ${empty ? "empty-v" : ""}" href="${link}"><div class="lbl"><span>${label}</span>${delta || ""}</div><div class="val">${empty ? cta : value}</div><div class="sub">${sub}</div></a>`;
}
// The chart preserves unreported dates as gaps, never fabricated zeroes.
function overviewSeries(d, metric='clicks') {
  const key=metric==='impressions'?'impressions':'clicks';
  const byDate=new Map((d.daily||[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(Date.parse(r.date))).map(r=>[r.date,r]));
  const last=[...byDate.keys()].sort().at(-1);
  if(!last)return {key,rows:[],total:null,reported:0,last:null,previous:null};
  const day=n=>isoDay(Date.parse(last)-n*DAY);
  const window=end=>Array.from({length:28},(_,i)=>{const date=day(end+27-i),raw=byDate.get(date)?.[key];return {date,value:typeof raw==='number'&&Number.isFinite(raw)&&raw>=0?raw:null};});
  const rows=window(0),prior=window(28),reported=rows.filter(r=>r.value!==null).length;
  return {key,rows,total:reported?rows.reduce((n,r)=>n+(r.value??0),0):null,reported,last,previous:reported===28&&prior.every(r=>r.value!==null)?prior.reduce((n,r)=>n+r.value,0):null};
}
function overviewChart(d) {
  const c=overviewSeries(d,S.overviewMetric),label=c.key==='clicks'?'Search clicks':'Search impressions';
  const max=Math.max(1,...c.rows.map(r=>r.value??0)),ceiling=Math.max(4,Math.ceil(max/4)*4),W=760,H=245,left=54,top=18,base=210,width=680;
  const plot=c.rows.length?`<svg class="search-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} for the 28 days ending ${esc(c.last)}. ${c.reported} days reported. Open the data table for exact values.">
    ${[0,1,2,3,4].map(i=>{const y=base-i*(base-top)/4;return `<line class="chart-gridline" x1="${left}" x2="${left+width}" y1="${y}" y2="${y}"/><text x="${left-10}" y="${y+4}" text-anchor="end">${new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(ceiling*i/4)}</text>`;}).join('')}
    ${c.rows.map((r,i)=>{const x=left+i*width/28+4,h=r.value===null?12:r.value/ceiling*(base-top);return `<rect class="${r.value===null?'chart-gap':'chart-bar'}" x="${x}" y="${base-Math.max(1,h)}" width="${width/28-8}" height="${Math.max(1,h)}" rx="2"><title>${esc(r.date)}: ${r.value===null?'Not reported':num(r.value)+' '+c.key}</title></rect>`;}).join('')}
    ${[0,7,14,21,27].map(i=>`<text x="${left+i*width/28+12}" y="235" text-anchor="${i===27?'end':'middle'}">${esc(new Date(c.rows[i].date+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</text>`).join('')}</svg>`:'';
  return `<div class="card-head"><div><h2>Search performance</h2><p>Google Search Console · latest 28-day window</p></div><div class="metric-switch" role="group" aria-label="Search chart metric">${['clicks','impressions'].map(k=>`<button data-overview-metric="${k}" aria-pressed="${c.key===k}">${k==='clicks'?'Clicks':'Impressions'}</button>`).join('')}</div></div>
    ${c.total!==null?`<div class="chart-stat"><strong>${num(c.total)}</strong>${deltaTag(c.total,c.previous)}<span>${esc(label.toLowerCase())}${c.previous!==null?' · vs previous 28 days':''}</span></div>${plot}<div class="chart-caption"><span class="chart-legend"><i></i>${esc(label)} · ${c.reported}/28 days reported</span><span>Through ${esc(fmtShort(c.last))}${Date.now()-Date.parse(c.last)>7*DAY?' · Refresh recommended':''}</span></div><details class="chart-data"><summary>View source data & measurement notes</summary><p>Search clicks are not unique visitors or attributed sales. Missing dates are shown as gaps. Comparisons require two complete 28-day windows.</p><div class="tablewrap"><table><caption class="sr-only">Daily ${esc(label.toLowerCase())}</caption><thead><tr><th scope="col">Date</th><th scope="col">${esc(label)}</th></tr></thead><tbody>${c.rows.map(r=>`<tr><th scope="row">${esc(r.date)}</th><td>${r.value===null?'Not reported':num(r.value)}</td></tr>`).join('')}</tbody></table></div><a class="btn ghost" href="${href('growth')}">Explore all results →</a></details>`:`<div class="chart-empty">${icon('activity',28)}<h3>Your performance starts with a connection.</h3><p>${connected(d,'gsc')?'Google is connected. The first search report has not been saved yet.':S.isAdmin?'Connect Search Console to see the searches bringing people to your business.':'Your team can connect Search Console to show the searches bringing people to your business.'}</p><a class="btn" href="${href('connections')}">${connected(d,'gsc')?'Check sync status':S.isAdmin?'Connect Search Console':'View connections'} →</a></div><div class="chart-caption">No search data available. This chart fills with reported results.</div>`}`;
}
function overviewDecision(s,d,client=false) {
  const issues=client?[]:attention(s,d);
  const ordered=[...issues.filter(x=>x.sev==='crit'),...issues.filter(x=>x.sev!=='crit')];
  const fixes=(d.fixes||[]).filter(readyFix).length,drafts=(d.drafts||[]).filter(x=>pendingDraft(x,d)).length;
  const reviews=[...(drafts?[{t:`${plural(drafts,'draft')} ready for review`,why:'Read the work, check the facts and approve the exact version.',h:href('content'),cta:'Review content'}]:[]),...(fixes?[{t:`${plural(fixes,'website improvement')} to review`,why:'Compare the current page with the proposed change before deciding.',h:href('fixes'),cta:'Review improvements'}]:[])];
  // Failures first, then prepared work; secondary warnings stay available on demand.
  const items=[...ordered.filter(x=>x.sev==='crit'),...reviews,...ordered.filter(x=>x.sev!=='crit')];
  const first=items[0]||{t:'Nothing awaiting review.',why:'No proposals are waiting in this snapshot. Check your team’s queue for the next scheduled work.',h:href('team'),cta:'See the work queue'};
  return `<section class="decision-card" data-severity="${first.sev||'normal'}"><div class="decision-heading"><span class="eyebrow">${items.length?'Your next decision':'Workspace status'}</span><span class="decision-count">${num(fixes+drafts)} to review</span></div><h2>${esc(first.t)}</h2><p>${esc(first.why)}</p><a class="btn primary" href="${first.h}">${esc(first.cta)} ${icon('arrow',14)}</a>${items.length>1?`<details class="decision-extra"><summary>${items.length-1} more ${items.length===2?'item':'items'} to consider</summary><ul>${items.slice(1).map(x=>`<li><b>${esc(x.t)}</b><p>${esc(x.why)}</p><a href="${x.h}">${esc(x.cta)} →</a></li>`).join('')}</ul></details>`:''}</section>`;
}
function overviewAgents(s,d) {
  return `<section class="overview-section"><div class="card-head"><div><h2>Your agency at work</h2><p>Current work. Clear next steps. A team behind every channel.</p></div><a href="${href('team')}">View your team →</a></div><div class="agent-deck">${agentRoster(s,d).filter(a=>a.key!=='strategy').map(a=>`<article class="agent-mini" data-working="${a.active}"><div class="agent-mini-head"><span class="agent-mini-icon">${scanner('overview-'+a.key)}</span><span class="mini-state">${esc(a.state)}</span></div>${a.active?pulseLine(true):''}<h3>${esc(a.name)}</h3><p class="agent-scope">${esc(a.scope)}</p><dl><div><dt>Now</dt><dd>${esc(a.now)}</dd></div><div><dt>Up next</dt><dd>${esc(a.next)}</dd></div></dl><a href="${href(a.key==='seo'?'seo':a.page)}">Open workspace <span aria-hidden="true">↗</span></a></article>`).join('')}</div></section>`;
}
function overviewSetup(s,d) {
  const steps=setupSteps(s,d),done=steps.filter(x=>x[2]).length,next=steps.find(x=>!x[2]);
  return `<section class="card"><div class="card-head"><h2>${next?'Build your foundation':'Your foundation is connected'}</h2><span class="kind">${done} of ${steps.length}</span></div><div class="progress" role="progressbar" aria-label="Workspace setup" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${done}"><i style="width:${done/steps.length*100}%"></i></div>${next?`<div class="setup-focus"><div><b>${esc(next[0])}</b><p>${esc(next[1])}</p></div><a class="btn" href="${next[3]}">${esc(next[4])} →</a></div>`:'<p class="muted">Your core setup is complete. Check Integrations for access and reporting freshness.</p>'}<details class="setup-details"><summary>View all setup steps</summary><ul class="setup-list">${steps.map(([t,p,ok,h,cta])=>`<li class="${ok?'done':''}"><span class="tick">${ok?icon('check',13):''}</span><div><b>${esc(t)}</b><small>${esc(p)}</small></div>${ok?'':`<a class="btn" href="${h}">${esc(cta)}</a>`}</li>`).join('')}</ul></details></section>`;
}
function overviewView(s,d,client=false) {
  const run=(d.aeoRuns||d.agentStatus?.aeoRuns||[]).find(r=>r.status==='done'),verified=(d.fixes||[]).filter(verifiedLive).length;
  const orders=ECOM.includes(s.platform)&&connected(d,'shopify')&&!client;
  if(orders&&!S.sales[s.id])loadSales(s.id);
  const sales=S.sales[s.id];
  const outcomes=[['Verified website changes',num(verified),'Confirmed on the public page'],['Named in AI answers',run&&successfulAnswers(run)>0&&run.summary?.visibility!=null?`${run.summary.visibility}%`:'—',run?`${successfulAnswers(run)} successful answers${partialAeo(run)?' · partial coverage':''} · ${fmtShort(run.finished_at||run.started_at)}`:'No completed check recorded'],...(orders?[['Store sales · 7 days',sales?.data?money(sales.data.cur):'—',sales?.data?`${num(sales.data.orders)} orders · reported by Shopify`:sales?.error||'Loading your store report']]:[['Content awaiting approval',num((d.drafts||[]).filter(x=>pendingDraft(x,d)).length),'Finished work only · approving publishes it']])];
  const events=client?[]:buildEvents(d).slice(0,4);
  return `${client?'':checkupBanner(s)}<header class="overview-head"><div><div class="eyebrow">Your agency, connected</div><h1>Your marketing, in motion.</h1><p>${esc(s.name)} · A clear view of performance, priorities and the work behind them.</p></div><div class="head-actions"><span class="period-label">${esc(new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}</span><button class="btn" data-client-refresh>${icon('refresh',14)} Refresh workspace</button></div></header>
    ${client?`<div class="banner info">${(d.role||s.role)==='reviewer'?'You can review work and record decisions. Your agency handles execution.':'You have viewing access. Message your team to discuss a change.'}</div>`:`<section class="overview-command" aria-label="Ask Samaritan">${assistantPanel(s)}</section>`}
    <div class="overview-grid"><section class="card overview-chart" id="overview-chart" aria-label="Search performance">${overviewChart(d)}</section><aside class="overview-aside" aria-label="Decisions and outcomes">${overviewDecision(s,d,client)}<section class="card outcome-card" aria-label="Recorded outcomes">${outcomes.map(([label,value,note])=>`<div class="outcome-row"><div><span>${esc(label)}</span><small>${esc(note)}</small></div><strong>${esc(value)}</strong></div>`).join('')}</section></aside></div>
    ${overviewAgents(s,d)}${client?'':`<div class="overview-bottom">${overviewSetup(s,d)}<section class="card"><div class="card-head"><h2>Latest activity</h2><a class="btn ghost" href="${href('activity')}">Activity log →</a></div>${events.length?`<ul class="timeline">${events.map(x=>`<li><span class="ic">${icon(x.i,15)}</span><div><b>${esc(x.t)}</b></div><time datetime="${esc(x.at)}">${esc(fmtShort(x.at))}</time></li>`).join('')}</ul>`:'<p class="muted">Completed work will appear here after your first checkup or draft.</p>'}<p class="kind">Recorded work is separate from measured business growth.</p></section></div>`}`;
}
function todayView(s,d){return overviewView(s,d);}

async function loadSales(id) {
  S.sales[id] = { loading: true };
  try { const r = await engine("sales", { site_id: id }); S.sales[id] = { data: r.sales }; }
  catch (e) { S.sales[id] = { error: /scope|access|denied|protected/i.test(e.message) ? "Reconnect Shopify to allow sales" : "Couldn't load sales" }; }
  if (S.page === "today" && S.siteId === id && !S.modal) render();
}

// ---------- Production pipeline ----------
const inProduction=x=>x.lane==='production'||x.lane==='attention'||(x.status==='approved'&&x.kind==='Content brief'&&x.stage);
function pipelineNote(x,d){
 if(x.status==='needs_review'&&x.lane==='approval')return `<p class="kind pipeline-note">Ready to publish${x.prepared_by==='system'?' · prepared by Samaritan':''} · ${x.adapter==='shopify_article'?'publishes to your Shopify blog':'adds this section to the page in Shopify'} · checked on the live page afterwards.</p>`;
 if(!inProduction(x))return '';
 const made=x.deliverable_id&&(d?.drafts||[]).find(y=>y.id===x.deliverable_id);
 const why=x.stage==='delivered'?`Turned into a finished article${made?`: <a href="#draft-${esc(made.id)}">${esc(made.title)}</a>`:''}.`
  :x.stage==='producing'?'Samaritan is writing the finished article now.'
  :x.stage==='queued'?`In production. Samaritan turns this plan into a finished article${x.blocker?.code==='retrying'?' (retrying after: '+esc(x.blocker.detail)+')':''}.`
  :x.stage==='blocked'&&x.blocker?esc(x.blocker.detail)
  :(x.reasons||[]).map(r=>esc(r.detail)).join(' ')||'Waiting to be sorted into production.';
 return `<p class="kind pipeline-note"><b>${x.stage==='delivered'?'Delivered':x.stage==='blocked'||x.lane==='attention'?'Cannot be published yet':'In production'}</b> · ${why}</p>`;
}
function productionPanel(d){
 const rows=(d.drafts||[]).filter(inProduction);if(!rows.length)return '';
 const n=f=>rows.filter(f).length,making=n(x=>['queued','producing'].includes(x.stage)),done=n(x=>x.stage==='delivered'),blocked=rows.filter(x=>x.stage==='blocked'||(x.lane==='attention'&&x.stage!=='delivered')||!x.stage);
 const why={};for(const x of blocked){const k=x.blocker?.detail||(x.reasons||[])[0]?.detail||'Waiting to be sorted into production.';(why[k]||=[]).push(x);}
 return `<details class="card production-panel"><summary><b>Production pipeline</b> · ${num(making)} being finished · ${num(done)} delivered · ${num(blocked.length)} cannot be published yet<span class="kind"> · not part of your approval count</span></summary><p class="muted">Plans and briefs stay here until Samaritan has turned them into finished, publishable work. Only finished work asks for your approval.</p>${Object.entries(why).sort((a,b)=>b[1].length-a[1].length).map(([k,xs])=>`<div class="production-reason"><b>${plural(xs.length,'item')}</b> · ${esc(k)}<div class="kind">${xs.slice(0,4).map(x=>esc(x.title)).join(' · ')}${xs.length>4?` · and ${xs.length-4} more`:''}</div></div>`).join('')}</details>`;
}
// One approval publishes the exact version shown, then checks the live page. No second step.
async function approveWork(id){
 const sid=S.siteId,x=S.data[sid]?.drafts.find(r=>String(r.id)===String(id));
 if(!x||S.busy.has('d:'+id))return;
 S.busy.add('d:'+id);render();
 try{
  const {data:{session}}=await sb.auth.getSession();
  const r=await fetch(`${CFG.supabaseUrl}/functions/v1/playbooks`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,apikey:CFG.supabaseAnonKey},body:JSON.stringify({action:'approve',site_id:sid,draft_id:id,payload_hash:x.payload_hash})});
  const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||'Could not approve this item.');
  toast(j.already?'Already approved. Publishing is under way.':'Approved. Publishing now, then we check the live page.');
 }catch(e){toast(e.message);}
 finally{S.busy.delete('d:'+id);if(S.siteId===sid){if(S.isAdmin)await loadWorkspace(sid).catch(()=>{});await refresh();}}
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-approve-work]');if(b){b.disabled=true;approveWork(b.dataset.approveWork);}});
// ---------- All tasks ----------
function oppWhy(x){const o=oppFor(x.id);return o?`<div class="opp-why"><span class="opp-tag">${o.kind==='ai_answer_gap'?'AI search gap':o.kind==='article_aeo'?'Published article':'Thin page'}</span><p>${esc(o.why)}</p></div>`:'';}
function draftCard(x) {
  const busy = S.busy.has("d:" + x.id);
  const st = x.ranking_hold?['Needs ranking evidence','warn']:draftStatus[x.status];
  return `<article id="draft-${esc(x.id)}" class="item ${x.status !== "needs_review" ? "resolved" : ""}">
    <div class="item-head"><span class="status ${st[1]}">${st[0]}</span><span class="kind">${esc(x.kind)} · ${fmtShort(x.created_at)}</span><span class="target" style="flex-basis:100%">${esc(x.title)}</span></div>
    ${oppWhy(x)}${pipelineNote(x,S.data[S.siteId])}
    <div class="actions">${x.ranking_hold?'<span class="kind">Held for evidence review</span>':x.status === "needs_review" && x.kind === "FAQ section" && oppFor(x.id)?.publishable ? `<button class="btn" data-draft="rejected" data-id="${esc(x.id)}" ${busy ? "disabled" : ""}>Reject</button>` : x.status === "needs_review" ? `${x.lane==='approval'?`<button class="btn primary" data-approve-work="${esc(x.id)}" ${busy ? "disabled" : ""}>${busy?'Publishing…':'Approve &amp; publish'}</button>`:''}<button class="btn" data-draft="rejected" data-id="${esc(x.id)}" ${busy ? "disabled" : ""}>Reject</button>` : oppFor(x.id)?.evidence?.publish ? '' : `<button class="btn ghost" data-draft="needs_review" data-id="${esc(x.id)}" ${busy ? "disabled" : ""}>Undo</button>`}
      <button class="btn ghost" data-copy-draft="${esc(x.id)}">Copy</button>${x.kind==='Blog post'?`<button class="btn ghost" data-copy-draft="${esc(x.id)}" data-copy-format="html">Copy HTML</button>`:''}<button class="btn ghost" data-draft-edit="${esc(x.id)}">Edit</button><button class="btn ghost danger" data-draft-del="${esc(x.id)}">Delete</button></div>
    ${x.ranking_hold?`<p class="kind">${esc(x.ranking_hold.reason)}</p>`:publicationControls(x)}
    ${x.status === "needs_review" ? suggestBox("draft", x) : ""}
    <div class="item-body one">${S.editDraft === x.id
      ? `<form id="draft-edit" data-id="${esc(x.id)}" class="form" style="max-width:none"><input type="text" id="de-title" value="${esc(x.title)}" required><textarea id="de-body" style="min-height:260px">${esc(x.body)}</textarea><p class="hint">Add links as [descriptive text](https://example.com/page). Save to preview before approving.</p><div style="display:flex;gap:8px"><button class="btn primary" type="submit">Save</button><button class="btn ghost" type="button" data-act="cancel-edit">Cancel</button></div></form>`
      : `<div class="draft-body">${readableDraft(x.body)}</div>${x.kind==='Blog post'?articleLinkReview(x.body):''}`}</div>
  </article>`;
}
// ---------- Review queue ----------
function serp(url,title,isDesc){const t=String(title||'');return `<div class="serp"><div class="u">${esc((url||'').replace(/^https?:\/\//,''))}</div><div class="${isDesc?'d':'t'}">${esc(t)||'<span class="muted">(empty)</span>'}</div><div class="len">${t.length} characters · Preview only. Google may truncate or rewrite the result; length alone does not justify a change.</div></div>`;}

function filteredFixes(d) {
  const st = S.filter.status;
  let rows = d.fixes.filter((f) => st === "pending" ? readyFix(f) : st === "outdated" ? f.status === "pending" && !!searchReviewHold(f) : st === "approved" ? ["approved", "rollback_requested"].includes(f.status) : st === "failed" ? f.status === "failed" : st === "rejected" ? f.status === "rejected" : false);
  if (S.filter.field !== "all") rows = rows.filter((f) => f.field === S.filter.field);
  return rows.sort((a, b) => (PRI_ORDER[a.priority] ?? 2) - (PRI_ORDER[b.priority] ?? 2) || String(a.page_name).localeCompare(String(b.page_name)));
}
function reviewView(s, d) {
  const drafts = d.drafts.filter((x) => pendingDraft(x, d));
  const shop = connected(d, "shopify");
  const held = d.fixes.filter(f=>f.status==="pending"&&searchReviewHold(f));
  const by = (st) => d.fixes.filter((f) => st === "pending" ? readyFix(f) : st === "approved" ? ["approved", "rollback_requested"].includes(f.status) : f.status === st).length;
  const fields = [...new Set(d.fixes.filter(readyFix).map((f) => f.field))];
  const rows = filteredFixes(d);
  const bulk = S.filter.status === "pending" ? rows.filter(readyFix) : [];
  const write = siteWrite(s, d);
  return `${held.length?`<section class="card search-review-status"><h3>${plural(held.length,'older SEO suggestion')} held for evidence review</h3><p>These are excluded from ready-to-publish totals. Run a fresh audit to identify missing metadata. Existing titles and descriptions stay in place; proposed rewrites use a reviewed experiment.</p><div class="actions"><button class="btn" data-act="checkup">Run fresh website audit</button><a class="btn" href="${href('seo','experiments')}">Review existing-page changes</a></div></section>`:''}${write === false ? `<div class="banner"><b>Connect ${esc(platformOf(s).name)} to publish with one click.</b> <a href="${href("connections")}">Connect now</a></div>` : ""}
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Status" >
        ${[["pending", `Ready (${by("pending")})`], ...(held.length?[["outdated",`Evidence review (${held.length})`]]:[]), ...(by("failed") ? [["failed", `Needs attention (${by("failed")})`]] : []), ["rejected", `Skipped (${by("rejected")})`]].map(([k, l]) => `<button class="chip" data-filter-status="${k}" aria-pressed="${S.filter.status === k}">${l}</button>`).join("")}
      </div>
      ${bulk.length ? (S.confirmBulk
        ? `<div class="confirm">Publish all ${bulk.length} to ${esc(platformOf(s).name)} now? <button class="btn accent" data-act="bulk-yes">Publish ${bulk.length}</button><button class="btn ghost" data-act="bulk-no">Cancel</button></div>`
        : `<button class="btn accent" data-act="bulk">Publish all ${bulk.length}</button>`) : ""}
    </div>
    ${S.filter.status === "pending" && fields.length > 1 && false ? `<div class="chips" style="margin-bottom:14px" role="group" aria-label="Type">${["all", ...fields].map((f) => `<button class="chip" data-filter-field="${esc(f)}" aria-pressed="${S.filter.field === f}">${f === "all" ? "All types" : esc(FIELD[f] || f)}</button>`).join("")}</div>` : ""}
    <div class="list">${rows.length ? rows.slice(0, S.showN).map(fixHTML).join("") : `<div class="empty"><b>${S.filter.status === "pending" ? (held.length?"No publish-ready changes":"All caught up") : "Nothing here"}</b>${S.filter.status === "pending" ? "No publish-ready changes. The daily check proposes missing listings and fixes for clear problems (keyword-stuffed, cut-off, duplicate or all-caps titles and descriptions)." : ""}</div>`}</div>
    ${rows.length > S.showN ? `<div class="more"><button class="btn" data-act="more">Show ${Math.min(40, rows.length - S.showN)} more of ${rows.length - S.showN}</button></div>` : ""}`;
}
function searchEvidenceHTML(f) {
  if(!['seo.title','seo.description'].includes(f.field))return '';
  if(f.data?.experiment_id)return `<div class="note">This change belongs to a reviewed search pilot. <a href="${href('seo','experiments')}">View hypothesis, baseline and readout</a>.</div>`;
  if(f.field==='seo.description')return 'Search appearance housekeeping is excluded from ranking decisions.';
 const e=f.data?.search_strategy;
  if(!e || e.version!=='2026-11-05.2')return '<div class="note">Evidence review required. This older suggestion cannot be published. A fresh audit checks for verified search defects. Existing listings are reviewed through Search experiments.</div>';
  const b=e.baseline||{}, metric=b.current;
  return `<details class="note"><summary>Why Samaritan proposed this · review evidence</summary>${e.defects?.length?`<ul class="defects">${e.defects.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<p>${esc(e.reason)}</p><p>${esc(e.hypothesis||'')}</p><p>${esc(e.risk||'')}</p><p>Search Console: ${esc(b.status)}${metric?` · ${esc(metric.clicks)} clicks / ${esc(metric.impressions)} impressions`:''}. ${esc(b.current_window?.startDate||'')} ${b.current_window?'to':''} ${esc(b.current_window?.endDate||'')}</p><p>Page conversions and profit are not established by this evidence. No uplift forecast.</p><p>${esc(e.measurement?.window||'')} ${esc(e.measurement?.interpretation||'')}</p><p>Evidence prepared ${esc(e.reviewed_at||'')} · Policy ${esc(e.version)}</p><p>${(e.sources||[]).filter(x=>/^https:\/\/developers\.google\.com\//.test(x.url)).map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.id)}</a>`).join(' · ')}</p></details>`;
}
function suggestBox(kind, item) {
  const role = S.data[S.siteId]?.role || siteById(S.siteId)?.role;
  if (!S.isAdmin && role !== "reviewer") return "";
  const revs = kind === "draft" ? (item.revisions || []) : (item.data?.revisions || []), last = revs.at(-1);
  const ph = kind === "draft" ? "e.g. Answer the customer’s main question first and remove any unverified claims" : "e.g. Keep the product’s exact name and remove the unsupported claim";
  return `<div class="suggest-wrap">${last ? `<p class="rev-note"><span class="pill vf ok">Revised</span> “${esc(last.instruction)}”${last.summary ? ` · ${esc(last.summary)}` : ""} <small>${esc(fmtTime(last.at))}</small><button class="btn ghost sm" type="button" data-revert-kind="${kind}" data-revert-id="${esc(item.id)}">Undo revision</button></p>` : ""}<details class="suggest"${S.openSuggest === kind + item.id ? " open" : ""}><summary>Suggest a change</summary><form class="suggest-form" data-kind="${kind}" data-id="${esc(item.id)}"><textarea name="note" required minlength="4" maxlength="1500" rows="2" placeholder="${esc(ph)}"></textarea><label class="suggest-remember"><input type="checkbox" name="remember"> Also apply this to all future work</label><div class="suggest-actions"><button class="btn primary" type="submit">Revise it</button></div><p class="hint" role="status"></p></form></details></div>`;
}
function fixHTML(f) {
  const busy = S.busy.has(f.id);
  const hold = searchReviewHold(f);
  const isDesc = f.field === "seo.description", isTitle = f.field === "seo.title";
  const label = FIELD[f.field] || f.field;
  let btns = "";
  if (f.status === "pending") btns = `<button class="btn accent" data-fix="approved" data-id="${esc(f.id)}" ${busy ? "disabled" : ""}>${busy ? "Publishing…" : "Publish"}</button><button class="btn ghost" data-fix="rejected" data-id="${esc(f.id)}" ${busy ? "disabled" : ""}>Skip</button>`;
  else if (f.status === "failed") btns = `<button class="btn accent" data-fix="${f.data?.failedOperation === "rollback" ? "rollback_requested" : "approved"}" data-id="${esc(f.id)}" ${busy ? "disabled" : ""}>${f.data?.failedOperation === "rollback" ? "Retry rollback" : "Try again"}</button><button class="btn ghost" data-fix="rejected" data-id="${esc(f.id)}">Skip</button>`;
  else if (["approved", "rejected"].includes(f.status)) btns = `<button class="btn ghost" data-fix="pending" data-id="${esc(f.id)}" ${busy ? "disabled" : ""}>Undo</button>`;
  if(hold && ['pending','failed'].includes(f.status))btns=`<a class="btn" href="${href('seo','experiments')}">Review evidence workflow</a><button class="btn ghost" data-fix="rejected" data-id="${esc(f.id)}">Dismiss outdated suggestion</button>`;
  if(f.data?.experiment_id && ['pending','failed','approved'].includes(f.status) && f.data?.failedOperation!=='rollback')btns=`<a class="btn" href="${href('seo','experiments')}">Review search pilot</a>`;
  const state = { approved: "Publishing…", rejected: "Skipped", failed: f.data?.failedOperation === "rollback" ? "Couldn't roll back" : "Couldn't publish", rollback_requested: "Undoing…" }[f.status];
  const body = isTitle || isDesc
    ? `<div class="ba before"><h5>Now</h5>${serp(f.url, f.before, isDesc)}</div><div class="ba"><h5>${hold?"Unapproved suggestion":"Proposed copy"}</h5>${serp(f.url, f.after, isDesc)}</div>`
    : `<div class="ba before"><h5>Now</h5><p>${esc(f.before || "(empty)")}</p></div><div class="ba"><h5>After publishing</h5><p>${esc(f.after)}</p></div>`;
  const pri = hold ? "normal" : f.priority === "medium" ? "normal" : f.priority;
  return `<article class="item ${esc(pri)} ${f.status !== "pending" ? "resolved" : ""}">
    <div class="item-head">${hold?'<span class="pill state">Evidence review</span>':""}${pri === "critical" || pri === "high" ? `<span class="pill ${esc(pri)}">${pri === "critical" ? "Urgent" : "Important"}</span>` : ""}<span class="kind">${esc(label)} · ${esc(f.kind)}</span>
      ${state ? `<span class="pill ${f.status === "failed" ? "err" : "state"}">${state}</span>` : ""}
      <span class="target">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.page_name || f.url)}</a>` : esc(f.page_name)}</span></div>
    <div class="actions">${btns}</div>
    <div class="item-body">${body}</div>
    ${hold?`<p class="note">${esc(hold)}</p>`:""}${searchEvidenceHTML(f)}${f.status==="pending"&&!hold&&!f.data?.experiment_id?suggestBox("fix",f):f.status==="failed"?knowledgeCorrectionForm("fix",f.id):""}
    ${f.status === "failed" && f.error ? `<div class="note err">${esc(f.error)}</div>` : f.note ? `<div class="note">${esc(f.note)}</div>` : ""}
  </article>`;
}

// ---------- Lead pipeline ----------
function leadsView(s, d) {
  const by = (st) => d.leads.filter((l) => l.stage === st);
  const n = (st) => d.leads.filter((l) => l.stage === st).length, won = n("won"), lost = n("lost");
  const openVal = d.leads.filter((l) => ["new", "qualified", "contacted"].includes(l.stage)).reduce((a, l) => a + (+l.value || 0), 0);
  return `${pageHead("", "Leads", "Every inquiry in one place, with a next step. Moving a card never sends anything on its own.", `<button class="btn primary" data-act="add-lead">${icon("plus", 14)} Add lead</button>`)}
    <div class="grid kpis" style="margin-bottom:16px">
      ${kpi("New", "users", n("new"), "Not contacted yet")}
      ${kpi("In conversation", "activity", n("qualified") + n("contacted"), openVal ? `${money(openVal)} open value` : "Qualified or contacted")}
      ${kpi("Won", "check", won, "All time")}
      ${kpi("Win rate", "target", won + lost ? Math.round(100 * won / (won + lost)) + "%" : "–", "Won ÷ closed")}
    </div>
    ${S.addingLead ? `<form class="card form" id="lead-form" style="max-width:none;margin-bottom:16px">
      <div class="row2"><label class="field">Name<input type="text" id="l-name" required></label><label class="field">Source<input type="text" id="l-source" placeholder="Website form, phone, Instagram…"></label></div>
      <div class="row2"><label class="field">Email<input type="email" id="l-email"></label><label class="field">Phone<input type="tel" id="l-phone"></label></div>
      <div class="row2"><label class="field">Estimated value ($)<input type="number" id="l-value" min="0" step="1"></label><label class="field">Stage<select id="l-stage">${STAGES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label></div>
      <label class="field">What do they need?<textarea id="l-note" style="min-height:70px"></textarea></label>
      <div style="display:flex;gap:8px"><button class="btn primary" type="submit">Save lead</button><button class="btn ghost" type="button" data-act="cancel-lead">Cancel</button></div></form>` : ""}
    <div class="board">${STAGES.map(([k, l]) => `<section class="col" aria-label="${l}"><div class="col-head">${l}<span>${by(k).length}</span></div>
      ${by(k).map((x) => `<div class="lead"><div class="who"><span class="ws-av" style="width:26px;height:26px;font-size:12px">${esc((x.name || "?")[0].toUpperCase())}</span><b>${esc(x.name)}</b></div>
        ${x.note ? `<p>${esc(x.note)}</p>` : ""}
        <div class="meta">${[x.email && `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>`, x.phone && `<a href="tel:${esc(x.phone)}">${esc(x.phone)}</a>`, x.source && esc(x.source), x.value != null && money(+x.value), fmtShort(x.created_at)].filter(Boolean).join(" · ")}</div>
        <select data-lead-stage="${esc(x.id)}" aria-label="Stage for ${esc(x.name)}">${STAGES.map(([k2, l2]) => `<option value="${k2}" ${x.stage === k2 ? "selected" : ""}>${l2}</option>`).join("")}</select>
        <div style="display:flex;gap:4px;align-items:center;justify-content:space-between"><button class="btn ghost" style="padding:5px 8px" data-act="new-task" data-ws="conversion" data-lead="${esc(x.id)}" title="Draft a follow-up">Draft reply</button>
        <button class="btn ghost danger" style="padding:5px 8px" data-lead-del="${esc(x.id)}" aria-label="Delete ${esc(x.name)}">✕</button></div></div>`).join("") || `<div class="kind" style="padding:4px">No leads</div>`}
    </section>`).join("")}</div>
`;
}

// ---------- Activity ----------
function buildEvents(d) {
  const ev = [];
  d.audits.forEach((a) => ev.push({ at: a.created_at, t: `${a.run_type || "Weekly run"} completed · on-page score ${a.score ?? "–"}${a.prev_score != null ? ` (was ${a.prev_score})` : ""}`, e: "run.completed", c: "ok", i: "pulse" }));
  const grp = (rows, dateKey, keyFn) => { const m = {}; rows.forEach((f) => { if (!f[dateKey]) return; const k = f[dateKey].slice(0, 10) + "|" + keyFn(f); (m[k] ||= { at: f[dateKey], n: 0, f }).n++; if (f[dateKey] > m[k].at) m[k].at = f[dateKey]; }); return Object.values(m); };
  grp(d.fixes.filter((f) => ["deployed", "rolled_back"].includes(f.status)), "deployed_at", (f) => f.status + f.field).forEach((g) => ev.push({ at: g.at, t: `${g.n} ${(FIELD[g.f.field] || g.f.field).toLowerCase()} change${g.n === 1 ? "" : "s"} ${g.f.status === "rolled_back" ? "restored on the platform" : "saved to the platform"}`, e: g.f.status === "rolled_back" ? "fixes.rolled_back" : "fixes.deployed", c: g.f.status === "rolled_back" ? "warn" : "ok", i: "globe" }));
  grp(d.fixes.filter((f) => ["approved", "rejected"].includes(f.status) || (f.status === "deployed" && f.decided_at)), "decided_at", (f) => (f.status === "rejected" ? "r" : "a") + f.field).forEach((g) => ev.push({ at: g.at, t: `${g.n} ${(FIELD[g.f.field] || g.f.field).toLowerCase()} fix${g.n === 1 ? "" : "es"} ${g.f.status === "rejected" ? "rejected" : "approved"}`, e: g.f.status === "rejected" ? "fixes.rejected" : "fixes.approved", c: g.f.status === "rejected" ? "warn" : "", i: "checks" }));
  (d.aeoRuns || []).forEach((r) => ev.push({ at: r.finished_at || r.started_at, t: r.status === "done" ? `AI visibility check finished · named in ${r.summary?.visibility ?? 0}% of answers` : r.status === "running" ? "AI visibility check started" : "AI visibility check failed", e: "aeo." + r.status, c: r.status === "failed" ? "warn" : "", i: "bot" }));
  d.drafts.forEach((x) => { ev.push({ at: x.created_at, t: `Draft created: ${x.title}`, e: "draft.created", i: "file" }); if (x.decided_at) ev.push({ at: x.decided_at, t: `Draft ${x.status === "approved" ? "approved" : "rejected"}: ${x.title}`, e: "draft." + x.status, c: x.status === "approved" ? "ok" : "warn", i: "file" }); });
  // The same pipeline, publishing and verification records the review queue and client view read.
  const titleOf = (id) => d.drafts.find((x) => x.id === id)?.title || "content";
  d.drafts.forEach((x) => {
    if (x.source_draft_id && x.checked_at) ev.push({ at: x.created_at, t: `Samaritan finished an article from a plan: ${x.title}`, e: "work.produced", c: "ok", i: "file" });
    if (x.status === "needs_review" && x.lane === "approval" && x.checked_at) ev.push({ at: x.checked_at, t: `Ready for approval: ${x.title}`, e: "work.ready", c: "ok", i: "checks" });
  });
  const stuck = d.drafts.filter((x) => x.stage === "blocked" && x.gate_at);
  if (stuck.length) ev.push({ at: stuck.map((x) => x.gate_at).sort().pop(), t: `${stuck.length} plan${stuck.length === 1 ? "" : "s"} cannot be published yet. See the production pipeline for each reason.`, e: "work.blocked", c: "warn", i: "file" });
  [...(S.workspace[S.siteId]?.publications || []), ...(S.results[S.siteId]?.page_publications || []), ...(d.publications || [])].forEach((p) => {
    const name = p.snapshot?.title || titleOf(p.draft_id), state = p.verification?.state || (typeof p.verification === "string" ? p.verification : "");
    if (p.published_at) ev.push({ at: p.published_at, t: `Published to Shopify: ${name}`, e: "work.published", c: "ok", i: "globe" });
    if (state && (p.verification?.checked_at || p.published_at)) ev.push({ at: p.verification?.checked_at || p.published_at, t: state === "verified" ? `Checked on the live page: ${name}` : `Live-page check needs review (${String(state).replaceAll("_", " ")}): ${name}`, e: "work." + state, c: state === "verified" ? "ok" : "warn", i: "check" });
    if (["failed", "uncertain", "blocked"].includes(p.status)) ev.push({ at: p.attempted_at || p.created_at || p.published_at, t: `Publishing needs attention: ${name}${p.error ? " · " + p.error : ""}`, e: "work.failed", c: "warn", i: "globe" });
  });
  d.leads.forEach((l) => ev.push({ at: l.created_at, t: `Lead added: ${l.name}`, e: "lead.created", i: "users" }));
  d.tasks.filter((t) => t.decided_at && t.status !== "pending").forEach((t) => ev.push({ at: t.decided_at, t: `Website fix ${t.status === "done" ? "marked done" : "dismissed"}: ${t.kind}`, e: "task." + t.status, c: t.status === "done" ? "ok" : "warn", i: "check" }));
  d.connectors.filter((c) => c.last_checked_at).forEach((c) => ev.push({ at: c.last_checked_at, t: `${CONNECTOR_TYPES[c.type]?.name || c.type} ${c.status === "connected" ? "checked and connected" : "isn't working"}`, e: "integration." + c.status, c: c.status === "connected" ? "ok" : "warn", i: "plug" }));
  ev.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return ev;
}
function activityView(s, d) {
  const ev = buildEvents(d);
  return `${pageHead("", "Activity log", "Everything Impackt Media and you did for this business, newest first.")}
    <div class="card">${ev.length ? `<ul class="timeline">${ev.slice(0, 100).map((x) => `<li><span class="ic ${x.c || ""}">${icon(x.i, 15)}</span><div><b>${esc(x.t)}</b><div class="ev">${esc(x.e)}</div></div><time datetime="${esc(x.at)}">${fmtTime(x.at)}</time></li>`).join("")}</ul>` : `<div class="empty" style="border:0"><b>No activity yet</b>Runs, approvals, drafts and leads show up here.</div>`}</div>`;
}

// ---------- workspace pages ----------
// ---------- channel workspaces ----------
function channelTabs(page,items,selected){return `<nav class="channel-tabs" aria-label="${esc(PAGES[page])} workspace sections">${items.map(([key,label,target,sub])=>`<a href="${href(target||page,sub||key)}" ${selected===key?'aria-current="page"':''}>${esc(label)}</a>`).join('')}</nav>`;}
function channelStats(items){return `<div class="channel-stats">${items.map(([label,value,note])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`).join('')}</div>`;}
function channelSignal(s,d,key){const agent=agentRoster(s,d).find(a=>a.key===key);return `<section class="channel-signal" data-mode="${agent.active?'working':'idle'}"><div class="channel-signal-id">${scanner('channel')}<div><span class="eyebrow">Your dedicated agent</span><h2>${esc(agent.name)}</h2>${systemReadout(agent.state,agent.active?'working':['Needs attention','Check status'].includes(agent.state)?'attention':'idle')}</div></div><dl><div><dt>Now</dt><dd>${esc(agent.now)}</dd></div><div><dt>Next</dt><dd>${esc(agent.next)}</dd></div></dl><a href="${href('team')}">View the whole team →</a></section>`;}
function channelPriorities(title,rows,empty){return `<section class="card channel-priorities"><div class="card-head"><h2>${esc(title)}</h2><span class="kind">Next decisions</span></div>${rows.length?`<ol>${rows.slice(0,4).map((r,i)=>`<li><span class="priority-number">0${i+1}</span><div><h3>${esc(r.title)}</h3><p>${esc(r.detail)}</p></div><a class="btn" href="${href(r.page,r.sub)}">${esc(r.action||'Review')} →</a></li>`).join('')}</ol>`:`<div class="empty"><b>${esc(empty)}</b>Use the channel tools to gather evidence and prepare the next useful action.</div>`}</section>`;}
function channelControls(s,d,kind){
 const types=kind==='seo'?['gsc','shopify','webflow','wordpress','framer','framer_key']:kind==='paid'?['gads','meta']:['shopify','webflow','wordpress'];
 const connections=(d.connectors||[]).filter(c=>types.includes(c.type));
 const rows=kind==='paid'?[['Campaigns','Planning and copy drafting'],['Account execution','Campaign launch and budget changes are not enabled']]:kind==='geo'?[['Checks','Questions are sent to configured, active providers'],['Improvements','Work is prepared for review; task completion is not a visibility gain']]:[['Review','Proposals and drafts require a decision'],['Execution','Available actions depend on the connected platform'],['Verification','Saved website changes are checked separately on the live page']];
 return `<div class="channel-two"><section class="card"><div class="eyebrow">Operating rules</div><h2>How this channel works</h2><dl class="channel-rules">${rows.map(([a,b])=>`<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl><a class="btn" href="${href('connections')}">Manage integrations →</a></section><section class="card"><div class="eyebrow">Connected sources</div><h2>Account status</h2>${kind==='geo'?`<dl class="channel-rules">${Object.entries(S.aeoInfo?.engines||{}).filter(([k])=>aiProviderActive(k)).map(([k,v])=>`<div><dt>${esc(ENGINE_LABEL[k]||k)}</dt><dd>${v.configured&&!v.paused?'Configured':v.paused?'Paused':'Key required'}</dd></div>`).join('')||'<p>Provider status is not available in this snapshot.</p>'}</dl>`:connections.length?`<dl class="channel-rules">${connections.map(c=>`<div><dt>${esc(CONNECTOR_TYPES[c.type]?.name||c.type)}</dt><dd>${esc(c.status)}${c.last_checked_at?' · '+esc(fmtTime(c.last_checked_at)):''}</dd></div>`).join('')}</dl>`:'<p class="muted">No channel connection is recorded.</p>'}<p class="note-line">Agency administrators manage account credentials and execution permissions.</p></section></div>`;
}
function seoChannelView(s,d){
 const sub=['performance','experiments','history','controls'].includes(S.sub)?S.sub:'overview',c=counts(d),g=gsc28(d),audit=d.audits[0];
 const nav=channelTabs('seo',[['overview','Overview'],['queue','Website work','fixes','approve'],['performance','Search performance'],['experiments','Experiments'],['history','Change history'],['controls','Controls']],sub);
 const header=pageHead('Search engine optimization','SEO','Understand the opportunity. Review the work. Verify what changed.',`<a class="btn" href="${href('fixes')}">Review website work →</a>`);
 if(sub==='performance')return header+nav+(connected(d,'gsc')?'<div class="channel-toolbar"><button class="btn" data-act="gsc-sync">Refresh Google data</button></div>':'')+searchView(s,d);
 if(sub==='experiments')return header+nav+searchExperimentsView(s,d);
 if(sub==='history')return header+nav+websiteView(s,d);
 if(sub==='controls')return header+nav+channelControls(s,d,'seo');
 const priorities=d.fixes.filter(readyFix).map(f=>({title:f.page_name||f.url||FIELD[f.field]||'Website proposal',detail:f.note||f.reason||f.after||'Review the proposed website improvement.',page:'fixes'}));
 if(!connected(d,'gsc'))priorities.unshift({title:'Connect the search evidence',detail:'Bring in real queries, clicks and impressions before evaluating search performance.',page:'connections',action:'Connect'});
 if(!audit)priorities.push({title:'Establish the website baseline',detail:'Run a website check to identify specific page improvements.',page:'fixes',action:'Open checks'});
 return header+nav+channelSignal(s,d,'seo')+channelStats([['Awaiting review',c.pendingFixes,'Website proposals'],['Verified live',d.fixes.filter(verifiedLive).length,'Confirmed page changes'],['Search clicks',g?num(g.cur.clicks):'—',g?`${g.cur.days} reported days · through ${fmtDate(g.last)}`:'Connect Search Console'],['Audit coverage',audit?num(audit.page_count||s.checkup?.pages||0):'—',audit?`Latest saved audit · ${fmtDate(audit.created_at)}`:'No completed audit']])+channelPriorities('Your next search priorities',priorities,'Your current proposal queue is clear.')+`<div class="channel-two"><section class="card"><div class="eyebrow">Search intelligence</div><h2>What brings customers to you?</h2><p>Inspect the queries and pages reported by Google, then decide whether to improve an existing destination or prepare useful content.</p><a class="btn" href="${href('seo','performance')}">Explore search performance →</a></section><section class="card"><div class="eyebrow">A complete change record</div><h2>Know what actually changed.</h2><p>See the saved updates, live-page verification and available rollback actions in one history.</p><a class="btn" href="${href('seo','history')}">View change history →</a></section></div>`;
}
function searchExperimentsView(s,d) {
 const state=S.experiments?.[s.id]||{},rows=state.rows||[],draft=S.searchDrafts?.[s.id]||{};
 if(state.error)return `<section class="card"><h2>Search pilots need backend activation</h2><p>The experiment database is not available. Existing SEO safeguards remain active. Contact your agency administrator before preparing a pilot.</p><button class="btn" data-experiment-action="refresh">Check again</button></section>`;
 const field=(name,label,type='text',required=true)=>`<label class="field">${label}<input name="${name}" type="${type}" value="${esc(draft[name]||'')}" ${required?'required':''} maxlength="2000"></label>`;
 const area=(name,label,required=true)=>`<label class="field">${label}<textarea name="${name}" ${required?'required minlength="25"':''} maxlength="2000">${esc(draft[name]||'')}</textarea></label>`;
 const pct=x=>typeof x==='number'&&Number.isFinite(x)?`${x>=0?'+':''}${(x*100).toFixed(1)}%`:'Unavailable';
 return `<section class="card"><div class="card-head"><div><div class="eyebrow">Measure before expanding</div><h2>One page. One reviewed hypothesis.</h2><p>Compare an approved metadata change against an unchanged page. Keep existing work protected while you learn.</p></div><button class="btn" data-experiment-action="refresh">Refresh pilots</button></div><p class="kind">Shopify products and collections · one active pilot per business · 7 settling days + 28 observation days + reporting lag. Comparison results are observational, not causal proof.</p>${state.error?errorBox(state.error):''}<details><summary>Prepare a search pilot</summary><form id="search-experiment-form"><fieldset><legend>1. Choose comparable pages</legend>${field('url','Page to improve','url')}${field('control_url','Comparison page (kept unchanged)','url')}${area('control_rationale','Why are these pages comparable? Consider intent, audience and seasonality.')}</fieldset><fieldset><legend>2. Define the exact change</legend><label class="field">Metadata field<select name="field"><option value="seo.title" ${draft.field==='seo.title'?'selected':''}>Search title</option><option value="seo.description" ${draft.field==='seo.description'?'selected':''}>Meta description</option></select></label>${area('after','Proposed copy')}${field('protected_terms','Existing phrases to preserve (comma-separated)')}${area('hypothesis','What customer problem should this change address?')}${area('rationale','What page evidence justifies this proposal?')}</fieldset><fieldset><legend>3. Record known risks</legend>${area('confounders','Other changes, promotions or seasonal effects (optional)',false)}<p>No live page changes during preparation. Samaritan reads the current metadata and freezes both pages’ search baselines for your review.</p></fieldset><button class="btn primary" type="submit">Prepare evidence & review</button></form></details></section><div class="list" style="margin-top:20px">${rows.map(e=>{
 const x=e.snapshot,f=x.fix,r=e.result||{},deployed=d.fixes.some(v=>v.id===f.id&&v.status==='deployed');
 return `<article class="card"><div class="card-head"><div><span class="pill state">${esc(e.status)}</span><h3>${esc(f.page_name||f.url)}</h3></div><span class="kind">${esc(FIELD[f.field]||f.field)}</span></div><p>${esc(x.hypothesis)}</p><div class="row2"><div><b>Current / original</b><p class="review-copy">${esc(f.before)}</p></div><div><b>Proposed / tested</b><p class="review-copy">${esc(f.after)}</p></div></div><details><summary>Evidence, protected terms & comparison</summary><p>${esc(x.rationale)}</p><p>Protected: ${esc(x.protected_terms.join(', '))}</p><p>Comparison: ${esc(x.control_url)}</p><p>${esc(x.control_rationale)}</p><p>${esc(x.method)}</p><p>Prepared ${esc(fmtTime(x.prepared_at))}. Exact-copy approval expires after 24 hours if not executed.</p><div class="row2">${['treatment','control'].map(k=>{const b=x.baseline[k];return `<div><b>${k==='treatment'?'Treatment':'Comparison'} baseline</b><p>${esc(b.window.startDate)} to ${esc(b.window.endDate)} · ${esc(b.summary.clicks)} clicks · ${esc(b.summary.impressions)} impressions · ${esc(b.summary.returned_days)}/28 returned days.</p></div>`;}).join('')}</div><p>Known confounders: ${esc(x.confounders||'None recorded; this does not establish their absence.')}</p></details>${e.status==='draft'?`<label class="approval-check"><input id="experiment-review-${esc(e.id)}" type="checkbox"> I reviewed the original, proposed copy, baseline and risks. I approve publishing this exact one-page pilot.</label><div class="actions"><button class="btn primary" data-experiment-action="approve" data-id="${esc(e.id)}">Approve & queue pilot</button><button class="btn ghost" data-experiment-action="cancel" data-id="${esc(e.id)}">Cancel draft</button></div>`:''}${e.started_at?`<p>Live verification: ${esc(fmtTime(e.started_at))}. Readout due: ${esc(fmtTime(e.due_at))}.</p>`:''}${r.status?`<h4>${esc(r.status.replaceAll('_',' '))}</h4><p>${esc(r.method||'The full measurement window must finish before a readout.')}</p>${r.treatment_change!==undefined?`<div class="row2"><p>Treatment clicks: <b>${pct(r.treatment_change)}</b></p><p>Comparison clicks: <b>${pct(r.comparison_change)}</b></p></div><p>Comparison-adjusted observed change: ${pct(r.comparison_adjusted_change)}. This is not an incremental revenue or causal uplift estimate.</p>`:''}${(r.flags||[]).map(v=>`<p class="note">${esc(v)}</p>`).join('')}`:''}${['queued','running'].includes(e.status)?`<div class="actions"><button class="btn" data-experiment-action="measure" data-id="${esc(e.id)}">Check live status</button>${e.status==='running'?`<button class="btn ghost" data-experiment-action="stop" data-id="${esc(e.id)}">Stop for review</button>`:''}</div>`:''}${['queued','running','review'].includes(e.status)?`<details><summary>Record a confounder</summary><form class="experiment-note" data-id="${esc(e.id)}"><label class="field">Other edits, promotions, stock changes or measurement issues<textarea name="note" minlength="10" maxlength="1000" required></textarea></label><button class="btn" type="submit">Save observation</button></form><p>${esc(e.review_notes||'No additional observations recorded.')}</p></details>`:''}${e.status==='review'?`<p>Review the evidence and change history before deciding. No automatic expansion.</p><div class="actions"><button class="btn" data-experiment-action="retain" data-id="${esc(e.id)}">${deployed?'Keep change & close pilot':'Close review'}</button>${deployed?`<button class="btn" data-experiment-action="rollback" data-id="${esc(e.id)}">Restore original copy</button>`:''}</div>`:''}</article>`;
 }).join('')||'<div class="empty">No search pilots yet. Prepare a hypothesis when you have a specific opportunity and comparable search evidence.</div>'}</div>`;
}

function geoChannelView(s,d){
 const sub=['answers','plan','controls'].includes(S.sub)?S.sub:'overview',run=lastAeo(d),sum=run?.summary||{},tasks=(d.tasks||[]).filter(t=>t.kind==='AI visibility'&&t.status==='pending');
 const header=pageHead('Generative & answer engine optimization','GEO & AEO','From recorded answers to a practical improvement plan.');
 const nav=channelTabs('geo',[['overview','Overview'],['answers','Answers & questions'],['plan','Improvement plan'],['controls','Providers & controls']],sub);
 if(sub==='answers')return header+nav+aiView(s,d,{includePlan:false});
 if(sub==='plan')return header+nav+visibilityPlan(s,d);
 if(sub==='controls')return header+nav+channelControls(s,d,'geo');
 const readyCard=readinessCard(s,d);
 const success=run?successfulAnswers(run):0;
 const priorities=tasks.map(t=>({title:t.target||'Visibility improvement',detail:'Samaritan investigates this evidence and prepares supported content for approval.',page:'geo',sub:'plan'}));
 if(!run)priorities.push({title:'Build your first answer baseline',detail:'Choose the customer questions to track, then run a check with your configured providers.',page:'geo',sub:'answers',action:'Open checks'});
 return header+nav+readyCard+channelSignal(s,d,'visibility')+(d.aeoReportError?`<div class="banner">${esc(d.aeoReportError)}</div>`:'')+channelStats([['Named in answers',success&&sum.visibility!=null?sum.visibility+'%':'—','Latest completed check · successful answers only'],['Cited as a source',success&&sum.cited!=null?sum.cited+'%':'—','A citation is separate from a visit'],['Answers returned',run?`${success} / ${sum.checks??'—'}`:'—',run?fmtDate(run.finished_at):'No completed check'],['Open improvements',tasks.length,'Evidence in the preparation queue']])+aiAnswerBoard(s)+channelPriorities('Turn the gaps into useful work',priorities,'No open improvement tasks in this snapshot.')+`<div class="channel-two"><section class="card"><div class="eyebrow">Read the evidence</div><h2>What did the AI actually say?</h2><p>Open the recorded answer, named competitors and available citations. See failed checks alongside successful answers.</p><a class="btn" href="${href('geo','answers')}">Inspect answers →</a></section><section class="card"><div class="eyebrow">Close the loop</div><h2>Improve. Recheck. Compare.</h2><p>Use the plan to improve relevant pages or prepare supporting content. Recheck the same customer questions after the work is live.</p><a class="btn" href="${href('geo','plan')}">Open the improvement plan →</a></section></div>`;
}
function paidConsole(s,d){
 const p=S.paid?.[s.id],conns=(d.connectors||[]).filter(c=>['google_ads','meta_ads'].includes(c.type));
 if(p?.error)return errorBox(p.error);
 const rows=p?.reports||[],changes=p?.changes||[],controls=p?.controls||[];
 const money=(v,c)=>new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD',maximumFractionDigits:2}).format(v);
 return `<section class="card"><div class="card-head"><div><div class="eyebrow">Connected campaigns</div><h2>Account performance & controlled changes</h2><p>Last 28 complete days in each account’s time zone. Currency stays separate. Reported spend and clicks do not establish profit or incremental growth.</p></div>${S.isAdmin?'<button class="btn" data-operation="ads_sync">Refresh ad reports</button>':''}</div>${!conns.length?`<div class="empty"><b>Connect an advertising account to begin.</b><p>Authorize Google Ads or Meta Ads, select the account, then sync its campaigns.</p><a class="btn primary" href="${href('connections')}">Open integrations</a></div>`:''}${rows.length?`<div class="tablewrap"><table><thead><tr><th>Campaign</th><th>Status</th><th>Spend</th><th>Clicks</th><th>Reporting period</th>${S.isAdmin?'<th>Prepare a change</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.name)}</b><small>${esc(r.provider==='google_ads'?'Google Ads':'Meta Ads')} · ${esc(r.account_id)}</small></td><td>${esc(r.status)}</td><td>${money(r.spend,r.currency)}</td><td>${num(r.clicks)}</td><td>${esc(r.period_start)} – ${esc(r.period_end)}<small>${esc(r.time_zone)} · synced ${esc(fmtTime(r.observed_at))}</small></td>${S.isAdmin?`<td><button class="btn" data-paid="ads_propose" data-connector="${esc(r.connector_id)}" data-campaign="${esc(r.campaign_id)}" data-target="${r.status==='PAUSED'?(r.provider==='google_ads'?'ENABLED':'ACTIVE'):'PAUSED'}">Review ${r.status==='PAUSED'?'resume':'pause'}</button></td>`:''}</tr>`).join('')}</tbody></table></div>`:conns.length?'<p>No current campaign report. Choose an account in Integrations, then refresh.</p>':''}</section>
 ${S.isAdmin?conns.map(c=>{const control=controls.find(x=>x.connector_id===c.id)||{};return `<details class="card" style="margin-top:16px"><summary>${esc(c.label)} · account ${esc(c.config?.account_id||'not selected')} · change permissions</summary><form class="ad-control-form" data-connector="${esc(c.id)}"><p>These settings govern approved campaign status changes. Pausing Impackt Media jobs does not pause active ads. Daily budget limits check a campaign’s configured budget; they are not a guaranteed platform spending cap.</p><label class="approval-check"><input name="enabled" type="checkbox" ${control.enabled?'checked':''}> Allow individually approved campaign changes</label><label class="approval-check"><input name="resume" type="checkbox" ${control.allow_resume?'checked':''}> Allow approved resumptions that may restart ad spend</label><label class="field">Maximum configured daily budget for resuming (${esc(c.config?.currency||'account currency')})<input name="budget" type="number" min="0" step="0.01" value="${control.max_daily_budget||0}"></label><label class="field">Maximum changes in 24 hours<input name="changes" type="number" min="1" max="10" value="${control.max_changes_per_day||3}"></label><p>Shared or unsupported budgets cannot be resumed. Meta resumption requires a USD campaign-owned daily budget.</p><button class="btn" type="submit">Save account limits</button></form></details>`;}).join(''):''}
 <section class="card" style="margin-top:16px"><h2>Campaign change journal</h2>${changes.map(p=>`<article class="ad-proposal"><b>${esc(p.before?.name||p.campaign_id)}</b><p>Account ${esc(p.account_id)} · ${esc(p.before?.status)} → <strong>${esc(p.after_status)}</strong></p><span class="status">${esc(p.status)}</span>${p.error?`<p role="alert">${esc(p.error)}</p>`:''}${S.isAdmin?`<div class="operation-actions">${p.status==='proposed'?`<button class="btn primary" data-paid="ads_approve" data-connector="${esc(p.connector_id)}" data-change="${p.id}" data-hash="${esc(p.approval_hash)}">Approve this exact change</button><button class="btn" data-paid="ads_reject" data-connector="${esc(p.connector_id)}" data-change="${p.id}">Reject</button>`:''}${['uncertain','applying'].includes(p.status)?`<button class="btn" data-paid="ads_reconcile" data-connector="${esc(p.connector_id)}" data-change="${p.id}">Check provider state</button>`:''}${p.status==='verified'?`<button class="btn" data-paid="ads_reverse" data-connector="${esc(p.connector_id)}" data-change="${p.id}">Prepare reversal for review</button>`:''}${['blocked','approved'].includes(p.status)?`<button class="btn" data-paid="ads_reject" data-connector="${esc(p.connector_id)}" data-change="${p.id}">Withdraw change</button>`:''}</div>`:''}</article>`).join('')||'<p>No campaign changes recorded.</p>'}</section>`;
}
function adAccountPicker(c){const list=S.adAccounts?.[c.id];return `<div class="ad-account-picker"><p>${c.config?.account_id?'Selected account: '+esc(c.config.account_name||c.config.account_id):'Authorization saved. Select the business’s advertising account.'}</p><button class="btn" data-paid="ads_accounts" data-connector="${esc(c.id)}">Load available accounts</button>${list?`<div class="list">${list.map(a=>`<button class="btn" data-paid="${a.manager?'ads_accounts':'ads_select'}" data-connector="${esc(c.id)}" data-account="${esc(a.id)}" data-manager="${esc(a.manager?a.id:a.login_customer_id||'')}">${esc(a.name||a.id)} · ${esc(a.id)} ${a.manager?'— open manager':esc(a.currency||'')}</button>`).join('')||'<p>No accessible accounts returned.</p>'}</div>`:''}${c.config?.expires_at?`<small>Authorization expires ${esc(fmtTime(c.config.expires_at))}</small>`:''}</div>`;}

function paidChannelView(s,d){
 const sub=['economics','creative','controls'].includes(S.sub)?S.sub:'overview',drafts=d.drafts.filter(x=>x.workspace==='ads');
 const header=pageHead('Paid acquisition','Lead generation','Focused campaigns. Clear measurement. Human-led budgets.');
 const nav=channelTabs('paid',[['overview','Refine & measure'],['creative','New campaign'],['controls','Accounts & controls']],sub);
 if(sub==='economics')return header+nav+adsView(s,d);
 if(sub==='creative')return header+nav+leadgenView(s,d);
 if(sub==='controls')return header+nav+paidConsole(s,d);
 return header+nav+`<a class="btn primary" href="${href('paid','creative')}">Prepare a new campaign</a><div style="height:16px"></div>`+measurementSettings(s,d)+paidConsole(s,d)+channelPriorities('Campaign briefs in production',drafts.filter(x=>x.status==='needs_review').map(x=>({title:x.title,detail:x.kind||'Campaign draft',page:'paid',sub:'creative'})),'No campaign drafts awaiting review.');
}
function contentQueue(s,d){
 const w=S.workspace[s.id]||{},topics=w.topics||[],pubs=[...(w.publications||[]),...(S.results[s.id]?.page_publications||[])],jobs=(S.operations?.[s.id]?.jobs||[]).filter(j=>j.channel==='content'),week=Date.now()-7*DAY;
 const running=jobs.filter(j=>operationState(j)==='running'),waiting=reviewGroups(s,d).filter(g=>['content','geo'].includes(g.key)).reduce((n,g)=>n+g.count,0);
 const cells=[['Ideas ready',topics.filter(t=>t.status==='suggested').length,''],['Preparing',running.length,running.length?'live':''],['Needs attention',jobs.filter(j=>['blocked','uncertain'].includes(j.status)&&Date.parse(j.finished_at||j.created_at)>week).length,'warn'],['Awaiting review',waiting,''],['Queued publication',jobs.filter(j=>['blog_publish','page_content_publish'].includes(j.kind)&&j.status==='queued').length,''],['Verified live',pubs.filter(p=>p.status==='published'&&p.verification?.state==='verified').length,'ok']];
 return `<section class="cq" aria-label="Content pipeline">${cells.map(([l,n,tone])=>`<div class="cq-cell ${n&&tone?tone:''}"><strong>${num(n)}</strong><span>${l}</span></div>`).join('<i class="cq-arrow">→</i>')}</section>`;
}
function contentChannelView(s,d){
 const sub=['drafts','publications','rules'].includes(S.sub)?S.sub:'overview',w=S.workspace[s.id],pubs=[...(w?.publications||[]),...(S.results[s.id]?.page_publications||[])],topics=(w?.topics||[]).filter(t=>t.status==='suggested');
 const header=pageHead('Content strategy & production','Content','Business-specific topics, useful drafts and a clear path to publication.',newTaskBtn('seo'));
 const nav=channelTabs('content',[['overview','Editorial overview'],['drafts','Drafts & review'],['publications','Publication history'],['rules','Brand & publishing']],sub);
 if(sub==='drafts')return header+nav+contentQueue(s,d)+contentDraftsView(s,d);
 if(sub==='publications')return header+nav+`<section class="card"><div class="card-head"><h2>Publication history</h2><span class="kind">Actual publishing records</span></div>${w?.error?`<p role="alert">${esc(w.error)}</p>`:''}${pubs.length?`<div class="tablewrap"><table><thead><tr><th>Article</th><th>Status</th><th>Published</th><th>Details</th></tr></thead><tbody>${pubs.map(p=>`<tr><td>${esc(d.drafts.find(x=>x.id===p.draft_id)?.title||p.title||'Content record')}</td><td>${esc(p.status)}</td><td>${p.published_at?esc(fmtTime(p.published_at)):'—'}</td><td>${esc(p.error||p.external_handle||'Awaiting confirmation')}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><b>${w?'No publication records yet.':'Loading publication records…'}</b>Approved drafts appear in history only after a publishing attempt is recorded.</div>`}<p class="note-line">The approved version is preserved in the publishing record. Editing a draft does not update a live article.</p><a class="btn" href="${href('content','drafts')}">Open drafts for review →</a></section>`;
 if(sub==='rules')return header+nav+`<div class="channel-two"><section class="card"><div class="eyebrow">Your business voice</div><h2>Context behind the copy</h2><dl class="channel-rules">${[['Customer',s.profile?.customers||'Add your target customers'],['Goal',s.profile?.goal||'Add your primary business goal'],['Voice',s.brand?.voice||s.profile?.voice||'Set your brand voice'],['Facts',s.brand?.facts||'Add verified product and business details']].map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><a class="btn" href="${href('business')}">Edit business context →</a></section><section class="card"><div class="eyebrow">Publication controls</div><h2>Review the exact version.</h2><p>Direct article publication uses a connected Shopify blog. Choose the destination and approve the complete article before publishing.</p><p>Other website workflows use reviewed copy through their own publishing process.</p><a class="btn" href="${href('connections')}">Manage website connections →</a></section></div>`;
 const day=t=>{const d0=new Date(t);if(!Number.isFinite(d0.getTime()))return '';const k=Math.floor((Date.now()-d0.getTime())/DAY);return k<1?'Prepared today':k<2?'Prepared yesterday':'Prepared '+d0.toLocaleDateString(undefined,{month:'short',day:'numeric'});};
 const ready=d.drafts.filter(x=>x.status==='needs_review').sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 const writing=(w?.topics||[]).filter(t=>t.status==='writing'),fresh=pubs.filter(p=>p.status==='published'&&Date.now()-Date.parse(p.published_at)<14*DAY).sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at))).slice(0,6);
 const list=(rows,empty)=>rows.length?`<ul class="dx-receipts">${rows.join('')}</ul>`:`<p class="dx-muted-t dx-pad">${empty}</p>`;
 const sec=(t,p,body,right='')=>`<section class="dx-sec"><div class="dx-sec-head"><div><h2>${t}</h2><p>${p}</p></div>${right}</div><div class="dx-card">${body}</div></section>`;
 return header+nav+contentQueue(s,d)
  +sec('Ready for your review','New drafts first. Nothing publishes without your yes.',list(ready.slice(0,8).map(x=>`<li><span class="dx-ok" style="background:var(--dx-panel2);color:var(--dx-ink2)">${icon('file',14)}</span><div><b>${esc(x.title)}</b><small>${esc(x.kind)} · ${esc(day(x.created_at))}</small></div><a class="btn sm" href="${href('content','drafts')}">Read</a></li>`),'No drafts are waiting. New ones arrive as Samaritan finishes them.'),ready.length>8?`<a class="dx-link" href="${href('content','drafts')}">All ${ready.length} →</a>`:'')
  +(writing.length?sec('Samaritan is writing','Drafts in progress right now.',list(writing.map(t=>`<li><span class="wl-spin"></span><div><b>${esc(t.title)}</b><small>${esc(t.draft_kind||'Article')} · started ${esc(fmtTime(t.started_at))}</small></div></li>`),'')):'')
  +recommendedTopics(s)
  +sec('Published in the last 14 days','Confirmed on your live site. Older work is in Publication history.',list(fresh.map(p=>`<li><span class="dx-ok">${icon('check',14)}</span><div><b>${esc(d.drafts.find(x=>x.id===p.draft_id)?.title||p.title||'Published content')}</b><small>${esc(fmtTime(p.published_at))}${p.verification?.state==='verified'?' · confirmed live':''}</small></div></li>`),'Nothing published in the last 14 days.'),`<a class="dx-link" href="${href('content','publications')}">Publication history →</a>`);
}
function clientChannelOverview(s,d,kind){
 const seo=kind==='seo',geo=kind==='geo',title=seo?'SEO':geo?'GEO & AEO':'Paid channels';
 const fixes=(d.fixes||[]).filter(readyFix),tasks=(d.tasks||[]).filter(x=>x.kind==='AI visibility');
 const intro=seo?'Website proposals, saved changes and available search evidence.':geo?'Business-specific questions and the work prepared to improve the answers.':'Campaign context and the creative prepared for your business.';
 const rows=seo?fixes.map(f=>({title:f.page_name||f.url||'Website proposal',detail:f.after||'Review the suggested change',page:'fixes'})):geo?tasks.filter(t=>t.status==='pending').map(t=>({title:t.target,detail:t.after,page:'geo',sub:'plan',action:'Open plan'})):(d.drafts||[]).filter(x=>(x.workspace==='ads'||['Ad copy','Campaign brief','Offer ideas'].includes(x.kind))&&x.status==='needs_review').map(x=>({title:x.title,detail:x.kind,page:'content',action:'Read draft'}));
 if(geo&&S.sub==='plan')return pageHead('Client workspace',title,'Your business-specific improvement queue.')+`<a class="btn" href="${href('geo')}">← Channel overview</a><div class="list channel-priorities">${tasks.map(t=>`<article class="card"><h3>${esc(t.target)}</h3><p>${esc(t.after)}</p><span class="kind">${esc(t.status)}</span></article>`).join('')||'<div class="empty">No visibility improvement tasks have been shared.</div>'}</div>`;
 return pageHead('Your channel workspace',title,intro)+channelSignal(s,d,seo?'seo':geo?'visibility':'ads')+channelPriorities(seo?'Website work to review':geo?'Your improvement plan':'Campaign work to review',rows,'No open work shared in this channel.')+`<div class="channel-two"><section class="card"><h2>${seo?'See the search evidence':geo?'Keep the questions connected':'Your campaign access'}</h2><p>${seo?'Available search clicks and impressions are kept separate from the website work.':geo?'Your agency can inspect the recorded AI answers and help explain the tasks shared here.':'Your Impackt Media team · Samaritan manages account access. This workspace does not launch ads or change budgets.'}</p><a class="btn" href="${href(seo?'growth':geo?'geo':'connections',geo?'plan':'')}">${seo?'View search results':geo?'View the full plan':'View integrations'} →</a></section><section class="card"><h2>One shared marketing team.</h2><p>See the recorded work and current status of your Impackt Media agents. Open Your human team to message a marketing specialist.</p><a class="btn" href="${href('team')}">Meet your team →</a></section></div>`;
}

function wsHead(k, actions) { return pageHead("Your operating rhythm", WS[k].label, WS[k].blurb, actions); }
function wsDrafts(d, k) {
  const rows = d.drafts.filter((x) => x.workspace === k);
  const ai = S.aeoInfo?.writer;
  return `<div class="card"><div class="card-head"><h3>Drafts</h3>${newTaskBtn(k)}</div>
    ${rows.length ? `<div class="list">${rows.slice(0, 20).map(draftCard).join("")}</div>` : `<div class="empty" style="border:0;padding:18px"><b>Your work starts here</b>${ai ? `Ask ${esc(ai)} for a first draft in your brand voice, or write one yourself.` : "Write a draft yourself, or add an AI key in Integrations to generate one."}</div>`}
  </div>`;
}
function growthView(s,d) {
 S.links||={};if(!S.links[s.id]){S.links[s.id]=[];loadLinks(s.id).then(()=>{if(S.page==='growth')render();});}
 if(!S.connectInfo&&S.isAdmin&&!growthView.ci){growthView.ci=1;loadConnectInfo().then(()=>{if(S.page==='growth')render();});}
 const tab=({ads:'paid'}[S.sub]||S.sub||'overview');
 const html=window.ImpacktResults.render(S.results[s.id],{name:s.name,href,admin:S.isAdmin,tab,ecommerce:ecommerceSite(s,d),days:S.resultDays,end:S.resultEnd||new Date(Date.now()-DAY).toISOString().slice(0,10)});
 const at=html.indexOf('</nav>',html.indexOf('r-tabs'));if(at<0)return html;
 return html.slice(0,at+6)+setupBar(s,d,tab)+storeSection(s,d,tab)+html.slice(at+6);
}

function fixesView(s, d) {
  if (S.sub === "failed") { S.filter.status = "failed"; S.sub = null; }
  const sub = ["hand", "live"].includes(S.sub) ? S.sub : "approve";
  const c = counts(d), liveN = d.fixes.filter((f) => f.status === "deployed").length;
  const write = siteWrite(s, d);
  const running = ["running", "queued"].includes(s.checkup?.status);
  const actions = `<button class="btn" data-act="checkup" ${running ? "disabled" : ""}>${icon("refresh", 14)} ${running ? "Checking…" : "Check my site now"}</button>`;
  const body = sub === "hand" ? agencyResearch(s,d) : sub === "live" ? websiteView(s, d) : reviewView(s, d);
  const tabs = [...(d.fixes.length || write !== null ? [["approve", "Ready to publish", c.pendingFixes]] : []), ["hand", "Edits", c.openTasks], ["live", "Saved changes", liveN]];
  const cur = write === null && sub === "approve" && !d.fixes.length ? "hand" : sub;
  const bodyFinal = cur === "hand" ? agencyResearch(s,d) : body;
  return `<a class="channel-back" href="${href('seo')}">← SEO overview</a>${pageHead("Website operations", "Website work", write === null ? "Review website findings, inspect proposed changes and verify the work after publication." : "Impackt Media checks your site every week and writes each fix for you. Publish approved changes and check the live-page verification.", actions)}
    ${checkupBanner(s)}
    ${subtabs("fixes", tabs, cur)}${bodyFinal}`;
}
function checkupBanner(s) {
  const c = s.checkup || {};
  if (["running", "queued"].includes(c.status)) return `<div class="banner info"><b>On-page check in progress.</b> ${c.pages || 0} pages checked${c.discovered ? ` of ${c.discovered} discovered` : ""}; ${c.queued || 0} suggestions saved. ${c.stage === "writing" ? "Preparing suggestions from your business rules." : "Continuing through the site."} Progress is saved between batches; you can leave this page.</div>`;
  if (c.status === "failed") return `<div class="banner"><b>The check needs attention:</b> ${esc(c.error || "unknown error")} ${c.checkpoint ? "Progress is saved. Check my site now resumes the unfinished audit." : ""}</div>`;
  if (c.coverage === "partial") return `<div class="banner"><b>Partial audit coverage.</b> ${c.pages || 0} pages checked. ${(c.failures || []).length} fetches failed. ${esc((c.warnings || []).join(" "))} The score describes the pages successfully checked.</div>`;
  return "";
}
function contentDraftsView(s, d) {
  const f = S.contentFilter || "review";
  const content=d.drafts.filter(x=>inScopeDraft(x)&&x.workspace!=='ads');
  const pending=x=>pendingDraft(x,d,s.id);
  const rows=content.filter(x=>S.contentFocus===String(x.id)||f==='all'||f==='review'&&pending(x)||f==='approved'&&!pending(x)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const n=st=>content.filter(x=>st==='needs_review'?pending(x):!pending(x)).length;
  return `    <div class="toolbar"><div class="chips" role="group" aria-label="Status">${[["review", `To read (${n("needs_review")})`], ["approved", `History (${n("approved")})`], ["all", `All (${content.length})`]].map(([k, l]) => `<button class="chip" data-content-filter="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div></div>
    <div class="list">${rows.length ? rows.slice(0, 40).map(draftCard).join("") : `<div class="empty"><b>${f === "review" ? "Nothing to read" : "Nothing here yet"}</b>${S.aeoInfo?.writer ? `Choose a researched topic or request website content and ${esc(S.aeoInfo.writer)} writes a first draft in your voice.` : "Samaritan prepares content when a search opportunity passes the page-level evidence checks. Connect Search Console and refresh the website audit to gather evidence."}<br>${newTaskBtn("seo")}</div>`}</div>`;
}
function searchView(s, d) {
  const gscConn = conn(d, "gsc"), g = gsc28(d);
  if (!g) return `<div class="empty"><b>${gscConn ? "Search Console is added" : "See how people find you on Google"}</b>${gscConn ? (gscConn.status === "connected" ? "The first sync runs every morning, or start it now." : `It isn't working yet: ${esc(gscConn.last_error || "run the test")}.`) : "Connect Search Console to see clicks, impressions, rankings and top queries here."}<br>
      ${gscConn?.status === "connected" ? `<button class="btn primary" data-act="gsc-sync">Sync now</button>` : `<a class="btn primary" href="${href("integrations")}" data-add="gsc">Connect Search Console</a>`}</div>`;
  const { cur, prev, last } = g;
  return `<div class="grid kpis">
      ${kpi("Clicks · 28 days", "search", num(cur.clicks), "From Google Search", deltaTag(cur.clicks, prev?.clicks))}
      ${kpi("Impressions · 28 days", "globe", num(cur.imps), "Times you showed up", deltaTag(cur.imps, prev?.imps))}
      ${kpi("Click-through rate", "target", pct(cur.ctr), "Clicks ÷ impressions", deltaTag(cur.ctr, prev?.ctr))}
      ${kpi("Average position", "activity", cur.pos ? cur.pos.toFixed(1) : "–", "Lower is better", deltaTag(cur.pos, prev?.pos, true))}
    </div>
    <div class="card chart" style="margin-top:14px"><h3>Search performance</h3>
      <div class="legend"><span><i style="background:var(--chart-a)"></i>Clicks</span><span><i style="background:var(--chart-b)"></i>Impressions</span><span>Data through ${fmtDate(last)} · Google reports with a 2-3 day delay</span></div>
      ${lineChart(d.daily.slice(-90))}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3>Top queries · 28 days</h3>${gscTable(d.queries.slice(0, 15), "query")}</div>
      <div class="card"><h3>Top pages · 28 days</h3>${gscTable(d.pages.slice(0, 15).map((p) => ({ ...p, page: p.page.replace(/^https?:\/\/[^/]+/, "") || "/" })), "page")}</div>
    </div>`;
}
function gscTable(rows, key) {
  if (!rows.length) return `<p class="muted">No data yet.</p>`;
  return `<div class="tablewrap"><table><thead><tr><th>${key === "query" ? "Query" : "Page"}</th><th class="n">Clicks</th><th class="n">Impr.</th><th class="n">Pos.</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td class="wrap">${esc(r[key])}</td><td class="n">${num(r.clicks)}</td><td class="n">${num(r.impressions)}</td><td class="n">${r.position.toFixed(1)}</td></tr>`).join("")}
  </tbody></table></div>`;
}
function lineChart(rows) {
  const W = 900, H = 220, P = { l: 44, r: 54, t: 10, b: 26 };
  if (rows.length < 2) return `<p class="muted">Not enough days yet.</p>`;
  const maxC = Math.max(1, ...rows.map((r) => r.clicks)), maxI = Math.max(1, ...rows.map((r) => r.impressions));
  const nice = (m) => { const p = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil(m / p) * p; };
  const yc = nice(maxC), yi = nice(maxI);
  const x = (i) => P.l + (i / (rows.length - 1)) * (W - P.l - P.r);
  const y = (v, m) => P.t + (1 - v / m) * (H - P.t - P.b);
  const path = (k, m) => rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[k], m).toFixed(1)}`).join("");
  const area = path("clicks", yc) + `L${x(rows.length - 1)},${H - P.b}L${x(0)},${H - P.b}Z`;
  const labelIdx = [0, Math.floor(rows.length / 2), rows.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily clicks and impressions">
    ${[0, 0.5, 1].map((t) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t * yc, yc)}" y2="${y(t * yc, yc)}" stroke="var(--line)"/>
      <text x="${P.l - 6}" y="${y(t * yc, yc) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${num(Math.round(t * yc))}</text>
      <text x="${W - P.r + 6}" y="${y(t * yc, yc) + 4}" font-size="11" fill="var(--muted)" font-family="var(--mono)">${num(Math.round(t * yi))}</text>`).join("")}
    <path d="${area}" fill="var(--chart-a)" opacity=".08"/>
    <path d="${path("impressions", yi)}" fill="none" stroke="var(--chart-b)" stroke-width="2"/>
    <path d="${path("clicks", yc)}" fill="none" stroke="var(--chart-a)" stroke-width="2.5"/>
    <circle cx="${x(rows.length - 1)}" cy="${y(rows[rows.length - 1].clicks, yc)}" r="4" fill="var(--chart-a)"/>
    ${labelIdx.map((i, k) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${["start", "middle", "end"][k]}" font-size="11" fill="var(--muted)">${new Date(rows[i].date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}</text>`).join("")}
  </svg>`;
}

// ----- AI visibility (AEO / GEO) -----
function visibilityPlan(s,d) {
 const topics=S.results[s.id]?.topics||S.workspace[s.id]?.topics||[],gaps=(d.tasks||[]).filter(t=>t.kind==='AI visibility'&&t.status==='pending'),policy=S.operations?.[s.id]?.policy;
 return `<section class="card visibility-plan"><div class="card-head"><div><span class="eyebrow">Evidence → preparation → approval</span><h2>From AI search gaps to useful content.</h2><p>Samaritan checks the relevant page and prepares supported content. You review the draft; your agency handles anything that needs more evidence or publishing access.</p></div><a class="btn primary" href="${href('inbox','geo')}">Review prepared content →</a></div><p class="kind">${policy?.paused||!policy?.weekly_content?'Automatic preparation is paused. Your agency manages the schedule in Your team.':'Automatic preparation respects your weekly allowance and limits the waiting queue to two content drafts.'}</p><div class="research-grid">${gaps.slice(0,12).map(t=>{const topic=topics.find(x=>x.source_task_id===t.id),draft=topic?.draft_id&&d.drafts.find(x=>x.id===topic.draft_id);return `<article class="research-card"><span class="status">${draft?draft.status==='needs_review'?'Draft ready for review':'Draft prepared':topic?.status==='writing'?'Preparation started':topic?'Content brief prepared':'Agency research'}</span><h3>${esc(t.target)}</h3><p>${esc(t.before)}</p>${draft?`<a class="btn" href="${href('inbox','geo')}">Read prepared content →</a>`:'<p class="kind">An absent mention does not prove a content gap. Existing pages and business facts are checked first.</p>'}<details><summary>Evidence & research notes</summary><p class="review-copy">${esc(t.note)}</p></details></article>`;}).join('')||'<p class="muted">Research opportunities appear after a completed AI search check. Prepared content will appear in To review.</p>'}</div></section>`;
}
function agencyResearch(s,d){
 const rows=d.tasks.filter(t=>t.status==='pending'&&t.kind!=='AI visibility');
 return `<section class="card"><span class="eyebrow">Agency responsibility</span><h2>Edits</h2><p>Changes your team makes in the site's editor because no connection can publish them. Clients never see this list. Mark one done and Samaritan rechecks the live page.</p>${rows.slice(0,30).map(t=>`<details class="research-detail"><summary>${esc(t.kind)} · ${esc(t.target)}</summary><p>${esc(t.before)}</p><p class="kind">${esc(t.note||'The agency must verify the page and execution route before proposing a change.')}</p></details>`).join('')||'<p>No edits waiting.</p>'}</section>`;
}

function aiView(s, d, {includePlan=true}={}) {
  if (!d.aeoReady) return `<div class="empty"><b>AI visibility data could not be loaded</b>${esc(d.aeoReportError || "Reload in a few minutes.")}</div>`;
  const info = S.aeoInfo?.engines || {};
  const configured = Object.entries(info).filter(([k, e]) => aiProviderActive(k) && e.configured && !e.paused).map(([k]) => k);
  const run = d.aeoRuns[0], done = lastAeo(d);
  const sum = done?.summary || {};
  const previousRun = d.aeoRuns.filter((r) => r.status === "done")[1];
  const prev = comparableAeo(done, previousRun) ? previousRun.summary : null;
  const running = run?.status === "running";
  const progress = running ? `${d.aeoChecks.filter((c) => ["done", "failed"].includes(c.status)).length} of ${d.aeoChecks.length}` : "";
  const engines = [...new Set(d.aeoChecks.filter(c=>aiProviderActive(c.engine)).map((c) => c.engine))];
  const byPrompt = {};
  d.aeoChecks.forEach((c) => { (byPrompt[c.prompt] ||= {})[c.engine] = c; });
  const prompts = d.aeoPrompts;
  const setup = S.aeoInfo && !configured.length ? `<div class="card move" style="margin-bottom:14px"><div class="eyebrow">${icon("bot", 13)} Turn on AI visibility</div><h2>Find out what AI tells your customers.</h2>
    <p>Each weekly checkup asks ChatGPT and Claude the ${prompts.filter((p) => p.active).length || ""} questions below and checks whether ${esc(s.name)} is named, where it ranks against competitors, and whether your site is cited as a source. Add a key for each engine you want tracked.</p>
    <a class="btn primary" href="${href("connections")}">Turn on AI tracking ${icon("arrow", 14)}</a></div>` : "";
  const tick = (c) => {
    if (!c) return `<td class="n muted">·</td>`;
    if (c.status === "pending" || c.status === "working") return `<td class="n muted">…</td>`;
    if (c.status === "failed") return `<td class="n" title="${esc(c.error)}"><span class="pill err">err</span></td>`;
    return `<td class="n"><button class="btn ghost" style="padding:2px 6px" data-check="${esc(c.id)}" title="See the answer">${c.mentioned ? `<span class="pill state">${c.position ? "#" + c.position : "cited"}</span>` : `<span class="muted">no</span>`}</button></td>`;
  };
  const open = S.openCheck && d.aeoChecks.find((c) => c.id === S.openCheck);
  return `${setup}${providerErrorCards(d)}${partialAeo(done) ? `<div class="banner info">Partial coverage: ${successfulAnswers(done)} of ${done.summary.checks} checks returned answers. Percentages exclude failed checks and describe only the active providers that returned answers.</div>` : ""}
    ${includePlan?visibilityPlan(s,d):""}
    ${configured.length ? `<div class="toolbar"><p class="muted" style="margin:0">Tracking ${configured.map((k) => ENGINE_LABEL[k]).join(", ")} on the weekly checkup.${running ? ` Check in progress: ${progress} answers back.` : ""}</p>
      <button class="btn primary" data-act="aeo-run" ${running ? "disabled" : ""}>${running ? "Running…" : "Run check now"}</button></div>` : ""}
    ${done ? `<div class="grid kpis">
      ${kpi("AI visibility", "bot", `${sum.visibility ?? 0}%`, `Answers that name ${esc(s.name)}`, prev ? deltaPts(sum.visibility, prev.visibility) : "")}
      ${kpi("Cited as a source", "globe", `${sum.cited ?? 0}%`, `Answers that link to ${esc(s.domain.replace(/^www\./, ""))}`, prev ? deltaPts(sum.cited, prev.cited) : "")}
      ${kpi("Average position", "target", sum.avgPosition ?? "–", "When named, among competitors")}
      ${kpi("Successful answers", "checks", successfulAnswers(done), `${fmtDate(done.finished_at || done.started_at)}${sum.failed ? ` · ${sum.failed} failed` : ""}`)}
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3>By engine</h3><table><thead><tr><th>Engine</th><th class="n">Named</th><th class="n">Cited</th></tr></thead><tbody>
        ${Object.entries(sum.byEngine || {}).filter(([k])=>aiProviderActive(k)).map(([k, e]) => `<tr><td>${esc(ENGINE_LABEL[k] || k)}</td><td class="n">${e.visibility == null ? "Unavailable" : e.visibility + "%"}</td><td class="n">${e.cited == null ? "Unavailable" : e.cited + "%"}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="card"><h3>Who AI recommends instead</h3>${(sum.competitors || []).length ? `<table><thead><tr><th>Brand</th><th class="n">Share of answers</th></tr></thead><tbody>
        <tr><td><b>${esc(s.name)}</b></td><td class="n"><b>${sum.visibility ?? 0}%</b></td></tr>
        ${sum.competitors.slice(0, 8).map((c) => `<tr><td>${esc(c.name)}</td><td class="n">${c.share}%</td></tr>`).join("")}</tbody></table>` : `<p class="muted">No tracked competitors showed up.</p>`}</div>
    </div>` : configured.length ? `<div class="empty"><b>No completed check yet</b>Click Run check now, or wait for the next weekly checkup.</div>` : ""}
    ${d.aeoRuns.filter((r) => r.status === "done").length > 1 ? `<div class="card chart" style="margin-top:14px"><h3>Visibility by run</h3><p class="kind">Coverage can differ between runs. Partial runs are not used for change alerts.</p>${weekBars(d.aeoRuns.filter((r) => r.status === "done").slice(0, 12).reverse())}</div>` : ""}
    ${open ? `<div class="card" style="margin-top:14px"><div class="toolbar" style="margin-bottom:8px"><h3 style="margin:0">${esc(ENGINE_LABEL[open.engine])}: “${esc(open.prompt)}”</h3><button class="btn ghost" data-act="close-check">Close</button></div>
      <p class="kind" style="margin-top:0">${open.mentioned ? `Named${open.position ? ` at position ${open.position}` : ""}${open.cited ? " and cited" : ""}` : "Not named"}${open.competitors?.length ? ` · Competitors named: ${esc(open.competitors.join(", "))}` : ""}</p>
      <div class="draft-body" style="max-height:420px">${esc(open.answer || "")}</div>
      ${(open.citations || []).length ? `<p class="kind" style="margin:10px 0 4px">Sources the AI used</p><ul style="margin:0;padding-left:18px;font-size:13px">${open.citations.map((c) => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title || c.url)}</a></li>`).join("")}</ul>` : ""}
    </div>` : ""}
    <div class="card" style="margin-top:14px"><h3>Questions tracked (${prompts.filter((p) => p.active).length} active)</h3>
      <div class="tablewrap"><table><thead><tr><th>Question</th><th>Type</th>${engines.map((e) => `<th class="n">${esc(ENGINE_LABEL[e] || e)}</th>`).join("")}<th></th></tr></thead><tbody>
      ${prompts.map((p) => `<tr style="${p.active ? "" : "opacity:.5"}"><td class="wrap">${esc(p.prompt)}</td><td class="kind" style="white-space:nowrap">${esc(p.category)}</td>${engines.map((e) => tick(byPrompt[p.prompt]?.[e])).join("")}
        <td style="white-space:nowrap"><button class="btn ghost" data-prompt-toggle="${esc(p.id)}">${p.active ? "Pause" : "Resume"}</button><button class="btn ghost danger" data-prompt-del="${esc(p.id)}">Delete</button></td></tr>`).join("") || `<tr><td colspan="9" class="muted">No questions yet. Add the questions your customers ask an AI below.</td></tr>`}
      </tbody></table></div>
      <form id="prompt-form" style="display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-top:12px">
        <input type="text" id="p-text" required placeholder="Add a question your customers ask an AI">
        <select id="p-cat">${["Discovery", "Product", "Seasonal", "Comparison", "Trust", "Brand", "Local", "Education"].map((c) => `<option>${c}</option>`).join("")}</select>
        <button class="btn primary" type="submit">Add</button>
      </form>
    </div>`;
}
function weekBars(runs) {
  const W = 900, H = 160, P = 28, bw = Math.min(48, (W - 2 * P) / runs.length - 10);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="AI visibility by week">
    <line x1="${P}" x2="${W - P}" y1="${H - 24}" y2="${H - 24}" stroke="var(--line)"/>
    ${runs.map((r, i) => { const v = r.summary?.visibility || 0; const x = P + i * ((W - 2 * P) / runs.length) + 5; const h = (H - 50) * v / 100;
      return `<rect x="${x}" y="${H - 24 - h}" width="${bw}" height="${h}" rx="4" fill="var(--chart-a)"/><text x="${x + bw / 2}" y="${H - 28 - h}" text-anchor="middle" font-size="11" fill="var(--ink)" font-family="var(--mono)">${v}%</text><text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${new Date(r.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>`; }).join("")}
  </svg>`;
}

// ----- Paid Ads -----
const CALC_DEFAULT = { budget: 1500, cpc: 1.25, cvr: 2.5, aov: 120, margin: 35 };
function adsView(s, d) {
  const c = { ...CALC_DEFAULT, ...store.get("calc:" + s.id, {}) };
  const f = (k, l, step, pre) => `<label class="field">${l}<input type="number" min="0" step="${step}" data-calc="${k}" value="${esc(c[k])}" inputmode="decimal" ${pre ? `aria-label="${l} in ${pre}"` : ""}></label>`;
  return `<div class="grid two" style="margin-bottom:14px">${SOON.map(([k, n, b]) => `<div class="card prov soon"><div class="prov-top"><div class="logo-tile">${LOGO[k]}</div><div><b>${n}</b><div class="kind">Not connected · execution unavailable</div></div></div><p class="prov-blurb">${b}</p></div>`).join("")}</div>
    <div class="card"><div class="card-head"><h3>Campaign calculator</h3><span class="kind">Planning scenario · not observed results</span><span class="kind">Check the unit economics before you spend</span></div>
      <div class="calc"><div class="inputs">${f("budget", "Monthly budget ($)", 50, "$")}${f("cpc", "Cost per click ($)", 0.05, "$")}${f("cvr", "Conversion rate (%)", 0.1)}${f("aov", "Average order value ($)", 1, "$")}${f("margin", "Gross margin (%)", 1)}
        <div style="align-self:end"><button class="btn ghost" data-act="calc-reset">Reset</button></div></div>
        <div class="out" id="calc-out" aria-live="polite"></div></div></div>
    <p class="note-line">Impackt Media doesn't spend money or launch ads. Plan here, draft ad copy in Content, and launch in Google or Meta Ads.</p>`;
}
function calcUpdate() {
  const el = document.getElementById("calc-out"); if (!el) return;
  const v = {}; document.querySelectorAll("[data-calc]").forEach((i) => { v[i.dataset.calc] = parseFloat(i.value) || 0; });
  const clicks = v.cpc ? v.budget / v.cpc : 0, orders = clicks * v.cvr / 100, revenue = orders * v.aov;
  const roas = v.budget ? revenue / v.budget : 0, profit = revenue * v.margin / 100 - v.budget;
  const cpa = orders ? v.budget / orders : null, beCpa = v.aov * v.margin / 100, beRoas = v.margin ? 100 / v.margin : null;
  el.innerHTML = `<div><span>Clicks</span><b>${num(Math.round(clicks))}</b></div><div><span>Orders</span><b>${orders.toFixed(1)}</b></div>
    <div><span>Revenue</span><b>${money(revenue)}</b></div><div><span>ROAS</span><b>${roas.toFixed(2)}x</b></div>
    <div><span>Cost per order</span><b>${money(cpa)}</b></div><div><span>Profit after ad spend</span><b style="color:${profit >= 0 ? "#6ee7b7" : "#fca5a5"}">${money(profit)}</b></div>
    <div class="verdict">${profit >= 0 ? "Profitable on first purchase." : "Loses money on first purchase."} Break-even is ${money(beCpa)} per order, or ${beRoas ? beRoas.toFixed(2) + "x" : "–"} ROAS. Repeat orders improve this.</div>`;
  if (S.siteId) store.set("calc:" + S.siteId, v);
}

// ----- Website -----
function websiteView(s, d) {
  const c = counts(d);
  const delta = s.prev_score != null && s.score != null ? s.score - s.prev_score : null;
  const shop = connected(d, "shopify");
  const run = d.audits[0];
  const live = d.fixes.filter((f) => ["deployed", "rolled_back", "rollback_requested"].includes(f.status)).sort((a, b) => String(b.deployed_at || "").localeCompare(String(a.deployed_at || "")));
  return `<div class="card head">
      ${gauge(s.score)}
      <div style="min-width:0"><h3 style="font-size:18px;margin:0">${esc(s.domain.replace(/^www\./, ""))}</h3><div class="domain">${esc(s.platform)} · On-page checks</div>
        ${s.headline ? `<p class="headline">${esc(s.headline)}</p>` : ""}
        <div class="facts"><span>Score ${delta != null ? `<span class="delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : ""}${delta}</span>` : "<b>baseline</b>"}</span><span>Last run <b>${fmtDate(s.last_run_at)}</b></span><span>Next run <b>${fmtDate(s.next_run_at)}</b></span><span>Approved changes <b>${shop ? "processed every 10 minutes" : "require a connected publishing platform"}</b></span></div></div>
      <div></div>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3>Latest run${run ? ` · ${fmtDate(run.created_at)}` : ""}</h3>
        ${run ? `<p class="kind" style="margin:0">${esc(run.run_type || "Run")} · health ${run.score}${run.prev_score != null ? ` (was ${run.prev_score})` : ""}</p><ul class="highlights">${(run.highlights || []).map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : `<p class="muted">No runs yet. The first on-page check fills this in.</p>`}</div>
      <div class="card"><h3>Waiting on you</h3><table><tbody>
        <tr><td><a href="${href("fixes")}">Fixes to approve</a></td><td class="n">${c.pendingFixes}</td></tr>
        <tr><td><a href="${href("fixes", "hand")}">Edits</a></td><td class="n">${c.openTasks}</td></tr>
        <tr><td>Changes verified on the live site</td><td class="n">${d.fixes.filter(verifiedLive).length}</td></tr>
      </tbody></table></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Weekly checkups</h3>
      ${d.audits.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Run</th><th class="n">Health</th><th>What happened</th></tr></thead><tbody>
      ${d.audits.map((a) => `<tr><td style="white-space:nowrap">${fmtDate(a.created_at)}</td><td>${esc(a.run_type || "Run")}</td><td class="n">${a.score ?? "–"}${a.prev_score != null ? ` <span class="muted">(${a.prev_score})</span>` : ""}</td><td>${(a.highlights || []).length ? esc(a.highlights[0]) : a.applied?.meta != null ? `${a.applied.meta} meta, ${a.applied.alt} alt` : ""}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="muted">No runs yet.</p>`}</div>
    <div class="card" style="margin-top:14px"><div class="toolbar"><h3>Saved changes (${live.length})</h3><button class="btn" data-act="verify-saved">Check saved changes</button></div>
      <p class="muted" style="margin-top:0">Platform saves and live-page verification are tracked separately. A mismatch may mean a theme or SEO app renders a different value. Rollback restores the recorded original and is verified separately.</p>
      ${live.length ? `<div class="tablewrap"><table><thead><tr><th>Page</th><th>Change</th><th>Before</th><th>After</th><th>Verification</th><th>When</th><th></th></tr></thead><tbody>
      ${live.slice(0, S.showN).map((f) => `<tr><td class="wrap">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.page_name)}</a>` : esc(f.page_name)}</td><td>${esc(FIELD[f.field] || f.field)}</td><td class="wrap muted">${esc((f.restore ?? f.before) || "(empty)")}</td><td class="wrap">${esc(f.after)}</td><td>${verificationBadge(f)}<button class="btn ghost" data-verify="${esc(f.id)}">Recheck</button></td><td style="white-space:nowrap">${fmtShort(f.deployed_at)}</td>
        <td>${f.status === "deployed" && f.restore != null ? `<button class="btn ghost" data-fix="rollback_requested" data-id="${esc(f.id)}">Roll back</button>` : f.status === "rolled_back" ? `<span class="pill state">Rolled back</span>` : f.status === "rollback_requested" ? `<span class="pill state">Rollback queued</span>` : ""}</td></tr>`).join("")}
      </tbody></table></div>${live.length > S.showN ? `<div class="more"><button class="btn" data-act="more">Show more</button></div>` : ""}` : `<p class="muted">No changes recorded yet.</p>`}</div>
`;
}

// ----- Conversion -----
function conversionView(s, d) {
  const n = (st) => d.leads.filter((l) => l.stage === st).length;
  const won = n("won"), lost = n("lost");
  const openVal = d.leads.filter((l) => ["new", "qualified", "contacted"].includes(l.stage)).reduce((a, l) => a + (+l.value || 0), 0);
  return `${wsHead("conversion", `<a class="btn" href="${href("leads")}">Open pipeline</a>${newTaskBtn("conversion")}`)}
    <div class="grid kpis">
      ${kpi("New leads", "users", n("new"), "Not contacted yet")}
      ${kpi("In conversation", "activity", n("qualified") + n("contacted"), openVal ? `${money(openVal)} in open value` : "Qualified or contacted")}
      ${kpi("Won", "check", won, "All time")}
      ${kpi("Win rate", "target", won + lost ? Math.round(100 * won / (won + lost)) + "%" : "–", "Won ÷ closed")}
    </div>
    <div style="margin-top:14px">${wsDrafts(d, "conversion")}</div>
    <p class="note-line">Automatic messaging, calls and calendar booking aren't connected. Drafts are ready to copy into your email or text app.</p>`;
}

// ----- Integrations -----
// One-click authorization through Nango: the business signs in to its own tools; agents then use those connections.
async function nangoCall(body){const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${CFG.supabaseUrl}/functions/v1/nango`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,apikey:CFG.supabaseAnonKey},body:JSON.stringify({site_id:S.siteId,...body})});const j=await r.json().catch(()=>({}));if(!r.ok&&j.code!=='not_configured')throw new Error(j.error||`Request failed (${r.status})`);return {...j,status:r.status};}
async function loadNango(sid=S.siteId){(S.nango||={});if(S.nango[sid]?.loading)return;S.nango[sid]={...(S.nango[sid]||{}),loading:true};try{const j=await nangoCall({action:'status'});S.nango[sid]={configured:!!j.configured,integrations:j.integrations||[],connections:j.connections||[]};}catch(e){S.nango[sid]={error:e.message,integrations:[],connections:[]};}if(S.siteId===sid&&['integrations','connections'].includes(S.page))render();}
function nangoSection(s){
  const n=S.nango?.[s.id];if(!n||n.loading&&!n.integrations)return `<section class="card nango-sec" aria-busy="true"><div class="card-head"><h3>Authorize more tools</h3></div><div class="nango-skel"><i></i><i></i><i></i></div></section>`;
  if(n.error)return `<section class="card nango-sec"><div class="card-head"><h3>Authorize more tools</h3></div><p class="muted">Couldn't load your tools: ${esc(n.error)}</p></section>`;
  const live=(n.connections||[]).filter(c=>c.status!=='revoked'),byKey=new Map(live.map(c=>[c.provider_config_key,c]));
  if(!n.configured)return S.isAdmin?`<section class="card nango-sec"><div class="card-head"><h3>Authorize more tools</h3><span class="pill">Not turned on</span></div><p class="muted">Let clients sign in to HubSpot, Meta, Calendly and 600+ other tools right here, so Samaritan can read and act on them. Add a <b>NANGO_SECRET_KEY</b> Edge Function secret from your Nango Cloud environment and set Nango's webhook URL to <span class="mono">${esc(CFG.supabaseUrl)}/functions/v1/nango</span>. The tools you enable in Nango appear here automatically.</p></section>`:'';
  if(!n.integrations.length)return S.isAdmin?`<section class="card nango-sec"><div class="card-head"><h3>Authorize more tools</h3></div><p class="muted">Nango is on, but no integrations are enabled yet. Add them in your Nango dashboard and they appear here.</p></section>`:'';
  return `<section class="card nango-sec"><div class="card-head"><h3>Authorize more tools</h3><span class="kind">${live.filter(c=>c.status==='connected').length} authorized · sign in once, Samaritan does the rest</span></div><div class="nango-grid">${n.integrations.map(i=>{const c=byKey.get(i.key),ok=c?.status==='connected',bad=c?.status==='error',busy=S.busy.has('ng:'+i.key);return `<div class="nango-item ${ok?'on':''}" data-integration="${esc((i.name+' '+i.provider).toLowerCase())}" data-integration-status="${ok?'connected':bad?'attention':'available'}">${i.logo?`<img src="${esc(i.logo)}" alt="" width="28" height="28" loading="lazy">`:`<span class="logo-tile">${icon('plug')}</span>`}<div><b>${esc(i.name)}</b><small>${ok?`Authorized${c.connected_by?' by '+esc(c.connected_by):''}`:bad?esc(c.error||'Authorization failed'):'Not authorized'}</small></div>${ok?(S.isAdmin?`<button class="btn" data-nango-remove="${esc(i.key)}" data-conn="${esc(c.connection_id)}">Disconnect</button>`:`<span class="pill ok">Connected</span>`):`<button class="btn primary" data-nango-connect="${esc(i.key)}" ${busy?'disabled':''}>${busy?'Opening…':bad?'Try again':'Authorize'}</button>`}</div>`;}).join('')}</div></section>`;
}
function loadNangoUI(){if(window.ImpacktNango)return Promise.resolve();return loadNangoUI.p||=new Promise((ok,no)=>{const sc=document.createElement('script');sc.src='/nango-connect.js';sc.onload=ok;sc.onerror=()=>{loadNangoUI.p=null;no(new Error('Could not load the sign-in window'));};document.head.appendChild(sc);});}
async function nangoConnect(key){const sid=S.siteId;S.busy.add('ng:'+key);render();try{const [j]=await Promise.all([nangoCall({action:'session',integration:key}),loadNangoUI()]);if(!j.token)throw new Error(j.error||'Could not start authorization');window.ImpacktNango.open(j.token,(ev)=>{if(ev?.type==='connect'){toast('Authorized. Samaritan can use it now.');setTimeout(()=>loadNango(sid),1500);setTimeout(()=>loadNango(sid),6000);}if(ev?.type==='close'){S.busy.delete('ng:'+key);render();}});}catch(e){toast(e.message);}finally{S.busy.delete('ng:'+key);render();}}
function integrationsView(s, d) {
  const has = (t) => d.connectors.some((c) => c.type === t);
  const addable = s.platform === "shopify" ? ["shopify", "gsc"] : s.platform === "wordpress" ? ["wordpress", "gsc"] : ["framer", "gsc"];
  const info = S.aeoInfo;
  const keyLink = { chatgpt: "https://platform.openai.com/api-keys", gemini: "https://aistudio.google.com/apikey", claude: "https://console.anthropic.com/settings/keys" };
  return `${pageHead("Your connected business", "Integrations", "Connect the tools your business runs on. See what Impackt Media can read, improve and measure from each connection.")}
    ${operationsHealth(s)}<div class="integration-toolbar"><label>Find an integration<input type="search" id="integration-search" placeholder="Search tools or capabilities" aria-controls="integration-catalog"></label><label>Show<select id="integration-filter"><option value="all">All integrations</option><option value="connected">Connected</option><option value="available">Available to connect</option><option value="attention">Needs attention</option><option value="planned">Not enabled</option></select></label><span class="kind">${d.connectors.filter(c=>c.status==='connected').length} connected sources</span></div>
    ${S.adding ? `<div class="card" style="margin-bottom:16px">${addConnectorForm(s, S.adding)}</div>` : ""}
    <div class="prov-grid" id="integration-catalog">
      ${Object.keys(PROVIDERS).filter(k=>k!=="framer"||s.platform==="framer"||!d.connectors.some(c=>c.type==="framer")).map(k=>provCard(k,s,d)).join('')}
      ${SOON.map(([k,n,b])=>`<div class="card prov soon" data-integration="${esc((n+' '+b).toLowerCase())}" data-integration-status="planned"><div class="prov-top"><div class="logo-tile">${LOGO[k]||icon('plug')}</div><div><b>${esc(n)}</b><div class="kind">Not enabled for this workspace</div></div></div><p class="prov-blurb">${esc(b)}</p></div>`).join('')}
    </div><p id="integration-empty" hidden>No integrations match. Try another search or filter.</p>
    ${nangoSection(s)}
    ${s.platform !== "framer" && (d.connectors.some((c) => c.type === "framer") || !["shopify", "wordpress", "woocommerce", "webflow"].includes(s.platform)) ? `<div class="card-head" style="margin:22px 0 10px"><h3 style="font-size:16px">Website reading</h3>${platformOf(s).mode === "read" && s.platform !== "wordpress" ? `<span class="kind">${esc(platformOf(s).name)} uses public-page reading here. Add a supported project connection above to enable provider-native edits.</span>` : ""}</div>
    <div class="list">${d.connectors.filter((c) => c.type === "framer").map(connCard).join("") || `<div class="card conn"><div class="conn-icon crawl">W</div><div style="min-width:0"><b>Website reading</b><div class="kind">${CONNECTOR_TYPES.framer.blurb}</div></div><button class="btn" data-add="framer">Set up</button></div>`}</div>` : ""}
    <details class="card" style="margin-top:24px"><summary>Agency settings · AI engines</summary><div class="card-head" style="margin:16px 0 10px"><h3 style="font-size:16px">AI engines</h3><span class="kind">Shared by every workspace</span></div>
    <div class="card">${info ? `<p class="muted" style="margin-top:0">Add each key as an <a href="https://supabase.com/dashboard/project/egtvvunkdkpqmfafhkjg/functions/secrets" target="_blank" rel="noopener">Edge Function secret in Supabase</a> under the name shown. Impackt Media picks it up on the next check, no redeploy needed.</p>
      <div class="tablewrap"><table><thead><tr><th>Engine</th><th>Used for</th><th>Secret name</th><th>Status</th><th></th></tr></thead><tbody>
      ${Object.entries(info.engines || {}).filter(([k,e])=>aiProviderActive(k)&&!e.paused).map(([k, e]) => `<tr><td><b style="font-weight:600">${esc(e.label)}</b></td><td class="kind">AI visibility${k === "claude" || k === "chatgpt" ? " · drafting" : ""}</td><td class="mono" style="font-size:12px">${esc(e.secret)}</td><td>${e.configured ? `<span class="status ${e.lastStatus === "done" ? "done" : ""}">${e.lastStatus === "done" ? "Last check succeeded" : e.lastStatus === "failed" ? "Last check failed" : "Key saved · untested"}</span>${e.lastError ? `<div class="kind" style="max-width:380px">${esc(e.lastError)}</div>` : ""}` : `<span class="status">Not set</span>`}</td><td><a href="${keyLink[k]}" target="_blank" rel="noopener">Get key ↗</a></td></tr>`).join("")}
      </tbody></table></div>
      <p class="kind" style="margin-bottom:0">${info.writer ? `Drafts are written by ${esc(info.writer)}.` : "Add an Anthropic or OpenAI key to turn on AI drafting."} Provider usage is billed separately. A saved key does not guarantee available credits or model access.</p>` : `<p class="muted">Checking…</p>`}</div>
    </details>`;
}
function providerKeys(s, d) {
  const has = (t) => d.connectors.some((c) => c.type === t);
  const keys = ["google"];
  if (s.platform === "shopify" || has("shopify")) keys.push("shopify");
  if (["wordpress", "woocommerce"].includes(s.platform) || has("wordpress")) keys.push("wordpress");
  if (s.platform === "webflow" || has("webflow")) keys.push("webflow");
  if (s.platform === "framer" || has("framer_key")) keys.push("framer");
  if (s.platform === "netlify" || has("netlify")) keys.push("netlify");
  return keys;
}
function provCard(k, s, d) {
  if(["framer","netlify"].includes(k)) { const P=PROVIDERS[k],c=d.connectors.find(x=>x.type===k),write=c?.config?.writeEnabled,ok=c?.status==="connected";return `<div class="card prov ${ok?"is-on":""}" data-integration="${esc((P.name+" "+P.blurb).toLowerCase())}" data-integration-status="${ok?"connected":c?"attention":"available"}"><div class="prov-top"><div class="logo-tile">${LOGO[P.logo]||icon("globe",26)}</div><div><b>${P.name}</b><div class="kind">${P.sub}</div></div><span class="pill ${ok?"ok":""}">${ok?(write?"Project connected":"Website reader connected"):"Not connected"}</span></div><p class="prov-blurb">${esc(P.blurb)}</p>${window.ImpacktWebsites.card(k,c)}</div>`; }
  const P = PROVIDERS[k], c = d.connectors.find((x) => x.type === P.type);
  const det = c?.config?.detail || {};
  const ok = c?.status === "connected", bad = c && c.status === "error";
  const pill = ok ? `<span class="pill ok">${k === "google" && !c.config.lastSync ? "Authorized · sync pending" : "Connected"}</span>` : bad ? `<span class="pill warn">Needs attention</span>` : c ? `<span class="pill">Almost done</span>` : `<span class="pill">Not connected</span>`;
  const busy = S.busy.has("o:" + k) || (c && S.busy.has("c:" + c.id));
  let info = "";
  if (!c && k === "google" && S.connectInfo?.pending?.some(a => a.site_id === s.id)) info = "Google sign-in was started, but authorization has not returned to Impackt Media. Connect again and finish Google's consent screens.";
  if (c && k === "google") info = [c.config.account && `Signed in as ${c.config.account}`, c.config.property && `Property: ${c.config.property}`, c.config.lastSync && `Synced ${fmtTime(c.config.lastSync)}`, !c.config.auth && "Using the service account"].filter(Boolean).join(" · ");
  if (c && k === "shopify") info = [det.shopName || c.config.shop, c.config.auth === "oauth" ? "Installed as the Impackt Media app" : "Using an access token", c.config.auth === "oauth" && !(c.config.scopes || []).includes("read_orders") ? "Reconnect to show sales" : ""].filter(Boolean).join(" · ");
  if (c && k === "wordpress") info = [c.config.url, det.user && `Signed in as ${det.user}`, det.seoPlugin && `SEO plugin: ${det.seoPlugin}`].filter(Boolean).join(" · ");
  let extra = "";
  if (!c && k === "shopify") extra = `<label class="field prov-field">Store address<input type="text" id="o-shop" placeholder="your-store.myshopify.com" value="${s.id === "hwd" ? "halalworlddepot.myshopify.com" : ""}"></label>`;
  
  if (c && k === "webflow") info = [det.siteName || c.config.siteName, c.config.domain, "Connected as the Impackt Media app"].filter(Boolean).join(" · ");
  if (c && k === "framer") info = [c.config.url, "Read-only website access"].filter(Boolean).join(" · ");
  if (!c && k === "wordpress") extra = `<label class="field prov-field">Site address<input type="url" id="o-wp" value="https://${esc(s.domain)}"></label>`;
  if (c && k === "google" && !c.config.property) {
    const props = S.gscProps[c.id];
    if (!props) { loadGscProps(c.id); extra = `<p class="kind">Loading your Search Console properties…</p>`; }
    else extra = props.length ? `<form class="prov-field" id="prop-form" data-conn="${esc(c.id)}"><label class="field">Which property is ${esc(s.domain)}?<select id="o-prop">${props.map((p) => `<option value="${esc(p.property)}">${esc(p.property)}</option>`).join("")}</select></label><button class="btn primary" type="submit">Use this property</button></form>`
      : `<p class="kind">This Google account has no Search Console access for ${esc(s.domain)}. Reconnect with the Google account that owns it.</p>`;
  }
  const connectLabel = k === "google" ? "Connect with Google" : `Connect ${P.name}`;
  const actions = k === "framer"
    ? (c ? `<button class="btn" data-conn-test="${esc(c.id)}" ${busy?"disabled":""}>Test website</button><button class="btn ghost danger" data-conn-del="${esc(c.id)}">Disconnect</button>`
         : `<button class="btn primary" data-add="framer">Connect website</button>`)
    : c
    ? `<button class="btn" ${['google_ads','meta_ads'].includes(c.type)?'data-paid="ads_accounts" data-connector="'+esc(c.id)+'"':'data-conn-test="'+esc(c.id)+'"'} ${busy ? "disabled" : ""}>${busy ? "Checking…" : "Test"}</button><button class="btn ghost" data-oauth="${k}" ${busy ? "disabled" : ""}>Reconnect</button><button class="btn ghost danger" data-conn-del="${esc(c.id)}">Disconnect</button>`
    : `<button class="btn primary" data-oauth="${k}" ${busy ? "disabled" : ""}>${busy ? "Opening…" : connectLabel} ${icon("arrow", 13)}</button>${P.manual ? `<button class="linkish" data-add="${P.manual[0]}">${P.manual[1]}</button>` : ""}`;
  return `<div class="card prov ${ok ? "is-on" : ""}" data-integration="${esc((P.name+' '+P.sub+' '+P.blurb).toLowerCase())}" data-integration-status="${ok?'connected':c?'attention':'available'}">
    <div class="prov-top"><div class="logo-tile">${LOGO[P.logo]}</div><div style="min-width:0"><b>${P.name}</b><div class="kind">${P.sub}</div></div>${pill}</div>
    <p class="prov-blurb">${info ? esc(info) : P.blurb}</p>
    ${bad && c.last_error ? `<div class="note err">${esc(c.last_error)}</div>` : c && !ok && !bad && c.last_error ? `<div class="note">${esc(c.last_error)}</div>` : ""}
    ${extra}${c&&k==='google'&&c.config.auth==='oauth'?analyticsPicker(c):''}${c&&['google_ads','meta_ads'].includes(k)?adAccountPicker(c):''}
    <div class="prov-actions">${actions}</div>
  </div>`;
}
// ----- Impackt Media apps (owner only): register Impackt Media once with each platform -----
const APP_STEPS = {
 meta:{name:'Meta',logo:'meta',time:'App setup and permission review',steps:red=>['Create a Meta developer app for Impackt Media with Marketing API and Facebook Login.','Register the callback URL:'+red,'Request ads_read and ads_management. Client accounts require the appropriate Advanced Access and app review.','Save the app ID and app secret below.'],note:'Authorize a business account through Integrations after app setup.'},
  google: { name: "Google", logo: "google", time: "About 10 minutes", steps: (red) => [
    `Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud</a> and create a project called <b>Impackt Media</b>.`,
    `Enable the <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noopener">Search Console API</a>. Enable the Google Analytics Data API and Google Analytics Admin API for traffic reporting.`,
    `In <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener">Google Auth Platform</a> click <b>Get started</b>: app name Impackt Media, audience <b>External</b>. Then <b>Clients → Create client → Web application</b> with this redirect URI:${red}`,
    `Paste the Client ID and Client secret below.`], note: "Until Google verifies the app, up to 100 Google accounts can connect. Add them under Audience → Test users, or submit for verification from the same page." },
  shopify: { name: "Shopify", logo: "shopify", time: "About 10 minutes", steps: (red) => [
    `In the <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noopener">Shopify Dev Dashboard</a> click <b>Create app</b> and name it <b>Impackt Media</b>.`,
    `In the app version set the App URL to <span class="mono">${esc(S.connectInfo?.appUrl || location.origin + "/app/")}</span>, add this redirect URL:${red}and paste these scopes: <span class="mono">read_products, write_products, read_content, write_content, read_files, write_files, read_online_store_navigation, write_online_store_navigation, read_orders</span>. Click <b>Release</b>.`,
    `Under <b>Distribution</b> pick <b>Public distribution</b> so any store can install Impackt Media with one click. (Custom distribution works for a single store while Shopify reviews the app.)`,
    `Paste the Client ID and Secret below.`], note: "Shopify reviews public apps before live stores can install them (usually a few days to a couple of weeks). Until then, development stores connect right away. If you need a live store connected sooner, a second app with Custom distribution for that one store works immediately." },
  webflow: { name: "Webflow", logo: "webflow", time: "About 5 minutes", steps: (red) => [
    `In Webflow open <b>Workspace settings → Apps &amp; Integrations → Develop</b> and click <b>Create an app</b> named <b>Impackt Media</b>.`,
    `Turn on <b>Data client</b>, add this redirect URI:${red}and tick <span class="mono">sites:read, pages:read, pages:write, cms:read</span>.`,
    `Paste the Client ID and Client secret below.`], note: "" },
};
function appsView(s, d) {
  if (!S.isAdmin) return `<div class="empty"><b>Owner only</b></div>`;
  if (!S.platformApps) { loadPlatformApps(); return `${pageHead("", "Impackt Media apps", "")}<p class="muted">Loading…</p>`; }
  const info = S.connectInfo || {};
  const copy = (v) => `<div class="copy" style="margin:6px 0"><code>${esc(v)}</code><button class="btn" type="button" data-copy="${esc(v)}">Copy</button></div>`;
  const order = Object.keys(APP_STEPS).sort((a, b) => (b === S.appsFocus) - (a === S.appsFocus));
  return `${pageHead("Owner only", "Impackt Media apps", "Register Impackt Media once with each platform. After that, every business connects in one click: Connect, approve, done. Your customers never see this page.")}
    <div class="card"><h3>Google Ads setup</h3><p>Use the saved Google OAuth app. Enable Google Ads API in that Cloud project and obtain production API access. Add this additional authorized redirect URI:</p>${copy(info.redirects?.google_ads||location.origin+'/connect/callback/google_ads')}<p>Search Console consent does not grant Ads access. Connect Google Ads separately in Integrations.</p></div><div class="list">${order.map((k) => {
      const A = APP_STEPS[k], row = S.platformApps.find((r) => r.provider === k), ok = !!(row?.client_id && row?.has_secret) || info.providers?.[k];
      return `<div class="card setup-panel ${S.appsFocus === k ? "" : ""}" id="app-${k}" style="${ok ? "background:var(--surface)" : ""}">
        <div class="prov-top"><div class="logo-tile">${LOGO[A.logo]}</div><div><b>${A.name}</b><div class="kind">${ok ? "Ready. Businesses can connect in one click." : `${A.time}, once`}</div></div>${ok ? `<span class="pill ok">Ready</span>` : `<span class="pill">Not set up</span>`}</div>
        ${ok && S.appsOpen !== k ? `<div style="margin-top:10px"><button class="linkish" data-apps-open="${k}">Update credentials</button></div>` : `
        <ol class="steps">${A.steps(copy(info.redirects?.[k==='meta'?'meta_ads':k] || "")).map((x) => `<li>${x}</li>`).join("")}</ol>
        <form class="form app-form" data-provider="${k}" style="max-width:none"><div class="row2">
          <label class="field">Client ID<input type="text" name="cid" required autocomplete="off" value="${esc(row?.client_id || "")}"></label>
          <label class="field">Client secret<span class="hint">${row?.has_secret ? "Saved. Leave blank to keep it." : "Stored encrypted. Never shown again."}</span><input type="password" name="csec" ${row?.has_secret ? "" : "required"} autocomplete="off"></label></div>
          <div><button class="btn primary" type="submit">Save ${A.name} app</button></div></form>
        ${A.note ? `<p class="kind" style="margin:10px 0 0">${A.note}</p>` : ""}`}
      </div>`; }).join("")}</div>`;
}
async function loadPlatformApps() {
  if (loadPlatformApps.busy) return; loadPlatformApps.busy = true;
  const { data } = await sb.rpc("admin_platform_apps"); S.platformApps = data || [];
  if (!S.connectInfo) await loadConnectInfo();
  loadPlatformApps.busy = false;
  if (S.page === "apps") render();
}
function setupPanel(k) {
  const info = S.connectInfo || {};
  const red = info.redirects?.[k] || "";
  const copy = (v) => `<div class="copy" style="margin-top:6px"><code>${esc(v)}</code><button class="btn" type="button" data-copy="${esc(v)}">Copy</button></div>`;
  const secrets = `<a href="https://supabase.com/dashboard/project/egtvvunkdkpqmfafhkjg/functions/secrets" target="_blank" rel="noopener">Supabase → Edge Function secrets</a>`;
  const body = k === "google" ? `<ol class="steps">
      <li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud</a> and create a project called <b>Impackt Media</b> (or pick the one you already made).</li>
      <li>Enable the <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noopener">Search Console API</a> and the <a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com" target="_blank" rel="noopener">Google Analytics Data API</a>.</li>
      <li>Open <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener">Google Auth Platform</a> → <b>Get started</b>. App name <b>Impackt Media</b>, your email as support email, audience <b>External</b>. Under <b>Audience → Test users</b>, add the Google accounts you'll connect with.</li>
      <li>Go to <b>Clients → Create client → Web application</b>, name it Impackt Media, and add this under <b>Authorized redirect URIs</b>:${copy(red)}</li>
      <li>Copy the <b>Client ID</b> and <b>Client secret</b> into ${secrets} as <span class="mono">GOOGLE_CLIENT_ID</span> and <span class="mono">GOOGLE_CLIENT_SECRET</span>.</li>
      <li>Come back and click <b>Check again</b>.</li></ol>`
    : k === "webflow" ? `<ol class="steps">
      <li>In Webflow open <b>Workspace settings → Apps &amp; Integrations → Develop</b> and click <b>Create an app</b>. Name it <b>Impackt Media</b>.</li>
      <li>Turn on <b>Data client (REST API)</b> and add this <b>Redirect URI</b>:${copy(red)}</li>
      <li>Tick these scopes: <span class="mono">sites:read, pages:read, pages:write, cms:read</span>, then create the app.</li>
      <li>Copy the <b>Client ID</b> and <b>Client secret</b> into ${secrets} as <span class="mono">WEBFLOW_CLIENT_ID</span> and <span class="mono">WEBFLOW_CLIENT_SECRET</span>.</li>
      <li>Come back and click <b>Check again</b>.</li></ol>`
    : `<ol class="steps">
      <li>Open the <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noopener">Shopify Dev Dashboard</a> and click <b>Create app</b>. Name it <b>Impackt Media</b>.</li>
      <li>In the version settings set <b>App URL</b> to:${copy(info.appUrl || location.origin)}and add this under <b>Redirect URLs</b>:${copy(red)}</li>
      <li>Under <b>Scopes</b> paste:${copy("read_products,write_products,read_content,write_content,read_files,write_files,read_online_store_navigation,write_online_store_navigation,read_orders")}Then click <b>Release</b>.</li>
      <li>Under <b>Distribution</b> choose <b>Custom distribution</b> and enter your store's .myshopify.com address.</li>
      <li>From <b>Settings</b>, copy the <b>Client ID</b> and <b>Secret</b> into ${secrets} as <span class="mono">SHOPIFY_CLIENT_ID</span> and <span class="mono">SHOPIFY_CLIENT_SECRET</span>.</li>
      <li>Come back and click <b>Check again</b>.</li></ol>`;
  return `<div class="card setup-panel" style="margin-bottom:18px"><div class="prov-top"><div class="logo-tile">${LOGO[PROVIDERS[k].logo]}</div><div><b>One-time setup: register Impackt Media with ${PROVIDERS[k].name}</b><div class="kind">About 10 minutes, once. After this every workspace connects in one click.</div></div></div>
    ${body}
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" data-act="setup-recheck">Check again</button><button class="btn ghost" data-act="setup-close">Close</button></div></div>`;
}
function connCard(c) {
  const T = CONNECTOR_TYPES[c.type] || CONNECTOR_TYPES.framer;
  const det = c.config?.detail || {};
  const what = c.type === "shopify" ? c.config.shop : c.type === "wordpress" ? c.config.url : c.type === "gsc" ? c.config.property : c.config.url;
  const info = c.type === "shopify" && det.shopName ? `Store: ${det.shopName}` : c.type === "wordpress" && det.user ? `Signed in as ${det.user} · SEO plugin: ${det.seoPlugin}` : c.type === "gsc" && det.permission ? `Access: ${det.permission}${c.config.lastSync ? ` · last sync ${fmtTime(c.config.lastSync)}` : ""}` : det.title ? `Page title: ${det.title}` : "";
  const busy = S.busy.has("c:" + c.id);
  return `<div class="card conn"><div class="conn-icon ${T.cls}">${T.icon}</div>
    <div style="min-width:0"><b>${esc(T.name)}</b> <span class="kind mono">${esc(what)}</span>
      <div class="kind"><span class="status-dot ${esc(c.status)}"></span>${c.status === "connected" ? "Connected" : c.status === "error" ? "Not working" : "Not tested yet"}${c.last_checked_at ? ` · checked ${fmtTime(c.last_checked_at)}` : ""}${info ? ` · ${esc(info)}` : ""}</div>
      ${c.status === "error" && c.last_error ? `<div class="note err">${esc(c.last_error)}</div>` : ""}</div>
    <div class="actions"><button class="btn" ${['google_ads','meta_ads'].includes(c.type)?'data-paid="ads_accounts" data-connector="'+esc(c.id)+'"':'data-conn-test="'+esc(c.id)+'"'} ${busy ? "disabled" : ""}>${busy ? "Testing…" : "Test"}</button>${c.type !== "gsc" && c.type !== "framer" ? `<button class="btn ghost" data-conn-key="${esc(c.id)}">Replace key</button>` : ""}<button class="btn ghost danger" data-conn-del="${esc(c.id)}">Remove</button></div>
  </div>`;
}
function addConnectorForm(s, type) {
  if(["netlify","framer"].includes(type))return window.ImpacktWebsites.form(s,type);
  const head = `<h3>Connect ${esc(CONNECTOR_TYPES[type].name)}</h3>`;
  const actions = `<div style="display:flex;gap:8px"><button class="btn primary" type="submit" id="conn-save">Save and test</button><button class="btn ghost" type="button" data-act="cancel-add">Cancel</button></div>`;
  if (type === "shopify") return `${head}<form class="form" id="conn-form" data-type="shopify">
    <ol class="steps"><li>In Shopify admin open <b>Settings → Apps and sales channels → Develop apps</b> and create an app called "Impackt Media".</li>
    <li>Under <b>Admin API scopes</b> tick: <span class="mono">read_products, write_products, read_content, write_content, read_files, write_files, write_online_store_navigation</span>.</li>
    <li>Install the app, then reveal and copy the <b>Admin API access token</b> (starts with <span class="mono">shpat_</span>).</li></ol>
    <label class="field">Store address<span class="hint">The .myshopify.com address</span><input type="text" id="f-shop" required placeholder="your-store.myshopify.com" value="${s.id === "hwd" ? "halalworlddepot.myshopify.com" : ""}"></label>
    <label class="field">Admin API access token<span class="hint">Stored encrypted in Supabase Vault. It never shows on this page again.</span><input type="password" id="f-secret" required autocomplete="off" placeholder="shpat_…"></label>
    ${actions}</form>`;
  if (type === "wordpress") return `${head}<form class="form" id="conn-form" data-type="wordpress">
    <ol class="steps"><li>In WordPress open <b>Users → Profile → Application Passwords</b>.</li><li>Name it "Impackt Media", click <b>Add New Application Password</b> and copy it.</li></ol>
    <label class="field">Site address<input type="url" id="f-url" required placeholder="https://example.com" value="https://${esc(s.domain)}"></label>
    <label class="field">WordPress username<input type="text" id="f-user" required autocomplete="off"></label>
    <label class="field">Application password<span class="hint">Stored encrypted in Supabase Vault.</span><input type="password" id="f-secret" required autocomplete="off"></label>
    ${actions}</form>`;
  if (type === "gsc") {
    const info = S.gscInfo;
    if (!info) return `${head}<p class="muted">Checking Search Console setup…</p>`;
    if (!info.configured) return `${head}<div class="banner">Search Console needs a one-time Google setup before any workspace can connect.</div>
      <ol class="steps"><li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud</a> and create a project called "Impackt Media".</li>
      <li>Enable the <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noopener">Google Search Console API</a> for it.</li>
      <li>Go to <b>IAM &amp; Admin → Service accounts</b>, create one named "pulse", open it, then <b>Keys → Add key → JSON</b>. A .json file downloads.</li>
      <li>In Supabase open <a href="https://supabase.com/dashboard/project/egtvvunkdkpqmfafhkjg/functions/secrets" target="_blank" rel="noopener">Edge Function secrets</a>, add <span class="mono">GSC_SERVICE_ACCOUNT</span> and paste the whole file's contents as the value.</li>
      <li>Come back here and click Check again.</li></ol>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" data-act="gsc-recheck">Check again</button><button class="btn ghost" data-act="cancel-add">Cancel</button></div>`;
    const opts = (S.gscList || []).filter((p) => p.permission !== "siteUnverifiedUser");
    return `${head}<ol class="steps"><li>In <a href="https://search.google.com/search-console/users" target="_blank" rel="noopener">Search Console → Settings → Users and permissions</a> for ${esc(s.domain)}, click <b>Add user</b>.</li>
      <li>Paste this email and give it <b>Full</b> permission:<div class="copy" style="margin-top:6px"><code>${esc(info.email)}</code><button class="btn" type="button" data-copy="${esc(info.email)}">Copy</button></div></li>
      <li>Pick the property below. If it's not listed yet, click Refresh after adding the user.</li></ol>
      <form class="form" id="conn-form" data-type="gsc" style="margin-top:12px">
        <label class="field">Search Console property
          ${opts.length ? `<select id="f-prop" required>${opts.map((p) => `<option value="${esc(p.property)}" ${p.property.includes(s.domain.replace(/^www\./, "")) ? "selected" : ""}>${esc(p.property)} (${esc(p.permission)})</option>`).join("")}</select>`
          : `<input type="text" id="f-prop" required placeholder="sc-domain:${esc(s.domain.replace(/^www\./, ""))}" value="sc-domain:${esc(s.domain.replace(/^www\./, ""))}"><span class="hint">No properties shared with Impackt Media yet. Add the user above, then Refresh.</span>`}
        </label>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit" id="conn-save">Save and test</button><button class="btn" type="button" data-act="gsc-refresh">Refresh list</button><button class="btn ghost" type="button" data-act="cancel-add">Cancel</button></div>
      </form>`;
  }
  return `${head}<form class="form" id="conn-form" data-type="framer">
    <p class="muted" style="margin:0">Impackt Media reads the live site (sitemap and pages) every week. It can't edit ${esc(s.platform)} sites, so fixes land in All tasks.</p>
    <label class="field">Site address<input type="url" id="f-url" required value="https://${esc(s.domain)}"></label>${actions}</form>`;
}

// ----- Business profile -----
function profileView(s) {
  const p = s.profile || {}, b = s.brand || {};
  return `${pageHead("", "Business details", "Impackt Media uses these in every fix, draft and AI check, to guide your suggestions. Review important claims and business rules before publishing.")}
    <form class="card form" id="profile-form" style="max-width:780px">
      <div class="row2"><label class="field">Business name<input type="text" id="pf-name" required value="${esc(s.name)}"></label><label class="field">Industry<input type="text" id="pf-industry" value="${esc(p.industry || "")}" placeholder="Online halal butcher"></label></div>
      <div class="row2"><label class="field">Website<input type="text" id="pf-domain" required value="${esc(s.domain)}"></label><label class="field">Platform<select id="pf-platform">${Object.entries(PLATFORMS).map(([x, P]) => `<option value="${x}" ${s.platform === x || (x === "other" && !PLATFORMS[s.platform]) ? "selected" : ""}>${esc(P.name)}</option>`).join("")}</select></label></div>
      <label class="field">Who are your customers?<textarea id="pf-customers" style="min-height:70px">${esc(p.customers || "")}</textarea></label>
      <label class="field">Your growth goal<input type="text" id="pf-goal" value="${esc(p.goal || "")}"></label>
      <label class="field">What you sell and key facts<span class="hint">Shipping rules, guarantees, what makes you different. These guide suggestions; review important claims before publishing.</span><textarea id="pf-facts">${esc(b.facts || "")}</textarea></label>
      <label class="field">Brand voice<input type="text" id="pf-voice" value="${esc(b.voice || p.voice || "")}"></label>
      <div class="row2"><label class="field">Keywords<span class="hint">Comma separated</span><input type="text" id="pf-keywords" value="${esc((b.keywords || []).join(", "))}"></label><label class="field">Words to avoid<span class="hint">Comma separated</span><input type="text" id="pf-banned" value="${esc((b.bannedWords || []).join(", "))}"></label></div>
      <label class="field">Rules<span class="hint">One per line</span><textarea id="pf-rules">${esc((b.rules || []).filter(r=>r!==p.market_rule).join("\n"))}</textarea></label>
      <div><button class="btn primary" type="submit">Save profile</button></div>
    </form>`;
}

// ----- New workspace -----
const marketKeys=["description","industry","customers","model","locations","service","shipping","enrollment"];
function marketFields(values={}){
 const field=(key,label,hint="",long=false,required=false)=>`<label class="field">${label}${hint?`<small class="muted">${hint}</small>`:""}${long?`<textarea name="${key}" maxlength="2000" ${required?"required":""}>${esc(values[key]||"")}</textarea>`:`<input name="${key}" maxlength="550" value="${esc(values[key]||"")}">`}</label>`;
 return field("description","Business description","What do you offer, and to whom?",true,true)+`<div class="row2">${field("industry","Industry")}${field("customers","Customers or audience")}</div>`+field("model","How do you operate?","For example, online delivery, storefronts, service calls, campuses, or a combination.")+'<details class="intake-areas"><summary>Locations and service coverage</summary><div>'+field("locations","Physical locations","One store, office or campus per line. Include the city and state, and a location page if available.",true)+field("service","Areas you serve","Where you provide local services. Leave blank if this does not apply.")+field("shipping","Shipping or delivery coverage","Include regions and exclusions that customers need to know.")+field("enrollment","Enrollment area","For schools, include confirmed districts, residency rules or other enrollment boundaries.")+'</div></details>';
}
function marketValues(form){return Object.fromEntries(marketKeys.map(k=>[k,form.elements[k].value.trim()]));}
function marketDomain(value){
 const url=new URL(/^https?:\/\//i.test(value)?value:"https://"+value);
 if(url.username||url.password||url.port||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(url.hostname))throw Error("Enter a public website address.");
 return url.hostname;
}
async function suggestMarket(form){
 const status=form.querySelector("[role=status]"), input=form.elements.domain;
 let domain;try{domain=marketDomain(input.value.trim())}catch(e){status.textContent=e.message;return;}
 if(form.dataset.lookup===domain)return;
 form.dataset.lookup=domain;
 const originals={...marketValues(form),name:form.elements.businessName?.value||""};
 status.textContent="Reading the website for business details…";
 try{
  const {data,error}=await sb.functions.invoke("business-intake",{body:{domain,site:form.dataset.site||null}});
  if(!form.isConnected||marketDomain(input.value.trim())!==domain||form.dataset.lookup!==domain)return;
  if(error){
    const body=await error.context?.json?.().catch(()=>null);
    throw Error(body?.error||"Website lookup is unavailable. Retry or fill in the profile below.");
  }
  for(const key of [...marketKeys,"name"]){const el=form.elements[key==="name"?"businessName":key];if(el&&data[key]&&!originals[key]&&!el.value){el.value=data[key];el.dataset.suggested=data[key];}}
  status.textContent="Review the suggestions and fill any gaps. Pages checked: "+data.sources.map(u=>new URL(u).hostname+new URL(u).pathname).join(" · ");
 }catch(err){if(form.isConnected&&form.dataset.lookup===domain){delete form.dataset.lookup;status.textContent=err.message||"Enter the details below, or retry the lookup.";}}
}
function resetSuggested(form){delete form.dataset.lookup;for(const el of form.elements){if(el.dataset.suggested&&el.value===el.dataset.suggested)el.value="";delete el.dataset.suggested;}form.querySelector("[role=status]").textContent="";}
let intakeTimer;
document.addEventListener("input",e=>{
 if(e.target.id!=="s-domain")return;
 const form=e.target.form;clearTimeout(intakeTimer);resetSuggested(form);
 intakeTimer=setTimeout(()=>{if(form.isConnected&&form.elements.domain.value.includes("."))suggestMarket(form);},900);
});
document.addEventListener("change",e=>{if(e.target.id==="s-domain"&&e.target.value.trim())suggestMarket(e.target.form);});
document.addEventListener("click",async e=>{
 const lookup=e.target.closest("[data-market-lookup]");if(lookup){suggestMarket(lookup.form);return;}
 const open=e.target.closest("[data-market-open]");if(!open||document.querySelector("#market-dialog"))return;
 const site=S.siteId,dlg=document.createElement("dialog");dlg.id="market-dialog";dlg.innerHTML='<button class="btn" autofocus>Close</button><p role="status">Loading business profile…</p>';document.body.append(dlg);dlg.querySelector("button").onclick=()=>dlg.close();dlg.addEventListener("close",()=>dlg.remove(),{once:true});dlg.showModal();
 const {data,error}=await sb.rpc("read_intake_profile",{p_site:site});
 if(!dlg.open)return;if(error||!data){dlg.querySelector("p").textContent="Could not load this business profile.";return;}
 dlg.innerHTML=`<form class="form" data-site="${esc(site)}"><h2>Confirm your business profile</h2><p>Review the details Samaritan uses to plan work for ${esc(data.name)}.</p><label class="field">Website<input name="domain" readonly value="${esc(data.domain)}"></label><button class="btn" type="button" data-market-lookup>Find missing details</button><p role="status"></p>${marketFields({...data,...data.market})}<div><button class="btn primary">Confirm profile</button> <button class="btn" type="button" data-close>Close</button></div></form>`;
 const form=dlg.querySelector("form");form.querySelector("[data-close]").onclick=()=>dlg.close();
 if(!data.market)suggestMarket(form);
 form.onsubmit=async ev=>{ev.preventDefault();ev.stopPropagation();const value=marketValues(form),button=form.querySelector(".primary");button.disabled=true;const {error}=await sb.rpc("confirm_intake_profile",{p_site:site,p_input:value,p_revision:data.revision||null});if(error){button.disabled=false;form.querySelector("[role=status]").textContent=error.message;return;}dlg.close();await loadSites();render();toast("Business profile confirmed");};
});
// Data access for the guided onboarding (onboarding.js renders; everything that touches Supabase stays here).
function prefillAsk(prompt){
 const until=Date.now()+8000;
 (function tryFill(){const el=document.querySelector("#samaritan-page textarea");if(!el){if(Date.now()<until)setTimeout(tryFill,150);return;}
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(el,prompt);el.dispatchEvent(new Event("input",{bubbles:true}));el.focus();el.setSelectionRange(prompt.length,prompt.length);})();
}
async function saveSiteProfile(sid,update){
 const {data,error}=await sb.from("sites").select("profile").eq("id",sid).single();if(error)throw error;
 const profile=update(data?.profile||{});
 const {error:e2}=await sb.from("sites").update({profile}).eq("id",sid);if(e2)throw e2;
 const s=siteById(sid);if(s)s.profile=profile;
}
const onboardingCtx={
 userId:()=>S.session?.user?.id,
 sites:()=>S.sites,
 marketDomain,
 platforms:PLATFORMS,
 scanner,
 wordmark:()=>wordmark("#/agency"),
 async intake(domain){
  const {data,error}=await sb.functions.invoke("business-intake",{body:{domain,site:null}});
  if(error){const body=await error.context?.json?.().catch(()=>null);throw Error(body?.error||"Website lookup is unavailable.");}
  return data||{};
 },
 async createSite({domain,name,platform,market}){
  const pick=k=>String(market?.[k]||"").trim();
  let sid=domain.replace(/^www\./,"").split(".")[0].toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,24)||"site";
  if(S.sites.some(x=>x.id===sid))sid+="-"+Math.random().toString(36).slice(2,5);
  const {error}=await sb.from("sites").insert({id:sid,name,domain,platform,mode:"review",brand:{name},profile:{industry:pick("industry"),customers:pick("customers"),market:Object.fromEntries(["description","model","locations","service","shipping","enrollment"].map(k=>[k,pick(k)])),market_revision:crypto.randomUUID(),onboarding:"guided"},sort_order:S.sites.length+1,next_run_at:nextMonday()});
  if(error)throw Error("Could not create the workspace: "+error.message);
  await loadSites();
  engine("checkup",{site_id:sid}).catch(()=>{}); // the durable queue is saved with the business
  return sid;
 },
 saveProfile:saveSiteProfile,
 async gscConnector(sid){const {data,error}=await sb.from("connectors").select("id,type,config,status,last_error").eq("site_id",sid).eq("type","gsc").order("created_at",{ascending:false}).limit(1);if(error)throw error;return data?.[0]||null;},
 async connectInfo(){if(!S.connectInfo)await loadConnectInfo();return S.connectInfo;},
 async gscProperties(cid){return ((await engine("gsc_list",{connector_id:cid})).sites||[]).filter(p=>p.permission!=="siteUnverifiedUser");},
 async googleAuthUrl(sid,hash){return (await connectFn("start",{provider:"google",site_id:sid,return_to:location.origin+location.pathname+hash})).url;},
 async setProperty(cid,property){
  const {data,error}=await sb.from("connectors").select("config").eq("id",cid).single();if(error)throw error;
  const {error:e2}=await sb.from("connectors").update({config:{...(data?.config||{}),property},last_error:null}).eq("id",cid);if(e2)throw e2;
  const r=await engine("test",{connector_id:cid});if(!r.ok)throw Error(r.error||"Search Console did not accept this property.");
 },
 syncGoogle,
 async searchData(sid){
  const since=new Date(Date.now()-92*DAY).toISOString().slice(0,10);
  const [q,dl]=await Promise.all([sb.from("gsc_queries").select("period_end,query,clicks,impressions,ctr,position").eq("site_id",sid).order("period_end",{ascending:false}).order("impressions",{ascending:false}).limit(250),sb.from("gsc_daily").select("date,clicks,impressions,ctr,position").eq("site_id",sid).gte("date",since).order("date")]);
  if(q.error)throw q.error;if(dl.error)throw dl.error;
  const rows=q.data||[],latest=rows[0]?.period_end;
  return {queries:rows.filter(r=>r.period_end===latest),daily:dl.data||[]};
 },
 finish(sid,prompt){delete S.data[sid];S.siteId=sid;go(`#/w/${encodeURIComponent(sid)}/${prompt?"ask":"today"}`);if(prompt)prefillAsk(prompt);},
 saveAnswers(sid,patch){const at=new Date().toISOString();return saveSiteProfile(sid,p=>({...p,...(patch.attribution?{attribution:{...patch.attribution,at}}:{}),...(patch.seo_level?{seo_level:patch.seo_level}:{}),...(patch.onboarded?{onboarded_at:at}:{})}));},
 exitHref:()=>"#/agency",
};
// Business owners who signed up themselves: same journey from Search Console on, through owner-scoped endpoints.
const ownerOnboardingCtx={
 ...onboardingCtx, owner:true,
 wordmark:()=>wordmark("#/"),
 async gscConnector(sid){const {data,error}=await sb.rpc("client_workspace",{p_site:sid});if(error)throw error;return (data?.connectors||[]).find(c=>c.type==="gsc")||null;},
 async gscProperties(){return [];},
 async setProperty(){throw Error("Choose the property from Connections.");},
 syncGoogle:sid=>signupFn("sync_google",{site_id:sid}),
 searchData:sid=>signupFn("search_summary",{site_id:sid}),
 saveAnswers:(sid,patch)=>signupFn("profile",{site_id:sid,patch}),
 exitHref:sid=>`#/w/${encodeURIComponent(sid)}/today`,
};
function addSiteView(){
 S.newPlatform="other";
 return `${pageHead("Agency workspace","Add a client","Welcome the business to Impackt. Confirm its context, connect the relevant accounts, then work with Samaritan.")}<p class="muted"><a href="#/onboarding">Prefer the guided onboarding with Samaritan →</a></p><form class="intake-sheet form" id="site-form"><section class="intake-panel"><h2>Start with their website</h2><div class="intake-url"><label class="field">Public website<input name="domain" id="s-domain" required inputmode="url" placeholder="example.com"></label><button type="button" class="btn" data-market-lookup>Read website</button></div><p class="intake-status" role="status" aria-live="polite">Use the published website your customers visit.</p></section><section class="intake-panel"><h2>Review the business profile</h2><div class="row2"><label class="field">Business name<input id="s-name" name="businessName" required autocomplete="organization"></label><label class="field">Website platform<select id="s-platform">${Object.entries(PLATFORMS).map(([k,v])=>`<option value="${k}" ${k==="other"?"selected":""}>${esc(v.name)}</option>`).join("")}</select></label></div>${marketFields()}</section><footer><button class="btn primary" type="submit">Confirm profile & meet Samaritan</button></footer></form>`;

}


// ----- New task modal -----
function modalHTML() {
  const m = S.modal, ai = S.aeoInfo?.writer;
  if(m.mode==='copy')return `<div class="modal-bg"><section class="modal form" role="dialog" aria-modal="true" aria-labelledby="copy-heading"><h2 id="copy-heading">Copy ${m.html?'article HTML':'draft'}</h2><p>Your browser blocked automatic copying. The complete text is selected below; use your device’s Copy command.${m.html?' Paste it into your CMS HTML editor.':''}</p><label class="field">${m.html?'HTML source':'Draft text'}<textarea id="copy-source" readonly style="min-height:260px">${esc(m.text)}</textarea></label><button class="btn primary" data-act="close-modal">Done</button></section></div>`;
  const lead = m.lead && S.data[S.siteId]?.leads.find((l) => l.id === m.lead);
  return `<div class="modal-bg" data-act="modal-bg"><form class="modal form" id="task-form" role="dialog" aria-modal="true" aria-labelledby="mt-h" style="max-width:620px">
    <div><h2 id="mt-h">New task</h2><p class="muted" style="margin:0">Drafts go to the Review queue. Nothing is published or sent.</p></div>
    <div class="seg" role="group" aria-label="How to create it"><button type="button" data-mode="ai" aria-pressed="${m.mode === "ai"}" ${ai ? "" : "disabled title=\"Add an Anthropic or OpenAI key in Integrations\""}>${icon("sparkle", 13)} Generate with ${esc(ai || "AI")}</button><button type="button" data-mode="manual" aria-pressed="${m.mode === "manual"}">Write it myself</button></div>
    ${!ai ? `<div class="banner info" style="margin:0">AI drafting turns on when you add an Anthropic or OpenAI key in <a href="${href("connections")}" data-act="close-modal">Connections</a>.</div>` : ""}
    <div class="row2"><label class="field">Workspace<select id="mt-ws">${Object.entries(WS).map(([k, w]) => `<option value="${k}" ${m.ws === k ? "selected" : ""}>${w.label}</option>`).join("")}</select></label>
      <label class="field">Type<select id="mt-kind">${(DRAFT_KINDS[m.ws] || DRAFT_KINDS.seo).map((k) => `<option ${m.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></label></div>
    <label class="field">Title<input type="text" id="mt-title" ${m.mode === "manual" ? "required" : ""} value="${esc(m.title || (lead ? `Follow-up to ${lead.name}` : ""))}" placeholder="${m.mode === "ai" ? "Optional, Impackt Media names it for you" : "A practical guide to…"}"></label>
    ${m.mode === "ai"
      ? `<label class="field">What do you need?<span class="hint">Impackt Media adds your business profile, voice and rules automatically.${m.kind==='Blog post'?' Articles also research source links and relevant website pages.':''}</span><textarea id="mt-brief" required style="min-height:120px" placeholder="e.g. A 900-word guide to buying zabiha halal lamb for Eid, targeting 'halal lamb online'">${esc(m.brief || (lead ? `Reply to ${lead.name}${lead.note ? `, who wrote: "${lead.note}"` : ""}. Be helpful and suggest a clear next step.` : ""))}</textarea></label>`
      : `<label class="field">Draft<textarea id="mt-body" required style="min-height:200px">${esc(m.body || "")}</textarea></label>`}
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" type="button" data-act="close-modal">Cancel</button><button class="btn primary" type="submit" id="mt-save">${m.mode === "ai" ? "Generate draft" : "Send to review"}</button></div>
  </form></div>`;
}
function openModal(ws, lead) {
  const w = ws || (WS[S.page] ? S.page : "seo");
  S.modal = { ws: w, kind: DRAFT_KINDS[w][0], mode: S.aeoInfo?.writer ? "ai" : "manual", lead };
  render(); document.getElementById(S.modal.mode === "ai" ? "mt-brief" : "mt-title")?.focus();
}
function syncModal() {
  if (!S.modal) return;
  const v = (id) => document.getElementById(id)?.value;
  Object.assign(S.modal, { ws: v("mt-ws") ?? S.modal.ws, kind: v("mt-kind") ?? S.modal.kind, title: v("mt-title") ?? S.modal.title, brief: v("mt-brief") ?? S.modal.brief, body: v("mt-body") ?? S.modal.body });
}

document.addEventListener('click',async e=>{const button=e.target.closest('[data-analytics]');if(!button||!S.isAdmin)return;const sid=S.siteId,identity=S.session?.user?.id;button.disabled=true;try{const result=await engine('analytics_'+button.dataset.analytics,{site_id:sid});if(S.session?.user?.id!==identity)return;if(result.properties){S.analyticsProps||={};S.analyticsProps[button.dataset.connector]=result.properties;}else await loadSite(sid);if(sid===S.siteId)render();toast(result.properties?'Analytics properties loaded.':'Analytics report refreshed.');}catch(err){toast(err.message);button.disabled=false;}});
document.addEventListener('submit',async e=>{
 const form=e.target;if(!form.matches('.leadgen-prepare,.leadgen-save,.analytics-select,.ads-measurement'))return;e.preventDefault();e.stopImmediatePropagation();if(!S.isAdmin)return;
 const sid=S.siteId,identity=S.session?.user?.id,button=form.querySelector('button[type=submit],button:not([type])'),fields=new FormData(form);if(button.disabled)return;button.disabled=true;const original=button.textContent;button.textContent='Working…';
 try{let result;if(form.matches('.leadgen-prepare'))result=await engine('leadgen_prepare',{site_id:sid,brief:fields.get('brief'),landing_url:fields.get('landing_url')});
 else if(form.matches('.leadgen-save')){const draft=(S.data[sid]?.drafts||[]).find(x=>String(x.id)===form.dataset.id),p=leadPlan(draft?.body);if(!p)throw Error('Refresh the campaign proposal.');const lines=name=>String(fields.get(name)||'').split('\n').map(s=>s.trim()).filter(Boolean);result=await engine('leadgen_save',{site_id:sid,draft_id:draft.id,revision_version:Number(form.dataset.revision),plan:{...p,landing_url:fields.get('landing_url'),groups:p.groups.map((g,i)=>({name:String(fields.get('group-'+i)).trim(),keywords:lines('keywords-'+i)})),negatives:lines('negatives')}});}
 else if(form.matches('.analytics-select'))result=await engine('analytics_select',{site_id:sid,property_id:fields.get('property_id')});
 else result=await engine('ads_measurement',{site_id:sid,connector_id:form.dataset.connector,lead_action:fields.get('lead_action'),booking_action:fields.get('booking_action')});
 if(S.session?.user?.id!==identity)return;await loadSite(sid);if(sid===S.siteId){render();toast(result?.queued?'Measurement saved. Reporting sync queued.':result?.reused?'Existing campaign proposal reopened.':'Saved. Review the updated workspace.');}
 }catch(err){toast(err.message);button.disabled=false;button.textContent=original;}
});
// ---------- events ----------
document.addEventListener('submit',e=>{if(e.target.id!=='results-period')return;e.preventDefault();const form=new FormData(e.target),end=String(form.get('end')),days=Number(form.get('days'));try{window.ImpacktResults.range(end,days);S.resultEnd=end;S.resultDays=days;render();}catch(err){toast(err.message);}});

document.addEventListener("click", async (e) => {
 const pageAction=e.target.closest('[data-page-content]');
 if(pageAction&&S.isAdmin){const sid=S.siteId,id=pageAction.dataset.id,action=pageAction.dataset.pageContent;if(action==='cancel'){S.pagePublish=null;render();return;}pageAction.disabled=true;try{const r=await engine('page_content_'+action,{site_id:sid,draft_id:id,approved_hash:pageAction.dataset.hash,reviewed:!!document.getElementById((action==='reverse'?'page-rollback-':'page-approve-')+id)?.checked});if(S.siteId!==sid)return;if(action==='prepare')S.pagePublish={...r,id};else{S.pagePublish=null;await loadSite(sid);toast(action==='verify'?'Verification recorded.':'Approved work queued.');}render();}catch(err){toast(err.message);pageAction.disabled=false;}return;}

 if(e.target.closest('[data-results-print]')){window.print();return;}
 if(e.target.closest('[data-results-export]')){const r=window.ImpacktResults.range(S.resultEnd||new Date(Date.now()-DAY).toISOString().slice(0,10),S.resultDays),data=S.results[S.siteId];if(!data||data.error)return toast('Load a report before exporting.');const url=URL.createObjectURL(new Blob([window.ImpacktResults.csv(data,r)],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='Impackt-results-'+r.start+'-'+r.end+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}

  const metric=e.target.closest('[data-overview-metric]');if(metric){S.overviewMetric=metric.dataset.overviewMetric==='impressions'?'impressions':'clicks';const chart=document.getElementById('overview-chart');if(chart){chart.innerHTML=overviewChart(S.data[S.siteId]);chart.querySelector('[aria-pressed="true"]')?.focus();}return;}
  const motion=e.target.closest('[data-motion-toggle]');if(motion){S.motionPaused=!S.motionPaused;document.querySelector('.shell')?.classList.toggle('motion-paused',S.motionPaused);motion.textContent=S.motionPaused?'Resume motion':'Pause motion';motion.setAttribute('aria-pressed',String(S.motionPaused));window.ImpacktMotion?.sync();return;}
  const support=e.target.closest('[data-support-toggle]');if(support){const panel=document.getElementById('support-preview'),launcher=document.querySelector('.support-launcher');panel.hidden=!panel.hidden;S.supportOpen=!panel.hidden;launcher?.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){panel.querySelector('button')?.focus();const id=S.siteId;await loadSupport(id);if(S.siteId===id&&S.supportOpen){render();document.querySelector('#support-preview [data-support-toggle]')?.focus();}}else launcher?.focus();return;}

  const chatLink=e.target.closest('[data-chat-thread]');if(chatLink){const tid=chatLink.dataset.chatThread;setTimeout(()=>{mountChat();setTimeout(()=>dispatchEvent(new CustomEvent('samaritan-chat:open',{detail:{thread:tid}})),300);},50);}
  const threadLink=e.target.closest('[data-open-thread]');if(threadLink){S.supportOpen=true;const id=threadLink.dataset.openThread;await loadSupport(id);return;}
  const supportManage=e.target.closest('[data-support-manage]');if(supportManage&&S.isAdmin){supportManage.disabled=true;const {error}=await sb.rpc('support_manage',{p_site:S.siteId,p_action:supportManage.dataset.supportManage});if(error)toast(error.message);else{await loadSupport(S.siteId);await loadOperations(S.siteId);render();}return;}
  const pilot=e.target.closest('[data-pilot]');if(pilot&&S.isAdmin){pilot.disabled=true;try{await engine(pilot.dataset.pilot,{site_id:S.siteId,status:pilot.dataset.state});await loadOperations(S.siteId);render();}catch(err){toast(err.message);pilot.disabled=false;}return;}
  const cancelJob=e.target.closest('[data-job-cancel]');if(cancelJob&&S.isAdmin){cancelJob.disabled=true;try{await engine('operation_cancel',{site_id:S.siteId,job_id:cancelJob.dataset.jobCancel});await loadOperations(S.siteId);render();}catch(err){toast(err.message);cancelJob.disabled=false;}return;}
  const retry=e.target.closest('[data-job-retry]');if(retry&&S.isAdmin){retry.disabled=true;try{await engine('operation_retry',{site_id:S.siteId,job_id:retry.dataset.jobRetry});await loadOperations(S.siteId);render();}catch(err){toast(err.message);retry.disabled=false;}return;}
  const paidButton=e.target.closest('[data-paid]');if(paidButton&&S.isAdmin){paidButton.disabled=true;const siteId=S.siteId;try{const result=await engine(paidButton.dataset.paid,{site_id:siteId,connector_id:paidButton.dataset.connector,campaign_id:paidButton.dataset.campaign,target_status:paidButton.dataset.target,change_id:paidButton.dataset.change,approval_hash:paidButton.dataset.hash,account_id:paidButton.dataset.account,manager_id:paidButton.dataset.manager});if(result.accounts){S.adAccounts||={};S.adAccounts[paidButton.dataset.connector]=result.accounts;}await loadSite(siteId);if(siteId===S.siteId)render();toast(result.queued?'Approved change queued.':result.proposal?'Proposal prepared. Review the exact account and change.':'Account information updated.');}catch(err){toast(err.message);paidButton.disabled=false;}return;}
  const operation=e.target.closest('[data-operation]');
  if(operation&&S.isAdmin){operation.disabled=true;try{const action=operation.dataset.operation;
    await engine(action==='pause'||action==='resume'?'operation_policy':'operation_enqueue',{site_id:S.siteId,...(action==='pause'||action==='resume'?{paused:action==='pause'}:{kind:action})});
    await loadOperations(S.siteId);render();toast('Saved. Scheduled work continues with the dashboard closed.');
  }catch(err){toast(err.message);operation.disabled=false;}return;}
  const clientRefresh=e.target.closest('[data-client-refresh]');if(clientRefresh){clientRefresh.disabled=true;try{await loadSites();if(!S.sites.some(s=>s.id===S.siteId)){S.data={};return renderNoAccess();}await loadSite(S.siteId);render();toast('Workspace updated.');}catch(err){S.data={};renderShell(errorBox(err));}return;}
  const clientButton=e.target.closest('[data-client-decision]');
  if(clientButton){if(clientButton.dataset.clientDecision==='approved'){const d=S.data[S.siteId],x=(clientButton.dataset.kind==='fix'?d.fixes:d.drafts).find(x=>String(x.id)===clientButton.dataset.id);if(x&&excludedCopy(x.after||x.title+' '+x.body))return toast('This copy conflicts with a saved business correction. Request changes before approving.');}if(!document.getElementById('client-read-'+clientButton.dataset.id)?.checked)return toast('Read the proposal and check the review box first.');const kind=clientButton.dataset.kind,d=S.data[S.siteId],item=(kind==='fix'?d.fixes:d.drafts).find(x=>String(x.id)===clientButton.dataset.id);if(!item)return;clientButton.disabled=true;try{const {error}=await sb.rpc('client_review',{p_site:S.siteId,p_kind:kind,p_id:String(item.id),p_decision:clientButton.dataset.clientDecision,p_snapshot:clientSnapshot(kind,item)});if(error)throw error;await loadSite(S.siteId);render();toast('Decision recorded. Your agency handles the next step.');}catch(err){toast(err.message);clientButton.disabled=false;}return;}
  const revoke=e.target.closest('[data-revoke-access]');if(revoke&&S.isAdmin){revoke.disabled=true;const {error}=await sb.from('workspace_access').update({revoked_at:new Date().toISOString()}).eq('id',revoke.dataset.revokeAccess).eq('site_id',S.siteId);if(error){toast(error.message);revoke.disabled=false;}else await loadAccess(S.siteId);return;}

  const row = e.target.closest("tr[data-href]");
  if (row && !e.target.closest("a,button")) { location.hash = row.dataset.href; return; }
  if (e.target.classList?.contains("modal-bg")) { S.modal = null; return render(); }
  const b = e.target.closest("button, a[data-add], a[data-act]");
  if (!b) { if (!e.target.closest(".ws-switch")) document.querySelectorAll(".ws-switch[open]").forEach((x) => x.removeAttribute("open")); return; }
  const d = S.data[S.siteId];
  if(b.dataset.experimentAction) {
    e.preventDefault();const sid=S.siteId,action=b.dataset.experimentAction,id=b.dataset.id;b.disabled=true;
    try {
      if(action!=='refresh') {
        const item=S.experiments?.[sid]?.rows.find(x=>x.id===id);
        const approval=action==='approve';
        await engine('search_experiment_'+(['retain','rollback','cancel'].includes(action)?'close':action),{site_id:sid,id,...(approval?{approved_hash:item?.approval_hash,reviewed:!!document.getElementById('experiment-review-'+id)?.checked}:{}),...(['retain','rollback','cancel'].includes(action)?{decision:action}:{})});
      }
      await loadSite(sid);if(S.siteId===sid)render();toast(action==='approve'?'Pilot queued with your exact-copy approval.':'Pilot updated.');
    }catch(err){toast(err.message);}finally{b.disabled=false;}return;
  }
  if(b.dataset.work) {e.preventDefault();return workspaceClick(b);}
  if(b.dataset.prompt) {S.chatInput[S.siteId]=b.dataset.prompt;render();document.getElementById('pulse-question')?.focus();return;}
  const act = b.dataset.act;
  if (act === 'aeo-task-filter') {S.visibilityShowAll=!S.visibilityShowAll;return render();}
  if (act === 'aeo-plan') {
    const sid=S.siteId;S.busy.add('aeo-plan');render();
    try {const r=await engine('aeo_plan',{site_id:sid});await loadSite(sid);toast(r.created?`${r.created} improvement tasks added`:r.reason||'Your existing action plan is up to date');}
    catch(err){toast(err.message);}finally{S.busy.delete('aeo-plan');if(S.siteId===sid)render();}return;
  }
  if(b.dataset.aeoDraft) {
    go(href('content'));toast('Review evidence-backed topics and existing page coverage before drafting a new article.');return;
  }
  if (act === "signout") return sb.auth.signOut();
  if (act === "menu") { document.body.classList.toggle("nav-open"); return; }
  if (act === "reload") { b.disabled = true; await refresh(); return toast("Up to date"); }
  if (act === "new-task") { e.preventDefault(); return openModal(b.dataset.ws, b.dataset.lead); }
  if (act === "close-modal") { S.modal = null; return render(); }
  if (b.dataset.mode && S.modal) { syncModal(); S.modal.mode = b.dataset.mode; return render(); }
  if (b.dataset.platform) { S.newPlatform = b.dataset.platform; document.querySelectorAll("[data-platform]").forEach((x) => { const on = x === b; x.setAttribute("aria-pressed", on); x.setAttribute("aria-checked", on); }); return; }
  if (b.dataset.contentFilter) { S.contentFocus=null;S.contentFilter = b.dataset.contentFilter; return render(); }
  if (b.dataset.taskFilter) { S.taskFilter = b.dataset.taskFilter; S.showN = 40; return render(); }
  if (b.dataset.filterStatus) { S.filter.status = b.dataset.filterStatus; S.filter.field = "all"; S.showN = 40; S.confirmBulk = false; return render(); }
  if (b.dataset.filterField) { S.filter.field = b.dataset.filterField; S.showN = 40; S.confirmBulk = false; return render(); }
  if (act === "more") { S.showN += 40; return render(); }
  if (act === "bulk") { S.confirmBulk = true; return render(); }
  if (act === "bulk-no") { S.confirmBulk = false; return render(); }
  if (act === "bulk-yes") { S.confirmBulk = false; return setFix(filteredFixes(d).map((f) => f.id), "approved"); }
  if (b.dataset.fix === "rejected") { const sid = S.siteId, f = S.data[sid]?.fixes.find((r) => String(r.id) === b.dataset.id); if (f) { const prev = f.status; return undoable("Skipped", () => { f.status = "rejected"; }, () => { f.status = prev; }, async () => { const { error } = await sb.from("fixes").update({ status: "rejected", decided_at: new Date().toISOString() }).eq("site_id", sid).eq("id", f.id); if (error) { f.status = prev; toast("Could not save: " + error.message); } if (S.siteId === sid) render(); }); } }
  if (b.dataset.fix) return setFix([b.dataset.id], b.dataset.fix);
  if (b.dataset.task) return setTask(b.dataset.id, b.dataset.task);
  if (b.dataset.draft === "rejected") { const sid = S.siteId, x = S.data[sid]?.drafts.find((r) => String(r.id) === b.dataset.id); if (x) { const prev = x.status; return undoable("Rejected", () => { x.status = "rejected"; }, () => { x.status = prev; }, async () => { const { error } = await sb.from("drafts").update({ status: "rejected", decided_at: new Date().toISOString() }).eq("id", x.id); if (error) { x.status = prev; toast("Could not save: " + error.message); } if (S.siteId === sid) render(); }); } }
  if (b.dataset.draft) return setDraft(b.dataset.id, b.dataset.draft);
  if (b.dataset.draftEdit) { S.editDraft = b.dataset.draftEdit; return render(); }
  if (act === "cancel-edit") { S.editDraft = null; return render(); }
  if (b.dataset.copyDraft) {
    const x=d.drafts.find(r=>r.id===b.dataset.copyDraft);if(!x)return;
    const html=b.dataset.copyFormat==='html',text=html?globalThis.ImpactfulArticle.renderArticleHtml(x.body):`${x.title}\n\n${x.body}`;
    try {await navigator.clipboard.writeText(text);toast(html?'HTML copied. Paste into your CMS HTML editor.':'Copied');}
    catch {S.modal={mode:'copy',html,text};render();const field=document.getElementById('copy-source');field?.focus();field?.select();}
    return;
  }
  if (b.dataset.draftDel) {
    const sid = S.siteId, list = S.data[sid]?.drafts || [], i = list.findIndex((r) => String(r.id) === b.dataset.draftDel); if (i < 0) return;
    const x = list[i];
    return undoable("Draft deleted", () => { list.splice(list.indexOf(x), 1); }, () => { list.splice(Math.min(i, list.length), 0, x); }, async () => { const { error } = await sb.from("drafts").delete().eq("id", x.id); if (error) { list.splice(Math.min(i, list.length), 0, x); toast("Could not delete: " + error.message); if (S.siteId === sid) render(); } });
  }
  if (act === "add-lead") { S.addingLead = true; render(); return document.getElementById("l-name")?.focus(); }
  if (act === "cancel-lead") { S.addingLead = false; return render(); }
  if (b.dataset.leadDel) {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Delete?"; return; }
    const { error } = await sb.from("leads").delete().eq("id", b.dataset.leadDel);
    if (error) return toast("Could not delete: " + error.message);
    return refresh();
  }
  if (act === "calc-reset") { store.set("calc:" + S.siteId, {}); return render(); }
  if (b.dataset.add) {
    e.preventDefault(); S.adding = b.dataset.add;
    if (S.page !== "connections") { location.hash = href("integrations"); } else render();
    if (S.adding === "gsc") loadGscInfo();
    return;
  }
  if (act === "cancel-add") { S.adding = null; return render(); }
  if (b.dataset.oauth) return startOAuth(b.dataset.oauth);
  if (b.dataset.nangoConnect) return nangoConnect(b.dataset.nangoConnect);
  if (b.dataset.nangoRemove) { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Disconnect?"; return; } b.disabled = true; try { await nangoCall({ action: "remove", provider_config_key: b.dataset.nangoRemove, connection_id: b.dataset.conn }); toast("Disconnected."); } catch (err) { toast(err.message); } return loadNango(); }
  if (b.dataset.appsOpen) { S.appsOpen = b.dataset.appsOpen; return render(); }
  if (act === "setup-close") { S.setup = null; return render(); }
  if (act === "setup-recheck") { b.disabled = true; await loadConnectInfo(); if (S.connectInfo?.providers?.[S.setup]) { const k = S.setup; S.setup = null; toast(`${PROVIDERS[k].name} is set up. Click Connect.`); } else toast("Not set up yet. Check both secrets are saved in Supabase."); return render(); }
  if (act === "gsc-recheck" || act === "gsc-refresh") { S.gscInfo = null; render(); return loadGscInfo(); }
  if (b.dataset.copy) { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Copied"); } catch { toast("Copy failed. Select the text and copy it."); } return; }
  if (b.dataset.connTest) return testConn(b.dataset.connTest);
  if (b.dataset.connDel) {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Click again to remove"; return; }
    const { error } = await sb.rpc("delete_connector", { p_connector: b.dataset.connDel });
    if (error) return toast("Could not remove: " + error.message);
    await refresh(); return toast("Connection removed");
  }
  if (b.dataset.connKey) {
    const card = b.closest(".card"); if (card.querySelector(".rekey")) return;
    card.insertAdjacentHTML("beforeend", `<form class="rekey form" style="grid-column:1/-1"><label class="field">New key or password<input type="password" required autocomplete="off"></label><div><button class="btn primary" type="submit">Save and test</button></div></form>`);
    card.querySelector(".rekey").addEventListener("submit", async (ev) => {
      ev.preventDefault(); const v = ev.target.querySelector("input").value.trim();
      const { error } = await sb.rpc("set_connector_secret", { p_connector: b.dataset.connKey, p_secret: v });
      if (error) return toast("Could not save: " + error.message);
      await testConn(b.dataset.connKey);
    });
    return;
  }
  if (b.dataset.verify || act === "verify-saved") {
    b.disabled = true; b.textContent = "Checking…";
    try { const r = await engine("verify", { site_id: S.siteId, ...(b.dataset.verify ? { ids: [b.dataset.verify] } : {}) }); toast(`${r.verification.checked} checked: ${r.verification.verified} verified, ${r.verification.needsAttention} need attention.`); }
    catch (e) { toast(e.message); }
    return refresh();
  }
  if (b.dataset.aeoRetry) {
    b.disabled = true;
    try { const r = await engine("aeo_retry_failed", { site_id: S.siteId, engine: b.dataset.aeoRetry }); toast(`${r.queued} failed checks queued for a fresh attempt.`); }
    catch (e) { toast(e.message); }
    await refresh(); pollAeo(); return;
  }
  if (act === "gsc-sync") {
    b.disabled = true; b.textContent = "Syncing…";
    try { const x = await syncGoogle(S.siteId); toast(x.days ? `Synced ${x.days} days and ${x.queries} queries` : "Google connected, but Search Console returned no data for this property yet."); }
    catch (err) { toast(err.message); }
    return refresh();
  }
  if (b.dataset.check) { S.openCheck = b.dataset.check; render(); document.querySelector("[data-act=close-check]")?.scrollIntoView({ block: "center" }); return; }
  if (act === "close-check") { S.openCheck = null; return render(); }
  if (b.dataset.promptToggle) {
    const p = d.aeoPrompts.find((x) => x.id === b.dataset.promptToggle);
    const { error } = await sb.from("aeo_prompts").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast("Could not save: " + error.message);
    return refresh();
  }
  if (b.dataset.promptDel) {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirm delete"; return; }
    const { error } = await sb.from("aeo_prompts").delete().eq("id", b.dataset.promptDel);
    if (error) return toast("Could not delete: " + error.message);
    return refresh();
  }
  if (act === "aeo-run") {
    b.disabled = true; b.textContent = "Starting…";
    try { const r = await engine("aeo_start", { site_id: S.siteId }); const n = r.result?.[S.siteId]; toast(n > 0 ? `Asking ${n} questions now. Results fill in over the next few minutes.` : n === -1 ? "A check is already running." : "Add questions first."); }
    catch (err) { toast(err.message); }
    await refresh(); pollAeo(); return;
  }
  if (act === "checkup") { b.disabled = true; return runCheckup(S.siteId); }
  if (act === "apply-now") {
    b.disabled = true; b.textContent = "Applying…";
    try { const r = await engine("apply", { site_id: S.siteId }); const x = r.result?.[S.siteId] || { deployed: 0, failed: 0, rolledBack: 0 }; toast(`${x.deployed} applied, ${x.rolledBack} rolled back, ${x.failed} failed`); }
    catch (err) { toast(err.message); }
    return refresh();
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.modal) { S.modal = null; render(); } });
function filterIntegrations(){
 const query=(document.getElementById('integration-search')?.value||'').trim().toLowerCase(), status=document.getElementById('integration-filter')?.value||'all';let shown=0;
 document.querySelectorAll('[data-integration]').forEach(card=>{card.hidden=!(card.dataset.integration.includes(query)&&(status==='all'||card.dataset.integrationStatus===status));if(!card.hidden)shown++;});
 const empty=document.getElementById('integration-empty');if(empty)empty.hidden=shown>0;
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const p=document.getElementById('support-preview');if(p&&!p.hidden){p.hidden=true;S.supportOpen=false;const b=document.querySelector('.support-launcher');b?.setAttribute('aria-expanded','false');b?.focus();}}});
document.addEventListener('click',async e=>{
 const art=e.target.closest?.('[data-article]');
 if(art&&!S.articleBusy)return articleRequest(art.dataset.opp,art.dataset.article);
 const run=e.target.closest?.('[data-wl-run]');
 if(run&&S.isAdmin){const sid=S.siteId;if(S.wlBusy)return;S.wlBusy=Date.now();render();toast('Samaritan is looking for new work. New fixes appear here on their own, usually within 2 minutes.');(async()=>{try{const {data:{session}}=await sb.auth.getSession();const r=await fetch(`${CFG.supabaseUrl}/functions/v1/samaritan`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`,apikey:CFG.supabaseAnonKey},body:JSON.stringify({site_id:sid,burst:true})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||'Could not start.');const n=(j.result?.[sid]?.prepared||[]).length;await loadOpps(sid);if(!n)toast('Nothing new to fix right now. Everything found is already in progress.');}catch(err){toast(err.message);}S.wlBusy=false;if(S.siteId===sid)render();})();return;}
 const open=e.target.closest?.('[data-open-draft]');
 if(open){S.contentFocus=open.dataset.openDraft;S.contentFilter='review';setTimeout(()=>document.getElementById('draft-'+open.dataset.openDraft)?.scrollIntoView({behavior:'smooth',block:'start'}),400);}
});
document.addEventListener('click',async e=>{
 const b=e.target.closest?.('[data-revert-kind]');if(!b)return;e.preventDefault();
 const sid=S.siteId,kind=b.dataset.revertKind,id=b.dataset.revertId;b.disabled=true;b.textContent='Undoing…';
 try{const r=await reviseCall({site_id:sid,kind,id,action:'revert'});applyRevision(sid,kind,id,r,null);if(S.siteId===sid)render();toast('Previous version restored.');}
 catch(err){toast(err.message);b.disabled=false;b.textContent='Undo revision';}
});
document.addEventListener('click',async e=>{
 const button=e.target.closest?.('[data-priority-action]');if(!button)return;const sid=S.siteId,identity=S.session?.user?.id;button.disabled=true;const original=button.textContent;button.textContent=button.dataset.priorityAction==='plan'?'Preparing action plan…':'Saving team direction…';
 try{if(button.dataset.priorityAction==='plan')await engine('priority_plan',{site_id:sid,priority_id:button.dataset.id});else{const {error}=await sb.rpc('activate_business_priority',{p_site:sid,p_id:button.dataset.id});if(error)throw error;}if(S.session?.user?.id!==identity)return;await loadKnowledge(sid);if(S.isAdmin){const {data}=await sb.from('sites').select('*').eq('id',sid).single();if(data)Object.assign(siteById(sid),data);}if(S.siteId===sid){render();toast(button.dataset.priorityAction==='plan'?'Action plan prepared for review.':'Team direction saved. Future agent work uses this priority.');}}
 catch(err){toast(err.message);button.disabled=false;button.textContent=original;}
});
document.addEventListener("input", (e) => { if(e.target.id==='integration-search')filterIntegrations(); if(e.target.id === "pulse-question") S.chatInput[S.siteId]=e.target.value; if (e.target.dataset?.calc) calcUpdate(); });
document.addEventListener("change", async (e) => {
  if(e.target.id==='integration-filter'){filterIntegrations();return;}
  if (e.target.id === "mt-ws" && S.modal) { syncModal(); S.modal.kind = DRAFT_KINDS[S.modal.ws][0]; return render(); }
  if (e.target.dataset?.leadStage) {
    const { error } = await sb.from("leads").update({ stage: e.target.value, updated_at: new Date().toISOString() }).eq("id", e.target.dataset.leadStage);
    if (error) return toast("Could not save: " + error.message);
    toast("Stage updated"); return refresh();
  }
});

document.addEventListener('change',async e=>{if(!e.target.matches?.('[data-weekly-content]')||!S.isAdmin)return;const input=e.target;input.disabled=true;try{await engine('operation_policy',{site_id:S.siteId,paused:S.operations?.[S.siteId]?.policy?.paused??true,weekly_content:input.checked});await loadOperations(S.siteId);toast('Content schedule updated.');}catch(err){input.checked=!input.checked;toast(err.message);}finally{input.disabled=false;}});
document.addEventListener('input',e=>{if(e.target.matches?.('#human-message textarea')){S.supportDrafts||={};const previous=S.supportDrafts[S.siteId];S.supportDrafts[S.siteId]={body:e.target.value,nonce:previous?.body===e.target.value?previous.nonce:crypto.randomUUID()};}});
document.addEventListener("submit", async (e) => {
 if(e.target.matches?.('.priority-request')) {
  e.preventDefault();const form=e.target,sid=S.siteId,identity=S.session?.user?.id,button=form.querySelector('button'),status=form.querySelector('[role="status"]'),f=new FormData(form);button.disabled=true;status.textContent='Saving your priority…';
  try{const {error}=await sb.rpc('request_business_priority',{p_site:sid,p_objective:String(f.get('objective')||'').trim(),p_context:String(f.get('context')||'').trim(),p_location:String(f.get('location')||'').trim(),p_target_date:f.get('target_date')||null,p_measure:String(f.get('measure')||'').trim()});if(error)throw error;if(S.session?.user?.id!==identity)return;await loadKnowledge(sid);if(S.siteId===sid){render();toast('Priority brief saved. Your agency can prepare the action plan.');}}
  catch(err){status.textContent='Not saved: '+err.message;button.disabled=false;}return;
 }

 if(e.target.matches?.('.suggest-form')) {
  e.preventDefault();const form=e.target,sid=S.siteId,identity=S.session?.user?.id,kind=form.dataset.kind,id=form.dataset.id,btn=form.querySelector('button[type="submit"]'),st=form.querySelector('[role="status"]');
  const note=String(form.note.value||'').trim(),remember=form.remember.checked;if(note.length<4)return;
  btn.disabled=true;st.textContent=kind==='draft'?'Revising… long drafts take up to a minute.':'Revising…';
  try{
   const r=await reviseCall({site_id:sid,kind,id,instruction:note});
   if(S.session?.user?.id!==identity)return;
   applyRevision(sid,kind,id,r,{instruction:note,summary:r.summary,at:new Date().toISOString()});
   let msg=r.summary?'Revised: '+r.summary:'Revised.';
   if(remember){if(note.length>=15){const {error}=await sb.rpc('correct_business_knowledge',{p_site:sid,p_note:note,p_phrase:'',p_kind:kind,p_id:id});if(error)msg+=' The rule was not saved: '+error.message;else{msg+=' Saved as a rule for future work.';loadKnowledge(sid);}}else msg+=' (Too short to save as a lasting rule.)';}
   S.openSuggest=null;if(S.siteId===sid)render();toast(msg);
  }catch(err){st.textContent=err.message;btn.disabled=false;}
  return;
 }
 if(e.target.matches?.('.knowledge-form')) {
  e.preventDefault();const form=e.target,sid=S.siteId,identity=S.session?.user?.id,button=form.querySelector('button'),status=form.querySelector('[role="status"]');button.disabled=true;status.textContent='Saving correction…';
  const f=new FormData(form);
  try{const {error}=await sb.rpc('correct_business_knowledge',{p_site:sid,p_note:String(f.get('note')||'').trim(),p_phrase:String(f.get('phrase')||'').trim(),p_kind:form.dataset.kind||null,p_id:form.dataset.item||null});if(error)throw error;if(S.session?.user?.id!==identity)return;await loadKnowledge(sid);if(S.isAdmin){const {data}=await sb.from('sites').select('*').eq('id',sid).single();if(data)Object.assign(siteById(sid),data);}if(S.siteId===sid){render();toast('Correction saved for future agent work. Live pages were not changed.');}}
  catch(err){status.textContent='Not saved: '+err.message;button.disabled=false;}return;
 }

 if(e.target.id==='search-experiment-form'||e.target.matches('.experiment-note')) {
  e.preventDefault();const sid=S.siteId,form=e.target,button=form.querySelector('button[type="submit"]');button.disabled=true;
  try {
    const payload=Object.fromEntries(new FormData(form));
    if(form.id==='search-experiment-form') {payload.protected_terms=String(payload.protected_terms||'').split(',').map(x=>x.trim()).filter(Boolean);await engine('search_experiment_create',{...payload,site_id:sid});if(S.searchDrafts)delete S.searchDrafts[sid];}
    else await engine('search_experiment_note',{site_id:sid,id:form.dataset.id,note:payload.note});
    await loadSite(sid);if(S.siteId===sid)render();toast('Evidence saved for review.');
  }catch(err){toast(err.message);}finally{button.disabled=false;}return;
 }
 if(e.target.id==='human-message'){e.preventDefault();const siteId=S.siteId,identity=S.session?.user?.id;S.supportSending||=new Set();if(S.supportSending.has(siteId))return;const body=e.target.elements.message.value.trim();if(!body)return;S.supportDrafts||={};const draft=S.supportDrafts[siteId]?.body.trim()===body?S.supportDrafts[siteId]:{body,nonce:crypto.randomUUID()};S.supportDrafts[siteId]=draft;S.supportSending.add(siteId);render();try{const {error}=await sb.rpc('support_send',{p_site:siteId,p_body:body,p_nonce:draft.nonce});if(error)throw error;if(S.session?.user?.id!==identity)return;delete S.supportDrafts[siteId];await loadSupport(siteId);await loadOperations(siteId);toast('Message saved for your team.');}catch(err){if(S.session?.user?.id===identity)toast('Message not confirmed. Your text is saved; retry sends the same request. '+err.message);}finally{S.supportSending.delete(siteId);if(S.session?.user?.id===identity&&S.siteId===siteId)render();}return;}
 if(e.target.matches('.ad-control-form')){e.preventDefault();const form=e.target,button=form.querySelector('button');button.disabled=true;try{await engine('ads_controls',{site_id:S.siteId,connector_id:form.dataset.connector,enabled:form.elements.enabled.checked,allow_resume:form.elements.resume.checked,max_daily_budget:Number(form.elements.budget.value),max_changes_per_day:Number(form.elements.changes.value)});await loadOperations(S.siteId);toast('Account limits saved.');}catch(err){toast(err.message);}finally{button.disabled=false;}return;}
 if(e.target.id==='access-form'){e.preventDefault();if(!S.isAdmin)return;const f=new FormData(e.target),button=e.target.querySelector('button');button.disabled=true;const {error}=await sb.from('workspace_access').upsert({site_id:S.siteId,email:String(f.get('email')).trim().toLowerCase(),role:String(f.get('role')),revoked_at:null,created_by:S.session.user.id},{onConflict:'site_id,email'});if(error){toast(error.message);button.disabled=false;}else{await loadAccess(S.siteId);toast('Access saved. Share the sign-in URL with your client.');}return;}

  if (["pulse-chat","blog-publish"].includes(e.target.id)) return workspaceSubmit(e);
  const id = e.target.id;
  const val = (x) => document.getElementById(x)?.value.trim() ?? "";
  if (id === "task-form") {
    e.preventDefault(); syncModal();
    const m = S.modal, btn = document.getElementById("mt-save");
    btn.disabled = true;
    if (m.mode === "ai") {
      btn.textContent = m.kind === "Blog post" ? "Researching sources & writing…" : "Writing…";
      try {
        await engine("draft", { site_id: S.siteId, workspace: m.ws, kind: m.kind, title: m.title, brief: m.brief });
        S.modal = null; await refresh(); toast("Draft ready in the Review queue");
      } catch (err) { btn.disabled = false; btn.textContent = "Generate draft"; toast(err.message); }
      return;
    }
    const { error } = await sb.from("drafts").insert({ site_id: S.siteId, workspace: m.ws, kind: m.kind, title: m.title, body: m.body });
    if (error) { btn.disabled = false; return toast("Could not save: " + error.message); }
    S.modal = null; await refresh(); return toast("Sent to the Review queue");
  }
  if (id === "draft-edit") {
    e.preventDefault();
    const { error } = await sb.from("drafts").update({ title: val("de-title"), body: document.getElementById("de-body").value }).eq("id", e.target.dataset.id);
    if (error) return toast("Could not save: " + error.message);
    S.editDraft = null; await refresh(); return toast("Saved");
  }
  if (id === "lead-form") {
    e.preventDefault();
    const value = val("l-value");
    const { error } = await sb.from("leads").insert({ site_id: S.siteId, name: val("l-name"), email: val("l-email") || null, phone: val("l-phone") || null, source: val("l-source") || null, note: val("l-note") || null, stage: val("l-stage"), value: value ? +value : null });
    if (error) return toast("Could not save: " + error.message);
    S.addingLead = false; await refresh(); return toast("Lead added");
  }
  if (id === "profile-form") {
    e.preventDefault();
    const s = siteById(S.siteId);
    const list = (x) => val(x).split(",").map((v) => v.trim()).filter(Boolean);
    const brand = { ...(s.brand || {}), name: val("pf-name"), facts: val("pf-facts"), voice: val("pf-voice"), keywords: list("pf-keywords"), bannedWords: list("pf-banned"), rules: document.getElementById("pf-rules").value.split("\n").map((v) => v.trim()).filter(Boolean) };
    if(s.profile?.market_rule)brand.rules.push(s.profile.market_rule);
    const profile = { ...(s.profile || {}), industry: val("pf-industry"), customers: val("pf-customers"), goal: val("pf-goal"), voice: val("pf-voice") };
    const { data:savedProfile,error } = await sb.from("sites").update({ name: val("pf-name"), domain: val("pf-domain").replace(/^https?:\/\//, "").replace(/\/.*$/, ""), platform: val("pf-platform"), brand, profile }).eq("id", S.siteId).eq("brand",JSON.stringify(s.brand||{})).select("id");
    if (error) return toast("Could not save: " + error.message);
    if(!savedProfile?.length)return toast("Business knowledge changed in another session. Refresh before saving so client corrections are preserved.");
    await refresh(); return toast("Profile saved");
  }
  if (id === "site-form") {
    e.preventDefault();
    let domain;try{domain=marketDomain(val("s-domain"));}catch(err){return toast(err.message);}
    const name=val("s-name"), platform=val("s-platform"), value=marketValues(e.target);
    const {industry,customers,...market}=value;
    const button=e.target.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
    let sid = domain.replace(/^www\./, "").split(".")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "site";
    if (S.sites.some((x) => x.id === sid)) sid += "-" + Math.random().toString(36).slice(2, 5);
    const { error } = await sb.from("sites").insert({ id: sid, name, domain, platform, mode: "review", brand: {name}, profile:{industry,customers,market,market_revision:crypto.randomUUID()}, sort_order: S.sites.length + 1, next_run_at: nextMonday() });
    if (error) {button.disabled=false;return toast("Could not create the workspace: " + error.message);}
    await loadSites(); S.siteId = sid; S.newPlatform = null;
    engine("checkup",{site_id:sid}).catch(()=>{}); // Durable queue is already saved with the new business.
    return go(href("ask"));
  }
  if (id === "prompt-form") {
    e.preventDefault();
    const prompt = val("p-text"); if (!prompt) return;
    const { error } = await sb.from("aeo_prompts").insert({ site_id: S.siteId, prompt, category: val("p-cat"), sort_order: (S.data[S.siteId].aeoPrompts.length + 1) * 10 });
    if (error) return toast("Could not add: " + error.message);
    toast("Question added. It's included in the next check."); return refresh();
  }
  if (e.target.classList.contains("app-form")) {
    e.preventDefault();
    const k = e.target.dataset.provider, f = new FormData(e.target);
    const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
    const { error } = await sb.rpc("admin_set_platform_app", { p_provider: k, p_client_id: String(f.get("cid") || "").trim(), p_secret: String(f.get("csec") || "").trim() || null });
    if (error) { btn.disabled = false; btn.textContent = "Save"; return toast("Could not save: " + error.message); }
    S.platformApps = null; S.appsOpen = null; S.connectInfo = null; await loadConnectInfo();
    toast(`${APP_STEPS[k].name} is ready. Every business can now connect it in one click.`);
    if (S.appsFocus === k) { S.appsFocus = null; return go(href("connections")); }
    return render();
  }
  if (id === "prop-form") {
    e.preventDefault();
    const cid = e.target.dataset.conn, c = S.data[S.siteId].connectors.find((x) => x.id === cid);
    const { error } = await sb.from("connectors").update({ config: { ...c.config, property: val("o-prop") }, last_error: null }).eq("id", cid);
    if (error) return toast("Could not save: " + error.message);
    return testConn(cid);
  }
  if (id === "conn-form") {
    e.preventDefault();
    const type = e.target.dataset.type, btn = document.getElementById("conn-save");
    btn.disabled = true; btn.textContent = "Saving…";
    let config = {}, secret = null;
    if (type === "shopify") { config = { shop: val("f-shop").replace(/^https?:\/\//, "").replace(/\/.*$/, "") }; secret = val("f-secret"); }
    else if (type === "wordpress") { config = { url: val("f-url").replace(/\/$/, ""), username: val("f-user") }; secret = val("f-secret"); }
    else if (type === "gsc") config = { property: val("f-prop") };
    else config = { url: val("f-url") };
    const { data: row, error } = await sb.from("connectors").insert({ site_id: S.siteId, type, config, label: CONNECTOR_TYPES[type].name }).select("id").single();
    if (error) { btn.disabled = false; btn.textContent = "Save and test"; return toast("Could not save: " + error.message); }
    if (secret) {
      const { error: e2 } = await sb.rpc("set_connector_secret", { p_connector: row.id, p_secret: secret });
      if (e2) toast("Saved, but the key could not be stored: " + e2.message);
    }
    S.adding = null;
    await testConn(row.id);
  }
});

async function publishFixes(ids) {
  const blocked=(S.data[S.siteId]?.fixes||[]).filter(f=>ids.includes(f.id)&&searchReviewHold(f));
  if(blocked.length)return toast("These SEO suggestions need evidence review. Open Search experiments or run a fresh audit.");
  ids.forEach((id) => S.busy.add(id)); render();
  const s = siteById(S.siteId), name = platformOf(s).name;
  try {
    const r = await engine("publish", { site_id: S.siteId, ids });
    ids.forEach((id) => S.busy.delete(id));
    await refresh();
    if (!r.published) {
      toast(`Saved. Connect ${name} and it publishes automatically.`);
      return go(href("connections"));
    }
    const x = r.result || {};
    toast(`${x.deployed || 0} saved to ${name}; live-page verification pending.${r.queued ? ` ${r.queued} still queued.` : ""}${x.failed ? ` ${x.failed} failed; review before retrying.` : ""}`);
  } catch (err) { ids.forEach((id) => S.busy.delete(id)); render(); toast(err.message); }
}
async function setFix(ids, status) {
  if (status === "approved") return publishFixes(ids);
  ids.forEach((id) => S.busy.add(id)); render();
  const patch = { status, decided_at: status === "pending" ? null : new Date().toISOString() };
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await sb.from("fixes").update(patch).eq("site_id", S.siteId).in("id", ids.slice(i, i + 100));
    if (error) { toast("Could not save: " + error.message); break; }
  }
  ids.forEach((id) => S.busy.delete(id));
  if (status === "rollback_requested") { try { await engine("apply", { site_id: S.siteId }); } catch { /* the 10-minute job retries */ } }
  const label = { rejected: "Skipped", pending: "Back in Ready to publish" }[status];
  await refresh();
  if (status === "rollback_requested") {
    const rows = S.data[S.siteId].fixes.filter(f => ids.includes(f.id));
    const restored = rows.filter(f => f.status === "rolled_back").length, failed = rows.filter(f => f.status === "failed").length;
    toast(`${restored} restored on the platform; check live verification.${failed ? ` ${failed} need attention.` : ""}${rows.some(f => f.status === "rollback_requested") ? " Remaining rollbacks are queued." : ""}`);
  } else toast(label);
}
async function runCheckup(id, quiet) {
  try { await engine("checkup", { site_id: id }); } catch (err) { return toast(err.message); }
  if (!quiet) toast("Checking your site in saved batches. You can leave this page while it continues.");
  await refresh(); pollCheckup();
}
function pollCheckup() {
  clearTimeout(pollCheckup.t);
  const s = siteById(S.siteId);
  if (S.page==="today"&&S.data[S.siteId]&&awaitingFirstAudit(s,S.data[S.siteId]))return;
  if (!["running", "queued"].includes(s?.checkup?.status)) return;
  pollCheckup.t = setTimeout(async () => { if (!S.modal) await refresh(); const now = siteById(S.siteId); if (now?.checkup?.status === "done") toast(`Check finished: ${plural(now.checkup.queued || 0, "new fix")} ready.`); pollCheckup(); }, 8000);
}
async function setTask(id, status) {
  S.busy.add("t:" + id); render();
  const { error } = await sb.from("tasks").update({ status, decided_at: status === "pending" ? null : new Date().toISOString(), verify: null, verified_at: null }).eq("site_id", S.siteId).eq("id", id);
  S.busy.delete("t:" + id);
  if (error) toast("Could not save: " + error.message);
  await refresh();
  if (!error && status === "done") {
    toast("Marked done. Checking your live site now…");
    const sid = S.siteId;
    followUp(sid).then(async (r) => { if (S.siteId !== sid) return; await refresh(); const t = S.data[sid]?.tasks.find((x) => x.id === id); toast(t?.verify?.state === "confirmed" ? "Confirmed on your live site ✓" : t?.verify?.state === "not_found" ? "Saved. We don't see the change on your site yet, and will check again." : "Saved. We'll confirm it on your site shortly."); }).catch(() => {});
  }
}
async function reviseCall(body) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${CFG.supabaseUrl}/functions/v1/revise`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: CFG.supabaseAnonKey }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error || "The revision could not be saved.");
  return j;
}
function applyRevision(sid, kind, id, r, rev) {
  const d = S.data[sid]; if (!d) return;
  if (kind === "draft") { const x = d.drafts.find((x) => String(x.id) === String(id)); if (!x) return; const revs = x.revisions || [];
    x.revisions = rev ? [...revs, { ...rev, title: x.title, body: x.body }] : revs.slice(0, -1); x.title = r.title; x.body = r.body; }
  else { const f = d.fixes.find((x) => String(x.id) === String(id)); if (!f) return; f.data = f.data || {}; const revs = f.data.revisions || [];
    f.data.revisions = rev ? [...revs, { ...rev, after: f.after }] : revs.slice(0, -1); f.after = r.after; }
}
async function followUp(siteId) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${CFG.supabaseUrl}/functions/v1/followthrough`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: CFG.supabaseAnonKey }, body: JSON.stringify({ site_id: siteId }) });
  return res.json().catch(() => ({}));
}
function verifyBadge(t) {
  const v = t.verify || {};
  if (v.state === "confirmed") return `<span class="pill vf ok">${icon("check", 12)} ${t.kind === "AI visibility" ? "AI now names you" : v.by === "site" ? "Fixed on your site" : "Confirmed live"}</span>`;
  if (v.state === "not_found") return `<span class="pill vf wait">Not on your site yet · checking again</span>`;
  if (v.state === "reopened") return `<span class="pill vf warn">Reopened: still showing on your site</span>`;
  if (v.state === "waiting") return `<span class="pill vf wait">Waiting for AI answers to update</span>`;
  if (t.status === "done" && !v.state) return `<span class="pill vf wait">Checking your site…</span>`;
  return "";
}
async function setDraft(id, status) {
  if (status === "approved") return approveWork(id);
  S.busy.add("d:" + id); render();
  const { error } = await sb.from("drafts").update({ status, decided_at: status === "needs_review" ? null : new Date().toISOString() }).eq("id", id);
  S.busy.delete("d:" + id);
  if (error) toast("Could not save: " + error.message); else toast(status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Back in review");
  await refresh();
}
async function testConn(id) {
  S.busy.add("c:" + id); render();
  try { const r = await engine("test", { connector_id: id }); toast(r.ok ? "Connected" : "Not working: " + r.error); }
  catch (err) { toast(err.message); }
  S.busy.delete("c:" + id);
  await refresh();
  const after = S.data[S.siteId]?.connectors.find((c) => c.id === id);
  if (after?.type === "gsc" && after.status === "connected") {
    toast("Search Console connected. Pulling the last 90 days…");
    try { const x = await syncGoogle(S.siteId); toast(x.days ? `Synced ${x.days} days of search data.` : "Synced successfully; Google returned no search data for this property yet."); } catch (e) { toast("Google sync failed: " + e.message); }
    await refresh();
  }
}
async function connectFn(action, extra = {}) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${CFG.supabaseUrl}/functions/v1/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: CFG.supabaseAnonKey },
    body: JSON.stringify({ action, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Connection error ${res.status}`);
  return body;
}
async function loadConnectInfo() {
  try { S.connectInfo = await connectFn("info"); } catch { S.connectInfo = null; }
}
async function loadGscProps(id) {
  if (loadGscProps[id]) return; loadGscProps[id] = true;
  try { S.gscProps[id] = ((await engine("gsc_list", { connector_id: id })).sites || []).filter((p) => p.permission !== "siteUnverifiedUser"); }
  catch (e) { S.gscProps[id] = []; toast("Could not list Google properties: " + e.message); }
  loadGscProps[id] = false;
  if (S.page === "connections") render();
}
async function startOAuth(k) {
  if (!S.connectInfo) await loadConnectInfo();
  if (!S.connectInfo?.providers?.[k]) { S.appsFocus = k==='google_ads'?'google':k==='meta_ads'?'meta':k; toast(`One-time setup: register Impackt Media with ${PROVIDERS[k].name}. Your customers never see this step.`); return go(href("apps")); }
  const extra = {};
  if (k === "shopify") { extra.shop = (document.getElementById("o-shop")?.value || siteById(S.siteId)?.config?.shop || S.data[S.siteId].connectors.find((c) => c.type === "shopify")?.config?.shop || "").trim(); if (!extra.shop) return toast("Enter the store's .myshopify.com address first."); }
  if (k === "wordpress") extra.url = (document.getElementById("o-wp")?.value || S.data[S.siteId].connectors.find((c) => c.type === "wordpress")?.config?.url || "").trim();
  S.busy.add("o:" + k); render();
  try {
    const r = await connectFn("start", { provider: k, site_id: S.siteId, return_to: location.origin + location.pathname + href("integrations"), ...extra });
    location.href = r.url;
  } catch (err) { S.busy.delete("o:" + k); render(); toast(err.message); }
}
function readConnectResult() {
  const q = new URLSearchParams(location.search);
  if (!q.get("connected")) return null;
  const r = { provider: q.get("connected"), ok: q.get("ok") === "1", msg: q.get("msg") || "" };
  history.replaceState(null, "", location.pathname + location.hash);
  return r;
}
async function loadGscInfo() {
  try {
    S.gscInfo = await engine("gsc_info");
    if (S.gscInfo.configured) { try { S.gscList = (await engine("gsc_list")).sites; } catch { S.gscList = []; } }
  } catch (err) { S.gscInfo = { configured: false }; toast(err.message); }
  if (S.adding === "gsc") render();
}
async function loadAeoInfo() {
  if (loadAeoInfo.busy) return; loadAeoInfo.busy = true;
  try { S.aeoInfo = await engine("aeo_info"); } catch { S.aeoInfo = { engines: {} }; }
  loadAeoInfo.busy = false;
  if (S.data[S.siteId] && !S.modal) render();
}
async function refresh() {
  await Promise.all([loadSites(), loadSite(S.siteId)]);
  S.freshData = true; delete S.sales[S.siteId];
  render();
}
function pollAeo() {
  clearTimeout(pollAeo.t);
  const d = S.data[S.siteId];
  if (!d?.aeoRuns?.[0] || d.aeoRuns[0].status !== "running") return;
  pollAeo.t = setTimeout(async () => { if (["growth", "geo", "today", "connections", "team"].includes(S.page) && !S.modal) { await refresh(); await loadAeoInfo(); } pollAeo(); }, 30000);
}
function nextMonday() {
  const d = new Date(); const add = ((8 - d.getDay()) % 7) || 7; d.setDate(d.getDate() + add); d.setHours(7, 38, 0, 0); return d.toISOString();
}

setInterval(async()=>{if(!S.session||!S.siteId||document.hidden||S.modal||['INPUT','TEXTAREA','SELECT','BUTTON','A','SUMMARY'].includes(document.activeElement?.tagName))return;try{await Promise.all([loadOperations(S.siteId),loadOpps(S.siteId),loadMetrics(S.siteId)]);if(S.supportOpen)await loadSupport(S.siteId);if(S.supportOpen||['team','today','connections','paid','playbooks'].includes(S.page))render();}catch{}},30000);
boot().catch(renderError);
// ---------- Command palette (Ctrl/Cmd+K or "/") ----------
function paletteItems() {
  const items = [], s = siteById(S.siteId);
  if (s) {
    const go = (label, page, sub, hint) => items.push({ group: "Go to", label, hint: hint || s.name, run: () => { location.hash = href(page, sub); } });
    go("Home", "today"); go("To review", "inbox"); go("Results", "growth");
    if (S.isAdmin) { go("SEO", "seo"); go("GEO / AEO", "geo"); go("Content drafts", "content", "drafts"); go("Paid ads", "paid"); go("Integrations", "connections"); go("Business details", "business"); }
    items.push({ group: "Actions", label: "Refresh this business", hint: s.name, run: () => scheduleLive(S.siteId, 0) });
    if (S.isAdmin) items.push({ group: "Actions", label: "Find more work now", hint: "Samaritan", run: () => { location.hash = href("today"); setTimeout(() => document.querySelector("[data-wl-run]")?.click(), 600); } });
  }
  if (S.isAdmin) items.push({ group: "Go to", label: "All clients", hint: "Agency", run: () => { location.hash = "#/agency"; } });
  for (const x of S.sites || []) items.push({ group: "Clients", label: x.name, hint: x.domain || "", run: () => { location.hash = `#/w/${encodeURIComponent(x.id)}/today`; } });
  for (const o of (S.opps?.[S.siteId]?.rows || []).filter((o) => o.stage === "ready" && o.draft_id).slice(0, 8)) items.push({ group: "Ready for you", label: o.title, hint: "Review", run: () => { location.hash = href("content", "drafts"); setTimeout(() => document.getElementById("draft-" + o.draft_id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 500); } });
  return items;
}
const fuzzy = (q, s) => { q = q.toLowerCase(); s = s.toLowerCase(); if (!q) return 1; if (s.includes(q)) return 3; let i = 0; for (const c of s) if (c === q[i]) i++; return i === q.length ? 1 : 0; };
document.addEventListener("click",e=>{if(e.target.closest("[data-workspace-search]"))openPalette();});
function openPalette() {
  if (document.querySelector(".cmdk")) return;
  const all = paletteItems(), wrap = document.createElement("div");
  wrap.className = "cmdk"; wrap.innerHTML = `<div class="cmdk-box" role="dialog" aria-label="Command menu"><input class="cmdk-in" placeholder="Jump to a client, page or action…" aria-label="Search"><ul class="cmdk-list" role="listbox"></ul><p class="cmdk-foot">↑↓ to move · Enter to open · Esc to close</p></div>`;
  document.body.appendChild(wrap);
  const input = wrap.querySelector("input"), list = wrap.querySelector("ul"); let sel = 0, shown = [];
  const close = () => wrap.remove();
  const draw = () => {
    const q = input.value.trim();
    shown = all.map((x) => ({ x, sc: Math.max(fuzzy(q, x.label) * 2, fuzzy(q, x.hint)) })).filter((r) => r.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 12).map((r) => r.x);
    sel = Math.min(sel, Math.max(0, shown.length - 1)); let g = "";
    list.innerHTML = shown.length ? shown.map((x, i) => `${x.group !== g ? `<li class="cmdk-g">${esc(g = x.group)}</li>` : ""}<li role="option" class="cmdk-i ${i === sel ? "on" : ""}" data-i="${i}"><span>${esc(x.label)}</span><small>${esc(x.hint)}</small></li>`).join("") : `<li class="cmdk-g">No matches</li>`;
  };
  input.addEventListener("input", () => { sel = 0; draw(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); const x = shown[sel]; close(); x?.run(); }
    else if (e.key === "Escape") close();
  });
  list.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (!li) return; const x = shown[+li.dataset.i]; close(); x?.run(); });
  wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
  draw(); input.focus();
}
document.addEventListener("keydown", (e) => {
  const a = document.activeElement, typing = a && (["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) || a.isContentEditable);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { if (!S.session) return; e.preventDefault(); openPalette(); return; }
  if (!typing && e.key === "/" && S.session && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openPalette(); }
});

// ---------- Draft auto-save: typed text survives a closed tab or a background refresh ----------
const DRAFT_FIELDS = "#de-title, #de-body, .suggest-form textarea[name=note]";
const draftKey = (el) => { const f = el.closest("form"); return f ? `gb-draft:${S.siteId}:${f.id || f.className}:${f.dataset.id || ""}:${el.id || el.name}` : null; };
let draftSaveT = 0;
document.addEventListener("input", (e) => {
  if (!e.target.matches?.(DRAFT_FIELDS)) return; const el = e.target;
  clearTimeout(draftSaveT); draftSaveT = setTimeout(() => { const k = draftKey(el); if (!k) return; try { el.value ? localStorage.setItem(k, el.value) : localStorage.removeItem(k); } catch { /* storage off */ } }, 300);
});
document.addEventListener("submit", (e) => { for (const el of e.target.querySelectorAll?.(DRAFT_FIELDS) || []) { const k = draftKey(el); try { k && localStorage.removeItem(k); } catch { /* */ } } }, true);
new MutationObserver(() => {
  for (const el of document.querySelectorAll(DRAFT_FIELDS)) {
    if (el.dataset.restoreChecked) continue; el.dataset.restoreChecked = "1";
    let saved = null; try { saved = localStorage.getItem(draftKey(el) || ""); } catch { /* */ }
    if (saved && saved !== el.value) { el.value = saved; const d = el.closest("details"); if (d) d.open = true; const n = document.createElement("small"); n.className = "draft-restored"; n.textContent = "Unsaved text restored"; el.after(n); }
  }
}).observe(document.body, { childList: true, subtree: true });
// Provider-native website connection and exact-change review (agency access).
document.addEventListener('submit',async e=>{
 if(e.target.id!=='website-connect-form')return;e.preventDefault();const form=e.target,button=form.querySelector('button[type=submit]'),status=form.querySelector('[data-web-status]'),sid=S.siteId;
 button.disabled=true;status.textContent='Verifying project access and matching the business domain…';
 try{const provider=form.dataset.provider;const response=await engine('website_connect',{site_id:sid,provider,secret:form.elements.secret.value,project_id:provider==='netlify'?form.elements.project.value:undefined,project_url:provider==='framer'?form.elements.project.value:undefined});form.elements.secret.value='';S.adding=null;await refresh();toast(response.detail?.blocked?'Connected for reading. Source access is needed for edits.':'Project connected. Reviewed website editing is enabled.');}catch(err){status.textContent=err.message;button.disabled=false;}
});
document.addEventListener('click',e=>{const button=e.target.closest('[data-website-open]');if(!button)return;const s=siteById(S.siteId),d=S.data[S.siteId],c=d?.connectors.find(c=>c.id===button.dataset.websiteOpen);if(s&&c)window.ImpacktWebsites.editor({site:s,connector:c,drafts:d.drafts||[],engine});});

// Keep the search pilot form's typed values across re-renders (read back by searchExperimentsView).
document.addEventListener('input',e=>{if(e.target.closest?.('#search-experiment-form')){S.searchDrafts||={};S.searchDrafts[S.siteId]||={};S.searchDrafts[S.siteId][e.target.name]=e.target.value;}});
})();
