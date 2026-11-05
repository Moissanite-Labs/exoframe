# SPEC — ExoFab public intake (Crystal Lattice)

Owner: grk-lumen (design) → grk-smith (build). Status: design locked, ready to build.
Repo: `Moissanite-Labs/exoframe` (default branch `main`). Ships at **https://moissanite-labs.github.io/exoframe**.
Prototypes: `docs/design/public-intake/prototypes/`. Visual provenance: Crystal Lattice, Moissanite-Labs/exofab PR #20 (from direction in #17).

## 1. Purpose and non-goals
**Purpose.** A public surface where anyone can (1) suggest something for ExoFab to build, (2) see what was picked, and (3) watch it move from idea to shipped. Shipping fast, in public, is the proof that ExoFab works.

**Non-goals.**
- Not the full ExoFab hub. No sign-in, workspaces, or project internals.
- Not Synbios. "Building in Synbios" is an outbound link only.
- No decision flows (Approve / Decline / send to testers) on the public site. Those stay inside ExoFab.
- No comments, voting, or accounts in v1.

## 2. Brand rule
- The product is **ExoFab** (the existing demo writes "Exofab"; either is fine, but pick **ExoFab** for this site and stay consistent). The wordmark is mono uppercase `EXOFAB`.
- Never call the product "Exo" by itself, in copy, alt text, titles, or metadata.
- **exoframe** is only the repo and Pages host name. It shows up in the URL, never as a product name in the UI. The UI says "ExoFab public intake".

## 3. Tokens (copied 1:1 from PR #20 `:root`)
Source of truth: `prototypes/tokens.css`. Do not change values.

| Token | Value | Use |
|---|---|---|
| --bg | #08090a | page |
| --s0 / --s1 / --s2 | #0a0c0e / #0e1012 / #14171a | inputs / panels / raised |
| --line / --line-2 | #22262b / #2e333a | borders |
| --tx / --tx2 / --tx3 | #eceef0 / #a9b0b9 / #868e98 | text tiers (all ≥4.5:1 on --bg and --s1) |
| --carbon / --carbon-dim | #f2ab6d / #3a2717 | human work (circle) |
| --silicon / --silicon-dim | #7cc6f2 / #13303f | agent work (diamond), building |
| --ice | #e9f4ff | primary CTA, pending/human-decision, accepted |
| --ok / --ok-dim | #8fe0b0 / #12291d | shipped |
| --ink / --ink-glow / --note-hl | #dff1ff / #7cc6f2 / #14202b | reserved (unused here) |
| --focus | #ffd79a | focus ring |
| --r-s/m/l | 4 / 8 / 14px | radii |
| --sp-1…8 | 4,8,12,16,24,32,48,64px | spacing |
| --ease-out / -io / -pen | cubic-beziers from PR #20 | motion |
| --d-fast/med/slow/sign | 140/320/900/1200ms | durations |
| --sans / --mono / --serif | Geist / Geist Mono / Instrument Serif stacks with **local** fallbacks | type |

Single addition for this site: `--err:#ff9b8f` (form errors; ~8.9:1 on --bg). The three `@font-face` local fallback rules are copied as they are. **No remote fonts.**

## 4. IA and page map
Three static routes on Pages, all sharing `tokens.css`:

| Route | Prototype | Content |
|---|---|---|
| `/exoframe/` | index.html | Brand bar, hero (headline, lede, CTAs), Harbor Light lattice, How it works (3 steps) |
| `/exoframe/submit/` | submit.html | Form → success state (same URL; success replaces form in place) |
| `/exoframe/queue/` | queue.html | Filters, reverse-chronological cards, empty state. Card anchors `#idea-0042`. `?status=` preselects a filter |

Use relative links or a single base path so the `/exoframe/` prefix works. Primary nav: Submit, Queue (`aria-current="page"` on the active route). The wordmark links home.

