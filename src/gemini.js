/**
 * Bill-y Frontend API Client
 * All Gemini calls are proxied through the Express backend.
 * The API key NEVER reaches the browser bundle.
 */

const API_BASE = '';

/* ═══════ Image Compression (browser-side, before upload) ═══════ */
function compressImage(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    if (file.type === 'application/pdf' || file.size < 500 * 1024) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/* ═══════ No-op: kept for backwards compatibility ═══════ */
export function initGemini(apiKey) {
  // API key is no longer used client-side
}

/* ═══════ Bill Analysis ═══════ */
export async function analyzeBill(file) {
  const processedFile = await compressImage(file);
  const formData = new FormData();
  formData.append('file', processedFile);

  const res = await fetch(`${API_BASE}/api/analyze-bill`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to analyze bill');
  }

  return res.json();
}

/* ═══════ Chat Q&A ═══════ */
export async function askQuestion(question, billData) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, billData })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get answer');
  }

  const data = await res.json();
  return data.answer;
}

/* ═══════ Streaming Chat Q&A ═══════ */
export async function askQuestionStream(question, billData, onChunk) {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, billData })
  });

  if (!res.ok) throw new Error('Failed to stream answer');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += decoder.decode(value, { stream: true });
    onChunk(fullText);
  }

  return fullText;
}

/* ═══════ Knowledge Base: Search ═══════ */
export async function searchDocs(question) {
  const res = await fetch(`${API_BASE}/api/kb/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to search knowledge base');
  }

  return res.json();
}

/* ═══════ Knowledge Base: Streaming Answer ═══════ */
export async function askWithContextStream(question, chunks, onChunk) {
  const res = await fetch(`${API_BASE}/api/kb/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, chunks })
  });

  if (!res.ok) throw new Error('Failed to get answer');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += decoder.decode(value, { stream: true });
    onChunk(fullText);
  }

  return fullText;
}
