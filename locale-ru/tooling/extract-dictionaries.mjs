#!/usr/bin/env node
/**
 * Extract every Client locale dictionary from a DeepSeek Harness checkout.
 *
 *   node tooling/extract-dictionaries.mjs <harness-checkout> [output.json]
 *
 * The checkout must be at the same release as the running client (e.g.
 * `dsh-v0.2.1-rc.5`). The script parses all `packages/**\/src` TypeScript with
 * the TypeScript compiler API, follows the `ctx.locale.register(...)` calls, and
 * resolves each registered namespace to its English dictionary (including
 * spread composition and `join('\n\n')` values).
 *
 * Output: `{ "namespaces": [{ "ns", "file", "keys", "en" }], "unresolved": [...] }`.
 * Translate each namespace's `en` map into `{ "namespaces": { ns: { key: text } } }`
 * and save it as `data/dictionaries.json`, then run `build-client.mjs`.
 *
 * Requires the TypeScript package: `npm install --no-save typescript`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] ?? process.env.DSH_SOURCE;
if (repo === undefined) {
  console.error('usage: node tooling/extract-dictionaries.mjs <harness-checkout> [output.json]');
  process.exit(2);
}
const output = path.resolve(process.argv[3] ?? path.join(here, '..', 'data', 'english-dictionaries.json'));
if (!fs.existsSync(path.join(repo, 'packages'))) {
  console.error(`not a DeepSeek Harness checkout: ${repo}`);
  process.exit(2);
}

let ts;
try {
  ts = (await import('typescript')).default;
} catch {
  console.error('the extraction needs TypeScript: run `npm install --no-save typescript` in this directory');
  process.exit(2);
}

const files = new Map();
const entryCache = new Map();

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'tests', 'dist', 'benchmarks'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.spec.') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function unwrap(node) {
  let current = node;
  while (current && (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current) || ts.isTypeAssertionExpression(current))) current = current.expression;
  return current;
}

function resolveSpec(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return undefined;
}

function analyze(file) {
  if (files.has(file)) return files.get(file);
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const info = { source, decls: new Map(), imports: new Map(), exports: new Map(), registers: [], strings: new Map() };
  files.set(file, info);

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      const init = unwrap(node.initializer);
      info.decls.set(node.name.text, init);
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) info.strings.set(node.name.text, init.text);
    } else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('.')) {
      const target = resolveSpec(file, node.moduleSpecifier.text);
      const clause = node.importClause;
      if (target !== undefined && clause) {
        if (clause.name) info.imports.set(clause.name.text, { file: target, exportName: 'default' });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            info.imports.set(element.name.text, { file: target, exportName: (element.propertyName ?? element.name).text });
          }
        }
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = resolveSpec(file, node.moduleSpecifier.text);
      if (target !== undefined) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) info.exports.set(element.name.text, { file: target, exportName: (element.propertyName ?? element.name).text });
        } else if (node.exportClause === undefined) {
          info.exports.set('*', { file: target });
        }
      }
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'register') {
        const receiver = callee.expression.getText(source);
        if (receiver === 'locale' || receiver.endsWith('.locale')) info.registers.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return info;
}

function resolveString(file, name, depth = 0) {
  if (depth > 10) return undefined;
  const info = analyze(file);
  if (info.strings.has(name)) return info.strings.get(name);
  const decl = info.decls.get(name);
  if (decl && (ts.isStringLiteral(decl) || ts.isNoSubstitutionTemplateLiteral(decl))) return decl.text;
  const imported = info.imports.get(name) ?? info.exports.get(name);
  if (imported) return resolveString(imported.file, imported.exportName, depth + 1);
  const wildcard = info.exports.get('*');
  if (wildcard) {
    const result = resolveString(wildcard.file, name, depth + 1);
    if (result !== undefined) return result;
  }
  return undefined;
}

function resolveEntriesFromExpr(expr, file, depth = 0) {
  if (depth > 10) return undefined;
  const node = unwrap(expr);
  if (!node) return undefined;
  if (ts.isIdentifier(node)) return resolveEntriesByName(file, node.text, depth + 1);
  if (!ts.isObjectLiteralExpression(node)) return undefined;
  const entries = {};
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property)) {
      const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name) ? property.name.text : undefined;
      if (name === undefined) return undefined;
      const value = resolveEntriesValue(property.initializer, file, depth + 1);
      if (value === undefined) return undefined;
      entries[name] = value;
    } else if (ts.isShorthandPropertyAssignment(property)) {
      const value = resolveEntriesValue(property.name, file, depth + 1);
      if (value === undefined) return undefined;
      entries[property.name.text] = value;
    } else if (ts.isSpreadAssignment(property)) {
      const spread = resolveEntriesFromExpr(property.expression, file, depth + 1);
      if (spread === undefined) return undefined;
      Object.assign(entries, spread);
    } else {
      return undefined;
    }
  }
  return entries;
}

function resolveEntriesValue(expr, file, depth) {
  const node = unwrap(expr);
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isIdentifier(node)) {
    const nested = resolveEntriesByName(file, node.text, depth + 1);
    if (nested !== undefined) return nested;
    return resolveString(file, node.text, depth + 1);
  }
  if (ts.isObjectLiteralExpression(node)) return resolveEntriesFromExpr(node, file, depth + 1);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = resolveEntriesValue(node.left, file, depth + 1);
    const right = resolveEntriesValue(node.right, file, depth + 1);
    return typeof left === 'string' && typeof right === 'string' ? left + right : undefined;
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'join') {
    const array = unwrap(node.expression.expression);
    const separator = node.arguments[0] ? resolveEntriesValue(node.arguments[0], file, depth + 1) : ',';
    if (typeof separator === 'string' && ts.isArrayLiteralExpression(array)) {
      const parts = array.elements.map((element) => resolveEntriesValue(element, file, depth + 1));
      if (parts.every((part) => typeof part === 'string')) return parts.join(separator);
    }
    return undefined;
  }
  return undefined;
}

function resolveEntriesByName(file, name, depth = 0) {
  if (depth > 10) return undefined;
  const key = `${file}#${name}`;
  if (entryCache.has(key)) return entryCache.get(key);
  entryCache.set(key, undefined);
  const info = analyze(file);
  let result;
  const decl = info.decls.get(name);
  if (decl !== undefined && (ts.isObjectLiteralExpression(decl) || ts.isIdentifier(decl))) result = resolveEntriesFromExpr(decl, file, depth + 1);
  if (result === undefined) {
    const imported = info.imports.get(name) ?? info.exports.get(name);
    if (imported) result = resolveEntriesByName(imported.file, imported.exportName, depth + 1);
  }
  if (result === undefined) {
    const wildcard = info.exports.get('*');
    if (wildcard) result = resolveEntriesByName(wildcard.file, name, depth + 1);
  }
  entryCache.set(key, result);
  return result;
}

function resolveStringValue(expr, file) {
  const node = unwrap(expr);
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isIdentifier(node)) return resolveString(file, node.text);
  return undefined;
}

function findTupleTable(info, file) {
  for (const init of info.decls.values()) {
    if (!ts.isArrayLiteralExpression(init)) continue;
    const result = {};
    for (const element of init.elements) {
      if (!ts.isArrayLiteralExpression(element) || element.elements.length < 2) continue;
      const locale = resolveEntriesValue(element.elements[0], file);
      const dict = resolveEntriesFromExpr(element.elements[1], file);
      if (typeof locale === 'string' && dict) result[locale] = dict;
    }
    if (result.en) return result;
  }
  return undefined;
}

const allFiles = walk(path.join(repo, 'packages')).filter((file) => file.includes('/src/'));
const namespaces = new Map();
const unresolved = [];

for (const file of allFiles) {
  const info = analyze(file);
  for (const call of info.registers) {
    const args = call.arguments;
    if (args.length < 2) continue;
    const ns = resolveStringValue(args[0], file);
    if (ns === undefined) continue;
    if (args.length === 3) {
      const locale = resolveStringValue(args[1], file);
      const dict = resolveEntriesFromExpr(args[2], file);
      if (locale === 'en' && dict) namespaces.set(ns, { en: dict, file, keys: Object.keys(dict).length });
      else {
        const table = findTupleTable(info, file);
        if (table?.en) namespaces.set(ns, { en: table.en, file, keys: Object.keys(table.en).length });
        else unresolved.push({ ns, reason: 'per-locale', file: path.relative(repo, file) });
      }
      continue;
    }
    const container = resolveEntriesFromExpr(args[1], file);
    if (!container) {
      unresolved.push({ ns, reason: 'dicts', file: path.relative(repo, file), text: args[1].getText(info.source).slice(0, 60) });
      continue;
    }
    const en = container.en;
    if (en === undefined || typeof en === 'string') {
      unresolved.push({ ns, reason: 'no en', file: path.relative(repo, file), text: Object.keys(container).join(',') });
      continue;
    }
    namespaces.set(ns, { en, file: path.relative(repo, file), keys: Object.keys(en).length });
  }
}

const report = {
  namespaces: [...namespaces.entries()].map(([ns, value]) => ({ ns, file: value.file, keys: value.keys, en: value.en })),
  unresolved,
};
fs.writeFileSync(output, JSON.stringify(report, null, 2));
const total = report.namespaces.reduce((sum, row) => sum + row.keys, 0);
console.log('namespaces:', report.namespaces.length, '| strings:', total, '| unresolved:', unresolved.length);
console.log('wrote', output);
