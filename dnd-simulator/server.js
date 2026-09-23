require('dotenv').config();

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const MAX_HISTORY_MESSAGES = 40; // ~20 back-and-forth turns of context sent to Claude

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const DM_SYSTEM_PROMPT = `You are an imaginative, fair Dungeon Master running a solo Dungeons & Dragons-inspired campaign for one player.

Rules you always follow:
- Narrate scenes with vivid, sensory detail in 2-4 sentences. Keep pacing brisk, do not ramble.
- Never decide the player's actions for them. Always end your reply with a direct question or a short list of options for what they can do next.
- Track continuity: remember names, items, NPCs, locations, and past decisions already established in the conversation.
- Resolve uncertain actions with light dice-roll flavor (you may narrate an implied roll and its outcome) without requiring the player to own physical dice.
- If this is the very first message of the campaign, open with a short evocative hook, then ask the player to create their character (name, race, class, and a one-line background) before the adventure truly begins.
- Reply in the same language the player is using.
- At the very end of EVERY reply, on its own final line, include a visual scene description formatted EXACTLY as:
SCENE: <one vivid sentence describing what this moment looks like for an illustrator - setting, characters present, action, mood, lighting>
This SCENE line must always be written in English regardless of what language the rest of your reply is in, must contain no dialogue or meta-text, and must always be present.`;

function splitNarrationAndScene(text) {
  const match = text.match(/SCENE:\s*(.+)\s*$/is);
  if (!match) {
    return { narration: text.trim(), sceneDescription: null };
  }
  const narration = text.slice(0, match.index).trim();
  const sceneDescription = match[1].trim();
  return { narration, sceneDescription };
}

async function generateSceneImage(sceneDescription) {
  if (!process.env.GEMINI_API_KEY || !sceneDescription) return null;

  const prompt = `Fantasy RPG illustration, digital painting style, dramatic lighting, detailed environment: ${sceneDescription}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini image request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) return null;

  return {
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    base64: imagePart.inlineData.data,
  };
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

app.post('/api/turn', async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Add it to dnd-simulator/.env and restart.' });
    }

    const { history, playerInput } = req.body || {};
    if (typeof playerInput !== 'string' || !playerInput.trim()) {
      return res.status(400).json({ error: 'playerInput is required.' });
    }

    const cleanHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-MAX_HISTORY_MESSAGES)
      : [];

    const messages = [...cleanHistory, { role: 'user', content: playerInput }];

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      system: DM_SYSTEM_PROMPT,
      messages,
    });

    const fullText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const { narration, sceneDescription } = splitNarrationAndScene(fullText);

    let image = null;
    let imageError = null;
    try {
      image = await generateSceneImage(sceneDescription);
    } catch (err) {
      imageError = err.message;
      console.error('Image generation failed:', err.message);
    }

    res.json({
      narration,
      sceneDescription,
      image,
      imageError,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`D&D simulator running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set. The Dungeon Master will not work until you add it to .env.');
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set. Scene illustrations will be skipped until you add it to .env.');
  }
});
