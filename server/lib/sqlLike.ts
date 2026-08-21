/**
 * escapeLike — turn a user-typed string into a safe ILIKE/LIKE fragment.
 *
 * Query parameterisation (`$1`) protects against SQL INJECTION, but NOT
 * against wildcard characters that the user themselves typed. An admin
 * search accepting `%` returns every row; a `_` matches any single char;
 * a `\` interacts with escape processing on some databases. All of these
 * are user-controllable "wildcard injection" — different bug class from
 * SQLi, same root cause: raw user input embedded in a LIKE pattern.
 *
 * Pair every ILIKE query with:
 *   `column ILIKE $1 ESCAPE '\\'`
 * and pass `%${escapeLike(userInput)}%` as the value.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
