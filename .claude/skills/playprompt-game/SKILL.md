---
name: playprompt-game
description: Design and build a new PlayPrompt children's learning game (ages 4-5) as one standalone HTML file in the house hand-drawn picture-book style, with the shared start screen, hint hand and kid-proofing. Games have no voice: they explain themselves with pictures and movement. Use when asked to create, port or restyle a kids' game, a storyboard artboard, or a game in the same look as Hedgehog's Orchard.
---

# PlayPrompt game

Each game is ONE standalone HTML file in `games/`: no build step, no assets, only the Google Fonts link (Baloo 2 + Nunito). It must work with a 4-5 year old who cannot read, taps fast and randomly, and has an adult nearby. **There is no voice**: a child must understand what to do from the pictures alone.

**Reference implementation: `games/hedgehogs-orchard.html`.** Start from a copy of it. Never rewrite the shell.

## Process

1. **Brief.** Settle: skill taught (one only), character, world, the single action a child does, 5 rounds, Easy and Harder variants. Also settle how the question is SHOWN (see No voice below); if it can only be explained in words, change the game. If a storyboard artboard exists, implement its layout, colours and character faithfully.
2. **Copy the reference** to `games/<kebab-name>.html`. Change only:
   - `<title>`, `--scene` (world background), home hero SVG, home copy (skill label, title, one story sentence for grown-ups, 3 picture steps with short captions, grown-up line and tip), win title and text;
   - everything after `/* ===== Game-specific` in the CSS and everything inside `/* ================= Game:` in the JS;
   - the play scene markup inside `<section id="play">` and the tray contents.
