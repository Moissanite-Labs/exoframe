import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateIdeaBody,
  submissionHash,
  formatIssueBody,
  ideaIdFromNumber,
  handlePostIdeas,
  applyParticipationPatch,
  isValidParticipantId,
} from "../src/index.js";

describe("validateIdeaBody", () => {
  it("accepts minimal public submission", () => {
    const r = validateIdeaBody({ title: "T", what: "W", public: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.title).toBe("T");
      expect(r.data.what).toBe("W");
    }
  });

  it("rejects private submissions", () => {
    const r = validateIdeaBody({ title: "T", what: "W", public: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.public).toBeTruthy();
  });
});

describe("submissionHash", () => {
  it("is stable for the same payload", async () => {
    const a = await submissionHash({ title: "A", what: "B", who: null, name: null });
    const b = await submissionHash({ title: "A", what: "B", who: null, name: null });
    expect(a).toBe(b);
  });
});

describe("formatIssueBody", () => {
  it("includes title and what", () => {
    const body = formatIssueBody({
      title: "Hello",
      what: "Does things",
      who: "devs",
      name: "Sam",
    });
    expect(body).toContain("Hello");
    expect(body).toContain("Does things");
    expect(body).toContain("devs");
    expect(body).toContain("Sam");
  });
});

describe("ideaIdFromNumber", () => {
  it("zero-pads to four digits", () => {
    expect(ideaIdFromNumber(42)).toBe("idea-0042");
  });
});

describe("POST /api/ideas integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 503 when secrets are missing", async () => {
    const req = new Request("https://worker.test/api/ideas", {
      method: "POST",
      headers: {
        Origin: "https://moissanite-labs.github.io",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "T",
        what: "W",
        public: true,
        turnstileToken: "tok",
      }),
    });
    const ctx = createExecutionContext();
    const savedGh = env.GH_ISSUES_TOKEN;
    const savedTs = env.TURNSTILE_SECRET;
    delete env.GH_ISSUES_TOKEN;
    delete env.TURNSTILE_SECRET;
    const res = await handlePostIdeas(req, env, ctx);
    env.GH_ISSUES_TOKEN = savedGh;
    env.TURNSTILE_SECRET = savedTs;
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(503);
  });

  it("honeypot returns 201 without calling GitHub", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const req = new Request("https://worker.test/api/ideas", {
      method: "POST",
      headers: {
        Origin: "https://moissanite-labs.github.io",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "T",
        what: "W",
        website: "http://spam.example",
        public: true,
        turnstileToken: "tok",
      }),
    });
    const ctx = createExecutionContext();
    const res = await handlePostIdeas(req, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(201);
    const githubCalls = fetchSpy.mock.calls.filter((c) =>
      String(c[0]).includes("api.github.com"),
    );
    expect(githubCalls.length).toBe(0);
    fetchSpy.mockRestore();
  });

  it("creates issue and dedupes on retry", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("turnstile")) {
        return new Response(
          JSON.stringify({
            success: true,
            hostname: "moissanite-labs.github.io",
            action: "submit-idea",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("api.github.com")) {
        return new Response(JSON.stringify({ number: 99 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    const body = JSON.stringify({
      title: "Retry test",
      what: "Something",
      public: true,
      turnstileToken: "good-token",
    });
    const headers = {
      Origin: "https://moissanite-labs.github.io",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.10",
    };

    const req1 = new Request("https://worker.test/api/ideas", {
      method: "POST",
      headers,
      body,
    });
    const ctx1 = createExecutionContext();
    const res1 = await SELF.fetch(req1);
    await waitOnExecutionContext(ctx1);
    expect(res1.status).toBe(201);
    const json1 = await res1.json();
    expect(json1.id).toBe("idea-0099");

    const req2 = new Request("https://worker.test/api/ideas", {
      method: "POST",
      headers,
      body,
    });
    const ctx2 = createExecutionContext();
    const res2 = await SELF.fetch(req2);
    await waitOnExecutionContext(ctx2);
    expect(res2.status).toBe(201);
    const json2 = await res2.json();
    expect(json2.id).toBe("idea-0099");

    const githubCalls = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter((c) => String(c[0]).includes("api.github.com"));
    expect(githubCalls.length).toBe(1);
  });
});

describe("CORS", () => {
  it("OPTIONS allows moissanite-labs.github.io", async () => {
    const res = await SELF.fetch(
      new Request("https://worker.test/api/ideas", {
        method: "OPTIONS",
        headers: { Origin: "https://moissanite-labs.github.io" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://moissanite-labs.github.io",
    );
  });

  it("rejects foreign origins on POST", async () => {
    const res = await SELF.fetch(
      new Request("https://worker.test/api/ideas", {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("applyParticipationPatch", () => {
  it("maps revision_requested to pending decisionState", () => {
    const r = applyParticipationPatch(
      {},
      { type: "decision-action", action: "revision_requested", decisionId: "d1" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.decisionState).toBe("pending");
      expect(r.data.decisionAction.action).toBe("revision_requested");
    }
  });
});

const PARTICIPANT_A = "11111111-1111-4111-8111-111111111111";
const PARTICIPANT_B = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://moissanite-labs.github.io";

describe("participation", () => {
  const slug = "rift-manager";
  const postHeaders = {
    Origin: ORIGIN,
    "Content-Type": "application/json",
    "CF-Connecting-IP": "203.0.113.55",
  };

  it("rejects POST without participantId", async () => {
    const res = await SELF.fetch(
      new Request(`https://worker.test/api/projects/${slug}/participation`, {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify({ type: "role-interest", slot: "coach" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("stores browser role-interest payload per participant", async () => {
    const post = await SELF.fetch(
      new Request(`https://worker.test/api/projects/${slug}/participation`, {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify({
          participantId: PARTICIPANT_A,
          type: "role-interest",
          slot: "analytics",
          note: "I can help with stats",
        }),
      }),
    );
    expect(post.status).toBe(200);
    const state = await post.json();
    expect(state.role).toBe("analytics");
    expect(state.roleInterest).toEqual({
      slot: "analytics",
      note: "I can help with stats",
    });

    const get = await SELF.fetch(
      new Request(
        `https://worker.test/api/projects/${slug}/participation?participant=${PARTICIPANT_A}`,
        { method: "GET", headers: { Origin: ORIGIN } },
      ),
    );
    expect(get.status).toBe(200);
    const stored = await get.json();
    expect(stored.roleInterest.slot).toBe("analytics");
    expect(stored.decisionState).toBeUndefined();
  });

  it("stores browser decision-action payload", async () => {
    const post = await SELF.fetch(
      new Request(`https://worker.test/api/projects/${slug}/participation`, {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify({
          participantId: PARTICIPANT_A,
          type: "decision-action",
          action: "approved",
          decisionId: "ship-gate-8",
        }),
      }),
    );
    expect(post.status).toBe(200);
    const state = await post.json();
    expect(state.decisionState).toBe("approved");
    expect(state.decisionAction).toMatchObject({
      action: "approved",
      decisionId: "ship-gate-8",
    });
  });

  it("isolates visitors and returns empty GET without participant id", async () => {
    await SELF.fetch(
      new Request(`https://worker.test/api/projects/${slug}/participation`, {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify({
          participantId: PARTICIPANT_A,
          type: "decision-action",
          action: "approved",
          decisionId: "ship-gate-8",
        }),
      }),
    );

    const getBare = await SELF.fetch(
      new Request(`https://worker.test/api/projects/${slug}/participation`, {
        method: "GET",
        headers: { Origin: ORIGIN },
      }),
    );
    expect(getBare.status).toBe(200);
    expect(await getBare.json()).toEqual({});

    const getB = await SELF.fetch(
      new Request(
        `https://worker.test/api/projects/${slug}/participation?participant=${PARTICIPANT_B}`,
        { method: "GET", headers: { Origin: ORIGIN } },
      ),
    );
    expect(await getB.json()).toEqual({});

    const getA = await SELF.fetch(
      new Request(
        `https://worker.test/api/projects/${slug}/participation?participant=${PARTICIPANT_A}`,
        { method: "GET", headers: { Origin: ORIGIN } },
      ),
    );
    const storedA = await getA.json();
    expect(storedA.decisionState).toBe("approved");
  });

  it("validates participant id format", () => {
    expect(isValidParticipantId(PARTICIPANT_A)).toBe(true);
    expect(isValidParticipantId("not-a-uuid")).toBe(false);
  });
});
