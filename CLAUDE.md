# CLAUDE.md

A live 3D playground game: you play one kid among NPC kids, grown-ups and a dog. It runs as
glasses-free 3D on Leia displays through the DisplayXR inline-3D SDK, and in 2D in any browser.
See `README.md` for the player-facing description and `TASKS.md` for open work.

- Live: https://joehillthunder.github.io/displayxr-playground-port/
- Deploy: push to `main`. `.github/workflows/pages.yml` copies the repo as-is to GitHub Pages; there is no build.

## Stack and constraints

- Plain ES modules, no bundler, no package.json. three.js `0.161.0` and `@displayxr/inline3d`
  `1.45.1` load from jsDelivr through the import map in `index.html`. If you bump a version, change
  the import map, and use only versions that are published and pinned exactly.
- No asset files. Every model, texture (canvas-drawn) and sound (WebAudio) is generated in code.
  Anything added under `assets/` needs a row in `assets/LICENSES.md` (original, generated or CC0 only).
- Units are metres, y is up, and +z points toward the starting camera. Character forward is
  `(sin yaw, cos yaw)`, and models face +z at yaw 0.
- This PC has no Node and no Python (the `python` command is a Store alias). Use PowerShell or perl
  for scripting.

## Run and check locally

```sh
# Static server (any static server works):
pwsh -NoProfile -File tools/serve.ps1 -Root . -Port 8791
# Screenshot + console errors in one go (2D path):
chrome --headless=new --use-angle=d3d11 --user-data-dir=<tmp> --window-size=1600,900 \
  --virtual-time-budget=9000 --enable-logging=stderr --v=0 --screenshot=out.png "http://localhost:8791/?kid=0&dev"
```

- For interactive tests, run headless Chrome with `--remote-debugging-port` and evaluate JS over the
  DevTools protocol. `window.playground` exposes `{ world, stage, crowd, eq, cam, player, choosePlayer }`.
  Drive the player with `dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))` and grab frames
  with `stage.renderer.domElement.toDataURL()` (the renderer has `preserveDrawingBuffer`).
- Don't evaluate `location.reload()` over CDP: the socket hangs. Start a fresh browser instead.
- URL params: `?kid=0-3` skips the picker, `?quality=high|medium|low`, `?depth=0-2`, `?dev` shows fps.
- Headless runs only exercise the 2D path. Stereo has to be checked on the Leia panel in the
  DisplayXR Browser (`C:\Program Files\DisplayXR\Browser\chrome.exe`). The page logs
  `[playground] firstWoven ...` and frame stats to the console, so run that browser with `--enable-logging`.

Before you push, verify at least: no console errors, the NPC kids cycle through activities, and the
equipment you touched still works (the stickers are a handy checklist: each one fires on success).

## Architecture (`js/`)

| File | Role |
|---|---|
| `main.js` | Boot order, follow camera, player input → `Character.input`, stickers, HUD, sun-follow, quality menu |
| `stage.js` | Renderer and DisplayXR session. **Camera rig with the attach pattern**: eye cameras are children of `stage.cam`, and `setViewRig` runs every frame. 2D fallback loop. |
| `world.js` | `World`: collision (surfaces, walls), interactables, an event bus (`on`/`emit`/`award`), updaters. Also the scenery. |
| `equipment.js` | Every piece of play equipment, plus `STICKERS`. Each one builds meshes, registers collision and interactables, and pushes an updater. |
| `character.js` | `Character`: movement modes shared by the player and the NPCs, pose and face animation. `Path` for slides. |
| `kidmodel.js` | `buildModel(look)`: the character mesh hierarchy (joints, face parts) |
| `npc.js` | `Crowd`: NPC kids (generator brains), grown-ups, `Dog`, `Pigeons`, `Butterflies` |
| `talk.js` | `SCRIPTS` (dialogue) and `Conversations` (runs lines: bubbles, mouths, head turns, voices) |
| `ballpit.js` | 1,000-ball physics (spatial hash), characters push balls |
| `materials.js` | Quality levels (`Q`, `QUALITY`, `q()`), material factories, `upgradeMaterials`, sky env map |
| `nature.js` | Instanced grass (wind + push shader) and trees |
| `fx.js`, `audio.js`, `input.js`, `util.js` | Speech bubbles and particles, synth SFX and babble, keyboard/touch/gamepad, maths |

