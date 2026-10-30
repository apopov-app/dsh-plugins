# DSH-плагины

Локальные плагины для DeepSeek Harness (Desktop, профиль `desktop`). Оба плагина — обычные
DSH-бандлы: папка плагина и есть его источник, в профиль она подключается ссылкой
(`link:`), поэтому правки подхватываются после переустановки бандла или перезапуска.

Репозиторий: <https://github.com/apopov-app/dsh-plugins> · npm: `@apopov-app/dsh-anonymous-session`, `@apopov-app/dsh-locale-ru`

## Состав

| Папка | Пакет | Что делает |
|---|---|---|
| [`anonymous-session/`](anonymous-session/README.md) | `@apopov-app/dsh-anonymous-session` 1.0.2 | Кнопка **«Новая анонимная сессия»** в левом сайдбаре: открывает стандартный интерфейс диалога в отдельном рабочем пространстве без выбора папки проекта. |
| [`locale-ru/`](locale-ru/README.md) | `@apopov-app/dsh-locale-ru` 1.0.3 | Русский язык для веб-клиента: язык `ru` в списке языков, 66 неймспейсов и 2918 переведённых строк, плюс несколько ru-правок вёрстки. |

### anonymous-session

- Пункт в сайдбаре (`sidebar.panellist`, id `anonymous-session`, order −10) прямо под кнопкой
  «Новая сессия»; оформлен как **вторая primary-кнопка** в геометрии штатной (38px, тот же радиус,
  заливка и hover), через `:has()` на своей иконке. В сложенном рельсе остаётся иконкой.
  Клик открывает панель-стартер, которая вызывает штатный `uiWorkspace.openWorkspace`.
- Host-половина готовит каталог `~/.dsh/anonymous` и регистрирует рабочее пространство
  «Анонимные сессии» (идемпотентно, заголовок — по текущей локали). Диалог — обычный:
  модель, plan mode, вложения, история; папку проекта выбирать не нужно.
- Подробности: [`anonymous-session/README.md`](anonymous-session/README.md).

### locale-ru

- Регистрирует язык `Русский` (fallback — английский) и русские словари для всех клиентских
  неймспейсов: сайдбар, диалог, чат, настройки, менеджер плагинов, темы, расписание, терминал,
  браузер, экспериментальные поверхности.
- Добавляет ru-правила вёрстки там, где английские ширины не выдерживают русский текст:
  заголовок «Рабочие пространства» в сайдбаре и карточки пресетов агента в настройках.
- Строки, которых нет в пакете (новая версия клиента), показываются по-английски.
- Исходные словари и инструменты перегенерации лежат в [`locale-ru/data/`](locale-ru/data) и
  [`locale-ru/tooling/`](locale-ru/tooling/README.md). Экстрактору нужен чекаут клиента — он уже
  склонирован в [`../core`](../core) (тег `dsh-v0.2.1-rc.5`).
- Подробности: [`locale-ru/README.md`](locale-ru/README.md).

## Исходники клиента

[`../core`](../core) — shallow-клон `deepseek-harness` на теге `dsh-v0.2.1-rc.5`, ровно той
версии, что собрана в установленном Desktop-клиенте. Это не плагин: он нужен только
инструментам языкового пакета (извлечение английских строк и сверка ключей при обновлении
клиента) и лежит в `.gitignore` корня `deepseek/`. Если клон удалён, его можно восстановить
командой из [`locale-ru/tooling/README.md`](locale-ru/tooling/README.md).

## Установка

Плагины ставятся штатным менеджером плагинов (в сессии агента или через Settings → Plugins
нельзя указать локальный путь, поэтому используется `install_bundle`):

```sh
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/anonymous-session
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/locale-ru
```

Установка добавляет пакет в `package.json` профиля `desktop`, линкует папку в
`node_modules` профиля и включает бандл. Переустановка (если плагин уже стоит):

```sh
plugin_manager remove_bundle @apopov-app/dsh-locale-ru
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/locale-ru
```

После установки/обновления клиентских бандлов **обновите страницу Harness** (⌘R); изменения
Host-половины подхватываются при следующем запуске приложения.

## Требования

- DeepSeek Harness Desktop, версия клиента **0.2.1-rc.5** (языковой пакет собран из
  `dsh-v0.2.1-rc.5`). Плагины не имеют зависимостей и шага сборки.
- Node.js нужен только для инструментов перегенерации языкового пакета (см.
  [`locale-ru/tooling/README.md`](locale-ru/tooling/README.md)).

## Публикация в npm

Оба пакета готовы к публикации под scope `@apopov-app`: убраны `private`, добавлены `license`, `engines.dsh`, файл `LICENSE`, ключевые слова; display-метаданные (locale `meta`, иконка) и `files` на месте. Состав пакета:

```sh
cd plugins/anonymous-session && npm pack --dry-run
cd ../locale-ru && npm pack --dry-run
```

Публикация (нужен npm-логин с доступом к scope `@apopov-app`):

```sh
npm login
cd plugins/anonymous-session && npm publish --access public
cd ../locale-ru && npm publish --access public
```

Пользователи ставят их как `@apopov-app/dsh-anonymous-session@1.0.2` и `@apopov-app/dsh-locale-ru@1.0.3` через Plugins → Add plugin, CLI `dsh plugin --profile <p> add <spec>` или агентский `plugin_manager install_bundle`.

`engines.dsh` у обоих — `>=0.2.1-rc.5 <0.3.0`; после обновления Desktop-клиента поднимите диапазон и версию пакета (для языкового пакета — ещё и перегенерируйте словари, см. `locale-ru/tooling/README.md`).

## Ограничения

- Языковой пакет переводит клиентские словари. Строки, которые Host отдаёт как
  `LocalizedText` (описания инструментов и команд, заголовки плагинов из метаданных
  пакетов), остаются английскими — это другой канал, браузерным плагином он не
  переводится.
- ru-правила вёрстки намеренно узкие: они привязаны к суффиксам CSS-классов клиента
  (`_sectionHeader`, `_cardIdentity`, …) и включаются только при `html[lang="ru"]`.
  При смене классов в новой версии клиента правила просто перестанут применяться —
  ничего не сломается, но вёрстка вернётся к исходной.
- «Анонимность» в `anonymous-session` означает «без проекта, каталога и выбора папки»:
  сессии — обычные (пишутся в журнал, видны в сайдбаре в группе «Анонимные сессии»),
  рабочая папка — пустая `~/.dsh/anonymous`.