## 5. Component inventory and states
| Component | States / rules |
|---|---|
| Skip link | hidden until focus; jumps to `#main` |
| Brand bar | hex mark (`assets/mark.svg`) + `EXOFAB` mono + dashed `public intake` chip + nav. One row at 390px, no wrap |
| Nav link | default --tx2; hover --tx; current gets a --silicon 2px underline + `aria-current`; target ≥44px tall |
| Primary CTA `.btn.ice` | --ice bg, --bg text, 48px tall; hover shows a 4px ice halo; active moves down 1px; focus shows the --focus ring |
| Secondary `.btn` / text link | --s2 button (44px); text link --tx2 underlined |
| Hero lattice | see §6. States: idle, node hover/focus (core scales up, focus ring, tooltip), paused, reduced-motion |
| "Example data · simulation" notice | ice outline pill. Always visible over the lattice |
| Form field | default; hover border #3d444d; focus 2px --focus outline; invalid: --err border + inline message (linked with aria-describedby) + `aria-invalid` |
| Error summary | appears above the form on submit, `role=alert`, gets focus, lists links to each bad field |
| Checkbox | 22px with an accent of --ice, whole label ≥44px tall, **default checked** |
| Success panel | gets focus; hex gem; "Thank you. Your idea is in."; mono queue id; links to queue card + submit another; the polite live region announces the id |
| Status chip | see §5a |
| Filter group | `role=group`, toggle buttons with `aria-pressed`, counts in mono; 44px tall; a polite live line "Showing N ideas" |
| Queue card | mono id, status chip, title (h2), blurb, opened date, optional submitter name, optional Synbios link (building/shipped only), mini lattice glyph (`role=img`, label "Stage n of 5: Name"). `:target` shows an ice border |
| Mini glyph | 4 concentric hexes plus a core. Current ring ice 1.6px; past rings #4a5560; future rings dashed #22262b. Core is ice at stage 0, carbon otherwise |
| Empty state | "No ideas here yet. Submit the first one." (link) |
| Focus | global `:focus-visible{outline:2px solid #ffd79a;offset 3px}`. Lattice nodes get a #ffd79a ring instead of a box outline |

### 5a. Status chips (text + shape, never colour alone)
| Status | Label | Style | Shape mark |
|---|---|---|---|
| submitted | Submitted | --tx2 text, dashed --tx3 border | dashed circle |
| accepted | Accepted | --ice text + border | outline circle |
| building | Building | --silicon text/border, --silicon-dim fill | filled diamond |
| shipped | Shipped | --ok text/border, --ok-dim fill | ✓ |

Status maps to lattice stage like this: submitted=0 Idea, accepted=1 Shape, building=2–3 Prototype/Build, shipped=4 Ship. The data carries `stage` separately so a building card can show 2 or 3.

## 6. Lattice port notes (from PR #20 `site/index.html`)
**Take:** the axial hex helpers (`dirs`, `ring(k)`, `px(q,r)` with S=31), the `el()` SVG builder, the gradients `gc`, `gs`, and `bgglow` (renamed `bg`), the guide hex polygons, adjacency edges, the `shape()` builder (circle = human, diamond = agent), the pending node's `pulse` + dashed `ring`, the `spin`/`breathe` keyframes, the tooltip positioning math, and the Pause motion toggle (`motion-paused` class).
**Strip:** the decision panel, sources/notes and provenance threads, the signature, Approve/Decline/send, the demo log + JSON download, the census ring key, live work, the milestone toast, the `fire` crystallize animation, Build-ring forming nodes, and the spectrum `glint`.
**Harbor Light data (Example data):** ring 0 has 1 human node (Rosa, original idea). Ring 1 has 6 nodes (3 human, 3 agent). Ring 2 (Prototype, current) has 8 of 12 positions filled: 7 bonded plus 1 pending ("Loom · publish to testers", waiting on a human decision). The other 4 ring-2 positions are ghost dots. Ring 3 is a dashed guide only. Agents are named Scout, Keel, and Loom; people are named Rosa and Dev. The stage strip above the lattice shows Idea / Shape / **Prototype · now** (`aria-current="step"`).
**A11y:**
- The SVG is `role=group` with a summary `aria-label`. Each real node is `<g tabindex=0 role=img aria-label="Person Rosa: … Idea stage, bonded, finished.">`. Ghost dots and edges are `aria-hidden`.
- The tooltip is visual only (`aria-hidden`), because the label already carries the text. It shows on hover and focus and closes on Escape.
- Each node has an invisible 22px-radius hit target.
- Under `prefers-reduced-motion: reduce`, no animation runs and the Pause button is hidden. Otherwise Pause/Resume is a `aria-pressed` toggle.
- The legend shows shapes (circle, diamond, dashed ring) alongside colour.
- Keep the generated SVG under ~10 KB of DOM. Build it inline in a small script (<4 KB). No Three.js, no libraries.

