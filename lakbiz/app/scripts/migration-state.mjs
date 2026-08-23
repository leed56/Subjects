const MIGRATION_FILENAME_RE = /^\d{14}_(.+)\.sql$/;

export function migrationNameFromFilename(filename) {
  const match = MIGRATION_FILENAME_RE.exec(filename);
  return match?.[1] ?? null;
}

export function buildMigrationNameCounts(files) {
  const counts = new Map();
  for (const file of files) {
    const name = migrationNameFromFilename(file);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/**
 * Return why a repository migration can be considered applied.
 *
 * Native Supabase migrations are frequently recorded with the timestamp from
 * the Management API call rather than the historical timestamp embedded in
 * this repository's filename. A unique semantic name therefore provides the
 * safe bridge between the two ledgers. Ambiguous/duplicate names are never
 * accepted as a native match.
 */
export function migrationAppliedBy(
  filename,
  {
    appliedFilenames = new Set(),
    nativeMigrationNames = new Set(),
    migrationNameCounts = new Map(),
    legacyAliases = {},
  } = {},
) {
  if (appliedFilenames.has(filename)) return "custom";

  const legacy = legacyAliases[filename];
  if (legacy && appliedFilenames.has(legacy)) return "legacy";

  const nativeName = migrationNameFromFilename(filename);
  if (
    nativeName &&
    migrationNameCounts.get(nativeName) === 1 &&
    nativeMigrationNames.has(nativeName)
  ) {
    return "native";
  }

  return null;
}
