/**
 * Build-time language packs for client/src/lib/i18n.ts.
 *
 * WHY (2026-09-13): i18n.ts is one object literal holding every string in all
 * six languages — 510 KB of the 1.19 MB main App chunk, parsed on every page by
 * every visitor, who reads ONE language. Arabic, Russian, French and Spanish are
 * ~410 KB of that.
 *
 * At build time this plugin rewrites i18n.ts so each entry keeps only `en` and
 * `he` (the primary market + global fallback), and emits one lazily-loaded
 * chunk per secondary language (`virtual:pw-i18n-pack/<lang>`). The runtime in
 * i18n.ts (`ensureLanguagePack`) loads a pack the first time a string is
 * requested in that language and merges it back in; App re-renders on
 * `subscribeLanguagePacks`. Until the pack arrives, t() falls back to English —
 * exactly what it already does for a key with no translation.
 *
 * The source file is untouched, so dev, tests and the server see all languages
 * inline. The build fails loudly if the file's shape changes.
 */
import ts from 'typescript';
import type { Plugin } from 'vite';

export const SECONDARY_LANGS = ['ar', 'ru', 'fr', 'es'] as const;
export type SecondaryLang = (typeof SECONDARY_LANGS)[number];
const VIRTUAL_PREFIX = 'virtual:pw-i18n-pack/';
export const LOADER_MARKER = '/*__PW_I18N_PACK_LOADER__*/ return null;';

export interface SplitResult {
  code: string;
  packs: Record<SecondaryLang, Record<string, string>>;
}

/** Pure transform — exported for tests. */
export function splitI18nSource(source: string): SplitResult {
  const sf = ts.createSourceFile('i18n.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let table: ts.ObjectLiteralExpression | undefined;
  sf.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const d of node.declarationList.declarations) {
      if (d.name.getText(sf) === 'translations' && d.initializer && ts.isObjectLiteralExpression(d.initializer)) {
        table = d.initializer;
      }
    }
  });
  if (!table) throw new Error('[i18n-packs] `translations` object literal not found in i18n.ts');
  if (!source.includes(LOADER_MARKER)) throw new Error('[i18n-packs] loader marker not found in i18n.ts');

  const packs = { ar: {}, ru: {}, fr: {}, es: {} } as SplitResult['packs'];
  const edits: Array<{ start: number; end: number; text: string }> = [];

  for (const prop of table.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isObjectLiteralExpression(prop.initializer)) {
      throw new Error(`[i18n-packs] unexpected entry shape near: ${prop.getText(sf).slice(0, 80)}`);
    }
    const key = ts.isStringLiteral(prop.name) || ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText(sf);
    const kept: string[] = [];
    for (const field of prop.initializer.properties) {
      if (!ts.isPropertyAssignment(field)) throw new Error(`[i18n-packs] unexpected field in "${key}"`);
      const lang = field.name.getText(sf).replace(/['"]/g, '');
      const init = field.initializer;
      if (!ts.isStringLiteral(init) && !ts.isNoSubstitutionTemplateLiteral(init)) {
        throw new Error(`[i18n-packs] non-literal value for "${key}".${lang}`);
      }
      if ((SECONDARY_LANGS as readonly string[]).includes(lang)) {
        packs[lang as SecondaryLang][key] = init.text; // later duplicates win, like the object literal
      } else {
        kept.push(field.getText(sf));
      }
    }
    edits.push({ start: prop.initializer.getStart(sf), end: prop.initializer.getEnd(), text: `{ ${kept.join(', ')} }` });
  }

  let code = source;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    code = code.slice(0, e.start) + e.text + code.slice(e.end);
  }
  const loader = `switch (lang) {\n${SECONDARY_LANGS.map(
    (l) => `    case '${l}': return (await import('${VIRTUAL_PREFIX}${l}')).default;`,
  ).join('\n')}\n  }\n  return null;`;
  code = code.replace(LOADER_MARKER, loader);
  return { code, packs };
}

export function i18nLanguagePacks(): Plugin {
  let packs: SplitResult['packs'] | null = null;
  return {
    name: 'pw-i18n-language-packs',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/client/src/lib/i18n.ts')) return null;
      const result = splitI18nSource(code);
      packs = result.packs;
      return { code: result.code, map: null };
    },
    resolveId(id) {
      return id.startsWith(VIRTUAL_PREFIX) ? `\0${id}` : null;
    },
    load(id) {
      if (!id.startsWith(`\0${VIRTUAL_PREFIX}`)) return null;
      const lang = id.slice(`\0${VIRTUAL_PREFIX}`.length) as SecondaryLang;
      if (!packs) throw new Error('[i18n-packs] pack requested before i18n.ts was transformed');
      return `export default ${JSON.stringify(packs[lang] ?? {})};`;
    },
  };
}
