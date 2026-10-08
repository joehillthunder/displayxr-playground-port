# Tasks

- [x] 1. Read the DisplayXR web SDK (`@displayxr/inline3d` 1.37.1): authoring guide, `js/README.md`,
      samples hello-cube, windows, camera-rig, display-modes, composition.
- [x] 2. Study the DisplayXR Arcade's Tetris 3D depth layout (study only; its repo has no license).
- [x] 3. Check Playground's export, remix and embed terms. Findings in the README's "From no-code prompt"
      section and under open questions below.
- [x] 4. Repo, Apache-2.0 license, README skeleton, GitHub Pages deploy via Actions.
- [ ] 5. **Waiting on the owner:** the Playground share link, the rules, and the look and feel. If the
      game is exported, also the export zip.
- [ ] 6. `DESIGN.md`: the depth map table. **Waiting on the owner's OK before building.**
- [ ] 7. Playable 2D version: three.js, plain ES modules, keyboard, mouse, touch and gamepad, fps
      counter with `?dev`.
- [ ] 8. Depth layers per `DESIGN.md`. Pop-out stays inside the comfort range, and no fast objects
      cross the screen plane at the edges.
- [ ] 9. HUD as crisp 2D DOM over the woven canvas, and a 2D/3D toggle (`wall.setStereoEnabled`, as in
      the display-modes sample).
- [ ] 10. Original or CC0 art and audio, each logged in `assets/LICENSES.md`.
- [ ] 11. Optional agent hook: `start_game()`, `set_difficulty()` and `show_score()` over the shared
      WebSocket/MCP bridge.
- [ ] 12. README: GIF, how to play, and the depth map. List what needs tuning on Leia hardware.

## Open questions

- **Playground export terms.** Playground can export a game as a zip of HTML, JS, CSS and generated
  assets. Its terms say Google does not claim ownership of "Your Games" but "retains all rights in
  features, services, and assets provided by Google". They don't say whether exported code or assets
  may be reused outside Playground. Until that's settled, the plan is to rebuild from the description
  with original art. If you choose the export route, I'd inspect the zip first to see which parts are
  Google-provided.
- **Agent bridge.** "The same WebSocket/MCP bridge as my other DisplayXR repos": which repo defines it?
  The `displayxr-demos` scaffold plans one in `packages/core`, but it isn't built yet.
