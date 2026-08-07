import { loadAiSchema } from "../src/infrastructure/ai/schema.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const bundle = await loadAiSchema<Record<string, unknown>>(
  "overall-self-analysis-output.schema.json",
);
const profileInsight = bundle.generationSchema.$defs?.profileInsight;

assert(profileInsight?.properties?.description, "出力フィールドdescriptionが生成用Schemaから削除されています。");
assert(profileInsight.description === undefined, "検証キーワードdescriptionが生成用Schemaに残っています。");
assert(profileInsight.properties.description.minLength === undefined, "未対応のminLengthが生成用Schemaに残っています。");

console.log("AI生成用Schema簡略化テスト成功");
