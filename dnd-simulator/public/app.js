(function () {
  const log = document.getElementById('log');
  const form = document.getElementById('input-form');
  const input = document.getElementById('player-input');
  const sendBtn = document.getElementById('send-btn');
  const dmSpinner = document.getElementById('dm-spinner');
  const imageSpinner = document.getElementById('image-spinner');
  const sceneImage = document.getElementById('scene-image');
  const scenePlaceholder = document.getElementById('scene-placeholder');
  const newCampaignBtn = document.getElementById('new-campaign');

  // history uses Anthropic's message format: {role: 'user'|'assistant', content: string}
  let history = [];
  let busy = false;

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function setBusy(isBusy) {
    busy = isBusy;
    input.disabled = isBusy;
    sendBtn.disabled = isBusy;
    dmSpinner.hidden = !isBusy;
  }

  async function takeTurn(playerInput) {
    setBusy(true);
    try {
      const res = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, playerInput }),
      });
      const data = await res.json();

      if (!res.ok) {
        addMessage('error', data.error || 'Something went wrong.');
        return;
      }

      addMessage('dm', data.narration);
      history.push({ role: 'user', content: playerInput });
      history.push({ role: 'assistant', content: data.narration });

      if (data.image) {
        imageSpinner.hidden = true;
        scenePlaceholder.hidden = true;
        sceneImage.hidden = false;
        sceneImage.src = `data:${data.image.mimeType};base64,${data.image.base64}`;
        sceneImage.alt = data.sceneDescription || 'Scene illustration';
      } else if (data.imageError) {
        console.warn('Image error:', data.imageError);
      }
    } catch (err) {
      addMessage('error', 'Could not reach the server: ' + err.message);
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const text = input.value.trim();
    if (!text) return;
    addMessage('player', text);
    input.value = '';
    takeTurn(text);
  });

  function resetCampaign() {
    history = [];
    log.innerHTML = '';
    sceneImage.hidden = true;
    scenePlaceholder.hidden = false;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    takeTurn('(The adventure begins. Set the opening scene.)');
  }

  newCampaignBtn.addEventListener('click', resetCampaign);

  // Kick off the very first scene automatically.
  resetCampaign();
})();
