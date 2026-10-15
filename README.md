# DisplayXR Playground

A live 3D playground full of kids at play. Climb the ladder and the rock wall, cross the wobbly
bridge, go down the wave slide and the spiral slide, cannonball off the diving plank into a pit of
1,000 colourful balls, swing, spin the merry-go-round and ride the seesaw with a friend. In
glasses-free 3D on a Leia display through [DisplayXR](https://displayxr.org), and in 2D in any
browser.

**Play:** https://joehillthunder.github.io/displayxr-playground-port/

## How to play

Pick your kid (Maya, Leo, Zara or Kai). The other kids are already playing and use everything on
their own.

| | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Move | `W` `A` `S` `D` or arrows, `Shift` to run | Thumbstick (left side) | Left stick, `RT` to run |
| Jump | `Space` | Jump | `A` |
| Climb, slide, swing, ride, pet, talk | `E` | Action | `X` / `B` |
| Look around | Drag, wheel to zoom, `C` to reset | Drag on the right side | Right stick |

On the ladder and rock wall, `W` climbs and `S` goes down. On a swing, hold `W` to pump higher and
press `Space` to leap off. On the diving plank, run and jump for a cannonball. In the ball pit, jump
to climb out. `Tab` shows the stickers, `K` switches kid, `M` toggles sound, `H` hides the help.

**Stickers:** 12 to collect (ladder, wave slide, bridge, rock wall, spiral slide, cannonball, fire
pole, swing high, fast merry-go-round, seesaw with a friend, ice cream, pet the dog). They are saved
in your browser.

## Who's on the playground

- **Seven other kids** with their own play routines: ladder to slide or pole, rock wall to spiral
  slide or diving plank, swings, ball pit, merry-go-round, seesaw, sandbox, ice cream, and tag (they
  will chase you). Sit on the seesaw alone and one of them comes over to join you.
- **Biscuit the dog** plays fetch with Dad. Pet him and he follows you around.
- **Mom** reads on a bench, **Grandpa** feeds the pigeons, and the **ice-cream seller** hands out cones.
- Pigeons scatter when you run at them, and butterflies drift over the flower beds.

## Everyone talks

Characters hold short conversations in speech bubbles that float at each speaker's depth, with a name
tag in their shirt colour. The speaker's mouth moves, they babble in their own voice, and listeners
turn their heads toward them.

- **Kids meet up and make plans.** Two kids walk over to each other, chat, and often go off to do
  something together ("Race you to the swings!").
- **Kids chat while they play:** side by side on the swings, in the ball pit, on the seesaw or the
  merry-go-round, up on the towers, and in the sandbox.
- **Grown-ups join in.** Mom calls out to kids by name ("Five more minutes!"), Grandpa tells stories, Dad
  offers the ball, Rosa takes ice-cream orders, and kids say hi to Biscuit, who woofs back.
- **You can talk too.** Walk up to any kid and press `E` ("Talk to Leo"). They may invite you to play,
  then head off to do it.

The lines are scripted in `js/talk.js`, with no network or AI service involved.

## How depth is used

One woven canvas with a **camera rig** (`@displayxr/inline3d` 1.45.1): the follow camera is the
game's own viewpoint, and the eye cameras hang off it (the attach pattern), so there is no stereo
lag while it moves.

| Element | Where it sits | Why |
|---|---|---|
| Your kid | Just in front of the glass (convergence = 1.08 × camera distance) | You are the subject |
| Swings, slides, kids running at you | Come out of the glass as they move toward the camera | The fun part |
| Equipment around you | Behind the glass | Readable depth, comfortable |
| Trees, fence, hills, clouds, sky | Far behind | Depth layers for parallax |
| Speech bubbles | At the speaker's depth, over their head | Who said what is obvious in 3D |
| HUD (stickers, prompts) | Flat DOM on the glass | Crisp text |

Eye separation grows with camera distance (`ipdFactorFor` in `js/stage.js`), so a playground framed
from 7 m still has the depth of a model on a desk. The Depth slider scales it from 0 (flat) to 2.
The per-eye buffer is capped at 2,560 px wide, and the shadow map renders once per frame for both eyes.

**Graphics.** Characters have detailed faces (irises, catch-lights, blinking lids, brows, a talking
mouth) and knit-textured clothes. Equipment is glossy clearcoat plastic, painted metal, chrome and
wood grain, all reflecting an environment map rendered from the sky. Up to 160,000 instanced grass
blades sway in the wind and part around anyone walking through them. Trees have swaying crowns, and a
4K sun shadow map follows the player. The **Quality** menu (High, Medium, Low) trades grass,
shadow resolution and the per-eye resolution for speed on the 3D panel.

URL options: `?kid=0`–`3` skips the picker, `?quality=high|medium|low`, `?depth=0`–`2`, `?dev` shows fps.

## Hardware

- **For 3D:** a Leia SR glasses-free 3D display, on Windows, running the
  [DisplayXR Browser](https://displayxr.org/browser).
- **Anywhere else:** any modern browser plays the same game in 2D.

## Code

Plain ES modules, no build step. three.js 0.161 and the DisplayXR SDK come from jsDelivr through an
import map. Everything is built from primitives at runtime. There are no art or audio files, and
the sounds are synthesized with WebAudio.

| File | What |
|---|---|
| `js/main.js` | Boot, follow camera, player input, stickers, HUD |
| `js/stage.js` | Renderer and the DisplayXR inline-3D session (camera rig, 2D fallback) |
| `js/world.js` | Collision (surfaces, walls), interactables, scenery |
| `js/equipment.js` | Towers, bridge, ladder, rock wall, pole, slides, plank, ball pit, swings, merry-go-round, seesaw, sandbox, ice-cream cart |
| `js/character.js` | Movement modes and animation, shared by the player and the NPCs |
| `js/kidmodel.js` | The character model: face, hair, clothes |
| `js/talk.js` | Conversation scripts and the runner (bubbles, mouths, head turns, voices) |
| `js/materials.js`, `js/nature.js` | Materials, environment lighting, quality levels; grass and trees |
| `js/npc.js` | NPC kid routines, grown-ups, the dog, pigeons, butterflies |
| `js/ballpit.js` | 1,000-ball physics with a spatial hash |
| `js/fx.js`, `js/audio.js`, `js/input.js` | Speech bubbles and confetti, sound effects, keyboard/touch/gamepad |

## Status

See [`TASKS.md`](TASKS.md).

## License

Code: [Apache 2.0](LICENSE). Assets: see [`assets/LICENSES.md`](assets/LICENSES.md).
