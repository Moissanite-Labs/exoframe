/** @typedef {import('@cloudflare/workers-types').RateLimit} RateLimit */

const ALLOWED_ORIGIN = "https://moissanite-labs.github.io";
const MAX_IDEA_BODY = 8 * 1024;

/**
 * @param {Request} request
 * @param {Record<string, string>} extra
 */
export function corsHeaders(request, extra = {}) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
    ...extra,
  };
  if (origin === ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
  }
  return headers;
}

/**
 * @param {Request} request
 * @param {number} status
 * @param {unknown} body
 * @param {Record<string, string>} [extra]
 */
export function jsonResponse(request, status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, extra),
    },
  });
}

/** @param {Request} request */
export function handleOptions(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

/**
 * @param {Record<string, unknown>} payload
 */
export async function submissionHash(payload) {
  const normalized = JSON.stringify({
    title: String(payload.title ?? "").trim(),
    what: String(payload.what ?? "").trim(),
    who: payload.who == null || payload.who === "" ? null : String(payload.who).trim(),
    name: payload.name == null || payload.name === "" ? null : String(payload.name).trim(),
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ ok: true, data: Record<string, unknown> } | { ok: false, errors: Record<string, string> }}
 */
export function validateIdeaBody(body) {
  const errors = {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const what = typeof body.what === "string" ? body.what.trim() : "";
  if (!title || title.length > 80) errors.title = "Add a short title so we can list your idea.";
  if (!what || what.length > 2000) errors.what = "Tell us a little about what it should do.";
  if (body.who != null && body.who !== "" && (typeof body.who !== "string" || body.who.length > 120)) {
    errors.who = "Who is it for must be 120 characters or fewer.";
  }
  if (body.name != null && body.name !== "" && (typeof body.name !== "string" || body.name.length > 80)) {
    errors.name = "Name must be 80 characters or fewer.";
  }
  if (body.public === false || body.private === true) {
    errors.public = "Only public ideas can be submitted through this form.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      what,
      who: body.who == null || body.who === "" ? null : String(body.who).trim(),
      name: body.name == null || body.name === "" ? null : String(body.name).trim(),
    },
  };
}

/**
 * @param {Record<string, string | null>} idea
 */
export function formatIssueBody(idea) {
  const lines = [
    "## Public intake submission",
    "",
    `**Title:** ${idea.title}`,
    "",
    "**What should it do?**",
    "",
    idea.what,
  ];
  if (idea.who) {
    lines.push("", `**Who is it for?** ${idea.who}`);
  }
  if (idea.name) {
    lines.push("", `**Submitter name (public queue):** ${idea.name}`);
  }
  lines.push("", "_Submitted via ExoFab public intake._");
  return lines.join("\n");
}

/**
 * @param {number} n
 */
export function ideaIdFromNumber(n) {
  return `idea-${String(n).padStart(4, "0")}`;
}

/**
 * @param {Env} env
 * @param {string} token
 * @param {string} remoteip
 */
export async function verifyTurnstile(env, token, remoteip) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) return { ok: false, reason: "missing_secret" };
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteip) form.set("remoteip", remoteip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) return { ok: false, reason: "upstream" };
  /** @type {{ success?: boolean, hostname?: string, action?: string }} */
  const data = await res.json();
  if (!data.success) return { ok: false, reason: "failed" };
  if (data.hostname && data.hostname !== env.TURNSTILE_HOSTNAME) {
    return { ok: false, reason: "hostname" };
  }
  if (data.action && data.action !== env.TURNSTILE_ACTION) {
    return { ok: false, reason: "action" };
  }
  return { ok: true };
}

/**
 * @param {Env} env
 * @param {Record<string, string | null>} idea
 */
export async function createGitHubIssue(env, idea) {
  const token = env.GH_ISSUES_TOKEN;
  if (!token) throw new Error("missing_gh_token");
  const repo = env.GITHUB_REPO || "Moissanite-Labs/exoframe";
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "exoframe-intake-worker",
    },
    body: JSON.stringify({
      title: `[intake] ${idea.title}`,
      body: formatIssueBody(idea),
      labels: ["intake:submitted", "intake:public"],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`github_${res.status}:${text.slice(0, 200)}`);
  }
  /** @type {{ number: number }} */
  const issue = await res.json();
  return issue.number;
}

/**
 * @param {Env} env
 * @param {string} key
 */
