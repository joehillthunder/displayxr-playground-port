# Tasks

- [x] Read the DisplayXR web SDK and choose a rig: a camera rig with the attach pattern (a
      third-person game owns its viewpoint).
- [x] Repo, Apache-2.0 license, GitHub Pages deploy via Actions.
- [x] Direction (2026-10-14): a live 3D playground with kids playing on it. You can go up a slide,
      climb ladders, jump into a ball pit, swing, and there are other characters.
- [x] Playable game: three.js, plain ES modules, keyboard, mouse, touch and gamepad, `?dev` fps.
- [x] Equipment: two towers, wobbly bridge, ladder, rock wall, fire pole, wave and spiral slides,
      diving plank, 1,000-ball pit, three swings, merry-go-round, seesaw, sandbox, ice-cream cart.
- [x] Characters: 8 kids (the player picks one of 4), Mom, Dad, Grandpa, the ice-cream seller,
      Biscuit the dog, pigeons, butterflies. NPC kids use all the equipment, and one joins you on the seesaw.
- [x] 12 stickers, saved in localStorage.
- [x] HUD as 2D DOM over the woven canvas, a 2D/3D toggle (`setStereoEnabled`), and a Depth slider.
- [x] Art and audio are all procedural (see `assets/LICENSES.md`).
- [x] Headless check (Chrome, 2D path): no console errors, NPC routines cycle, and every sticker can be earned.
- [ ] **Check on the Leia panel** in the DisplayXR Browser: woven, fps at full screen on the 8K
      panel, and comfort of the default depth (convergence 1.08 × camera distance, ipdFactor up to 5).
      Tune `POP`, `ipdFactorFor` and `MAX_EYE_W` in `js/stage.js`.
- [ ] Gameplay GIF for the README.
- [ ] Optional: an agent hook (`start_game()`, `show_score()`) over the shared WebSocket/MCP bridge.
