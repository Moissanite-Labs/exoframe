/* ExoFab crystal lattice — data-driven PR #20 runtime (Rift / project pages) */
(function (global) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const S = 31;
  const R3 = Math.sqrt(3);
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

  function ring(k) {
    if (!k) return [[0, 0]];
    const out = [];
    let q = dirs[4][0] * k;
    let r = dirs[4][1] * k;
    for (let i = 0; i < 6; i++) for (let j = 0; j < k; j++) {
      out.push([q, r]);
      q += dirs[i][0];
      r += dirs[i][1];
    }
    return out;
  }
  const px = (q, r) => [S * R3 * (q + r / 2), S * 1.5 * r];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseConfig(override) {
    if (override && typeof override === "object") return normalizeConfig(override);
    if (global.__EXO_LATTICE__ && typeof global.__EXO_LATTICE__ === "object") {
      return normalizeConfig(global.__EXO_LATTICE__);
    }
    const tag = document.getElementById("exo-lattice-data");
    if (tag && tag.textContent.trim()) {
      return normalizeConfig(JSON.parse(tag.textContent));
    }
    return normalizeConfig({});
  }

  function deriveStageProgress(works, stageIndex, currentStage) {
    if (stageIndex < currentStage) return 100;
    if (stageIndex > currentStage) return 0;
    const rc = ringCounts(works, stageIndex);
    const recorded = rc.filled + rc.p + rc.forming;
    if (recorded === 0) return 0;
    return Math.round((rc.filled / recorded) * 100);
  }

  function flattenDecision(dec) {
    if (!dec || typeof dec !== "object") return dec;
    const d = { ...dec };
    if (d.proposer && typeof d.proposer === "object") {
      const p = d.proposer;
      d.proposerActor = d.proposerActor || p.actor;
      d.proposedAgo = d.proposedAgo || p.when;
      if (p.build && !d.build) d.build = p.build;
      d.proposer = typeof p.name === "string" && p.name.trim() ? p.name.trim() : "Unknown";
    } else if (typeof d.proposer !== "string") {
      d.proposer = d.proposer ? String(d.proposer) : "Unknown";
    }
    return d;
  }

  function normalizeTraceRows(trace) {
    return (trace || []).map((row) => {
      if (!row || typeof row !== "object") return row;
      const r = { ...row };
      if (r.fromHtml) return r;
      if (typeof r.from === "string" && /<[a-z][\s\S]*>/i.test(r.from)) {
        r.fromHtml = r.from;
        r.from = r.from.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      }
      return r;
    });
  }

  function normalizeConfig(raw) {
    const defaultStages = [
      { n: "001", name: "Idea" },
      { n: "002", name: "Shape" },
      { n: "003", name: "Prototype" },
      { n: "004", name: "Build" },
      { n: "005", name: "Ship" },
    ];
    const stageDefs = (raw.stages && raw.stages.length === 5) ? raw.stages : defaultStages;
    const works = Array.isArray(raw.works) ? raw.works : [];
    const currentStage = typeof raw.currentStage === "number" ? raw.currentStage : 2;
    const stages = stageDefs.map((st, i) => ({
      n: st.n,
      name: st.name,
      progress: deriveStageProgress(works, i, currentStage),
    }));
    const apiBase = (raw.apiBase || global.EXO_API_BASE || "").replace(/\/$/, "");
    let decision = raw.decision === undefined ? null : raw.decision;
    if (decision) decision = flattenDecision(decision);
    return {
      slug: raw.slug || "",
      apiBase,
      rehearsal: Object.assign({ enabled: false, label: "Rehearsal" }, raw.rehearsal || {}),
      project: raw.project || {},
      stages,
      works,
      crew: raw.crew || { roles: [] },
      liveWork: Array.isArray(raw.liveWork) ? raw.liveWork : [],
      trace: normalizeTraceRows(raw.trace),
      decision,
      shipPending: Array.isArray(raw.shipPending) ? raw.shipPending : [],
      currentStage,
      participant: raw.participant || null,
    };
  }

  function workStats(works) {
    const w = works.filter((x) => x.state && x.state !== "ghost");
    const bonded = w.filter((x) => x.state === "done").length;
    const human = w.filter((x) => x.actor === "human" && x.state !== "ghost").length;
    const agent = w.filter((x) => x.actor === "agent" && x.state !== "ghost").length;
    const pending = w.filter((x) => x.state === "pending").length;
    const forming = w.filter((x) => x.state === "forming").length;
    return { bonded, human, agent, pending, forming };
  }

  function ringCounts(works, stage) {
    const inRing = works.filter((x) => x.stage === stage && x.state !== "ghost");
    const done = inRing.filter((x) => x.state === "done");
    const h = done.filter((x) => x.actor === "human").length;
    const a = done.filter((x) => x.actor === "agent").length;
    const p = inRing.filter((x) => x.state === "pending").length;
    const f = inRing.filter((x) => x.state === "forming").length;
    const total = ring(stage).length;
    return { total, filled: done.length, h, a, p, f, forming: f };
  }

  function buildNodes(cfg) {
    const map = {};
    (cfg.works || []).forEach((w) => { if (w.id) map[w.id] = w; });
    const nodes = [];
    const byId = {};
    for (let k = 0; k <= 4; k++) {
      ring(k).forEach(([q, r], i) => {
        const id = `${k}-${i}`;
        const src = map[id];
        const st = src ? src.state : "ghost";
        const actor = src ? src.actor : null;
        const title = src ? (src.label || src.title || "") : null;
        const [x, y] = px(q, r);
        const kind = actor === "human" ? "h" : actor === "agent" ? "a" : null;
        const n = { id, k, i, q, r, x, y, st, kind, title, from: src && src.from, url: src && src.url, raw: src };
        nodes.push(n);
        byId[id] = n;
      });
    }
    (cfg.shipPending || []).forEach((f) => {
      const src = byId[f.from];
      if (!src) return;
      const c = nodes.filter((n) => n.k === 3 && n.st === "ghost" && adj(n, src))
        .sort((a, b) => Math.hypot(a.x - src.x, a.y - src.y) - Math.hypot(b.x - src.x, b.y - src.y))[0];
      if (!c) return;
      c.st = "forming";
      c.kind = f.actor === "human" ? "h" : f.actor === "agent" ? "a" : "a";
      c.title = f.label || f.title;
      c.from = f.from;
    });
    return { nodes, byId };
  }

  function adj(A, B) {
    return Math.hypot(A.x - B.x, A.y - B.y) < S * R3 + 1;
  }

  function actorMark(actor) {
    if (actor === "human") return '<i class="dot"></i>';
    if (actor === "agent") return '<i class="dot a"></i>';
    return '<i class="dot" style="opacity:.5"></i>';
  }

  function initials(name, fb) {
    if (!name) return fb || "??";
    const p = String(name).trim().split(/\s+/);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  }

  function genericSigPaths(initials) {
    const letters = String(initials || "AB").slice(0, 3).toUpperCase();
    const paths = [];
    letters.split("").forEach((ch, idx) => {
      const x0 = 8 + idx * 28;
      const code = ch.charCodeAt(0);
      paths.push(`M${x0} 28 C${x0 + 4} 8, ${x0 + 18} 6, ${x0 + 22} 18 S${x0 + 8} 32, ${x0 + 26} 24`);
      paths.push(`M${x0 + 6} 16 Q${x0 + 14} ${10 + (code % 5)}, ${x0 + 20} 14`);
    });
    paths.push(`M${6} 36 C${40} 32, ${120} 28, ${letters.length * 28 + 20} 22`);
    return paths;
  }

  function ExoCrystalMount(root, config) {
    if (!root) return;
    const cfg = normalizeConfig(config || parseConfig());
    const ctx = { cfg, root, demoLog: [], decisionState: "pending", busy: false, remoteMode: "none" };
    let reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const $ = (sel, el) => (el || root).querySelector(sel);
    const $$ = (sel, el) => [...(el || root).querySelectorAll(sel)];

    renderChrome(ctx, $, $$);
    const lattice = renderLattice(ctx, $);
    renderCensus(ctx, $, $$, lattice);
    renderDecision(ctx, $, $$, lattice);
    renderCrew(ctx, $);
    renderLive(ctx, $, $$);
    renderTrace(ctx, $, lattice);
    bindDemoTools(ctx, $, lattice);
    loadParticipation(ctx, $, $$, lattice).then(() => applyPersistedDecision(ctx, $, $$, lattice));

    return ctx;
  }

  function renderChrome(ctx, $, $$) {
    const p = ctx.cfg.project;
    const reb = ctx.cfg.rehearsal;
    const banner = $("[data-exo-rehearsal-banner]");
    if (banner) {
      banner.hidden = !reb.enabled;
      const lb = $("[data-exo-rehearsal-label]", banner);
      if (lb) lb.textContent = reb.label || "EXOFAB / REHEARSAL";
      const cp = $("[data-exo-rehearsal-copy]", banner);
      if (cp) cp.innerHTML = reb.copy || "Interactive rehearsal only. Choices may stay in this browser unless connected to a participation API.";
      $$("[data-exo-rehearsal-only]", banner).forEach((el) => { el.hidden = !reb.enabled; });
    }
    const crumbs = $("[data-exo-crumbs]");
    if (crumbs) {
      const parts = p.crumbs || ["Moissanite Labs", p.origin || "Project", p.title || ctx.cfg.slug];
      crumbs.innerHTML = parts.map((c, i) => (i ? '<span aria-hidden="true">/</span>' : "") + (i === parts.length - 1 ? `<b>${esc(c)}</b>` : `<span>${esc(c)}</span>`)).join("");
    }
    const chip = $("[data-exo-header-chip]");
    if (chip && p.imported) { chip.hidden = false; chip.textContent = p.imported; }
    const vis = $("[data-exo-visitor]");
    if (vis && ctx.cfg.participant) {
      vis.hidden = false;
      const ini = initials(ctx.cfg.participant.name, "YO");
      vis.innerHTML = `<div class="av h" style="width:28px;height:28px;font-size:10px" aria-hidden="true">${esc(ini)}</div><span>You · ${esc(ctx.cfg.participant.name || "Visitor")}</span>`;
    }
    const eyebrow = $("[data-exo-eyebrow]");
    if (eyebrow) eyebrow.textContent = p.eyebrow || `${ctx.cfg.slug || "project"} / Project view`;
    const tEl = $("[data-exo-title]");
    if (tEl) tEl.textContent = p.title || ctx.cfg.slug || "Project";
    const sub = $("[data-exo-subtitle]");
    if (sub) { sub.textContent = p.subtitle || ""; sub.hidden = !p.subtitle; }
    const bl = $("[data-exo-blurb]");
    if (bl) bl.textContent = p.blurb || "";
    const act = $("[data-exo-project-actions]");
    if (act && p.links) {
      const bits = [];
      if (p.links.working_repo) bits.push(`<a class="btn primary" href="${esc(p.links.working_repo)}" rel="noopener noreferrer" target="_blank">Open working repo →</a>`);
      if (p.links.live_game) bits.push(`<a class="btn ghost" href="${esc(p.links.live_game)}" rel="noopener noreferrer" target="_blank">Play live game →</a>`);
      if (p.links.source_branch) bits.push(`<a class="btn link" href="${esc(p.links.source_branch)}" rel="noopener noreferrer" target="_blank">project/${esc(ctx.cfg.slug)} source</a>`);
      act.innerHTML = bits.join(" ");
    }
    const stagesEl = $("[data-exo-stages]");
    if (stagesEl) {
      stagesEl.innerHTML = ctx.cfg.stages.map((st, i) => {
        const cur = i === ctx.cfg.currentStage;
        const done = i < ctx.cfg.currentStage;
        const cls = done ? "stage done" : cur ? "stage now" : "stage";
        const prog = cur ? ` style="--p:${st.progress || 0}%"` : "";
        const ac = cur ? ' aria-current="step"' : "";
        return `<li class="${cls}"${prog}${ac}><div class="n">${esc(st.n)}</div><div class="t">${esc(st.name)}</div><i class="bar"></i></li>`;
      }).join("");
    }
    const foot = $("[data-exo-crystal-footer]");
    if (foot) foot.innerHTML = p.footer || "Exofab · project view · work counts derive from listed records";
  }

  function renderLattice(ctx, $) {
    const svg = $("#svg", ctx.root);
    if (!svg) return { nodes: [], byId: {}, threads: {}, pend: null, guideEls: [] };
    svg.innerHTML = "";
    const { nodes, byId } = buildNodes(ctx.cfg);
    const el = (t, a, p) => {
      const e = document.createElementNS(NS, t);
      for (const k in a) e.setAttribute(k, a[k]);
      (p || svg).appendChild(e);
      return e;
    };
    const defs = el("defs");
    defs.innerHTML = '<radialGradient id="gc" cx=".35" cy=".3"><stop offset="0" stop-color="#ffd9b5"/><stop offset=".6" stop-color="#f2ab6d"/><stop offset="1" stop-color="#a8632c"/></radialGradient><radialGradient id="gs" cx=".35" cy=".3"><stop offset="0" stop-color="#dcf2ff"/><stop offset=".6" stop-color="#7cc6f2"/><stop offset="1" stop-color="#3a7ea8"/></radialGradient><radialGradient id="halo"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="spec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2ab6d"/><stop offset=".3" stop-color="#f6e27a"/><stop offset=".55" stop-color="#8fe0b0"/><stop offset=".78" stop-color="#7cc6f2"/><stop offset="1" stop-color="#b9a2ff"/></linearGradient><radialGradient id="bgglow"><stop offset="0" stop-color="#1b2633" stop-opacity=".95"/><stop offset=".55" stop-color="#111821" stop-opacity=".5"/><stop offset="1" stop-color="#08090a" stop-opacity="0"/></radialGradient>';
    el("ellipse", { cx: 0, cy: 0, rx: 228, ry: 198, fill: "url(#bgglow)" });
    const ringHex = (k) => ring(k).filter((_, i) => !k || i % k === 0).map(([q, r]) => px(q, r).join(",")).join(" ");
    const guides = el("g");
    for (let k = 1; k <= 4; k++) {
      el("polygon", {
        points: ringHex(k), fill: "none", stroke: k <= 2 ? "#232a31" : k === 3 ? "#1a1f24" : "#15191d",
        "stroke-width": 1, class: "guide", "stroke-dasharray": k === 4 ? "2 5" : "none",
      }, guides);
    }
    const firePoly = el("polygon", { points: ringHex(2), fill: "none", stroke: "url(#spec)", "stroke-width": 2.4, class: "fire", "stroke-linejoin": "round" });
    const len = 6 * 2 * S * R3;
    firePoly.style.setProperty("--len", len);
    firePoly.setAttribute("stroke-dasharray", len);
    const guideEls = [...guides.children];
    const eg = el("g");
    const real = (n) => n.st !== "ghost";
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const A = nodes[a], B = nodes[b];
      if (!adj(A, B)) continue;
      const f = A.st === "forming" ? A : B.st === "forming" ? B : null;
      const o = f === A ? B : A;
      if (f) {
        if (o.id === f.from) el("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: "edge grow" + (f.kind === "h" ? " hf" : "") }, eg);
        continue;
      }
      if (!(real(A) && real(B))) {
        if (A.k >= 3 && B.k >= 3) el("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: "edge ghost" }, eg);
        continue;
      }
      const e = el("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: "edge" + ((A.st === "pending" || B.st === "pending") ? " ghost" : "") }, eg);
      if (A.st === "pending" || B.st === "pending") e.dataset.pend = "1";
    }
    const pend = nodes.find((n) => n.st === "pending");
    const tg = el("g");
    const threads = {};
    const dec = ctx.cfg.decision;
    if (pend && dec && dec.sources) {
      dec.sources.forEach((src, idx) => {
        const n = String(idx + 1);
        const node = byId[src.node || src.workId];
        if (!node) return;
        const mx = (node.x + pend.x) / 2 * 0.55;
        const my = (node.y + pend.y) / 2 * 0.55;
        threads[n] = el("path", { d: `M${pend.x},${pend.y} Q${mx},${my} ${node.x},${node.y}`, class: "thread" }, tg);
      });
    }
    const ng = el("g");
    const shape = (n, g, cls, r) => n.kind === "h"
      ? el("circle", { cx: n.x, cy: n.y, r, class: cls, fill: "url(#gc)" }, g)
      : el("polygon", { points: `${n.x},${n.y - r * 1.25} ${n.x + r * 1.25},${n.y} ${n.x},${n.y + r * 1.25} ${n.x - r * 1.25},${n.y}`, class: cls, fill: "url(#gs)", "stroke-linejoin": "round" }, g);

    nodes.forEach((n) => {
      const g = el("g", { class: "node " + n.st + (n.k === 2 ? " n2" : "") + (n.kind === "h" ? " hf" : ""), "data-id": n.id }, ng);
      g.style.setProperty("--i", n.i);
      if (n.st === "ghost") { el("circle", { cx: n.x, cy: n.y, r: n.k === 3 ? 2 : 1.6, class: "ghostn" }, g); g.style.cursor = "default"; return; }
      el("circle", { cx: n.x, cy: n.y, r: 18, fill: "url(#halo)", class: "halo" }, g);
      el("circle", { cx: n.x, cy: n.y, r: 13, class: "hlring" }, g);
      if (n.st === "pending") {
        el("circle", { cx: n.x, cy: n.y, r: 9, class: "pulse" }, g);
        el("circle", { cx: n.x, cy: n.y, r: 11, class: "ring" }, g);
        const c = shape(n, g, "core", 5.5);
        c.setAttribute("fill", "none"); c.setAttribute("stroke", "#e9f4ff"); c.setAttribute("stroke-width", "1.4");
        n.coreEl = c;
      } else if (n.st === "forming") {
        el("circle", { cx: n.x, cy: n.y, r: 9, class: "arc" }, g);
        const c = shape(n, g, "core", 4.5); c.setAttribute("opacity", ".6");
      } else {
        shape(n, g, "core", n.k === 0 ? 8 : 6);
        if (n.k === 2) el("circle", { cx: n.x, cy: n.y, r: 6, fill: "url(#spec)", class: "glint" }, g);
      }
      n.g = g;
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "img");
      const who = (n.title || "").split(" · ")[0] || "Work";
      g.setAttribute("aria-label", `${n.kind === "h" ? "Person" : n.kind === "a" ? "Agent" : "Work"}: ${n.title || n.id}; ${n.st}`);
      g.addEventListener("focus", () => showTip(ctx, n));
      g.addEventListener("blur", () => $("#tip", ctx.root).classList.remove("on"));
    });

    const tip = $("#tip", ctx.root);
    const lat = $("#lat", ctx.root);
    function showTip(n) {
      if (!n || !n.title || !tip || !lat) return;
      const parts = n.title.split(" · ");
      const who = parts[0] || "Work";
      const what = parts.slice(1).join(" · ") || n.title;
      const st = { done: "bonded", pending: "awaiting approval", forming: "forming now" }[n.st] || n.st;
      tip.innerHTML = `<span class="mono" style="color:${n.kind === "h" ? "var(--carbon)" : "var(--silicon)"}">${n.kind === "h" ? "Person" : n.kind === "a" ? "Agent" : "Work"} · ${st}</span>${esc(who)} — ${esc(what)}`;
      const sr = svg.getBoundingClientRect(), lr = lat.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      const sc = sr.width / vb.width;
      let x = sr.left - lr.left + (n.x - vb.x) * sc + 14;
      let y = sr.top - lr.top + (n.y - vb.y) * sc - 18;
      x = Math.max(8, Math.min(x, lr.width - 250));
      tip.style.left = x + "px"; tip.style.top = y + "px";
      tip.classList.add("on");
    }
    ng.addEventListener("pointerover", (e) => { const g = e.target.closest(".node"); if (g) showTip(byId[g.dataset.id]); });
    ng.addEventListener("pointerout", () => tip && tip.classList.remove("on"));

    updateLatCount(ctx, $, nodes);
    return { nodes, byId, threads, pend, guideEls, svg, showTip, ng };
  }

  function updateLatCount(ctx, $, nodes) {
    const el = $("#latcount", ctx.root);
    if (!el) return;
    const stats = workStats(ctx.cfg.works);
    const you = nodes.some((n) => n.st === "pending") ? stats.pending : 0;
    el.innerHTML = `<b>${stats.bonded}</b> bonded · <b>${stats.human}</b> human · <b>${stats.agent}</b> agent`
      + (you ? ` · <b>${you}</b> awaits you` : "")
      + (stats.forming ? ` · <b>${stats.forming}</b> forming` : "");
  }

  function renderCensus(ctx, $, $$, lat) {
    const ol = $("[data-exo-census]", ctx.root);
    if (!ol) return;
    ol.innerHTML = ctx.cfg.stages.map((st, k) => {
      const rc = ringCounts(ctx.cfg.works, k);
      const cur = k === ctx.cfg.currentStage;
      let countText = rc.filled ? `${rc.filled} piece${rc.filled === 1 ? "" : "s"}` : "Not started";
      if (rc.p) countText = `${rc.filled} of ${rc.total}`;
      if (rc.forming && !rc.filled) countText = `${rc.forming} forming`;
      const split = rc.filled || rc.p || rc.forming
        ? `<span class="split" aria-hidden="true">${rc.h ? `<i class="h" style="flex:${rc.h}"></i>` : ""}${rc.a ? `<i class="a" style="flex:${rc.a}"></i>` : ""}${rc.p ? `<i class="p" style="flex:${rc.p}"></i>` : ""}</span>`
        : "";
      return `<li><button type="button" class="rk${cur ? " now" : ""}" data-k="${k}"><span class="n">${esc(st.n)}<span class="sr"> · ring ${k}${cur ? ", current stage" : ""}</span></span><span class="t">${esc(st.name)}</span><span class="c">${esc(countText)}</span>${split}</button></li>`;
    }).join("");
    $$(".rk", ctx.root).forEach((b) => {
      const k = +b.dataset.k;
      const on = () => {
        if (k) lat.guideEls[k - 1].classList.add("gon");
        b.classList.add("on");
        lat.nodes.filter((n) => n.k === k && n.g).forEach((n) => n.g.classList.add("hl"));
      };
      const off = () => { lat.guideEls.forEach((g) => g.classList.remove("gon")); b.classList.remove("on"); clearHl(ctx.root); };
      b.addEventListener("mouseenter", on); b.addEventListener("mouseleave", off);
      b.addEventListener("focus", on); b.addEventListener("blur", off);
    });
  }

  function clearHl(root) { root.querySelectorAll(".hl").forEach((x) => x.classList.remove("hl")); }

  function renderDecision(ctx, $, $$, lat) {
    const panel = $("[data-exo-decision-panel]", ctx.root);
    if (!panel) return;
    const dec = ctx.cfg.decision;
    if (!dec) {
      panel.innerHTML = `<div class="dtop"><div class="dlabel mono"><i class="live-dot" style="background:var(--tx3);box-shadow:none"></i><span>No pending decision</span></div><span class="pill muted">Idle</span></div><h3 id="dec-h">Nothing needs your approval right now</h3><p class="reason">When a bounded proposal is recorded for this project, it appears here with sources, consequences, and explicit approval controls.</p><dl class="conseq"><div><dt>Status</dt><dd>No open decision <span>on this snapshot.</span></dd></div><div><dt>Records</dt><dd>Lattice nodes <span>still reflect imported work.</span></dd></div><div><dt>Next</dt><dd>Check back <span>after a proposal is filed.</span></dd></div></dl>`;
      panel.id = "exo-crystal-decision";
      return;
    }
    panel.id = "decision";
    const sigIni = dec.signerInitials || (ctx.cfg.participant && initials(ctx.cfg.participant.name, "YO")) || "YO";
    const paths = genericSigPaths(sigIni);
    const sources = dec.sources || [];
    const reasonHtml = dec.reasonHtml || esc(dec.reason || "");
    const srcList = sources.map((s, i) => {
      const n = i + 1;
      const actor = s.actor || "unknown";
      const cls = actor === "human" ? "note h" : "note";
      return `<li class="${cls}" id="src-${n}" data-n="${n}" data-node="${esc(s.node || s.workId || "")}" tabindex="0"><span class="num">${n}</span><div><div class="who">${actorMark(actor)}${esc(s.who || s.author || "Source")} <span class="kind">${esc(s.kind || actor)}</span></div><div class="what">${esc(s.what || s.title || "")}</div><div class="meta">${esc(s.hash || s.id || "")}${s.reviewer ? ` · reviewed by <b>${esc(s.reviewer)}</b>` : ""}</div></div></li>`;
    }).join("");
    const refs = sources.map((_, i) => `<sup><a class="ref${sources[i].actor === "human" ? " h" : ""}" href="#src-${i + 1}" data-n="${i + 1}">${i + 1}</a></sup>`).join("");
    const avCls = dec.proposerActor === "human" ? "av h" : "av a";
    const proposerBy = `<div class="by"><div class="${avCls}" aria-hidden="true"><span>${esc(dec.proposerInitials || initials(dec.proposer, "AG"))}</span></div><span>Proposed by <b>${esc(dec.proposer || "Agent")}</b>${dec.proposedAgo ? ` · ${esc(dec.proposedAgo)}` : ""}${dec.build ? `<span class="bybuild"> · <span class="mono" style="font-size:10px">${esc(dec.build)}</span></span>` : ""}</span></div>`;
    panel.innerHTML = `<div class="dtop"><div class="dlabel mono" id="dlabel"><i class="live-dot" id="ldot"></i><span id="dlabelText">${esc(dec.label || "Decision · needs approval")}</span></div><span class="pill" id="pill">${esc(dec.pill || "Unsigned")}</span></div><h3 id="dec-h">${esc(dec.title || "Proposal")}</h3>${proposerBy}<div class="dsec dbody"><div class="mainc"><h4 class="mono">${esc(dec.reasonHeading || "Reasoning")}</h4><p class="reason">${reasonHtml}${refs}</p><dl class="conseq">${(dec.consequences || []).map((c) => `<div><dt>${esc(c.dt)}</dt><dd>${c.dd || ""}</dd></div>`).join("") || "<div><dt>In this scenario</dt><dd>Review sources <span>before approving.</span></dd></div>"}</dl></div><aside class="margin"><div class="srchead"><h4 class="mono" style="margin:0">Sources · ${sources.length}</h4><button type="button" class="srctoggle" id="srcToggle" aria-expanded="true" aria-controls="notes"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span id="srcToggleText">Hide</span></button></div><ol class="notes" id="notes">${srcList}</ol></aside></div>${dec.principle ? `<figure class="principle"><span class="bar"></span><div class="in"><blockquote>${esc(dec.principle.quote || "")}</blockquote><p>${esc(dec.principle.note || "")}</p></div></figure>` : ""}<div class="signrow"><div><div class="sigline" id="sigline"><span class="x">×</span><span class="hint">your signature goes here</span><svg class="sig" id="sig" viewBox="-3 -4 192 44" aria-hidden="true"><defs><linearGradient id="inkg" x1="0" y1="0" x2="190" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#cfe9ff"/><stop offset="1" stop-color="#9fd6ff"/></linearGradient></defs><g id="sigpaths">${paths.map((d) => `<path d="${d}"/>`).join("")}</g><circle class="nib" id="nib" r="1.6" cx="0" cy="0"/></svg><span class="strike"></span></div><div class="under"><span>${esc(dec.sigCaption || "Illustrative signature · not legal proof")}</span><span id="sigdate">${esc(dec.sigDate || "Not a cryptographic or legal signature")}</span></div></div><div class="actions actions-main" id="actions"><button type="button" class="btn primary" id="approve"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span id="approveText">${esc(dec.approveLabel || "Approve")}</span></button><button type="button" class="btn ghost" id="decline">Decline</button></div></div><div class="subact"><p class="why">${esc(dec.scopeNote || "External actions require a person’s signature.")}</p><button type="button" class="btn link" id="revise">${esc(dec.reviseLabel || "Ask for revision")}</button></div><div class="declinebox" id="declinebox"><label class="mono" for="why">${esc(dec.declinePrompt || "Reason (optional)")}</label><textarea id="why" placeholder="${esc(dec.declinePlaceholder || "")}"></textarea><div class="actions"><button type="button" class="btn ghost" id="confirmDecline">Confirm decline</button><button type="button" class="btn link" id="cancelDecline">Back</button></div></div><div class="outcome" id="outcome" tabindex="-1"></div>`;

    bindSourceLinks(ctx, $, $$, lat);
    bindDecisionUI(ctx, $, $$, lat);
  }

  function bindSourceLinks(ctx, $, $$, lat) {
    const notesEl = $("#notes", ctx.root);
    const tog = $("#srcToggle", ctx.root);
    function lightSource(n) {
      clearHl(ctx.root);
      $$(`.ref[data-n="${n}"]`, ctx.root).forEach((r) => r.classList.add("hl"));
      const note = $(`#src-${n}`, ctx.root);
      if (note) note.classList.add("hl");
      const nodeId = note && note.dataset.node;
      const node = nodeId && lat.byId[nodeId];
      if (node && node.g) node.g.classList.add("hl");
      if (lat.threads[n]) lat.threads[n].classList.add("hl");
      if (lat.pend && lat.pend.g) lat.pend.g.classList.add("hl");
    }
    $$(".ref", ctx.root).forEach((r) => {
      const n = r.dataset.n;
      ["mouseenter", "focus"].forEach((ev) => r.addEventListener(ev, () => lightSource(n)));
      ["mouseleave", "blur"].forEach((ev) => r.addEventListener(ev, () => clearHl(ctx.root)));
      r.addEventListener("click", (e) => {
        e.preventDefault();
        if (notesEl && notesEl.classList.contains("collapsed")) setNotes(true);
        const note = $(`#src-${n}`, ctx.root);
        if (note) note.focus({ preventScroll: true });
      });
    });
    $$(".note", ctx.root).forEach((note) => {
      const n = note.dataset.n;
      ["mouseenter", "focus"].forEach((ev) => note.addEventListener(ev, () => lightSource(n)));
      ["mouseleave", "blur"].forEach((ev) => note.addEventListener(ev, () => clearHl(ctx.root)));
    });
    function setNotes(open) {
      if (!notesEl || !tog) return;
      notesEl.classList.toggle("collapsed", !open);
      tog.setAttribute("aria-expanded", open);
      const tx = $("#srcToggleText", ctx.root);
      if (tx) tx.textContent = open ? "Hide" : "Show";
    }
    if (tog) tog.addEventListener("click", () => setNotes(notesEl.classList.contains("collapsed")));
  }

  function bindDecisionUI(ctx, $, $$, lat) {
    const dec = ctx.cfg.decision;
    if (!dec) return;
    const approveB = $("#approve", ctx.root);
    const declineB = $("#decline", ctx.root);
    const reviseB = $("#revise", ctx.root);
    const actions = $("#actions", ctx.root);
    const dbox = $("#declinebox", ctx.root);
    const out = $("#outcome", ctx.root);
    const ann = $("#announce", ctx.root);
    const ann2 = $("#announce2", ctx.root);
    const sigline = $("#sigline", ctx.root);
    const decEl = $("#decision", ctx.root);
    let reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const say = (t, r) => { const a = r || ann; if (!a) return; a.textContent = ""; setTimeout(() => { a.textContent = t; }, 30); };
    const time = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const T = { sign: 1200, settle: 250, toast: 900 };

    function record(action, details) {
      ctx.demoLog.push({ action, at: new Date().toISOString(), ...details });
      postParticipation(ctx, { type: "decision-action", action, decisionId: dec.id, ...details }).catch(() => {});
    }

    function drawSignature(done) {
      const ps = [...$$("#sigpaths path", ctx.root)];
      const nib = $("#nib", ctx.root);
      if (!sigline) { done(); return; }
      sigline.classList.add("signing");
      if (reduce) { sigline.classList.remove("signing"); sigline.classList.add("signed"); done(); return; }
      const L = ps.map((p) => p.getTotalLength());
      const tot = L.reduce((a, b) => a + b, 0);
      const gap = 40, draw = T.sign - gap * (ps.length - 1);
      let t0 = 0;
      const plan = ps.map((p, i) => {
        p.style.strokeDasharray = L[i]; p.style.strokeDashoffset = L[i];
        const d = Math.max(60, draw * L[i] / tot);
        const s = t0; t0 += d + gap;
        return { p, L: L[i], s, d };
      });
      const start = performance.now();
      const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
      (function frame(now) {
        const t = now - start;
        plan.forEach((o) => {
          const k = Math.min(1, Math.max(0, (t - o.s) / o.d));
          o.p.style.strokeDashoffset = o.L * (1 - ease(k));
          if (nib && k > 0 && k < 1) {
            const pt = o.p.getPointAtLength(o.L * ease(k));
            nib.setAttribute("cx", pt.x); nib.setAttribute("cy", pt.y);
          }
        });
        if (t < t0) requestAnimationFrame(frame);
        else { sigline.classList.remove("signing"); sigline.classList.add("signed"); done(); }
      })(start);
    }

    function bindTraceRow(row) {
      const on = () => { const n = lat.byId[row.dataset.node]; if (n && n.g) n.g.classList.add("hl"); };
      ["mouseenter", "focus"].forEach((ev) => row.addEventListener(ev, on));
      ["mouseleave", "blur"].forEach((ev) => row.addEventListener(ev, () => clearHl(ctx.root)));
    }

    function addTrace(html, node) {
      const list = $("#trace", ctx.root);
      if (!list) return;
      const li = document.createElement("li");
      li.className = "tr new"; li.tabIndex = 0; li.dataset.node = node;
      li.innerHTML = html;
      list.prepend(li);
      bindTraceRow(li);
    }

    function approve() {
      if (ctx.busy || ctx.decisionState === "declined") return;
      ctx.busy = true; ctx.decisionState = "approving";
      if (approveB) approveB.disabled = true;
      if (declineB) declineB.disabled = true;
      if (reviseB) reviseB.disabled = true;
      const at = $("#approveText", ctx.root);
      if (at) at.textContent = "Signing…";
      say(`Simulating approval${ctx.remoteMode === "local" ? " (local rehearsal only)" : ""}.`);
      drawSignature(() => {
        ctx.decisionState = "approved";
        record("approved");
        if (decEl) decEl.classList.add("closed");
        const lt = $("#dlabelText", ctx.root); if (lt) lt.textContent = dec.approvedLabel || "Decision · approved";
        const ldot = $("#ldot", ctx.root); if (ldot) ldot.style.cssText = "background:var(--ok);box-shadow:0 0 8px var(--ok)";
        const pill = $("#pill", ctx.root); if (pill) { pill.textContent = dec.approvedPill || "Approved"; pill.className = "pill signed"; }
        const sd = $("#sigdate", ctx.root); if (sd) sd.textContent = `Recorded ${time()} · ${ctx.remoteMode === "local" ? "local rehearsal" : "stored participation"}`;
        if (out) {
          out.innerHTML = `<div class="stamp">✓ Approval recorded · ${time()}</div><b>${esc(dec.approveOutcome || "No external action was sent from this page.")}</b>${dec.recordId ? `<br><span class="mono" style="font-size:10px">${esc(dec.recordId)}</span>` : ""}<br><button type="button" class="mini" id="revoke">Revoke approval</button>`;
          out.classList.add("on"); out.focus({ preventScroll: true });
        }
        const n = lat.pend;
        if (n) {
          n.st = "done";
          if (n.g) {
            n.g.classList.remove("pending");
            n.g.querySelectorAll(".ring,.pulse").forEach((x) => x.remove());
            if (n.coreEl) { n.coreEl.setAttribute("fill", "url(#gs)"); n.coreEl.removeAttribute("stroke"); }
            const gl = document.createElementNS(NS, "circle");
            gl.setAttribute("cx", n.x); gl.setAttribute("cy", n.y); gl.setAttribute("r", 6);
            gl.setAttribute("fill", "url(#spec)"); gl.classList.add("glint");
            n.g.appendChild(gl);
          }
          const w = ctx.cfg.works.find((x) => x.id === n.id);
          if (w) w.state = "done";
        }
        ctx.root.querySelectorAll(".edge[data-pend]").forEach((e) => e.classList.remove("ghost"));
        addTrace(`<i class="dot g"></i><span class="w">Decision approved</span><time>now</time><span class="from">proposed by <b>${esc(dec.proposer || "Agent")}</b></span><code>${esc(dec.recordId || "dec")}</code>`, n && n.id);
        updateLatCount(ctx, $, lat.nodes);
        setTimeout(() => milestone(ctx, $, lat, ann2, reduce, T), reduce ? 0 : T.settle);
        ctx.busy = false;
      });
    }

    if (approveB) approveB.addEventListener("click", approve);
    if (declineB) declineB.addEventListener("click", () => { if (actions) actions.style.display = "none"; if (dbox) dbox.classList.add("on"); $("#why", ctx.root).focus(); });
    const cancel = $("#cancelDecline", ctx.root);
    if (cancel) cancel.addEventListener("click", () => { if (actions) actions.style.display = ""; if (dbox) dbox.classList.remove("on"); declineB && declineB.focus(); });
    const confirm = $("#confirmDecline", ctx.root);
    if (confirm) confirm.addEventListener("click", () => {
      if (ctx.decisionState === "declined") return;
      ctx.decisionState = "declined";
      const why = ($("#why", ctx.root) || {}).value || "";
      record("declined", { reason: why });
      if (dbox) dbox.classList.remove("on");
      if (decEl) decEl.classList.add("closed");
      const lt = $("#dlabelText", ctx.root); if (lt) lt.textContent = dec.declinedLabel || "Decision · declined";
      if (out) {
        out.innerHTML = `<div class="stamp" style="color:var(--tx2)">Declined · ${time()}</div><b>Nothing was sent.</b>${why ? `<br>Your note: “${esc(why)}”` : ""}`;
        out.classList.add("on"); out.focus({ preventScroll: true });
      }
      say("Declined. Nothing was sent.");
    });
    if (reviseB) reviseB.addEventListener("click", () => {
      if (ctx.busy) return;
      record("revision_requested");
      if (out) { out.textContent = dec.reviseOutcome || "Revision requested. The proposal stays open."; out.classList.add("on"); out.focus({ preventScroll: true }); }
      say("Revision requested.");
    });
    if (out) out.addEventListener("click", (e) => {
      if (e.target.id !== "revoke" || ctx.decisionState !== "approved") return;
      ctx.decisionState = "revoked";
      record("revoked");
      if (sigline) sigline.classList.add("revoked");
      const pill = $("#pill", ctx.root); if (pill) { pill.textContent = "Revoked"; pill.className = "pill muted"; }
      e.target.outerHTML = `<div class="stamp" style="color:var(--tx2);margin-top:10px">Approval revoked · ${time()}</div>`;
      say("Approval revoked.");
    });
  }

  function milestone(ctx, $, lat, ann2, reduce, T) {
    if (ctx.decisionState !== "approved") return;
    if (lat.svg) lat.svg.classList.add("crystallized");
    const ms = $("#ms", ctx.root);
    if (!ms) return;
    ms.hidden = false;
    const st = ctx.cfg.stages[ctx.cfg.currentStage];
    $("#msT", ctx.root).innerHTML = `<span class="mono" style="color:var(--tx2)">${esc(st.n)} / ${esc(st.name)}</span> &nbsp;<em>crystallized</em>`;
    const sub = $("[data-exo-ms-sub]", ctx.root);
    const rc = ringCounts(ctx.cfg.works, ctx.cfg.currentStage);
    if (sub) sub.textContent = decMilestoneCopy(ctx, rc);
    setTimeout(() => {
      if (ctx.decisionState !== "approved") return;
      ms.classList.add("on");
      const hide = () => { if (ms.matches(":hover,:focus-within")) return setTimeout(hide, 3000); ms.classList.remove("on"); };
      setTimeout(hide, 9000);
      if (ann2) { ann2.textContent = ""; setTimeout(() => { ann2.textContent = sub && sub.textContent ? sub.textContent : "Stage crystallized."; }, 30); }
    }, reduce ? 0 : T.toast);
    const close = $("#msClose", ctx.root);
    if (close) close.addEventListener("click", () => ms.classList.remove("on"), { once: true });
  }

  function decMilestoneCopy(ctx, rc) {
    const next = ctx.cfg.stages[ctx.cfg.currentStage + 1];
    return `${rc.filled} pieces in ${ctx.cfg.stages[ctx.cfg.currentStage].name}${next ? `. Next: ${next.name}.` : "."}`;
  }

  function renderCrew(ctx, $) {
    const roles = (ctx.cfg.crew && ctx.cfg.crew.roles) || [];
    const list = $("[data-exo-crew-list]", ctx.root);
    const meta = $("[data-exo-crew-meta]", ctx.root);
    const filled = roles.filter((r) => r.status === "filled").length;
    if (meta) meta.textContent = roles.length ? `${filled} filled · ${roles.length - filled} open` : "roles pending";
    if (!list) return;
    if (!roles.length) {
      list.innerHTML = `<li class="mem"><div><div class="nm">No crew slots yet</div><div class="rl">Import roster records to populate this panel.</div></div></li>`;
      return;
    }
    list.innerHTML = roles.map((r) => {
      const isAgent = r.actor === "agent";
      const ini = r.initials || initials(r.name, isAgent ? "AG" : "HU");
      const av = isAgent ? `<div class="av a" aria-hidden="true"><span>${esc(ini)}</span></div>` : `<div class="av h" aria-hidden="true">${esc(ini)}</div>`;
      const pending = r.status === "pending";
      return `<li class="mem">${av}<div><div class="nm">${esc(r.name || (pending ? "Open slot" : "Member"))}${isAgent ? ' <span class="mono" style="font-size:10px">agent</span>' : ""}</div><div class="rl">${esc(r.role || r.slot || "")}</div></div><span class="scope">${esc(r.scope || (pending ? "open" : "member"))}</span></li>`;
    }).join("");
    const form = $("[data-exo-role-form]", ctx.root);
    const sel = $("[data-exo-role-select]", ctx.root);
    const open = roles.filter((r) => r.status === "pending");
    if (form && sel && open.length) {
      form.hidden = false;
      sel.innerHTML = open.map((r) => `<option value="${esc(r.slot || r.role)}">${esc(r.role || r.slot)}</option>`).join("");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const slot = sel.value;
        postParticipation(ctx, { type: "role-interest", slot, note: "" }).then(() => {
          const st = $("[data-exo-role-status]", ctx.root);
          if (st) { st.hidden = false; st.textContent = ctx.remoteMode === "local" ? "Interest saved locally (rehearsal)." : "Interest sent."; }
        }).catch(() => {
          const st = $("[data-exo-role-status]", ctx.root);
          if (st) { st.hidden = false; st.textContent = "Interest noted locally (API unavailable)."; }
        });
      });
    }
  }

  function renderLive(ctx, $, $$) {
    const jobs = ctx.cfg.liveWork || [];
    const list = $("[data-exo-live-list]", ctx.root);
    const meta = $("[data-exo-live-meta]", ctx.root);
    if (meta) meta.textContent = jobs.length ? `${jobs.length} in motion` : "none active";
    if (!list) return;
    if (!jobs.length) {
      list.innerHTML = `<li class="job"><div class="what">No active work</div><div class="src">Open tasks appear here when recorded.</div></li>`;
      return;
    }
    list.innerHTML = jobs.map((j) => {
      const pause = j.pausable !== false ? `<button type="button" class="mini" data-pause aria-pressed="false">Pause</button>` : `<span class="mono" style="font-size:10px">${esc(j.status || "active")}</span>`;
      const prog = typeof j.progress === "number" ? j.progress : 0;
      const h = j.actor === "human" ? " h" : "";
      return `<li class="job"><div class="row"><span class="who">${actorMark(j.actor)}${esc(j.who || j.actorLabel || "Worker")}</span>${pause}</div><div class="what">${esc(j.what || j.title || "")}</div><div class="prog${h}" role="img" aria-label="${prog} percent"><i style="width:${prog}%"></i></div>${j.source ? `<div class="src">${esc(j.source)}</div>` : ""}</li>`;
    }).join("");
    $$("[data-pause]", ctx.root).forEach((b) => b.addEventListener("click", () => {
      const job = b.closest(".job");
      const p = job.classList.toggle("paused");
      b.setAttribute("aria-pressed", p);
      b.textContent = p ? "Resume" : "Pause";
    }));
  }

  function renderTrace(ctx, $, lat) {
    const rows = ctx.cfg.trace || [];
    const list = $("[data-exo-trace-list]", ctx.root);
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = `<li class="tr"><span class="w">No trace entries yet</span><span class="from">Import work records to populate provenance.</span></li>`;
      return;
    }
    list.innerHTML = rows.map((r) => `<li class="tr" tabindex="0" data-node="${esc(r.node || r.workId || "")}">${actorMark(r.actor)}<span class="w">${esc(r.what || r.title || "")}</span><time>${esc(r.time || "")}</time><span class="from">${r.fromHtml || esc(r.from || "")}</span>${r.hash ? `<code>${esc(r.hash)}</code>` : ""}</li>`).join("");
    $$(".tr[data-node]", ctx.root).forEach((row) => {
      if (!row.dataset.node) return;
      const on = () => { const n = lat.byId[row.dataset.node]; if (n && n.g) n.g.classList.add("hl"); };
      ["mouseenter", "focus"].forEach((ev) => row.addEventListener(ev, on));
      ["mouseleave", "blur"].forEach((ev) => row.addEventListener(ev, () => clearHl(ctx.root)));
    });
  }

  function bindDemoTools(ctx, $, lat) {
    const motion = $("#demoMotion", ctx.root);
    if (motion) motion.addEventListener("click", () => {
      const paused = document.documentElement.classList.toggle("motion-paused");
      motion.setAttribute("aria-pressed", paused);
      motion.textContent = paused ? "Resume motion" : "Pause motion";
    });
    const reset = $("#demoReset", ctx.root);
    if (reset) reset.addEventListener("click", () => location.reload());
    const exp = $("#demoExport", ctx.root);
    if (exp) exp.addEventListener("click", () => {
      const data = {
        format: "exofab-ui-demo/1",
        synthetic: ctx.cfg.rehearsal.enabled,
        verified: false,
        notice: "UI interactions only — not a signed legal record.",
        project: ctx.cfg.slug,
        state: ctx.decisionState,
        mode: ctx.remoteMode,
        events: ctx.demoLog,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "exofab-demo-log.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const tryDec = $("[data-exo-try-decision]", ctx.root);
    if (tryDec) tryDec.addEventListener("click", (e) => {
      const target = document.getElementById("decision") || document.getElementById("exo-crystal-decision");
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth" }); target.focus({ preventScroll: true }); }
    });
  }

  async function postParticipation(ctx, body) {
    const { slug, apiBase } = ctx.cfg;
    if (!apiBase || !slug) {
      ctx.remoteMode = "local";
      return Promise.resolve({ local: true });
    }
    const res = await fetch(`${apiBase}/api/projects/${encodeURIComponent(slug)}/participation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("participation failed");
    ctx.remoteMode = "remote";
    return res.json();
  }

  async function loadParticipation(ctx, $, $$, lat) {
    const { slug, apiBase, decision } = ctx.cfg;
    if (!apiBase || !slug || !decision) {
      ctx.remoteMode = ctx.cfg.rehearsal.enabled ? "local" : "none";
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/projects/${encodeURIComponent(slug)}/participation`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      ctx.remoteMode = "remote";
      if (data.decisionState) ctx.decisionState = data.decisionState;
      if (data.decisionAction) ctx._persistedAction = data.decisionAction;
    } catch (_) {
      ctx.remoteMode = "local";
    }
  }

  function applyPersistedDecision(ctx, $, $$, lat) {
    const act = ctx._persistedAction;
    if (!act || !ctx.cfg.decision) return;
    if (act.action === "approved") ctx.decisionState = "approved";
    if (act.action === "declined") ctx.decisionState = "declined";
    if (act.action === "revoked") ctx.decisionState = "revoked";
  }

  global.ExoCrystalMount = ExoCrystalMount;

  function autoMount() {
    const root = document.getElementById("exo-crystal-root");
    if (!root) return;
    ExoCrystalMount(root, parseConfig());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount);
  else autoMount();
})(typeof window !== "undefined" ? window : globalThis);