export async function applyRateLimit(env, key) {
  const rl = env.INTAKE_RL;
  if (!rl || typeof rl.limit !== "function") {
    return { success: true };
  }
  return rl.limit({ key });
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
export async function handlePostIdeas(request, env, ctx) {
  if (!env.GH_ISSUES_TOKEN || !env.TURNSTILE_SECRET) {
    return jsonResponse(request, 503, {
      error: "Intake is not configured. Your idea was not saved.",
    });
  }

  const raw = await request.text();
  if (raw.length > MAX_IDEA_BODY) {
    return jsonResponse(request, 413, { error: "Request body too large." });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(request, 400, { error: "Invalid JSON." });
  }

  if (typeof body.website === "string" && body.website.trim() !== "") {
    return jsonResponse(request, 201, {
      id: "idea-0000",
      status: "submitted",
      public: true,
    });
  }

  const validated = validateIdeaBody(body);
  if (!validated.ok) {
    return jsonResponse(request, 422, { errors: validated.errors });
  }

  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken : body["cf-turnstile-response"];
  if (!turnstileToken || typeof turnstileToken !== "string") {
    return jsonResponse(request, 422, {
      errors: { turnstile: "Complete the verification check." },
    });
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const rl = await applyRateLimit(env, clientIp);
  if (!rl.success) {
    return jsonResponse(request, 429, {
      error: "Too many ideas from here just now. Try again in a few minutes.",
    });
  }

  const ts = await verifyTurnstile(env, turnstileToken, clientIp);
  if (!ts.ok) {
    return jsonResponse(request, 422, {
      errors: { turnstile: "Verification failed. Try again." },
    });
  }

  const hash = await submissionHash(validated.data);
  const dedupeKey = `dedupe:${hash}`;
  const existing = await env.IDEAS_KV.get(dedupeKey, "json");
  if (existing && typeof existing.id === "string") {
    return jsonResponse(request, 201, existing);
  }

  let issueNumber;
  try {
    issueNumber = await createGitHubIssue(env, validated.data);
  } catch (err) {
    console.error("createGitHubIssue", err);
    return jsonResponse(request, 502, {
      error: "Could not save your idea right now. Try again shortly.",
    });
  }

  const result = {
    id: ideaIdFromNumber(issueNumber),
    status: "submitted",
    public: true,
  };
  ctx.waitUntil(env.IDEAS_KV.put(dedupeKey, JSON.stringify(result)));
  return jsonResponse(request, 201, result);
}

/** @param {Request} request */
export function handleGetIdeas(request) {
  return jsonResponse(request, 501, {
    error: "List API not implemented; queue reads data/ideas.json on Pages.",
  });
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {string} slug
 */
export async function handleParticipation(request, env, slug) {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return jsonResponse(request, 400, { error: "Invalid project slug." });
  }
  const key = `participation:${slug}`;

  if (request.method === "GET") {
    const stored = await env.IDEAS_KV.get(key, "json");
    return jsonResponse(request, 200, stored ?? {});
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const rl = await applyRateLimit(env, `participation:${clientIp}`);
  if (!rl.success) {
    return jsonResponse(request, 429, { error: "Too many requests. Try again later." });
  }

  let patch;
  try {
    patch = await request.json();
  } catch {
    return jsonResponse(request, 400, { error: "Invalid JSON." });
  }
  if (patch == null || typeof patch !== "object" || Array.isArray(patch)) {
    return jsonResponse(request, 400, { error: "Body must be a JSON object." });
  }

  const allowed = ["role", "interests", "feedback", "decisionState"];
  /** @type {Record<string, unknown>} */
  const filtered = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) filtered[k] = patch[k];
  }

  const prev = (await env.IDEAS_KV.get(key, "json")) ?? {};
  const merged = { ...prev, ...filtered };
  await env.IDEAS_KV.put(key, JSON.stringify(merged));
  return jsonResponse(request, 200, merged);
}

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (origin && origin !== ALLOWED_ORIGIN) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    if (url.pathname === "/api/ideas") {
      if (request.method === "POST") return handlePostIdeas(request, env, ctx);
      if (request.method === "GET") return handleGetIdeas(request);
    }

    const partMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/participation$/);
    if (partMatch) {
      const slug = decodeURIComponent(partMatch[1]);
      if (request.method === "GET" || request.method === "POST") {
        return handleParticipation(request, env, slug);
      }
    }

    return jsonResponse(request, 404, { error: "Not found." });
  },
};

/** @typedef {typeof import('../wrangler.toml')} WranglerEnv */

/**
 * @typedef {Object} Env
 * @property {KVNamespace} IDEAS_KV
 * @property {RateLimit} INTAKE_RL
 * @property {string} [GH_ISSUES_TOKEN]
 * @property {string} [TURNSTILE_SECRET]
 * @property {string} TURNSTILE_HOSTNAME
 * @property {string} TURNSTILE_ACTION
 * @property {string} GITHUB_REPO
 */
