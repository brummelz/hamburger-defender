# D&D Solo Simulator

A two-agent Dungeons & Dragons experience for one player:

- **Claude** plays the Dungeon Master: it narrates the scene, keeps track of the story, and always ends its turn with a question about what you want to do next.
- **Gemini** illustrates each scene: after every DM reply, an image is generated from a short visual description of that moment.

## How it works

1. The browser sends the running conversation plus your latest action to `POST /api/turn`.
2. The server calls the Claude API (Anthropic) with a Dungeon Master system prompt. Claude's reply always ends with a hidden `SCENE: ...` line describing the moment visually.
3. The server strips that line out, sends it to the Gemini image API, and returns both the narration and the generated image to the browser.
4. The page shows the narration in a chat log and the illustration in the scene panel, then waits for your next action.

## Setup

```bash
cd dnd-simulator
npm install
cp .env.example .env
```

Edit `.env` and add your keys:

- `ANTHROPIC_API_KEY` — from https://console.anthropic.com/
- `GEMINI_API_KEY` — from https://aistudio.google.com/apikey

Both keys stay server-side only; the browser never sees them.

## Run

```bash
npm start
```

Then open http://localhost:3000

## Notes / things you may want to tweak

- `CLAUDE_MODEL` and `GEMINI_IMAGE_MODEL` in `.env` let you swap models without touching code.
- The app is stateless between page loads: refreshing starts a brand new campaign (there's also a "New Campaign" button). Adding persistence (localStorage or a database) would be a natural next step if you want to resume a story later.
- Conversation history sent to Claude is capped at the last 40 messages to keep requests bounded; older context will fall off in very long campaigns.
- If `GEMINI_API_KEY` is missing, the app still works — you just won't get illustrations.
