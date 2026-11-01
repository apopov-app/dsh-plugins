# Russian language pack — tooling

Two scripts regenerate the browser half of the pack (`../client.js`) from data:

| File | Role |
|---|---|
| `../data/dictionaries.json` | Source of truth: `{ "namespaces": { "<namespace>": { "<key>": "русский текст" } } }` (66 namespaces, 2918 strings). |
| `../data/overrides.json` | Per-key translation overrides for labels that lost their slot after translation (longer than English in a fixed-width control). Applied on top of `dictionaries.json`. |
| `extract-dictionaries.mjs` | Pulls every English Client dictionary out of a DeepSeek Harness checkout (TypeScript AST, follows `ctx.locale.register(...)`). |
| `build-client.mjs` | Writes `../client.js` from the two data files, including the `ru` language registration and the `html[lang="ru"]` layout rules. |

## Regenerate for a newer client

1. Use the client checkout at `../../../core` (`deepseek/core`), already cloned at
   the tag matching the running client. If it is missing, clone it:

   ```sh
   git clone --depth 1 --branch dsh-v0.2.1-rc.5 \
     https://github.com/deepseek-ai/deepseek-harness ../../../core
   ```

2. Install the parser and extract the English dictionaries:

   ```sh
   npm install
   node extract-dictionaries.mjs ../../../core
   ```

   The script prints `namespaces / strings / unresolved` and writes
   `../data/english-dictionaries.json`. `unresolved` should be empty; anything
   listed there is a registration form the resolver does not understand yet.

3. Translate `english-dictionaries.json` into the `dictionaries.json` shape
   (`{ namespaces: { ns: { key: translation } } }`). Translation rules used for
   the shipped run:

   - keep placeholders (`{name}`, `{count}`, `{path}`) exactly, never translate
     their names;
   - preserve Markdown, newlines, emoji, punctuation and edge whitespace;
   - leave product names, model ids, slash commands, paths, code identifiers and
     keyboard key names untranslated;
   - glossary: session → сессия, workspace → рабочее пространство, agent → агент,
     tool → инструмент, subagent → субагент, prompt → запрос, composer → поле
     ввода, context → контекст, settings → настройки, plan mode → режим плана,
     compaction → сжатие, sidebar → боковая панель, turn → ход, step → шаг,
     token → токен, permission → разрешение, approval → подтверждение,
     plugin → плагин, bundle → набор, preset → пресет, skill → навык, goal → цель,
     workflow → воркфлоу, session log → журнал сессии;
   - verify afterwards that the placeholder set of every translation equals the
     English one (the shipped run had 0 mismatches over 2918 strings).

4. If a translated label no longer fits its control, add a short override to
   `../data/overrides.json` instead of editing the bulk data, then rebuild.

5. Rebuild and reinstall:

   ```sh
   node build-client.mjs
   plugin_manager remove_bundle @app-apopov/dsh-locale-ru
   plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/locale-ru
   ```

   Then reload the Harness page so the new client bundle is fetched.

`build-client.mjs` refuses to build with fewer than 60 namespaces (a guard against
writing a half-extracted pack), and `overrides.json` entries must match an
existing namespace/key or the build fails.
