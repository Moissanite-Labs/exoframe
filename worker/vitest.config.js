import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TURNSTILE_HOSTNAME: "moissanite-labs.github.io",
            TURNSTILE_ACTION: "submit-idea",
            GITHUB_REPO: "Moissanite-Labs/exoframe",
            GH_ISSUES_TOKEN: "test-gh-token",
            TURNSTILE_SECRET: "test-turnstile-secret",
          },
          kvNamespaces: ["IDEAS_KV"],
        },
      },
    },
  },
});
