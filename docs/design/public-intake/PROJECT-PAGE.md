# Project page IA (public)

Owner: grk-lumen (design). Status: approved for v0 slice.  
Route: `/exoframe/projects/<slug>/` on GitHub Pages (repo path `projects/<slug>/`).  
Visual system: [`SPEC.md`](SPEC.md) §3 tokens, §5a status chips, §8–9 a11y/perf. Architecture/security: [`../project-flow.md`](../project-flow.md).

## Brand

- Product name **ExoFab** only — never “Exo” alone.
- **exoframe** is the GitHub/Pages host name, not shown as a product label in UI.

## Shell

Same brand bar and footer as intake (`tokens.css` 1:1). Primary nav stays **Submit | Queue** (no Projects nav item in v1). Wordmark links home (`index.html`).

Page title suffix: ` · ExoFab project`.

## Queue integration

Queue cards in **building** or **shipped** status show outbound links in the card footer:

1. Existing Synbios link (“Building in Synbios →” / “See how it was built →”) when `synbios_url` is set.
2. **Open project →** when a published project exists for that `idea_id` (`projects/<slug>/`).

Submitted and accepted cards stay queue-only (no project link).

## Page stack (top → bottom)

### 1. EXAMPLE banner (Harbor Light only)

Ice outline pill (`.notice`): **Example project · simulation** — same voice as the landing lattice notice. Real projects omit this block.

For EXAMPLE Harbor Light, a short secondary note may state explicit gaps (no separate working repo yet; no delivered artifact; `work/*` is a stand-in only).

### 2. Hero

- Status chip (§5a) using `.st.<status>` — text + shape, never colour alone.
- **H1** project title.
- One-line lede (`blurb`).
- Meta row (mono / `--tx2`): opened date · `idea-NNNN` linked to `queue.html#idea-NNNN` · optional submitter name.

### 3. Actions (targets ≥44px)

| Status | Primary | Secondary |
|--------|---------|-----------|
| building, shipped | `.btn.ice` **Open working repo →** (external) | **Building in Synbios →** when `synbios_url` is present and differs from working repo URL |
| submitted, accepted | *(none)* | *(none)* |

No Approve/Decline or other decision controls on the public page.

### 4. Stage strip

Horizontal steps: **Idea / Shape / Prototype / Build / Ship** — maps to queue `stage` (0–4). Current step gets `aria-current="step"`. No Harbor Light lattice SVG on this page.

### 5. Activity feed

- `<ol class="activity">` reverse-chronological (newest first in source JSON).
- Each row: mono timestamp · actor mark (circle = human, diamond = agent, never colour alone) · **who** · short **verb** · optional deep link.
- **Pending** rows (e.g. Loom): ice/pending copy (“Waiting on a human decision”) — not interactive approve/decline.
- Cap ~8–12 rows for EXAMPLE data.
- Empty state: “No public activity yet.”

### EXAMPLE Harbor Light seeds (fictional)

1. Rosa — submitted idea (link to queue card)  
2. ExoFab — accepted in public queue  
3. Scout — shaped brief  
4. Keel — opened working branch (link to stand-in)  
5. Loom — publish to testers (**pending**, human decision language only)

## Out of scope on this page

Decision flows, comments, voting, accounts, internal notes, Worker/API implementation details.

## Acceptance

- [ ] Harbor Light at `projects/harbor-light/` matches stack above.
- [ ] Queue building/shipped cards show Synbios + Open project when applicable.
- [ ] axe wcag2aa: 0 violations at 390px; Lighthouse mobile a11y ≥90 target.
- [ ] Aggregation regenerates HTML from JSON only (no hand-edited activity copy in `index.html`).
