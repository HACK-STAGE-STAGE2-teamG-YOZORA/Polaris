import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { validateOpenApiResponse } from './openapi-contract.ts';

export type ApiResult = {
  status: number;
  body: unknown;
  contentType: string | null;
};

export type E2eContext = {
  baseUrl: string;
  request: (
    path: string,
    options?: { method?: string; body?: unknown; formData?: FormData },
  ) => Promise<ApiResult>;
};

let projectPrepared = false;

function runNodeCli(script: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(process.execPath, [resolve(script), ...args], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${script} ${args.join(" ")} に失敗しました。`);
  }
}

function prepareProject(env: NodeJS.ProcessEnv): void {
  if (projectPrepared) return;

  runNodeCli("node_modules/prisma/build/index.js", ["generate"], env);
  runNodeCli("node_modules/next/dist/bin/next", ["build"], env);
  projectPrepared = true;
}

async function availablePort(): Promise<number> {
  const server = createServer();
  server.unref();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  if (port === 0) throw new Error("E2E用ポートを確保できませんでした。");
  return port;
}

async function waitForServer(baseUrl: string, child: ChildProcess, logs: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.jsが起動前に終了しました。\n${logs()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/v1/system/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return;
    } catch {
      // 起動中は接続失敗を許容する。
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }

  throw new Error(`Next.jsの起動がタイムアウトしました。\n${logs()}`);
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");

  const gracefulDeadline = Date.now() + 5_000;
  while (child.exitCode === null && Date.now() < gracefulDeadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    const forcedDeadline = Date.now() + 5_000;
    while (child.exitCode === null && Date.now() < forcedDeadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }
}

export async function withE2eServer(
  test: (context: E2eContext) => Promise<void>,
  overrides: Record<string, string> = {},
  setup?: (databaseUrl: string) => Promise<void>,
): Promise<void> {
  const tempParent = resolve(".tmp");
  await mkdir(tempParent, { recursive: true });
  const tempRoot = await mkdtemp(join(tempParent, "polaris-e2e-"));
  const databasePath = join(tempRoot, "polaris-e2e.db").replaceAll("\\", "/");
  await writeFile(databasePath, "");
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...overrides,
    APP_URL: baseUrl,
    DATABASE_URL: `file:${databasePath}`,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
  };

  let child: ChildProcess | undefined;

  try {
    prepareProject(env);
    runNodeCli(
      "node_modules/prisma/build/index.js",
      ["db", "push"],
      env,
    );
    if (setup) await setup(env.DATABASE_URL as string);

    const output: string[] = [];
    child = spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString("utf8")));

    const recentLogs = () => output.join("").slice(-8_000);
    await waitForServer(baseUrl, child, recentLogs);

    const request: E2eContext["request"] = async (path, options = {}) => {
      const method = options.method ?? "GET";
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: options.body === undefined ? undefined : { "content-type": "application/json" },
        body: options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        signal: AbortSignal.timeout(180_000),
      });
      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      const result = {
        status: response.status,
        body,
        contentType: response.headers.get("content-type"),
      };
      await validateOpenApiResponse(method, path, result);
      return result;
    };

    try {
      await test({ baseUrl, request });
    } catch (error) {
      console.error("===== E2E server log (last 8000 chars) =====");
      console.error(recentLogs());
      throw error;
    }
  } finally {
    if (child) await stopServer(child);
    await rm(tempRoot, { recursive: true, force: true });
  }
}
