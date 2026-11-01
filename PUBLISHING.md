# Публикация и разработка

Служебный документ для поддержки репозитория. Пользователям он не нужен — им достаточно
[`README.md`](README.md).

## Пакеты в npm

Все пять плагинов опубликованы под scope `@app-apopov` (организация `app-apopov`).

| Пакет | Версия |
|---|---|
| `@app-apopov/dsh-anonymous-session` | 1.0.2 |
| `@app-apopov/dsh-locale-ru` | 1.0.3 |
| `@app-apopov/dsh-voice-assistant` | 0.1.0 |
| `@app-apopov/dsh-delete-session` | 0.1.0 |
| `@app-apopov/dsh-engram-memory` | 0.2.2 |

Проверка состава перед публикацией: `npm pack --dry-run` в папке плагина. Поле `files`
перечисляет только нужное — `node_modules` и служебные файлы в пакет не попадают.

## Публикация

Токен с обходом 2FA (`Bypass 2FA`) npm не пускает в `npm publish`: попытка возвращает
`404 Not Found`, а не `403`. Такой токен может только ставить версию на стейджинг, а
подтверждает человек с 2FA:

```sh
npm stage publish --access public   # допускается с токеном без 2FA
npm stage approve <stage-id>        # требует 2FA: интерактивный login или веб-интерфейс
```

При стейджинге npm заводит в пакете служебную версию `0.0.0-stage` — это плейсхолдер,
`latest` указывает на настоящую версию, на установку он не влияет.

`engines.dsh` у всех пакетов — `>=0.2.1-rc.5 <0.3.0`; после обновления Desktop-клиента
поднимите диапазон и версию пакета. Для языкового пакета дополнительно перегенерируйте
словари (см. `locale-ru/tooling/README.md`; экстрактору нужен чекаут клиента).

## Локальная установка для разработки

Пока плагин правится, его держат ссылкой на папку: менеджер плагинов принимает только spec,
поэтому локальный путь идёт через `install_bundle`.

```sh
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/locale-ru
```

Команда добавляет `link:` в `dependencies` профиля и включает бандл. Переустановка —
`plugin_manager remove_bundle @app-apopov/dsh-locale-ru`, затем `install_bundle` снова.
Правки клиентской половины подхватываются после обновления страницы (⌘R), Host-половины —
после перезапуска приложения.

## Установка из GitHub

Менеджер плагинов использует pnpm и понимает git-спеки; для монорепозитория нужен `path:`.

```sh
SHA=$(git ls-remote https://github.com/apopov-app/dsh-plugins.git refs/heads/main | cut -f1)
dsh plugin --profile <профиль> add "git+https://github.com/apopov-app/dsh-plugins.git#${SHA}&path:/<папка>"
```

Пинить стоит полный SHA, а не ветку: установка воспроизводима и не поменяется от новых пушей.
