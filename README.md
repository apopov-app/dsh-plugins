# DSH-плагины

Локальные плагины для DeepSeek Harness (Desktop, профиль `desktop`). Каждый — обычный
DSH-бандл: папка плагина и есть его источник, в профиль она подключается ссылкой
(`link:`), поэтому правки подхватываются после переустановки бандла или перезапуска.

Репозиторий: <https://github.com/apopov-app/dsh-plugins> · npm-скоуп `@apopov-app`, имя пакета — `@apopov-app/dsh-<папка>`.

## Состав

| Папка | Пакет | Что делает |
|---|---|---|
| [`anonymous-session/`](anonymous-session/README.md) | `@apopov-app/dsh-anonymous-session` 1.0.2 | Кнопка **«Новая анонимная сессия»** в левом сайдбаре: открывает стандартный интерфейс диалога в отдельном рабочем пространстве без выбора папки проекта. |
| [`locale-ru/`](locale-ru/README.md) | `@apopov-app/dsh-locale-ru` 1.0.3 | Русский язык для веб-клиента: язык `ru` в списке языков, 66 неймспейсов и 2918 переведённых строк, плюс несколько ru-правок вёрстки. |
| [`voice-assistant/`](voice-assistant/README.md) | `@apopov-app/dsh-voice-assistant` 0.1.0 | Плавающая орбита и полный голосовой режим: локальное распознавание GigaAM, озвучка через `assistant_say`, barge-in и выбор голоса. |
| [`delete-session/`](delete-session/README.md) | `@apopov-app/dsh-delete-session` 0.1.0 | Пункт **«Удалить диалог навсегда»** в меню сессии: останавливает работу и стирает журнал, кэш проекций и учёт в рабочем пространстве — без архива и без возможности восстановить. |
| [`engram-memory/`](engram-memory/README.md) | `@apopov-app/dsh-engram-memory` 0.1.0 | Память в локальном Engram: `memory_save` / `memory_search` / `memory_context`, проект — `<имя папки>-<хэш пути>`, плюс общий слой `global`. |

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

### voice-assistant

- Плавающая орбита в диалоге и полноценный голосовой режим: микрофон открыт, речь
  распознаётся локально, ответ модели озвучивается инструментом `assistant_say`
  (`intro` / `progress` / `reply`), а перебить ассистента можно, просто начав говорить
  (barge-in).
- Регистрирует собственный русский распознаватель (GigaAM v3 CTC, ONNX через
  `sherpa-onnx`) и синтезирует Piper-голосами сам: отдельные плагины распознавания и
  озвучки не нужны.
- Голоса: русские `irina`, `dmitri`, `denis`, `ruslan` и английский
  `en_US-lessac-medium`; интонация и темп — пресетами. Настройки лежат в
  Settings → General и на странице плагина, состояние — в
  `$DSH_HOME/voice-assistant/state.json`.
- Требует `sherpa-onnx-node` и сетевого доступа при первом выборе голоса (модели
  скачиваются в `$DSH_HOME/voice-assistant`). Подробности — в
  [`voice-assistant/README.md`](voice-assistant/README.md).

### delete-session

- Пункт **«Удалить диалог навсегда»** (`sidebar.workspaces.session.menu.item`, order 500,
  отделён разделителем) в меню «...» строки сессии. Открывает подтверждение с заголовком
  диалога и списком того, что сейчас выполняется; удаление начинается только после
  второго клика.
- Host-половина по маршруту `/api/delete-session` (`inspect` / `delete`):
  останавливает работу через `workspace/session-stop` и ждёт выхода агента из `running`,
  снимает id с архива и пина, отцепляет от учёта рабочего пространства, стирает каталог
  журнала `$DSH_HOME/sessions/<проект>/<id>/`, кэш проекций
  `$DSH_HOME/storages/session_projcache/sessions/<id>.json` и оповещает клиентов
  `api-session/removed`. Дочерние диалоги подагентов удаляются каскадом; форки и вложения
  не трогаются.
- Требование DSH: публичного API удаления сессии нет, поэтому плагин работает с
  документированной раскладкой JSONL-хранилища. Открытый в момент удаления диалог исчезает
  из списка сразу, но его агент остаётся в памяти процесса до перезапуска — журнала на
  диске к этому моменту уже нет. Подробности — в
  [`delete-session/README.md`](delete-session/README.md).

### engram-memory

- Host-плагин памяти поверх локального Engram: инструменты `memory_save`, `memory_search`
  и `memory_context`. Проект — `<имя папки>-<8 hex от sha256(realpath)>`, так что две разные
  папки с одинаковым именем не сливаются; ни инициализации, ни имени проекта в аргументах
  не нужно, `scope: "global"` кладёт запись в общий проект `global`.
