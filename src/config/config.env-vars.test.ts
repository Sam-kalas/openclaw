import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveStateDir } from "./paths.js";
import { withEnvOverride, withTempHome } from "./test-helpers.js";

// Mock loadDotEnv to skip CWD .env loading (prevents real API key contamination)
// but still load state-dir .env so ${VAR} substitution tests work.
vi.mock("../infra/dotenv.js", async () => {
  const dotenvPkg = await import("dotenv");
  const nodePath = await import("node:path");
  const nodeFs = await import("node:fs");

  return {
    loadDotEnv: vi.fn((_opts?: { quiet?: boolean }) => {
      // Skip dotenv.config() for CWD — that would load the project's real .env.
      // Only load the state-dir .env (second half of the real implementation).
      const stateDir =
        process.env.OPENCLAW_STATE_DIR?.trim() ||
        nodePath.join(process.env.HOME || "/tmp", ".openclaw");
      const globalEnvPath = nodePath.join(stateDir, ".env");
      if (nodeFs.existsSync(globalEnvPath)) {
        dotenvPkg.config({ path: globalEnvPath, override: false });
      }
    }),
  };
});

// Ensure env vars that may have been loaded by vitest or setup are cleared.
const envKeysToIsolate = ["OPENROUTER_API_KEY", "BRAVE_API_KEY"];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of envKeysToIsolate) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of envKeysToIsolate) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
});

describe("config env vars", () => {
  it("applies env vars from env block when missing", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "openclaw.json"),
        JSON.stringify(
          {
            env: { vars: { OPENROUTER_API_KEY: "config-key" } },
          },
          null,
          2,
        ),
        "utf-8",
      );

      await withEnvOverride({ OPENROUTER_API_KEY: undefined }, async () => {
        const { loadConfig } = await import("./config.js");
        loadConfig();
        expect(process.env.OPENROUTER_API_KEY).toBe("config-key");
      });
    });
  });

  it("does not override existing env vars", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "openclaw.json"),
        JSON.stringify(
          {
            env: { vars: { OPENROUTER_API_KEY: "config-key" } },
          },
          null,
          2,
        ),
        "utf-8",
      );

      await withEnvOverride({ OPENROUTER_API_KEY: "existing-key" }, async () => {
        const { loadConfig } = await import("./config.js");
        loadConfig();
        expect(process.env.OPENROUTER_API_KEY).toBe("existing-key");
      });
    });
  });

  it("applies env vars from env.vars when missing", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "openclaw.json"),
        JSON.stringify(
          {
            env: { vars: { GROQ_API_KEY: "gsk-config" } },
          },
          null,
          2,
        ),
        "utf-8",
      );

      await withEnvOverride({ GROQ_API_KEY: undefined }, async () => {
        const { loadConfig } = await import("./config.js");
        loadConfig();
        expect(process.env.GROQ_API_KEY).toBe("gsk-config");
      });
    });
  });

  it("loads ${VAR} substitutions from ~/.openclaw/.env on repeated runtime loads", async () => {
    await withTempHome(async (home) => {
      await withEnvOverride(
        {
          OPENCLAW_STATE_DIR: path.join(home, ".openclaw"),
          CLAWDBOT_STATE_DIR: undefined,
          OPENCLAW_HOME: undefined,
          CLAWDBOT_HOME: undefined,
          BRAVE_API_KEY: undefined,
          OPENCLAW_DISABLE_CONFIG_CACHE: "1",
        },
        async () => {
          const configDir = resolveStateDir(process.env, () => home);
          await fs.mkdir(configDir, { recursive: true });
          await fs.writeFile(
            path.join(configDir, "openclaw.json"),
            JSON.stringify(
              {
                tools: {
                  web: {
                    search: {
                      apiKey: "${BRAVE_API_KEY}",
                    },
                  },
                },
              },
              null,
              2,
            ),
            "utf-8",
          );
          await fs.writeFile(path.join(configDir, ".env"), "BRAVE_API_KEY=from-dotenv\n", "utf-8");

          const { loadConfig } = await import("./config.js");

          const first = loadConfig();
          expect(first.tools?.web?.search?.apiKey).toBe("from-dotenv");

          delete process.env.BRAVE_API_KEY;
          const second = loadConfig();
          expect(second.tools?.web?.search?.apiKey).toBe("from-dotenv");
        },
      );
    });
  });
});