### Key patterns

- **One movement code path.** The player and the NPCs both drive `ch.input`
  `{ mx, mz, fwd, run, jump, action }`. Equipment puts a character into a mode with
  `ch.enter(mode, data)`. `data.drive(ch, dt)` positions it each frame, `data.exitVel()` sets the
  jump-off velocity, and `data.release(ch)` frees the equipment. Modes: `ground`, `climb`, `slide`,
  `pole`, `swing`, `seat`, `sit`.
- **Collision is simple on purpose.** Characters are vertical cylinders. `addSurface` (a rect or
  circle with `top` or `topAt`) is walkable, `addWall` (an AABB) pushes characters out sideways, and
  `nav: true` / `navBlockers` make NPCs route around it. The floor is the highest surface within
  `STEP` (0.36 m) above the feet.
- **Interactables** are `{ id, label, pos, radius, yTol, can(ch), use(ch) }`, or a custom
  `near(ch) → distance|null` for anything that moves. The HUD prompt shows the `label` of the
  nearest one.
- **NPC brains are generators.** Each `yield` hands back `dt`. An activity is a plain sequence:
  `yield* walkTo(...)`, `tryUse(k, it)`, `yield* whileMode(k, 'climb', ...)`. To add one, write it in
  `ACTIVITIES` and give it a weight in `WEIGHTS`. To redirect a kid, set `k.next = '<activity>'` and
  `k.gen = life(k, 0)`.
- **Conversations:** a script is a list of `[speakerIndex, text]` lines, with `{0}`/`{1}` standing in
  for names, plus an optional trailing `{ then: activity }`. `talk.start(kind, parts, { hold })`:
  with `hold`, the NPC brains pause and the speakers face each other. NPC-initiated chats live in
  `Crowd.contextChat`/`adultChat` and the `chat` activity.
- **Materials:** equipment code uses plain colours through `mat(color)`. After the build,
  `upgradeMaterials` swaps them by colour (see the lists in `materials.js`) for plastic, painted
  metal, chrome or wood. To make a new colour shiny, add it to a list there.
- **Event bus:** `world.emit('slide' | 'cannonball' | 'icecream' | 'bark' | ...)`. `main.js` maps
  events to sounds and stickers. Award stickers with `world.award(ch, id)`; only the player's count.

## DisplayXR / stereo rules

- Keep **one persistent canvas**, and never replace it. The woven buffer is double width
  (left eye | right eye), sized by hand with `renderer.setPixelRatio(1)`.
- In `xrFrame`, validate the views and viewports *before* clearing. A bad frame is skipped, never drawn black.
- The shadow map updates once per frame (`shadowMap.autoUpdate = false`, `needsUpdate = true`
  before the eyes render).
- The depth tuning lives in `stage.js`: `POP` (convergence = 1.08 × camera distance, so the player
  sits just in front of the glass), `ipdFactorFor` (eye separation grows with distance, capped at 5),
  and the per-eye width cap (`q().eyeW`). Keep the convergence at 0.6 m or more for comfort.
- The HUD is DOM over the canvas (flat on the glass). Anything that should have depth, like speech
  bubbles, lives in the 3D scene.

## Gotchas

- A `ShaderMaterial` `#include` must sit on its own line. In a JS string, write it as `'\n#include <...>\n'`.
- In the env map (`makeEnvironment`), a sun brighter than about 4× blows rough surfaces out to white.
- A negative `%` index into a material array gives `undefined`, which renders white. Wrap it: `((i % n) + n) % n`.
- `mat()` caches by `JSON.stringify(opts)`, so never pass textures through it. Use the factories in
  `materials.js` or make the material directly.
- `Color.getHex()` already returns sRGB, as authored. Don't convert it again.
- The bubble text is canvas-drawn, so keep lines short. Lines over 26 characters wrap onto two lines.
- Commit messages end with a `Co-Authored-By` line when an agent writes the commit.
