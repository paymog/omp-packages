import { marked } from "marked";

const KEEP: Record<string, string[]> = {
  a: ["href", "title"],
  img: ["src", "alt", "title", "width", "height", "align"],
  td: ["align", "colspan", "rowspan"],
  th: ["align", "colspan", "rowspan"],
  p: ["align"],
  div: ["align"],
  h1: ["align"], h2: ["align"], h3: ["align"], h4: ["align"], h5: ["align"], h6: ["align"],
  details: ["open"],
  ol: ["start"],
  abbr: ["title"], b: [], blockquote: [], br: [], caption: [], code: [], dd: [], del: [], dl: [], dt: [], em: [], hr: [], i: [],
  ins: [], kbd: [], li: [], picture: [], pre: [], q: [], s: [], samp: [], small: [], span: [], strong: [], sub: [], summary: [],
  sup: [], table: [], tbody: [], tfoot: [], thead: [], tr: [], tt: [], u: [], ul: [],
};

// Raw-text and active elements: unwrapping them would emit their content as live markup.
const DROP: Record<string, true> = {
  script: true, style: true, textarea: true, title: true, xmp: true, iframe: true, noembed: true, noframes: true, noscript: true,
  plaintext: true, template: true, svg: true, math: true, object: true, embed: true, select: true, form: true, input: true, button: true,
  source: true, video: true, audio: true, frame: true, frameset: true, base: true, link: true, meta: true, head: true,
};

/** Base URLs for relative links and images in a README. Only GitHub repos resolve. */
export function readmeBase(repo: string | null): { link?: string; img?: string } {
  const m = repo?.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/);
  return m ? { link: `https://github.com/${m[1]}/blob/HEAD/`, img: `https://raw.githubusercontent.com/${m[1]}/HEAD/` } : {};
}

function safeUrl(raw: string, base: string | undefined, schemes: string[]): string | null {
  const v = raw.trim();
  if (v.startsWith("#")) return v;
  try {
    const u = new URL(v, base);
    return schemes.includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

/** Markdown (with inline HTML) from an untrusted README to an allowlisted HTML fragment. */
export async function renderReadme(md: string, repo: string | null): Promise<string> {
  const base = readmeBase(repo);
  const raw = await marked.parse(md, { gfm: true });
  const out = new HTMLRewriter()
    .on("*", {
      element(e) {
        const tag = e.tagName;
        if (DROP[tag]) {
          e.remove();
          return;
        }
        const keep = KEEP[tag];
        if (!keep) {
          e.removeAndKeepContent();
          return;
        }
        for (const [name] of [...e.attributes]) if (!keep.includes(name)) e.removeAttribute(name);
        // The package page owns the only h1.
        if (/^h[1-5]$/.test(tag)) e.tagName = `h${Number(tag[1]) + 1}`;
        if (tag === "a") {
          const href = safeUrl(e.getAttribute("href") ?? "", base.link, ["https:", "http:", "mailto:"]);
          if (href) e.setAttribute("href", href).setAttribute("rel", "nofollow ugc noopener");
          else e.removeAttribute("href");
        }
        if (tag === "img") {
          const src = safeUrl(e.getAttribute("src") ?? "", base.img, ["https:", "http:"]);
          if (!src) {
            e.remove();
            return;
          }
          e.setAttribute("src", src).setAttribute("loading", "lazy").setAttribute("referrerpolicy", "no-referrer");
          if (!e.hasAttribute("alt")) e.setAttribute("alt", "");
        }
      },
    })
    .onDocument({ comments: (c) => void c.remove() })
    .transform(new Response(raw));
  return out.text();
}
