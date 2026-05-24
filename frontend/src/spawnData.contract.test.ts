import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { parseSpawnItems } from "./validate.ts";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const SPAWN_DATA_PATH = resolve(REPO_ROOT, "data/spawn_items.json");
const SCHEMA_PATH = resolve(REPO_ROOT, "schemas/spawn_items.schema.json");

describe("spawn data contract", () => {
  it("committed spawn_items.json matches schema and frontend parser", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    const raw: unknown = JSON.parse(readFileSync(SPAWN_DATA_PATH, "utf8"));
    const ajv = new Ajv2020();
    const valid = ajv.validate(schema, raw);
    expect(valid, ajv.errorsText()).toBe(true);
    const items = parseSpawnItems(raw);
    expect(items.length).toBeGreaterThan(0);
  });
});