3. **Implement the `Game` interface** (the shell calls it):

   | member | job |
   |---|---|
   | `prompt()` | show the question again, visually: `cue()` the question picture, then the next thing to tap (the speaker button's tap calls it) |
   | `newRound()` | set up a round from `S.level`; end with `armHint()` |
   | `hintTarget()` | element the idle hint hand points at |
   | `demo(done)` | scripted "Show me how" using the hand; solve the round WITHOUT `roundDone()`; then call `done()` |
   | `autoSolve()` | test helper: do the correct action(s); safe to call repeatedly and mid-round |
   | `wrongTarget()` | test helper: element whose click is a wrong answer |

   On a correct round call `roundDone()` exactly once (and only when `!S.demo`). Keep `S.busy` true while animations lock input and always release it. Game-driven animations (demo, scaffolding) must still update the screen while input is locked: pass a `force` flag rather than going through the child's input guard.
4. **Draw it** following the style below.
5. **Test** (below). Do not call the game done until every kid test line passes.
6. **Commit** the HTML and push. Do not open a PR unless asked.

## Style: hand-drawn picture book

Palette (all games share ink and paper; each world adds a background):

| token | hex | used for |
|---|---|---|
| ink | `#3B2F4F` | every outline, all text |
| paper | `#FFF7E8` | buttons, cards, tray |
| tray | `#F7E7CC` | tiles |
| marigold | `#F4B63F` | stars, sun, highlights |
| persimmon | `#EC6B3E` | warm accent, fruit |
| lagoon | `#1F7A7A` | Play, selected, correct |
| plum | `#7C4D8F` | numbers, notes |
| sky | `#7EB8E0` | water, snow |
| blush | `#F3A7A0` | cheeks, hearts |
| moss / leaf | `#5E9461` / `#B7D77F` | trees, hills |

World backgrounds: orchard `#FFE2B0`, sky `#B5DCF2`, night `#27224A`, reef `#8FD3CB`, snow `#FAC9C0`. A new world picks one soft, clearly different background and 3-4 helper colours; keep the 8 shared colours.

Drawing rules:
- Flat fills, a 3px ink outline with `stroke-linejoin="round"`. No gradients, no shadows except the 4px offset button shadow in ink.
- Characters are simple and friendly: big round head or body, two dot eyes, blush cheeks, small smile. One accent colour each.
- Hand-drawn wobble comes from three SVG filters already defined in the reference's hidden `<defs>`: `#rough` (scenery, displacement 7), `#wob` (characters, buttons, tiles, displacement 3.4) and `#grain` (paper speckle, one overlay `#grain` at 16% opacity, `pointer-events:none`). Keep their CSS block ("Hand-drawn look") when copying.
- Never put `#wob` on text-heavy cards (steps, grown-up note, win card): small text must stay crisp.
- Icons use stroke-only line SVG, never emoji.
- Dark worlds: set the home right-column text and empty stars to light colours in the game-specific CSS; keep cards on paper.
- Large touch targets: tray tiles 100px in a 1180x820 stage, top-bar buttons 72px. Nothing smaller than 56px is tappable.

## No voice: the pictures explain the game

The games never speak. No speech synthesis, no recorded voice, no instruction a child must read. Short sound effects and musical tones are fine, but the game must be fully playable with sound off.

- **The question is a picture.** Show what is being asked in the scene itself: a thought bubble with the object and a big "?", an empty dashed slot in the shape of the answer, a highlighted target. At round start the question pulses with `cue(el)`.
- **Show, don't tell.** "Show me how" is the tutorial: the hand pointer plays one round, tapping exactly what the child will tap. The idle hint (9 s) moves the hand to the next thing to tap and the question pulses.
- **Every step leaves a visible trace.** Counting puts number badges on objects, placing fills the slot, a sequence lights up in order. A child can always see how far they got.
- **Correct:** the answer appears where the question was (the "?" becomes the number, the slot fills), the character celebrates (hop, dance), a chime, a star.
- **Wrong:** the tile wobbles, the character tilts its head, then the game demonstrates the method with the hand and visible marks (count the apples with badges, play the pattern again with lights), then the question pulses again. Never a red cross, a buzzer, lives or a timer.
- **Home screen:** the 3 step cards are icons first; captions are short and for grown-ups. Step 1 is "Look at...", never "Listen to...". No read-aloud button.
- **On-screen text is for grown-ups only**, except content the game teaches (numbers, letters).
- **Taps during the demo** wiggle the demo hand ("watch me first").
- Check before shipping: play one round with sound off and without reading anything. If you are unsure what to tap, the picture is not clear enough yet.

## Kid-proofing (already in the shell; keep it working)

- Home and mute are **press-and-hold** (about 0.9 s). A tap on the sound button re-shows the question (`Game.prompt()`).
- Taps are ignored during the demo (`#blocker`); input is locked while a round resolves.
- Upright phones show a turn-sideways picture (the stage is landscape).
- Wrong answers: wobble, then visual scaffolding (see No voice). Never red crosses, buzzers, lives, timers or "wrong".
- Idle for 9 s: the hand points at the next thing to do.
- Every game: 5 rounds, 3 stars (after rounds 2, 4, 5), about 3 minutes, win screen with Play again and Home.

## Test

Requires Playwright (`/opt/node-tools` in cloud sessions; set `PLAYWRIGHT_MODULE` to override).

```
node .claude/skills/playprompt-game/scripts/screenshots.mjs $PWD/games/<game>.html /tmp/<game>
node .claude/skills/playprompt-game/scripts/kidtest.mjs     $PWD/games/<game>.html /tmp/<game> <roundWaitMs>
```

`<roundWaitMs>`: time from a correct answer until the next round is ready, plus margin (2600 for quick games, 6500 where a swim or tune plays back). `kidtest.mjs` prints 25 PASS/FAIL lines, including a check that the game never speaks: random mashing, triple-tapping the right answer counts once, 12 wrong answers in a row, idle hint, quick tap on Home does not quit, tapping during the demo, play again, Harder level, phone and tablet sizes. Fix every FAIL. Then LOOK at the PNGs it writes (`-kid-mash`, `-kid-hint`, `-kid-harder`, `-kid-844x390`) and the `screenshots.mjs` home, play and win images: check overlap, clipped text, contrast on the world background, and that the wobble does not break small shapes.

Known limits: headless tests cannot hear sound effects or measure animation smoothness, and cannot judge whether a picture is clear to a child. Say so when reporting, and ask a person to try a few rounds on a real tablet with sound off.

## Reporting

End with: the file path, how a round plays, how each step is shown without words, Easy vs Harder, test results, and anything not verified.
