# Russian language pack

A DSH client plugin that adds **Русский** to the language selector and translates the shipped client UI — the whole interface, not just one plugin — into Russian.

## What it does

- Registers the `ru` language (`Русский`, English fallback) in the Client locale catalog, so the profile's `locale.preference: ru` resolves and Settings → Language lists it. The registration is self-healing: the pack watches the catalog and restores the language if another plugin that added it first unloads, and it installs dictionaries before the language so activation never flashes English.
- Registers one Russian dictionary per shipped client namespace (sidebar, conversation, chat, settings, plugin manager, theming, schedule, terminal, browser, and the experimental surfaces), generated from the `dsh-v0.2.1-rc.5` source: 66 namespaces, 2918 strings.
- Applies the layout rules Russian copy needs (scoped to `<html lang="ru">`):
  - the workspaces section header gets more of its row and ellipsizes instead of clipping a long label mid-word;
  - Agent-presets cards give the title its own line, so a long Russian default badge cannot squeeze the title out;
  - a few fixed-width labels are shortened through `data/overrides.json` (e.g. «По умолчанию», «О режиме», «Как применять»).
- Unknown keys fall back to English per key, so a newer client that adds copy stays readable.

## Composition

`cordis.patch.yml` inserts one Host row (a no-op Host half; the pack is browser-side):

```yaml
- insert:
    - id: locale-ru
      name: '@apopov-app/dsh-locale-ru'
```

## Install

```sh
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/locale-ru
```

The dictionaries register live; reload the Harness page after installing or replacing the bundle.

## Data and tooling

| Path | Role |
|---|---|
| `data/dictionaries.json` | Translated dictionaries: 66 namespaces, 2918 strings (source of truth for `client.js`). |
| `data/overrides.json` | Short-form overrides for labels whose slot is narrower than the natural translation. |
| `tooling/extract-dictionaries.mjs` | Extracts the English dictionaries from a DeepSeek Harness checkout (TypeScript AST). |
| `tooling/build-client.mjs` | Regenerates `client.js` from the two data files, including the `ru` layout rules. |
| `tooling/README.md` | Step-by-step regeneration and translation rules. |

`client.js` is generated — edit the data files and rerun `node tooling/build-client.mjs` instead of hand-editing it.