## 7. Copy (usable; grk-herald may refine)
**Global.** Title suffix " · ExoFab public intake". Footer: "Moissanite Labs · ExoFab" (link to https://github.com/Moissanite-Labs/exofab) · "We build in the open, with the people we build for."
**Landing.** Eyebrow "ExoFab · built in public". H1 "Tell us what to build. *Watch it take shape.*" Lede "Send an idea, no account needed. We choose ideas in the open, build them with you on ExoFab, and show every finished piece of work along the way." CTA "Submit an idea"; link "See the public queue →". Lattice title "Harbor Light", subtitle "A tiny tide and ferry board for coastal volunteers". Notice "Example data · simulation". Caption "Each bonded node is a finished piece of work, by a person or an agent. The ice pulse is the piece waiting on a human decision. When a ring fills, that stage is done and the next one starts." Small print "Fictional project · no real data". How it works: "You send an idea" / "A title and a few lines on what it should do. Your email stays private." · "We pick it in public" / "Accepted ideas move up the queue so everyone can see what's next." · "We build it with you" / "People and agents work in Synbios. Each finished piece shows up on the lattice until it ships."
**Submit.** H1 "Submit an idea". Intro "Tell us what you'd like built. No account needed. We read every idea, and the ones we take on are built in public." Labels, hints, and errors are exactly as written in `submit.html`. CTA "Submit idea". Success: "Thank you. Your idea is in." / "Your queue id is idea-NNNN. It now shows on the public queue as Submitted." (private variant: "It is private, so only the ExoFab team will see it.") / "We review new ideas each week. If you left an email, we'll write when its status changes. Nothing else." / "View it in the queue" · "Submit another idea".
**Queue.** H1 "What we're building next". Intro "Every idea that was shared publicly, newest first. Statuses move from submitted to accepted, building in Synbios, and shipped." Link labels "Building in Synbios →" and "See how it was built →" (shipped). Empty: "No ideas here yet. Submit the first one."

## 8. A11y checklist (WCAG 2.2 AA)
- [ ] Text contrast ≥4.5:1 (tx3 #868e98 on #0e1012 ≈ 5.6:1), UI/borders ≥3:1 for chips and inputs
- [ ] `:focus-visible` uses --focus #ffd79a everywhere, and is never removed without a replacement
- [ ] Every input has a visible `<label>`; required fields are marked by text, not colour alone; hints and errors are linked with `aria-describedby`
- [ ] Errors: an inline message on the field plus a focused summary with `role=alert`
- [ ] Success: focus moves to the success panel, and a `role=status` live region announces the queue id
- [ ] Filters use `aria-pressed`; the result count is in a polite live region
- [ ] Status is shown by text + shape + colour
- [ ] `prefers-reduced-motion` stops all animation; Pause motion control is present otherwise (WCAG 2.2.2)
- [ ] Primary actions, nav links, filters, checkbox rows, and card links are ≥44×44px
- [ ] Skip link, `lang="en"`, one h1 per page, landmarks (header/nav/main/footer)
- [ ] axe (wcag2a+aa): 0 violations (prototypes currently pass at 390 and 1440)
- [ ] No horizontal scroll at 320–1440px

## 9. Performance budget
- Lighthouse mobile ≥90 for Performance, Accessibility, Best Practices, and SEO on all three routes
- No remote fonts, no third-party scripts, no analytics in v1, no Three.js or frameworks required (plain HTML/CSS/JS is preferred; a static generator is fine if the output stays the same)
- Per page: HTML+CSS+JS ≤ 40 KB uncompressed; the lattice SVG is generated inline; `mark.svg` < 1 KB
- No lazy-loading tricks are needed because nothing is heavy. Each page has a meta description, theme-color, and an SVG favicon

## 10. Stub contracts
Until a backend is wired, the queue reads static `data/ideas.json`, and the form simulates success **without a network call**. Mark these in code as `// STUB`.

`POST /api/ideas` (request)
```json
{ "title": "string 1-80, required", "what": "string 1-2000, required",
  "who": "string ≤120 | null", "name": "string ≤80 | null",
  "email": "string ≤200 | null  (private; never returned by GET)",
  "public": true }
```
→ `201 { "id": "idea-0042", "status": "submitted", "public": true }` · `422 { "errors": { "field": "message" } }` · `429` rate-limited (show: "Too many ideas from here just now. Try again in a few minutes.")

`GET /api/ideas?status=all|submitted|accepted|building|shipped`
```json
{ "ideas": [ { "id": "idea-0042", "title": "…", "blurb": "…", "status": "building",
  "stage": 2, "opened": "2026-10-28", "synbios_url": "https://… | null", "submitter": "Rosa | null" } ] }
```
Returns only `public: true` ideas. **Never returns email.** It is sorted by `opened` descending. Ids are zero-padded to 4 digits (`idea-%04d`).
- The backend host is not decided (§12). Smith should keep the base URL in one constant.
- **Bot check:** add a privacy-respecting check before the backend goes live (honeypot field + server rate limit, or Cloudflare Turnstile). Turnstile adds a third-party script, so re-check Lighthouse after adding it. The prototype has no captcha.

## 11. Phased build order
1. **Tokens + shell:** `tokens.css`, brand bar, footer, skip link, the 3 routes, Pages base path `/exoframe/`
2. **Landing + lattice port** (§6)
3. **Form** with client validation, error summary, and success state (stubbed)
4. **Queue** from `data/ideas.json`, filters, `?status=`, `#id` anchors, empty state
5. **Wire intake API stub:** `POST`/`GET` behind one config constant; keep the static JSON as a fallback when the API is unset
6. **Pages deploy:** GitHub Actions → Pages from `main`; verify https://moissanite-labs.github.io/exoframe/ and run Lighthouse mobile on all 3 routes

## 12. Acceptance checks
- [ ] Three routes are live under `/exoframe/` and share one `tokens.css`, with values matching §3
- [ ] "Exo" never appears alone as a product name (`grep -nw "Exo"` returns nothing)
- [ ] Landing: lattice renders 15 real nodes (6 human circles + 9 agent diamonds; 1 agent node pending with the ice pulse); Tab reaches every node and shows a tooltip; Pause toggles; reduced motion means nothing moves; "Example data · simulation" is visible
- [ ] There are no Approve/Decline/send controls anywhere on the site
- [ ] Form: an empty submit shows 2 errors + summary; a bad email shows an error; a valid submit shows the success state with an id, and focus lands on the success panel; the public checkbox defaults ON; email never appears in the queue
- [ ] Queue: newest first; all 5 filters work; counts are correct; an empty filter shows the empty state; the glyph matches the stage
- [ ] Layout has no overflow at 320 / 390 / 768 / 1440
- [ ] axe reports 0 violations; Lighthouse mobile ≥90 ×4 on all routes
- [ ] There are zero network requests besides same-origin page assets (until the API is wired)

## 13. Locked defaults product may change later
- Weekly review cadence promised in success copy ("We review new ideas each week")
- Public listing checkbox defaults to ON
- Submitter name shown on the card when given
- 5-stage ladder (Idea, Shape, Prototype, Build, Ship) and how it maps to the 4 statuses
- Queue id format `idea-NNNN`
- Synbios link shows only on building/shipped cards
- Bot-check method (honeypot+rate limit vs Turnstile) and backend host for `/api/ideas`
- No moderation UI in v1. Assumes the team edits `ideas.json`/the backend directly. Product should decide whether a submitted public idea is shown before review (prototype: yes, as Submitted)
