# Anonymous session

A DSH plugin that adds a **New anonymous session** launcher to the left sidebar.
Clicking it opens the shipped Conversation UI — the same page, composer, model
selector, plan mode, attachments, and history as any session — but bound to a
dedicated, project-free workspace, so no directory picker appears.

## What you get

- **Sidebar launcher** (`sidebar.panellist`, id `anonymous-session`, order −10),
  directly under the shipped **New session** button, plus the matching `main` seat
  it selects while it starts. The shell renders a panel entry as a nav row;
  this plugin restyles its own row as a second primary button in the shipped
  bar geometry (38px, same radius, elevated fill, hover; macOS wash) using a
  `:has()` hook on its own icon, and keeps the plain icon control in the
  collapsed rail.
- **Standard conversation.** The launcher hands the click to the shipped
  New Session flow (`uiWorkspace.openWorkspace`), which creates or reuses a
  blank Session in the anonymous workspace and reveals the Conversation. Every
  feature of the normal chat works unchanged, including the session list row.
- **No directory picker.** The workspace is resolved by the Host, not chosen in
  the UI. Sessions work in `$DSH_HOME/anonymous` (falling back to
  `~/.dsh/anonymous`), an empty folder that belongs to no project.
- **Localized** (en / ru / zh). The plugin registers a Russian dictionary and,
  when the deployment's language catalog lacks Russian, adds it with English as
  the fallback so the profile's `locale.preference: ru` can resolve.

## How it works

1. Clicking the sidebar row selects a small starter panel
   (`main` key `anonymous-session`).
2. The starter posts to the authenticated Connection route
   `POST /api/anonymous-session` (Host half). The Host creates the directory if
   needed, then calls `workspaceRegistry.create(path, title)` — idempotent for a
   repeated path — and returns `{ workspaceId, path, title }`. The workspace
   title follows the caller's current locale.
3. The starter awaits `uiWorkspace.openWorkspace(workspaceId)`, the shipped
   entry point: it reuses a blank Session in that workspace or creates one,
   then reveals the Conversation. The Client learns the new workspace from the
   workspace stream, so a first-use click retries the "unknown workspace"
   refusal briefly before giving up and offering **Try again**.

Nothing model-facing is registered: no tool, no prompt section, no event
payload. The model sees only the Session it was started in.

## Composition

`cordis.patch.yml` inserts one Host row:

```yaml
- insert:
    - id: anonymous-session
      name: '@app-apopov/dsh-anonymous-session'
```

The package needs no dependencies and no build step; the browser half ships as
`./client` under the `dsh.client` manifest section.

## Install

```sh
plugin_manager install_bundle <absolute path to this directory>
```

## Tradeoffs to know

- Anonymous sessions are grouped in the sidebar under their own workspace
  ("Anonymous sessions"), not mixed into a project workspace. The workspace
  record is durable; removing the plugin leaves an empty workspace behind.
- The shipped **New session** button starts in the current (or most recent)
  workspace, so it can land in the anonymous workspace after you were last in
  an anonymous session. Open a project session first to start in that project.
- The agent's working directory is the shared anonymous folder. It contains no
  project files, but it is a real directory the approved tools may read and
  write, and session logs still record the conversation like any Session.
