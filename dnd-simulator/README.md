# D&D Solo Simulator

A two-agent Dungeons & Dragons experience for one player:

- A **Dungeon Master** agent narrates the scene, keeps track of the story, and always ends its turn with a question about what you want to do next. This is Claude when `ANTHROPIC_API_KEY` is set; otherwise the server automatically falls back to **Gemini** for narration, so the app runs with a Gemini-only key.
- **Gemini** illustrates each scene: after every DM reply, an image is generated from a short visual description of that moment.

> **Currently running Gemini-only.** Only `GEMINI_API_KEY` is configured, so Gemini plays both roles: it writes the DM narration (`gemini-flash-lite-latest`) and would generate the scene image. Note: image generation on this key currently returns a quota-exceeded (429) error — the Gemini API's free tier has zero quota for image models, so generating images needs a Google Cloud project with billing enabled. Narration works fine either way; add billing (or an Anthropic key later) to light up illustrations too.

## How it works

1. The browser sends the running conversation plus your latest action to `POST /api/turn`.
2. The server calls Claude (if configured) or Gemini with a Dungeon Master system prompt. The reply always ends with a hidden `SCENE: ...` line describing the moment visually.
3. The server strips that line out, sends it to the Gemini image API, and returns both the narration and the generated image (or an `imageError` if generation failed) to the browser.
4. The page shows the narration in a chat log and the illustration in the scene panel, then waits for your next action.

## Setup

```bash
cd dnd-simulator
npm install
cp .env.example .env
```

Edit `.env` and add your key(s):

- `GEMINI_API_KEY` — from https://aistudio.google.com/apikey (required)
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com/ (optional — adds Claude as the DM instead of Gemini)

Keys stay server-side only; the browser never sees them.

## Run

```bash
npm start
```

Then open http://localhost:3000

## Notes / things you may want to tweak

- `CLAUDE_MODEL`, `GEMINI_TEXT_MODEL`, and `GEMINI_IMAGE_MODEL` in `.env` let you swap models without touching code.
- The app is stateless between page loads: refreshing starts a brand new campaign (there's also a "New Campaign" button). Adding persistence (localStorage or a database) would be a natural next step if you want to resume a story later.
- Conversation history sent to the DM model is capped at the last 40 messages to keep requests bounded; older context will fall off in very long campaigns.
- If image generation quota isn't available, the app still works — you just won't get illustrations, and the browser console will log the `imageError` from the API.
