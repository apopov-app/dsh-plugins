#!/usr/bin/env node
/**
 * Regenerate `client.js` from `data/dictionaries.json` (+ optional
 * `data/overrides.json`), applying the Russian layout rules.
 *
 *   node tooling/build-client.mjs
 *
 * `data/dictionaries.json` is `{ "namespaces": { "<namespace>": { "<key>": "текст" } } }`,
 * i.e. the translated dictionaries produced from the English dictionaries of a
 * DeepSeek Harness client checkout (see `extract-dictionaries.mjs`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(here, '..');
const dataFile = path.join(here, '..', 'data', 'dictionaries.json');
const overridesFile = path.join(here, '..', 'data', 'overrides.json');
const outputFile = path.join(pluginRoot, 'client.js');

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const namespaces = data.namespaces;
const namespaceCount = Object.keys(namespaces).length;
const stringCount = Object.values(namespaces).reduce((sum, dict) => sum + Object.keys(dict).length, 0);
if (namespaceCount < 60) throw new Error(`refusing to build with only ${namespaceCount} namespaces`);

let overrideCount = 0;
if (fs.existsSync(overridesFile)) {
  const overrides = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));
  for (const [ns, entries] of Object.entries(overrides)) {
    for (const [key, text] of Object.entries(entries)) {
      if (namespaces[ns]?.[key] === undefined) throw new Error(`override targets unknown key: ${ns}.${key}`);
      namespaces[ns][key] = text;
      overrideCount += 1;
    }
  }
}
console.log('namespaces:', namespaceCount, '| strings:', stringCount, '| overrides:', overrideCount);

// Russian copy is longer than English. The workspace section header caps its
// label and clips without an ellipsis, and the Agent-presets card title shares
// its row with a badge, so both need a little more room; language-specific
// layout belongs to a language pack. The class suffix is how built CSS modules
// are served, and each rule is scoped to <html lang="ru">.
const RU_LAYOUT_CSS = [
  'html[lang="ru"] [class*="_sectionHeader"] > [class*="_sectionLabel"]:not([class*="_sectionLabelHidden"]){max-width:62%}',
  'html[lang="ru"] [class*="_sectionHeader"] > [class*="_sectionLabel"]{text-overflow:ellipsis}',
  'html[lang="ru"] [class*="_cardHead"] > [class*="_cardIdentity"]{flex-wrap:wrap}',
  'html[lang="ru"] [class*="_cardHead"] > [class*="_cardIdentity"] > [class*="_cardName"]{flex:1 1 100%}',
].join('');

const lines = [
  '/**',
  ' * Browser half of the Russian language pack.',
  ' *',
  ' * Registers the ru language in the Client locale catalog, one Russian',
  ' * dictionary per shipped client namespace, and the few layout rules Russian',
  ' * copy needs. Generated from the dsh-v0.2.1-rc.5 client locale sources; every',
  ' * key matches the English dictionary shipped by the package that owns the',
  ' * namespace, and lookups fall back to English for any key a future client adds.',
  ' */',
  '',
  'window.__ModuleLoader__.load({',
  "  id: '@apopov-app/dsh-locale-ru',",
  '  factory() {',
  '    /** Russian dictionaries, one plain object per locale namespace. */',
  `    const RU = ${JSON.stringify(namespaces)};`,
  '',
  '    /** Layout rules Russian copy needs where the shipped layout assumes English widths. */',
  `    const RU_LAYOUT_CSS = ${JSON.stringify(RU_LAYOUT_CSS)};`,
  '',
  '    /**',
  '     * Keep Russian in the shared language catalog.',
  '     *',
  '     * The catalog is shared: another plugin may register the language first, or',
  '     * own it and unload later. Registering once would leave the language missing',
  '     * after such an unload (and the language list would silently lose Russian),',
  '     * so watch the catalog and restore the definition whenever it disappears.',
  '     */',
  '    function keepRussian(locale) {',
  '      let owned;',
  '      const ensure = () => {',
  '        const snapshot = locale.getLocale();',
  "        const present = Array.isArray(snapshot?.locales) && snapshot.locales.some((entry) => String(entry?.id).toLowerCase() === 'ru');",
  '        if (present) return;',
  '        owned = undefined;',
  '        try {',
  "          owned = locale.addLanguage({ id: 'ru', label: 'Русский', fallback: 'en' });",
  '        } catch {',
  '          owned = undefined;',
  '        }',
  '      };',
  '      const unsubscribe = locale.subscribe(ensure);',
  '      ensure();',
  '      return () => {',
  '        unsubscribe();',
  '        if (owned !== undefined) {',
  '          owned();',
  '          owned = undefined;',
  '        }',
  '      };',
  '    }',
  '',
  '    return {',
  "      inject: ['locale'],",
  '      apply(ctx) {',
  '        // All namespaces register as one transaction: a namespace another',
  '        // plugin already owns for ru rolls the whole batch back instead of',
  '        // leaving a half-registered pack. Dictionaries go in BEFORE the',
  '        // language definition, so activating Russian never shows English copy.',
  '        ctx.effect(() => {',
  '          const disposers = [];',
  '          try {',
  '            for (const [ns, dictionary] of Object.entries(RU)) {',
  "              disposers.push(ctx.locale.register(ns, 'ru', dictionary));",
  '            }',
  '          } catch (error) {',
  '            for (const dispose of disposers.reverse()) dispose();',
  '            throw error;',
  '          }',
  '          return () => {',
  '            for (const dispose of disposers) dispose();',
  '          };',
  "        }, 'locale-ru: dictionaries');",
  '',
  "        ctx.effect(() => keepRussian(ctx.locale), 'locale-ru: language');",
  '',
  '        ctx.effect(() => {',
  "          if (typeof document === 'undefined') return () => {};",
  "          const tag = document.createElement('style');",
  "          tag.dataset.plugin = '@apopov-app/dsh-locale-ru';",
  "          tag.dataset.pluginCss = '@apopov-app/dsh-locale-ru/ru-layout.css';",
  '          tag.textContent = RU_LAYOUT_CSS;',
  '          document.head.appendChild(tag);',
  '          return () => {',
  '            tag.remove();',
  '          };',
  "        }, 'locale-ru: russian layout fixes');",
  '      },',
  '    };',
  '  },',
  '});',
  '',
];
fs.writeFileSync(outputFile, lines.join('\n'));
console.log('wrote', outputFile);
