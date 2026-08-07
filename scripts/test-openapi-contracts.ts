import { assertOpenApiRouteCoverage, loadOpenApiDocument, validateOpenApiResponse } from './openapi-contract.ts';

const document = await loadOpenApiDocument();
const coverage = await assertOpenApiRouteCoverage();

await validateOpenApiResponse('GET', '/api/v1/system/lm-studio', {
  status: 200,
  contentType: 'application/json',
  body: {
    status: 'INVALID_CONFIGURATION',
    baseUrl: 'http://127.0.0.1:1234',
    checkedAt: new Date().toISOString(),
    guidance: ['設定を確認してください。'],
  },
});
await validateOpenApiResponse('POST', '/api/v1/analysis-sessions/example/finalize', {
  status: 409,
  contentType: 'application/problem+json',
  body: {
    requestId: crypto.randomUUID(),
    code: 'CONFLICT',
    message: '確定できません。',
    retryable: false,
    details: [],
  },
});

console.log(`OpenAPI parse/route/response contracts: OK (${coverage.p0} P0, ${coverage.implemented}/${coverage.documented} implemented, v${document.info.version})`);
