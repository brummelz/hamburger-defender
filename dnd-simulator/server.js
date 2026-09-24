require('dotenv').config();

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-flash-lite-latest';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const MAX_HISTORY_MESSAGES = 40; // ~20 back-and-forth turns of context sent to the DM model

// Claude is used for the DM if a key is configured; otherwise we fall back to
// Gemini for both narration and illustration, so the app works with only a
// Gemini API key.
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

async function generateDMReplyWithClaude(messages) {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 700,
    system: DM_SYSTEM_PROMPT,
    messages,
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

async function generateDMReplyWithGemini(messages) {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = JSON.stringify({
    contents,
    systemInstruction: { parts: [{ text: DM_SYSTEM_PROMPT }] },
    generationConfig: { maxOutputTokens: 700 },
  });

  // Gemini's free tier occasionally returns a transient 503 ("high demand"); one retry is enough in practice.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (res.ok) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      return parts.map((p) => p.text || '').join('\n').trim();
    }
    if (res.status !== 503 || attempt === 1) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini text request failed (${res.status}): ${errText}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

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
    if (!anthropic && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server is missing both ANTHROPIC_API_KEY and GEMINI_API_KEY. Add at least one to dnd-simulator/.env and restart.' });
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

    const fullText = anthropic
      ? await generateDMReplyWithClaude(messages)
      : await generateDMReplyWithGemini(messages);

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
  if (anthropic) {
    console.log(`Dungeon Master: Claude (${CLAUDE_MODEL})`);
  } else if (process.env.GEMINI_API_KEY) {
    console.log(`Dungeon Master: Gemini (${GEMINI_TEXT_MODEL}) - no ANTHROPIC_API_KEY set, using Gemini for narration too.`);
  } else {
    console.warn('WARNING: neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is set. The Dungeon Master will not work until you add one to .env.');
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set. Scene illustrations will be skipped until you add it to .env.');
  }
});
