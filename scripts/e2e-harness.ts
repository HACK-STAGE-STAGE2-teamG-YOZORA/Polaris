import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { validateOpenApiResponse } from './openapi-contract.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { SESSION_COOKIE_NAME } from '../src/server/auth/config.ts';
import { sha256Base64Url } from '../src/server/auth/crypto.ts';
import pg from 'pg';

const E2E_AUTH_TOKEN = 'polaris-default-e2e-session-token';

export type ApiResult = {
  status: number;
  body: unknown;
  contentType: string | null;
};

export type E2eContext = {
  baseUrl: string;
  userId: string;
  authCookie: string;
  schemaName: string;
  request: (
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      formData?: FormData;
      headers?: Record<string, string>;
      authenticated?: boolean;
    },
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

/**
 * BASE_DATABASE_URLにスキーマパラメータを付与してE2E用の分離スキーマURLを生成する。
 */
function buildE2eDbUrl(schemaName: string): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL が設定されていません。");
  const url = new URL(base);
  url.searchParams.set('schema', schemaName);
  url.searchParams.set('search_path', schemaName);
  return url.toString();
}

/** ランダムなスキーマ名を生成する（PostgreSQLの識別子として有効な形式）。 */
function randomSchemaName(): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `e2e_${suffix}`;
}

export async function withE2eServer(
  test: (context: E2eContext) => Promise<void>,
  overrides: Record<string, string> = {},
  setup?: (databaseUrl: string, userId: string, schemaName: string) => Promise<void>,
): Promise<void> {
  const tempParent = resolve(".tmp");
  await mkdir(tempParent, { recursive: true });

  const schemaName = randomSchemaName();
  const databaseUrl = buildE2eDbUrl(schemaName);
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...overrides,
    APP_URL: baseUrl,
    DATABASE_URL: databaseUrl,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
  };

  // E2E用スキーマの作成とクリーンアップ用の管理クライアント
  const adminPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let child: ChildProcess | undefined;

  try {
    // E2E用スキーマを作成
    await adminPool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    prepareProject(env);

    // PostgreSQL用のスキーマにテーブルを作成
    runNodeCli(
      "node_modules/prisma/build/index.js",
      ["db", "push", "--url", databaseUrl],
      env,
    );

    // E2E用スキーマへ接続してセットアップデータを挿入
    const testPool = new pg.Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(testPool, { schema: schemaName });
    const authPrisma = new PrismaClient({ adapter });
    let defaultUserId: string;
    try {
      const defaultUser = await authPrisma.user.create({
        data: {
          googleSubject: `polaris-default-e2e-user-${schemaName}`,
          email: `default-e2e-${schemaName}@example.com`,
          displayName: '既定E2Eユーザー',
        },
      });
      defaultUserId = defaultUser.id;
      const e2eAuthToken = `polaris-default-e2e-session-token-${schemaName}`;
      await authPrisma.authSession.create({
        data: {
          userId: defaultUser.id,
          tokenHash: sha256Base64Url(e2eAuthToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    } finally {
      await authPrisma.$disconnect();
      await testPool.end();
    }
    if (setup) await setup(databaseUrl, defaultUserId, schemaName);

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

    const e2eAuthToken = `polaris-default-e2e-session-token-${schemaName}`;
    const request: E2eContext["request"] = async (path, options = {}) => {
      const method = options.method ?? "GET";
      const authCookie = `${SESSION_COOKIE_NAME}=${e2eAuthToken}`;
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          ...(options.authenticated === false ? {} : { cookie: authCookie }),
          ...options.headers,
        },
        body: options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        // API側の最長AI処理（既定180秒）がProblem Detailsを返すまで待つ。
        signal: AbortSignal.timeout(200_000),
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
      await test({ baseUrl, userId: defaultUserId, authCookie: `${SESSION_COOKIE_NAME}=${e2eAuthToken}`, schemaName, request });
    } catch (error) {
      console.error("===== E2E server log (last 8000 chars) =====");
      console.error(recentLogs());
      throw error;
    }
  } finally {
    if (child) await stopServer(child);
    // E2E用スキーマを削除してクリーンアップ
    try {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } catch (e) {
      console.warn(`E2Eスキーマ "${schemaName}" の削除に失敗しました:`, e);
    }
    await adminPool.end();
    await rm(tempParent, { recursive: true, force: true });
  }
}
