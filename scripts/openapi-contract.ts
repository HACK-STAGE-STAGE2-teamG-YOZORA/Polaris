import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import YAML from 'yaml';
import type { ApiResult } from './e2e-harness.ts';

type JsonObject = Record<string, any>;
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];
const OPENAPI_PATH = join(process.cwd(), 'docs', 'openapi.yaml');
let documentPromise: Promise<JsonObject> | undefined;
const validatorCache = new Map<string, ValidateFunction>();

export async function loadOpenApiDocument(): Promise<JsonObject> {
  documentPromise ??= readFile(OPENAPI_PATH, 'utf8').then((text) => {
    const document = YAML.parse(text) as unknown;
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new Error('openapi.yamlをobjectとして解析できません。');
    }
    const openapi = document as JsonObject;
    if (openapi.openapi !== '3.1.0') throw new Error('OpenAPI 3.1.0ではありません。');
    if (!openapi.paths || !openapi.components?.schemas) throw new Error('OpenAPI pathsまたはcomponents.schemasがありません。');
    return openapi;
  });
  return documentPromise;
}

function resolveReference(document: JsonObject, value: JsonObject): JsonObject {
  const reference = value.$ref;
  if (typeof reference !== 'string' || !reference.startsWith('#/')) return value;
  let current: unknown = document;
  for (const segment of reference.slice(2).split('/')) {
    current = (current as JsonObject)?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    throw new Error(`OpenAPI参照を解決できません: ${reference}`);
  }
  return current as JsonObject;
}

function templatePattern(template: string): RegExp {
  const escaped = template.split('/').map((segment) => {
    if (/^\{[^{}]+\}$/u.test(segment)) return '[^/]+';
    return segment.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  }).join('/');
  return new RegExp(`^${escaped}$`, 'u');
}

function findOperation(document: JsonObject, method: string, requestPath: string): { template: string; operation: JsonObject } {
  const pathname = new URL(requestPath, 'http://127.0.0.1').pathname;
  const normalizedMethod = method.toLowerCase();
  for (const [template, pathItem] of Object.entries(document.paths as JsonObject)) {
    if (!templatePattern(template).test(pathname)) continue;
    const operation = (pathItem as JsonObject)[normalizedMethod];
    if (!operation) throw new Error(`${method.toUpperCase()} ${template}はOpenAPIにありません。`);
    return { template, operation };
  }
  throw new Error(`${method.toUpperCase()} ${pathname}に対応するOpenAPI pathがありません。`);
}

function responseSchema(document: JsonObject, operation: JsonObject, status: number, contentType: string | null): JsonObject | null {
  const declared = operation.responses?.[String(status)] ?? operation.responses?.default;
  if (!declared) throw new Error(`HTTP ${status}レスポンスがOpenAPIに定義されていません。`);
  const response = resolveReference(document, declared);
  if (!response.content) return null;
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  const media = mediaType ? response.content[mediaType] : undefined;
  if (!media) {
    throw new Error(`Content-Type ${contentType ?? '(none)'}がOpenAPIレスポンスにありません。`);
  }
  return media.schema ? resolveReference(document, media.schema) : null;
}

export async function validateOpenApiResponse(
  method: string,
  requestPath: string,
  result: ApiResult,
): Promise<void> {
  const document = await loadOpenApiDocument();
  const { template, operation } = findOperation(document, method, requestPath);
  const schema = responseSchema(document, operation, result.status, result.contentType);
  if (!schema) {
    if (result.body !== null) throw new Error(`${method.toUpperCase()} ${template} HTTP ${result.status}は本文なしの契約です。`);
    return;
  }
  const cacheKey = `${method.toLowerCase()} ${template} ${result.status} ${result.contentType?.split(';', 1)[0] ?? ''}`;
  let validate = validatorCache.get(cacheKey);
  if (!validate) {
    const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true });
    addFormats(ajv);
    validate = ajv.compile({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      ...schema,
      components: { schemas: document.components.schemas },
    });
    validatorCache.set(cacheKey, validate);
  }
  if (!validate(result.body)) {
    throw new Error(
      `${method.toUpperCase()} ${template} HTTP ${result.status}がOpenAPIに適合しません。\n${ajvErrors(validate.errors)}`,
    );
  }
}

function ajvErrors(errors: ValidateFunction['errors']): string {
  return (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'invalid'}`).join('\n');
}

async function routeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.isFile() && entry.name === 'route.ts' ? [path] : [];
  }));
  return nested.flat();
}

function routeTemplate(path: string): string {
  const appRoot = join(process.cwd(), 'src', 'app');
  const segments = relative(appRoot, path).split(sep).slice(0, -1);
  return `/${segments.map((segment) => segment.replace(/^\[([^\]]+)\]$/u, '{$1}')).join('/')}`;
}

export async function assertOpenApiRouteCoverage(): Promise<{ documented: number; implemented: number; p0: number }> {
  const document = await loadOpenApiDocument();
  const documented = new Map<string, JsonObject>();
  for (const [path, pathItem] of Object.entries(document.paths as JsonObject)) {
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as JsonObject)[method];
      if (operation) documented.set(`${method.toUpperCase()} ${path}`, operation);
    }
  }

  const implemented = new Set<string>();
  for (const path of await routeFiles(join(process.cwd(), 'src', 'app', 'api', 'v1'))) {
    const source = await readFile(path, 'utf8');
    for (const match of source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/gu)) {
      implemented.add(`${match[1]} ${routeTemplate(path)}`);
    }
  }

  const undocumented = [...implemented].filter((key) => !documented.has(key));
  const missingP0 = [...documented].filter(([key, operation]) => !operation['x-priority'] && !implemented.has(key)).map(([key]) => key);
  if (undocumented.length > 0) throw new Error(`OpenAPI未定義のRouteがあります:\n${undocumented.join('\n')}`);
  if (missingP0.length > 0) throw new Error(`未実装のP0 OpenAPI操作があります:\n${missingP0.join('\n')}`);
  return {
    documented: documented.size,
    implemented: implemented.size,
    p0: [...documented.values()].filter((operation) => !operation['x-priority']).length,
  };
}
