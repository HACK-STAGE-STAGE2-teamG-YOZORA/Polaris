"""Validate Polaris contract files without modifying the workspace."""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def validate_json_schemas() -> None:
    schema_dir = ROOT / "contracts" / "ai"
    schema_paths = sorted(schema_dir.glob("*.json"))
    if not schema_paths:
        raise RuntimeError("No JSON Schema files found")

    for schema_path in schema_paths:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
            raise RuntimeError(f"Unexpected JSON Schema draft: {schema_path}")

        for reference in _collect_refs(schema):
            if reference.startswith(("#", "https://", "http://")):
                continue
            target_name = reference.split("#", 1)[0]
            if not (schema_dir / target_name).is_file():
                raise RuntimeError(
                    f"Missing relative schema reference {reference!r} in {schema_path.name}"
                )

    print(f"JSON Schema syntax and local references: OK ({len(schema_paths)} files)")


def validate_other_json_documents() -> None:
    paths = sorted((ROOT / "contracts").glob("*.json"))
    paths.extend(sorted((ROOT / "fixtures").glob("*.json")))
    for path in paths:
        json.loads(path.read_text(encoding="utf-8"))
    print(f"Other JSON documents: OK ({len(paths)} files)")


def _collect_refs(value: object) -> list[str]:
    if isinstance(value, dict):
        refs = [value["$ref"]] if isinstance(value.get("$ref"), str) else []
        for nested in value.values():
            refs.extend(_collect_refs(nested))
        return refs
    if isinstance(value, list):
        refs: list[str] = []
        for nested in value:
            refs.extend(_collect_refs(nested))
        return refs
    return []


def validate_sqlite_schema() -> None:
    ddl = (ROOT / "docs" / "database-schema.sql").read_text(encoding="utf-8")
    database = sqlite3.connect(":memory:")
    try:
        database.executescript(ddl)
        tables = [
            row[0]
            for row in database.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'table' ORDER BY name"
            )
        ]
    finally:
        database.close()

    expected = {
        "analysis_sessions",
        "messages",
        "experiences",
        "experience_quotes",
        "evidence_items",
        "career_hypotheses",
        "hypothesis_evidence",
        "career_reports",
        "companies",
        "company_sources",
        "company_facts",
        "recommendation_runs",
        "company_recommendations",
        "es_documents",
        "es_analyses",
        "es_claims",
        "es_claim_evidence",
        "es_revisions",
        "revision_changes",
    }
    missing = sorted(expected.difference(tables))
    if missing:
        raise RuntimeError(f"Missing SQLite tables: {', '.join(missing)}")
    print(f"SQLite DDL: OK ({len(tables)} tables)")


def validate_openapi_refs_textually() -> None:
    """Check internal component refs even when a YAML package is unavailable.

    A real OpenAPI linter must still parse and validate the full document. This
    local check catches misspelled component references without third-party code.
    """

    text = (ROOT / "docs" / "openapi.yaml").read_text(encoding="utf-8")
    component_names = set(
        re.findall(r"^    ([A-Za-z][A-Za-z0-9]*):\s*$", text, flags=re.MULTILINE)
    )
    refs = re.findall(r"\$ref:\s*['\"]#/components/(?:schemas|responses|parameters)/([^'\"]+)['\"]", text)
    missing = sorted({reference for reference in refs if reference not in component_names})
    if missing:
        raise RuntimeError(f"Missing OpenAPI component refs: {', '.join(missing)}")
    print(f"OpenAPI internal component references: OK ({len(refs)} references)")


if __name__ == "__main__":
    validate_json_schemas()
    validate_other_json_documents()
    validate_sqlite_schema()
    validate_openapi_refs_textually()
