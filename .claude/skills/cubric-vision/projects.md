# Cubric Vision: projects and media

Part of the `cubric-vision` skill. The base URL, the liveness check and the
whole-prompts rule are in [SKILL.md](SKILL.md): read that first.

## Projects

| Verb | Path | Purpose |
|---|---|---|
| POST | `/list-projects` | Every known project with id, name, folder path |
| POST | `/get-project` | One project's full record including `itemGroups` |
| POST | `/create-project` | New project |
| POST | `/update-project` | Write a project record back — body is `{folderPath, updates}` |
| POST | `/update-project-settings` | Settings only |
| POST | `/validate-project` | Integrity check |
| POST | `/delete-project` | Remove a project |
| POST | `/add-project-path` | Register an existing folder |
| POST | `/remove-project-path` | Unregister without deleting |
| POST | `/project/cleanup-assets` | Drop orphaned media |
| POST | `/project-notes`, `/project-notes/save` | Read and write `project.md` |

Start with `/list-projects` to get an id, then `/get-project` for its contents.

**`/update-project` merges `updates`, not a whole project.** The body is
`{folderPath, updates}` and the route spreads `updates` over the record. Send the
project under any other key — `project`, say — and it spreads `undefined`, writes
nothing, and still answers `{"success": true}`. Read the field back from
`project.json` before trusting a write.

### Creating a project

```bash
curl -s -X POST "$CUBRIC_URL/create-project" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Rider Study"}'
```

Body: `name` (defaults to `Untitled`), plus an optional `folderPath` naming the
**parent** directory. With no `folderPath` the project lands in the default
projects root — `Documents/Cubric Vision/Projects` unless the install overrides
it — which is the only root `/list-projects` scans for free.

Returns `{"success": true, "project": {...}}`. Keep `project.folderPath`: it is
the key every other project endpoint takes, not the id. The route creates
`Media/`, `project.json` and `project.md`, and on a folder-name collision
appends `_<first 8 of the id>` rather than merging into the existing project.

**The folder name is not always the project name.** Each of `<>:"/\|?*` is
replaced with `_` — replaced, not removed — and only in the folder, while
`project.name` keeps exactly what you sent. So `"Rider: Dusk"` is a project
*named* `Rider: Dusk` living in a folder called `Rider_ Dusk`. Never rebuild a
path out of the name you sent; use the returned `folderPath`.

Two things it does **not** do:

- **A custom `folderPath` is not registered.** `/list-projects` scans the default
  root plus a durable registry, so a project made anywhere else is invisible to
  the picker until you `POST /add-project-path` with its **parent** dir.
- **A running app does not notice.** The project exists on disk, but an open
  Vision window keeps its old list until it re-lists (back to the landing
  screen), and the new project does not become the open one.

### Creating a project, then generating into it

`/connector/generate` runs in **whatever project the app currently has open** —
creating a project does not make it that project. Open it explicitly:

```bash
curl -s -X POST "$CUBRIC_URL/connector/open-project" \
  -H 'Content-Type: application/json' \
  -d '{"folderPath":"C:/Users/me/Documents/Cubric Vision/Projects/Rider Study"}'
```

`folderPath` is the key, the same one `/create-project` and `/list-projects` hand
back. It opens the project for real — the app navigates to its gallery, exactly
as if the user had clicked the row — so it is a **visible change to what is on
their screen**. Returns `{"ok": true, "output": {folderPath, name, groupCount}}`
read back from the app's live state, so `groupCount` is a cheap confirmation you
landed where you meant to.

The full sequence:

1. `POST /create-project` → keep `folderPath`.
2. `POST /add-project-path` with the parent dir, if you passed a custom `folderPath`.
3. `POST /connector/open-project` with the `folderPath`.
4. `GET /connector/capabilities`, confirm `generationSubmit`.
5. `POST /connector/generate`.

**Do not skip step 3 and hope.** `NO_PROJECT` is the good outcome; the bad one is
the user having something open, in which case the run succeeds into the wrong
project and the response says `"ok": true` either way.

Errors: `BAD_REQUEST` (no `folderPath`), `NO_SUCH_PROJECT` (nothing readable
there — the message carries the underlying reason), `APP_UNAVAILABLE` (no window
listening).

## Media

| Verb | Path | Purpose |
|---|---|---|
| GET | `/project-media/:projectId` | List a project's media |
| GET | `/project-media/:projectId/download/:filename` | Fetch one file |
| DELETE | `/project-media/:projectId/:filename` | Delete one file |
| POST | `/project-media/:projectId/upload` | Add media |
| POST | `/project-media/:projectId/upload-raw` | Add media, raw body |
| POST | `/project-media/:projectId/update-meta` | Edit a media item's metadata |
| POST | `/project-media/:projectId/extract` | Extract a frame |
| POST | `/project-media/:projectId/probe-videos` | Probe video metadata |
| GET | `/project-media/:projectId/validate-preview-assets` | Check preview assets |
| POST | `/project-data/:projectId/upload` | Upload project data |
| GET | `/project-file?path=<urlencoded absolute path>` | Serve any project file |

`/project-file` is how the app itself refers to media internally, and the stored
`filePath` values are already in that form with a `&v=<timestamp>` cache buster.
To turn a stored `filePath` into a real path, URL-decode the `path` query
parameter.