- Закрывает разрыв MCP-варианта: MCP-сервер памяти DSH запускается в каталоге профиля и
  не видит папку сессии, из-за чего проект приходилось указывать руками. Локальный
  `engram serve` плагин поднимает сам и переиспользует уже запущенный — отдельный демон
  держать не нужно.
- Требует установленный `engram` и базу `~/.engram/engram.db`. Сквозного поиска в Engram
  нет, поэтому выдачу текущего проекта и `global` плагин склеивает сам; `all: true`
  ищет по всем проектам.
- Подробности — [`engram-memory/README.md`](engram-memory/README.md).

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
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/voice-assistant
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/delete-session
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/engram-memory
```

Установка добавляет пакет в `package.json` профиля `desktop`, линкует папку в
`node_modules` профиля и включает бандл. Переустановка (если плагин уже стоит):

```sh
plugin_manager remove_bundle @apopov-app/dsh-locale-ru
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/locale-ru
```

После установки/обновления клиентских бандлов **обновите страницу Harness** (⌘R); изменения
Host-половины подхватываются при следующем запуске приложения.

### Установка без npm (из GitHub)

Плагины можно ставить напрямую из этого репозитория: менеджер плагинов использует pnpm и понимает git-спеки. Для монорепозитория нужен `path:`:

```sh
SHA=$(git ls-remote https://github.com/apopov-app/dsh-plugins.git refs/heads/main | cut -f1)
dsh plugin --profile <профиль> add "git+https://github.com/apopov-app/dsh-plugins.git#${SHA}&path:/anonymous-session"
dsh plugin --profile <профиль> add "git+https://github.com/apopov-app/dsh-plugins.git#${SHA}&path:/locale-ru"
```

Строка та же для любой папки: замените `path:/<папка>` на нужную (`voice-assistant`, `delete-session`, `engram-memory`).

Те же строки принимает **Plugins → Add plugin** в Web-интерфейсе. Пинить стоит полный SHA, а не ветку: установка воспроизводима и не поменяется от новых пушей. Проверено: `pnpm add` ставит пакеты из этого репозитория, `dsh.bundle` и клиентские бандлы на месте.

## Требования

- DeepSeek Harness Desktop, версия клиента **0.2.1-rc.5** (языковой пакет собран из
  `dsh-v0.2.1-rc.5`). Шага сборки у плагинов нет: папка и есть готовый бандл.
- `voice-assistant` зависит от `sherpa-onnx-node` — при установке из npm pnpm поставит его
  сам, модели голосов и распознавания скачиваются при первом использовании.
- Node.js нужен только для инструментов перегенерации языкового пакета (см.
  [`locale-ru/tooling/README.md`](locale-ru/tooling/README.md)).

## Публикация в npm

Пакеты готовы к публикации под scope `@apopov-app`: убраны `private`, добавлены `license`, `engines.dsh`, файл `LICENSE`, ключевые слова; display-метаданные (locale `meta`, иконка) и `files` на месте. Состав пакета:

```sh
cd plugins/anonymous-session && npm pack --dry-run
cd ../locale-ru && npm pack --dry-run
cd ../voice-assistant && npm pack --dry-run
cd ../delete-session && npm pack --dry-run
cd ../engram-memory && npm pack --dry-run
```

Публикация (нужен npm-логин с доступом к scope `@apopov-app`; отложена, пока решается вопрос с восстановлением аккаунта):

```sh
npm login
cd plugins/anonymous-session && npm publish --access public
cd ../locale-ru && npm publish --access public
cd ../voice-assistant && npm publish --access public
cd ../delete-session && npm publish --access public
cd ../engram-memory && npm publish --access public
```

Пользователи ставят их как `@apopov-app/dsh-anonymous-session@1.0.2`, `@apopov-app/dsh-locale-ru@1.0.3`, `@apopov-app/dsh-voice-assistant@0.1.0`, `@apopov-app/dsh-delete-session@0.1.0` и `@apopov-app/dsh-engram-memory@0.1.0` через Plugins → Add plugin, CLI `dsh plugin --profile <p> add <spec>` или агентский `plugin_manager install_bundle`.

`engines.dsh` у всех — `>=0.2.1-rc.5 <0.3.0`; после обновления Desktop-клиента поднимите диапазон и версию пакета (для языкового пакета — ещё и перегенерируйте словари, см. `locale-ru/tooling/README.md`). У `voice-assistant` в зависимостях `sherpa-onnx-node` — при установке из npm pnpm поставит его сам; модели скачиваются при первом использовании.

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
