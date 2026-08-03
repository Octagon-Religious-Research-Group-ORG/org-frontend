---
paths: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/app/sitemap.ts", "src/app/robots.ts", "src/components/seo/**/*", "src/config/seo.ts", "public/google*.html", "public/BingSiteAuth.xml", "public/*.txt"]
---

# SEO Standards

## Rule 21: SEO Standards

**All projects follow the workspace SEO standard documented in `.claude/skills/seo-pipeline/`. All pages must have proper metadata, structured data, and be submitted to search engines. Run `/seo-update projects/{name}` before deployments to validate compliance.**

**Core Requirements:**

**Domain 1: Metadata**
- `metadataBase` set to `new URL(process.env.NEXT_PUBLIC_SITE_URL)` in root layout
- `title.template` set to `'%s | Site Name'` in root layout (never repeat site name on every page)
- Every page exports `generateMetadata()` or `export const metadata` with unique title (30–60 chars) and description (120–160 chars)
- All pages have `alternates.canonical` and `openGraph.url`
- Twitter card type `'summary_large_image'` on public-facing pages

**Domain 2: Structured Data (JSON-LD)**
- Root layout: `Organization` + `WebSite` schema via `<JsonLd>` component
- Every page: `WebPage` schema minimum
- Every non-root page: `BreadcrumbList` schema
- Service/product pages: `Service` schema
- Pages with FAQ sections: `FAQPage` schema
- Blog/content pages: `Article` schema
- Use `<JsonLd>` from `src/components/seo/JsonLd.tsx` (server-rendered `dangerouslySetInnerHTML` with static object — safe pattern)

**Domain 3: Technical Foundation**
- `src/app/sitemap.ts` — all public pages, uses `NEXT_PUBLIC_SITE_URL`
- `src/app/robots.ts` — allows all crawlers, sitemap URL
- Dynamic OG image at `src/app/og/route.tsx` (ImageResponse from `next/og`)
- `src/config/seo.ts` — centralized: `baseUrl`, `siteName`, `defaultOgImage`, `twitterHandle`

**Domain 4: Core Web Vitals**
- ALL images: `next/image` with explicit `width`/`height`/`alt` — never raw `<img>`
- LCP image (largest above-the-fold): must have `priority` prop
- ALL fonts: `next/font` — never external CDN `<link>` or `@import`
- Non-critical components: `dynamic()` with `{ ssr: false }` or `loading: 'lazy'`

**Domain 5: Keyword Strategy**
- Primary keyword in page `title`, `description`, `h1`, and JSON-LD `name`/`description`
- GSC Search Analytics provides real keyword data for established sites (free)
- New sites: semantic content analysis for keyword targets → `outputs/{project}-seo-keywords.md`

**Domain 6: External Submissions**
- Google Search Console property verified and sitemap submitted
- Bing Webmaster Tools site registered and sitemap submitted
- IndexNow key file at `public/{KEY}.txt` — submit new/updated URLs after each deployment
- Verification files (`public/google{hash}.html`, `public/BingSiteAuth.xml`) MUST NOT be deleted

**Domain 7: On-Page Standards**
- Each page has EXACTLY ONE `<h1>` containing the primary keyword
- No duplicate titles or descriptions across pages
- Internal links use descriptive anchor text (never "click here")
- Title uses short form only — `title.template` in layout appends `| Site Name` automatically

**Critical Pattern — `'use client'` Pages:**
Next.js App Router CANNOT export `metadata` from `'use client'` files. ALWAYS split:
```
src/app/{route}/page.tsx             ← Server: exports metadata, renders <PageNameClient>
src/app/{route}/_components/
  {PageName}Client.tsx               ← 'use client': all interactive logic
```

**Prohibited Patterns:**
- ❌ `export const metadata` and `'use client'` in the same file
- ❌ Raw `<img>` tags (causes CLS, fails Core Web Vitals)
- ❌ External font CDN (`<link>` or `@import`) for fonts
- ❌ Hardcoded production URLs in OG metadata or sitemap
- ❌ Duplicate `title` or `description` across pages
- ❌ Removing verification files (`public/google*.html`, `public/BingSiteAuth.xml`, `public/*.txt`)
- ❌ `robots.index: false` on public pages
- ❌ Missing `alternates.canonical` on non-root pages

**Commands:**
- `/seo-init projects/{name}` — Initialize or audit SEO (Audit-Only, Harden Existing, Implement From Scratch)
- `/seo-update projects/{name}` — Validate ongoing compliance across seven domains (35 checks)

For complete SEO standard, see `.claude/skills/seo-pipeline/references/`
