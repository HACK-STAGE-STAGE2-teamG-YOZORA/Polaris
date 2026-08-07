import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const nodeRequire = createRequire(import.meta.url);
const { Ajv2020 } = nodeRequire("ajv/dist/2020.js");
const addFormats = nodeRequire("ajv-formats");

type JsonObject = Record<string, any>;

export type AiSchemaBundle<T> = {
  generationSchema: JsonObject;
  validateStrict(value: unknown): T;
};

const schemaCache = new Map<string, Promise<AiSchemaBundle<unknown>>>();

async function readJson(relativePath: string): Promise<JsonObject> {
  const text = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return JSON.parse(text) as JsonObject;
}

function inlineCommonReferences(
  value: unknown,
  commonDefinitions: JsonObject,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      inlineCommonReferences(item, commonDefinitions),
    );
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const object = value as JsonObject;
  const reference = object.$ref;

  if (
    typeof reference === "string" &&
    reference.startsWith("common.schema.json#/$defs/")
  ) {
    const definitionName = reference.slice(
      "common.schema.json#/$defs/".length,
    );
    const definition = commonDefinitions[definitionName];

    if (!definition) {
      throw new Error(`共通Schema定義が見つかりません: ${reference}`);
    }

    return inlineCommonReferences(
      structuredClone(definition),
      commonDefinitions,
    );
  }

  return Object.fromEntries(
    Object.entries(object).map(([key, child]) => [
      key,
      inlineCommonReferences(child, commonDefinitions),
    ]),
  );
}

/**
 * llama.cppのgrammar変換が受け付けない検証専用keywordを除く。
 * 元Schemaによる保存前検証は別途必ず実行する。
 */
function simplifyForLmStudio(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(simplifyForLmStudio);
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const object = value as JsonObject;

  if (
    object.type === "integer" &&
    Number.isInteger(object.minimum) &&
    Number.isInteger(object.maximum) &&
    object.maximum - object.minimum <= 20
  ) {
    object.enum = Array.from(
      { length: object.maximum - object.minimum + 1 },
      (_, index) => object.minimum + index,
    );
  }

  const unsupportedKeywords = [
    "format",
    "uniqueItems",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "minItems",
    "maxItems",
    "description",
  ];

  for (const keyword of unsupportedKeywords) {
    delete object[keyword];
  }

  for (const [key, child] of Object.entries(object)) {
    if (
      ["properties", "$defs", "definitions", "patternProperties", "dependentSchemas"].includes(key) &&
      child &&
      typeof child === "object" &&
      !Array.isArray(child)
    ) {
      Object.values(child).forEach(simplifyForLmStudio);
    } else {
      simplifyForLmStudio(child);
    }
  }
}

async function buildSchemaBundle<T>(
  schemaFileName: string,
): Promise<AiSchemaBundle<T>> {
  const commonSchema = await readJson(
    "../../../contracts/ai/common.schema.json",
  );
  const strictSchema = await readJson(
    `../../../contracts/ai/${schemaFileName}`,
  );

  const generationSchema = inlineCommonReferences(
    structuredClone(strictSchema),
    commonSchema.$defs,
  ) as JsonObject;

  delete generationSchema.$schema;
  delete generationSchema.$id;
  delete generationSchema.title;
  simplifyForLmStudio(generationSchema);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(commonSchema);
  const validate = ajv.compile(strictSchema);

  return {
    generationSchema,
    validateStrict(value: unknown): T {
      if (!validate(value)) {
        const details = ajv.errorsText(validate.errors, {
          separator: "\n",
        });
        throw new Error(`AI出力が正式なSchemaに適合しません。\n${details}`);
      }

      return value as T;
    },
  };
}

export async function loadAiSchema<T>(
  schemaFileName: string,
): Promise<AiSchemaBundle<T>> {
  let cached = schemaCache.get(schemaFileName);

  if (!cached) {
    cached = buildSchemaBundle(schemaFileName);
    schemaCache.set(schemaFileName, cached);
  }

  return (await cached) as AiSchemaBundle<T>;
}
