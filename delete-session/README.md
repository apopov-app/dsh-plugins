# Delete dialog permanently

A DSH plugin that adds **Delete dialog permanently** to the Session row's
"..." menu. The shipped menu can only *archive* a dialog: the conversation
stays on disk, keeps its Workspace slot, and can be restored. This row does the
opposite — it stops whatever the dialog is running and **erases it from disk**,
with no undo.

## What it does

- **One destructive menu row.** The entry sits after *Copy session ID*, is
  drawn with the error color, and starts a separated group. Clicking it closes
  the menu and opens a confirmation dialog; nothing is deleted before the
  second click.
- **The confirmation names the dialog** and states that the history will be
  erased. When the dialog still has running work — a turn, background jobs,
  subagents, or scheduled tasks — the dialog lists that work and warns that it
  will be stopped. When the dialog owns subagent child dialogs, their count is
  shown too.
- **Open dialogs are handled.** Confirming a dialog that the main view
  currently shows stops its work, erases its files, and switches the view to
  the New Session state.
- **Hard erasure, not archiving.** For the dialog and every subagent child
  recursively, the Host:
  1. stops the running work through `workspace/session-stop` and waits (up to
     3 s) until the agent leaves `running`;
  2. removes the id from the Workspace registry's archive and pin sets and
     detaches it from its Workspace accounting;
  3. deletes the JSONL session directory
     (`$DSH_HOME/sessions/<project>/<session-id>/`) with the log, lock, and any
     generation files;
  4. deletes the cached projection checkpoint
     (`$DSH_HOME/storages/session_projcache/sessions/<session-id>.json` and its
     invalid-record backups);
  5. emits `api-session/removed`, so every open client drops the row at once
     and a short "Dialog deleted permanently" notice appears.
- **Orphan cache sweep on startup.** A dialog erased while it was live can
  write one last projection checkpoint during Host shutdown. On the next start
  the plugin erases cached rows whose Session no longer exists, so no cached
  title or message text outlives the dialog.
- **Nothing else is touched.** The Workspace directory, its files, other
  dialogs, forks that merely share the deleted dialog as a fork parent, and the
  content-addressed attachment pool are left alone.

## How it works

- **Host half** (`index.js`) registers an authenticated Connection route,
  `/api/delete-session`, with two actions: `inspect` (existence, live state,
  registry membership, current activity, subagent descendants) and `delete`
  (the erase sequence). It reads the JSONL layout directly because DSH exposes
  no session-deletion service, and it reuses the public registry API
  (`unarchiveSession`, `unpinSession`, `Workspace.detachSession`) for durable
  state.
- **Client half** (`client.js`) registers `sidebar.workspaces.session.menu.item`
  (`order: 500`) and a `shell.overlay` confirmation. The dialog inspects the
  session when it opens, so the warning reflects the work running at that
  moment. After a successful delete it shows a transient notice and navigates
  away only when the deleted dialog was the one on screen.

## Known limitation

DSH keeps an opened dialog's Agent in memory until the Host process exits, and
the public Host API has no "close this session" operation. For a dialog that is
open at deletion time, the log, projections, and accounting are erased
immediately and the row disappears from every client, but the process keeps the
in-memory agent until the next restart; it cannot be written back to disk
because its log directory is gone.

## Install

```sh
plugin_manager install_bundle /Users/ruelephant/dev-project/deepseek/plugins/delete-session
```

Or from the Web UI's **Plugins → Add plugin** with the git spec used by the
other bundles in this repository. Reload the window (⌘R) after installing the
client half; the Host route appears on the next app start.

## Requirements

- DSH Desktop `0.2.1-rc.5` or another client in the `>=0.2.1-rc.5 <0.3.0`
  range.
- The plugin has no build step and no npm dependencies.
