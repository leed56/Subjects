import { describe, expect, it } from "vitest";
import {
  buildMigrationNameCounts,
  migrationAppliedBy,
  migrationNameFromFilename,
} from "./migration-state.mjs";

const files = [
  "20250714000001_job_items_parts_materials.sql",
  "20250714000002_expenses_parts_purchase_category.sql",
  "20260823000012_revoke_legacy_sale_inventory_rpc.sql",
];

describe("migration state reconciliation", () => {
  it("extracts the semantic migration name from a repository filename", () => {
    expect(migrationNameFromFilename(files[0])).toBe("job_items_parts_materials");
    expect(migrationNameFromFilename("README.md")).toBeNull();
  });

  it("prefers the exact custom filename ledger", () => {
    const reason = migrationAppliedBy(files[0], {
      appliedFilenames: new Set([files[0]]),
      nativeMigrationNames: new Set(),
      migrationNameCounts: buildMigrationNameCounts(files),
    });
    expect(reason).toBe("custom");
  });

  it("recognizes a uniquely named native Supabase migration with a different timestamp", () => {
    const reason = migrationAppliedBy(files[0], {
      appliedFilenames: new Set(),
      nativeMigrationNames: new Set(["job_items_parts_materials"]),
      migrationNameCounts: buildMigrationNameCounts(files),
    });
    expect(reason).toBe("native");
  });

  it("does not trust an ambiguous native migration name", () => {
    const duplicateFiles = [
      "20250714000001_same_name.sql",
      "20260823000001_same_name.sql",
    ];
    const reason = migrationAppliedBy(duplicateFiles[0], {
      appliedFilenames: new Set(),
      nativeMigrationNames: new Set(["same_name"]),
      migrationNameCounts: buildMigrationNameCounts(duplicateFiles),
    });
    expect(reason).toBeNull();
  });

  it("supports historical filename aliases", () => {
    const reason = migrationAppliedBy("20250617000003_ac_service_lifecycle.sql", {
      appliedFilenames: new Set(["20250617000002_ac_service_lifecycle.sql"]),
      nativeMigrationNames: new Set(),
      migrationNameCounts: buildMigrationNameCounts(files),
      legacyAliases: {
        "20250617000003_ac_service_lifecycle.sql":
          "20250617000002_ac_service_lifecycle.sql",
      },
    });
    expect(reason).toBe("legacy");
  });
});
