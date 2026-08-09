"""Validate Polaris contract files without modifying the workspace."""

from __future__ import annotations

import json
import re
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


def validate_postgresql_schema() -> None:
    expected = {
        "users",
        "auth_sessions",
        "analysis_sessions",
        "messages",
        "experiences",
        "experience_quotes",
        "axis_evidence_items",
        "axis_assessments",
        "axis_assessment_evidence",
        "self_analysis_reports",
        "overall_self_analysis_profiles",
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

    migration_paths = sorted((ROOT / "prisma" / "migrations").glob("*/migration.sql"))
    if not migration_paths:
        raise RuntimeError("No Prisma migrations found")

    migration_ddl = "\n\n".join(
        path.read_text(encoding="utf-8").strip() for path in migration_paths
    )
    reference_ddl = (ROOT / "docs" / "database-schema.sql").read_text(
        encoding="utf-8"
    ).strip()
    if reference_ddl != migration_ddl:
        raise RuntimeError(
            "docs/database-schema.sql must match the ordered Prisma migration SQL"
        )

    tables = set(re.findall(r'^CREATE TABLE "([^"]+)"', migration_ddl, re.MULTILINE))
    missing = sorted(expected.difference(tables))
    if missing:
        raise RuntimeError(f"Missing PostgreSQL tables: {', '.join(missing)}")

    lock_text = (ROOT / "prisma" / "migrations" / "migration_lock.toml").read_text(
        encoding="utf-8"
    )
    if not re.search(r'^provider\s*=\s*"postgresql"\s*$', lock_text, re.MULTILINE):
        raise RuntimeError("Prisma migration provider must be postgresql")

    if "JSONB" not in migration_ddl or "CREATE TYPE" not in migration_ddl:
        raise RuntimeError("PostgreSQL migration must use native JSONB and enum types")

    print(
        f"PostgreSQL DDL/migrations: OK ({len(tables)} tables, "
        f"{len(migration_paths)} migrations)"
    )


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
    validate_postgresql_schema()
    validate_openapi_refs_textually()
