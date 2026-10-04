# Mini 3D Studio v1

Private development workspace for Mini-3Dgame.

## Access roles

- **Owner** — code, scene, data, team access.
- **Developer** — code, scene, data, play test.
- **Builder** — scene editing and play test.
- **Tester** — read-only scene/data and play test.
- **Player** — no Studio access.

Owner Player ID is checked on the Supabase backend. The public game does not grant Studio access from client-side UI state.

## Main workflow

1. Open **MORE → MINI 3D STUDIO**.
2. Work in **CODE**, **SCENE**, or **DATA**.
3. Press **SAVE** or use `Ctrl+S`.
4. Press **PLAY TEST**. This opens `?studioTest=1` and loads local Scene + Data drafts.
5. When a change is ready, use **COPY CURRENT**.
6. Replace the matching source file manually in the repository.
7. Refresh the public game and test again.

Studio intentionally does not auto-publish production code.

## CODE

The editor can open:

- `game.js`
- `game-config.js`
- `scene-data.js`
- `dev-tools.js`
- `style.css`
- `profile.js`
- `index.html`

Code drafts autosave locally. A code draft is **not executed automatically** by Play Test. Use COPY CURRENT and replace the real source file when you want to run that code.

## SCENE

Scene objects currently support:

- Box / building / wall
- Tree
- Car Spawn
- Loot Area

Tools:

- Select
- Move
- Rotate
- Scale
- Duplicate
- Delete
- Search
- Hide (editor only)
- Lock (editor only)
- Translation / rotation / scale snap
- Undo / redo
- Validation

Shortcuts:

- `W` Move
- `E` Rotate
- `R` Scale
- `F` Focus selected
- `Delete` Delete selected
- `Ctrl+D` Duplicate
- `Ctrl+Z` Undo
- `Ctrl+Y` Redo
- `Ctrl+S` Save

**COPY CURRENT** in SCENE generates the complete `scene-data.js` module.

## DATA

DATA edits `game-config.js`:

- Game/map values
- Bot values
- Zone values
- Weapon stats
- Car tuning
- Loot counts

**COPY CURRENT** in DATA generates the complete `game-config.js` module.

Play Test reads the local Data draft only in Studio test mode. Normal players use the real `game-config.js`.

## PLAY TEST dev panel

Studio Play Test includes developer-only controls:

- Start Ground
- Heal
- Test Loadout
- Bring Car
- Fast Zone
- Show Colliders
- Clear Bots
- Return Lobby

It also shows FPS, phase, HP, bots, loot, cars, object count, and zone radius.

The panel exists only when the URL contains `?studioTest=1`.

## Backups and versions

- **SNAPSHOT** stores a local Studio version.
- **VERSIONS** restores a local snapshot.
- **EXPORT BACKUP** downloads a portable JSON backup.
- **IMPORT** restores that backup.

Local drafts and snapshots are browser data. Export important work before clearing browser storage.

## Important source files

- `game-config.js` — gameplay numbers and weapon/car/loot tuning.
- `scene-data.js` — map objects, car spawns, loot areas.
- `game.js` — game systems and runtime logic.
- `dev-tools.js` — isolated Play Test developer panel.
- `studio/` — private development workspace.

## Safe production rule

Use this order for major changes:

**Edit → Save → Snapshot → Play Test → Validate → Copy Current → Replace source → Test public game**

If a major change breaks the project, the branch `studio-v02-backup-20261004` preserves the pre-v1 Studio state.
