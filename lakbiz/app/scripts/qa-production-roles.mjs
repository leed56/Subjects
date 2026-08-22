/**
 * Backwards-compatible entry point for production role QA.
 *
 * Financial policy changed to OWNER ONLY. The previous script encoded the
 * obsolete owner-or-manager assumption and committed test credentials. Keep
 * the familiar command name, but delegate to the current read-only isolation
 * suite which takes all role credentials from environment variables.
 *
 * Usage:
 *   node scripts/qa-production-roles.mjs
 */
import "./qa-owner-financial-isolation.mjs";
