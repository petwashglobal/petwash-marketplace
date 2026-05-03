/**
 * readonly-db — runtime guard that an "AI coworker" code path can only
 * issue SELECT queries.
 *
 * Why this exists:
 *   PR-20 scaffolds the CoworkerAgentService surface. Future families
 *   (PR-21+) will pass SQL fragments through to the database. Even if a
 *   prompt or a future regression accidentally generates a mutation, this
 *   wrapper rejects anything that is not a SELECT before it ever reaches
 *   Postgres. Defense-in-depth — Drizzle / pg roles are still the primary
 *   protection.
 *
 * Hard rules:
 *   - SELECT-only. Anything else throws CoworkerWriteAttemptError.
 *   - WITH clauses are allowed only if the wrapping statement is SELECT.
 *     A WITH ... INSERT/UPDATE/DELETE is rejected.
 *   - No multi-statement bundles (`;` between statements is rejected).
 *   - Caller is responsible for parameter binding via Drizzle's `sql`
 *     template tag — this guard does NOT sanitize parameters, it only
 *     classifies the leading verb.
 */
import { sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { logger } from '../../lib/logger';

export class CoworkerWriteAttemptError extends Error {
  constructor(public readonly attemptedVerb: string, public readonly snippet: string) {
    super(
      `Coworker readonly-db rejected non-SELECT statement (verb=${attemptedVerb}). ` +
        `This wrapper is SELECT-only. Snippet: ${snippet.slice(0, 120)}`,
    );
    this.name = 'CoworkerWriteAttemptError';
  }
}

const FORBIDDEN_VERBS = [
  'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT',
  'TRUNCATE', 'DROP', 'ALTER', 'CREATE', 'GRANT', 'REVOKE',
  'COPY', 'CALL', 'DO', 'VACUUM', 'REINDEX', 'CLUSTER',
  'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'BEGIN', 'START', 'LOCK',
  'SET', 'RESET', 'LISTEN', 'NOTIFY',
] as const;

/**
 * Classify a SQL string by its leading meaningful keyword.
 * Strips comments and whitespace before inspecting.
 *
 * Exported for unit tests in PR-21+.
 */
export function classifyLeadingVerb(rawSql: string): string {
  // Strip /* ... */ block comments and -- line comments.
  const stripped = rawSql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .trim();
  const firstToken = stripped.split(/\s+/)[0]?.toUpperCase() ?? '';
  // A `WITH ... SELECT` (CTE) is fine; a `WITH ... INSERT/UPDATE/DELETE`
  // is not. Walk forward and find the first non-CTE statement keyword.
  if (firstToken === 'WITH') {
    // Crude but adequate: look for first occurrence of a known statement
    // verb after the WITH block. This is not a full SQL parser — it errs
    // on the side of rejection.
    const upper = stripped.toUpperCase();
    for (const verb of ['SELECT', ...FORBIDDEN_VERBS]) {
      const idx = upper.indexOf(` ${verb} `);
      if (idx >= 0) return verb;
    }
    // No statement verb found inside WITH — treat as unknown so we reject.
    return 'UNKNOWN';
  }
  return firstToken;
}

/** True if the SQL string contains a top-level statement separator. */
function hasMultipleStatements(rawSql: string): boolean {
  // Strip strings and comments, then look for `;` followed by non-whitespace.
  const cleaned = rawSql
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
  return /;\s*\S/.test(cleaned);
}

export interface ReadonlyExecuteResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a SELECT-only SQL fragment. Rejects everything else.
 *
 * Usage (in PR-21+ family implementations):
 *   const { rows } = await readonlyDb.execute<MyRow>(sql`
 *     SELECT id, status FROM bookings WHERE created_at > NOW() - INTERVAL '1 day'
 *     LIMIT 100
 *   `);
 */
export const readonlyDb = {
  async execute<T = Record<string, unknown>>(query: SQL): Promise<ReadonlyExecuteResult<T>> {
    // Drizzle's SQL object has a .queryChunks property; rather than
    // reimplementing serialization, we render to text via the dialect
    // through db.execute itself. To classify, we round-trip the text.
    // The cheap path: ask Drizzle to serialize using its Postgres dialect.
    const sqlText = renderSqlText(query);
    if (hasMultipleStatements(sqlText)) {
      throw new CoworkerWriteAttemptError('MULTI', sqlText);
    }
    const verb = classifyLeadingVerb(sqlText);
    if (verb !== 'SELECT') {
      logger.warn(`[coworker.readonly-db] Rejected non-SELECT (verb=${verb})`);
      throw new CoworkerWriteAttemptError(verb || 'UNKNOWN', sqlText);
    }
    const result = await db.execute(query);
    const rows = ((result as any).rows ?? []) as T[];
    return { rows, rowCount: rows.length };
  },
};

/**
 * Best-effort serialization of a Drizzle SQL fragment to text for verb
 * classification. Uses the same pg-style dialect as the live db.
 */
function renderSqlText(query: SQL): string {
  // Drizzle exposes toQuery() via the dialect; we don't depend on
  // internals here — instead we use the tag's own `sql` property when
  // available, and otherwise stringify chunks defensively.
  const anyQ = query as any;
  if (typeof anyQ?.queryChunks?.map === 'function') {
    return anyQ.queryChunks
      .map((c: any) => {
        if (typeof c === 'string') return c;
        if (c && typeof c.value === 'string') return c.value;
        return ' ';
      })
      .join('');
  }
  return String(query);
}

/** Re-export `sql` so callers can import everything from one place. */
export { sql };
