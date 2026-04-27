/**
 * Bill-y Express Backend
 * Proxies all Gemini API calls so the API key stays server-side.
 * Serves the built Vite frontend for production.
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// ─── Middleware ───
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// ─── Gemini Setup ───
const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ Error: Set GEMINI_API_KEY or VITE_GEMINI_API_KEY environment variable.');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// ─── Prompts (mirrored from src/gemini.js) ───
const SYSTEM_PROMPT = `You are Bill-y, a Pakistani utility bill expert. Analyze this utility bill image and return JSON.

RULES:
- 1-sentence explanations max. Only explain unfamiliar charges.
- Every technical term MUST have a simple definition in parentheses. Example: "DG Capacity (your solar system's approved power limit)"
- NEVER use words like: "optimize", "mitigate", "leverage", "facilitate", "utilize"
- Use simple words: "reduce", "save", "avoid", "check", "lower"
- Do NOT calculate totals, savings, or projections. Only extract raw values from the bill.

Return ONLY valid JSON with this exact structure:
{
  "billType": "LESCO Electricity Bill" | "SNGPL Gas Bill" | "KWSB Water Bill" | "WASA Water Bill" | "Unknown",
  "billingMonth": "Month Year",
  "totalAmount": number,
  "dueDate": "DD Mon YYYY",
  "isPastDue": boolean,
  "unitsConsumed": number,
  "unitLabel": "kWh" | "MMBTU" | "gallons",
  "previousBillAmount": number or null,
  "comparisonText": "Rs. X more/less than last month" or null,
  "isNetMetering": boolean,
  "netMetering": {
    "unitsExported": number,
    "unitsImported": number,
    "netPosition": number,
    "creditValue": number,
    "creditRate": number,
    "expMdi": number or null,
    "dgCapacity": number or null,
    "isOverExporting": boolean,
    "monthInQuarter": number,
    "accumulatedCredit": number,
    "monthsToSettlement": number
  } or null,
  "solarInsights": [
    {
      "type": "warning" | "tip" | "info",
      "title": "Short 5-word max title",
      "body": "1 sentence. Define technical terms in parentheses."
    }
  ] or null,
  "charges": [
    {
      "name": "Charge Name",
      "amount": number,
      "explanation": "1 sentence. What is this charge? Define technical terms in parentheses.",
      "status": "NORMAL" | "FIXED" | "GOVERNMENT" | "OVERDUE" | "WARNING"
    }
  ],
  "changeReasons": [
    {
      "icon": "🔴" | "🏛️" | "📅" | "⚡" | "📈" | "📉",
      "title": "Short title",
      "explanation": "1 sentence explaining why the bill changed.",
      "type": "usage" | "government" | "seasonal"
    }
  ],
  "recommendations": [
    {
      "effort": "EASY" | "MEDIUM" | "HARD",
      "title": "Action title (max 6 words)",
      "explanation": "1 sentence. What to do.",
      "savings": "Rs. X" or null
    }
  ],
  "issueDate": "DD Mon YYYY" or null,
  "consumptionHistory": [
    {
      "month": "Mon YYYY",
      "units": number,
      "amount": number
    }
  ] or null,
  "recentBills": [
    {
      "month": "Mon YYYY",
      "units": number,
      "amount": number
    }
  ] or null
}

IMPORTANT RULES (ANTI-HALLUCINATION STRICT MODE):
- Read EVERY line item — do not skip any charge.
- For LESCO: look for Cost of Electricity, Fuel Price Adjustment, FC Surcharge, QTA, Fixed Charges, GST, ED, TV Fee, LP Surcharge, etc.
- For net metering: look for Import/Export readings, MDI, DG-Capacity, credit details.
- All amounts in Pakistani Rupees.
- STRICT RULE: NEVER invent, hallucinate, or estimate numbers, dates, or charges. If a value is not clearly printed on the bill, return null or omit it. Do NOT guess or extrapolate.
- changeReasons: List 1-3 reasons ONLY if there is actual evidence of change (e.g., new taxes, obvious seasonal jumps). If no obvious reason, return an empty array [].
- recommendations: List 1-3 recommendations specifically relevant to the actual charges seen on this bill. Do NOT give generic advice if it doesn't apply.
- solarInsights: Only provide insights if the bill clearly indicates net metering or solar data.
- CRITICAL: Extract the 12-month consumption history table ONLY if present.
- Extract "previous bills" or "bill comparison" section ONLY if present.
- Extract bill issue date ONLY if printed.
- Do NOT calculate costPerUnit, estimatedSavings, or projections — raw values only.`;

const CHAT_PROMPT_PREFIX = `You are Bill-y, a Pakistani utility bill expert. The user has uploaded a bill and you analyzed it. Here is the analysis data:\n\n`;
const CHAT_PROMPT_SUFFIX = `\n\nAnswer the user's question based on this specific bill data. Be conversational, specific with numbers, and helpful. If the question is about something not in the bill, say so honestly. Keep answers concise but thorough. Answer in English.`;

function buildDocPrompt(question, context, mode = 'government', chunkCount = 5) {
  const toneGuide = mode === 'government'
    ? `You are Official Docs Expert, a STRICT government document assistant for Pakistani utility consumers.
- Be authoritative. Only state facts from the documents.
- If the answer isn't in the excerpts, say "I couldn't find that in the official documents" and suggest what the user could ask instead.`
    : `You are Knowledge Base Assistant, a helpful guide for Pakistani utility consumers.
- Be conversational and friendly while still accurate.
- If the answer isn't in the excerpts, say so honestly and suggest related topics.`;

  return `${toneGuide}

RULES (CRITICAL):
- Write in SHORT, SIMPLE English. 1-2 sentences per point max.
- Every technical term MUST have a simple definition in parentheses. Example: "FPA (Fuel Price Adjustment — extra cost added to your bill for power plant fuel)"
- NEVER use words like: "optimize", "mitigate", "leverage", "facilitate", "utilize"
- Use simple words: "reduce", "save", "avoid", "check", "lower"
- Keep answers under 150 words. Be direct and helpful.
- CITATIONS: You have exactly ${chunkCount} source excerpts numbered [1] to [${chunkCount}]. Cite inline as [1], [2], etc. NEVER cite a number higher than [${chunkCount}]. Do NOT use [${chunkCount + 1}] or above — they do not exist.

EXCERPTS:
${context}

USER QUESTION: ${question}`;
}

// ─── Retry Helper ───
async function generateWithRetry(config, attempt = 1) {
  try {
    return await ai.models.generateContent(config);
  } catch (err) {
    const status = err?.status || err?.cause?.status || err?.response?.status;
    if ((status === 503 || status === 429) && attempt <= 2) {
      await new Promise(r => setTimeout(r, 2000));
      return generateWithRetry(config, attempt + 1);
    }
    throw err;
  }
}

// ─── Streaming Retry Helper ───
// Retries with exponential backoff; falls back to gemini-1.5-flash on 503
const FALLBACK_MODEL = 'gemini-3.1-flash-lite-preview';
async function streamWithRetry(config, res, attempt = 1) {
  const isLastAttempt = attempt > 3;
  try {
    const response = await ai.models.generateContentStream(config);
    for await (const chunk of response) {
      const text = chunk.text;
      if (text) res.write(text);
    }
  } catch (err) {
    const status = err?.status || err?.cause?.status || err?.response?.status;
    const isRetryable = status === 503 || status === 429;

    if (isRetryable && !isLastAttempt) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000); // 1s, 2s, 4s
      console.warn(`⚠️  Stream attempt ${attempt} failed (${status}), retrying in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));

      // On the 3rd attempt, fall back to a smaller model
      if (attempt === 2 && config.model !== FALLBACK_MODEL) {
        console.warn(`⚠️  Falling back to ${FALLBACK_MODEL}`);
        config = { ...config, model: FALLBACK_MODEL };
      }

      return streamWithRetry(config, res, attempt + 1);
    }

    throw err;
  }
}

// ─── JS-side Calculations (mirrored from gemini.js) ───
function parseSavingsAmount(savingsString) {
  if (!savingsString) return 0;
  const match = savingsString.match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
}

function addDerivedData(data) {
  const estimatedSavings = (data.recommendations || []).reduce((sum, r) => {
    return sum + parseSavingsAmount(r.savings);
  }, 0);
  data.estimatedSavings = estimatedSavings > 0 ? estimatedSavings : null;

  const history = data.consumptionHistory || [];
  const current = history.find(h => h.month === data.billingMonth) || history[history.length - 1];
  if (current && estimatedSavings > 0) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [cMon, cYear] = current.month.split(' ');
    const cIdx = months.indexOf(cMon);
    const cYearNum = parseInt(cYear, 10);

    data.savingsProjection = [];
    for (let i = 1; i <= 2; i++) {
      const nextIdx = (cIdx + i) % 12;
      const nextYear = cIdx + i >= 12 ? cYearNum + 1 : cYearNum;
      const projectedAmount = Math.max(0, current.amount - estimatedSavings);
      const savingsRatio = current.amount > 0 ? estimatedSavings / current.amount : 0;
      const projectedUnits = Math.round(current.units * (1 - savingsRatio * 0.5));

      data.savingsProjection.push({
        month: `${months[nextIdx]} ${nextYear}`,
        projectedUnits: Math.max(0, projectedUnits),
        projectedAmount: Math.round(projectedAmount)
      });
    }
  } else {
    data.savingsProjection = null;
  }

  if (data.recentBills) {
    data.recentBills = data.recentBills.map(b => ({
      ...b,
      costPerUnit: b.costPerUnit || (b.units > 0 ? Math.round((b.amount / b.units) * 100) / 100 : 0)
    }));
  }

  return data;
}

// ─── API Routes ───

// 1. Analyze Bill Image
app.post('/api/analyze-bill', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    const config = {
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: SYSTEM_PROMPT }
          ]
        }
      ],
      config: { responseMimeType: 'application/json' }
    };

    const result = await generateWithRetry(config);
    const text = result.text;

    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    cleaned = cleaned
      .replace(/,\s*([\]}])/g, '$1')
      .split('')
      .filter(c => {
        const code = c.charCodeAt(0);
        return code === 0x0A || code === 0x0D || code === 0x09 || code >= 0x20;
      })
      .join('');

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0].replace(/,\s*([\]}])/g, '$1'));
      } else {
        throw new Error('Failed to parse bill analysis');
      }
    }

    res.json(addDerivedData(parsed));
  } catch (err) {
    console.error('analyze-bill error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Chat Q&A
app.post('/api/chat', async (req, res) => {
  try {
    const { question, billData } = req.body;
    const prompt = CHAT_PROMPT_PREFIX + JSON.stringify(billData, null, 2) + CHAT_PROMPT_SUFFIX + '\n\nUser question: ' + question;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    res.json({ answer: result.text });
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Streaming Chat Q&A
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { question, billData } = req.body;
    const prompt = CHAT_PROMPT_PREFIX + JSON.stringify(billData, null, 2) + CHAT_PROMPT_SUFFIX + '\n\nUser question: ' + question;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await streamWithRetry({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    }, res);

    res.end();
  } catch (err) {
    console.error('chat stream error:', err.message);
    if (!res.headersSent) res.status(500).end();
    else res.end();
  }
});

// ─── Knowledge Base: Load embeddings at startup ───
let kbChunks = [];
let kbDocs = [];

function loadKbData() {
  const registryPath = path.join(__dirname, 'public', 'docs-registry.json');
  if (!fs.existsSync(registryPath)) {
    console.warn('⚠️ docs-registry.json not found');
    return;
  }

  try {
    kbDocs = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  } catch (e) {
    console.warn('⚠️ Failed to parse docs-registry.json:', e.message);
    return;
  }

  for (const doc of kbDocs) {
    const embedPath = path.join(__dirname, 'public', doc.embeddingsFile.replace(/^\//, ''));
    if (!fs.existsSync(embedPath)) {
      console.warn(`⚠️ Embeddings file missing: ${doc.embeddingsFile}`);
      continue;
    }
    try {
      const data = JSON.parse(fs.readFileSync(embedPath, 'utf-8'));
      const valid = data.filter(d => d.embedding?.length > 0 && d.chunk?.length > 0);
      valid.forEach(d => {
        kbChunks.push({
          chunk: d.chunk,
          embedding: d.embedding,
          docId: doc.id,
          docName: doc.name,
          category: doc.category || 'guide',
          authoritative: doc.authoritative || false,
          icon: doc.icon || '📄',
        });
      });
    } catch (e) {
      console.warn(`⚠️ Failed to load ${doc.id}:`, e.message);
    }
  }

  console.log(`📚 KB loaded: ${kbDocs.length} docs, ${kbChunks.length} chunks`);
}

loadKbData();

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// 4. KB Search (embed question + similarity)
app.post('/api/kb/search', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });
    if (!kbChunks.length) return res.status(503).json({ error: 'Knowledge base not loaded' });

    const embedResult = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: [question]
    });
    const questionEmbedding = embedResult.embeddings[0].values;

    const scored = kbChunks.map(c => ({
      ...c,
      score: cosineSimilarity(questionEmbedding, c.embedding)
    }));
    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, 5);

    // Sort: authoritative first, then by score
    topChunks.sort((a, b) => {
      if (a.authoritative && !b.authoritative) return -1;
      if (!a.authoritative && b.authoritative) return 1;
      return b.score - a.score;
    });

    res.json({
      chunks: topChunks.map((c, i) => ({
        id: i + 1,
        text: c.chunk,
        docName: c.docName,
        category: c.category,
        authoritative: c.authoritative,
        icon: c.icon,
        score: Math.round(c.score * 1000) / 1000
      }))
    });
  } catch (err) {
    console.error('kb search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 5. KB Streaming Answer
app.post('/api/kb/answer', async (req, res) => {
  try {
    const { question, chunks } = req.body;
    if (!question || !chunks?.length) return res.status(400).json({ error: 'Question and chunks required' });

    const govCount = chunks.filter(c => c.authoritative).length;
    const mode = govCount >= 3 ? 'government' : 'general';

    const contextParts = chunks.map((c, i) => `[${i + 1}] [${c.docName}]\n${c.text}`);
    const context = contextParts.join('\n\n');
    const prompt = buildDocPrompt(question, context, mode, chunks.length);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await streamWithRetry({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    }, res);

    res.end();
  } catch (err) {
    console.error('kb answer error:', err.message);
    if (!res.headersSent) res.status(500).end();
    else res.end();
  }
});

// ─── Serve Vite Build (must be LAST) ───
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('⚠️ dist/ folder not found. Run `npm run build` first for production.');
}

// ─── Start ───
app.listen(PORT, () => {
  console.log(`🚀 Bill-y server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   POST /api/analyze-bill`);
  console.log(`   POST /api/chat`);
  console.log(`   POST /api/chat/stream`);
  console.log(`   POST /api/kb/search`);
  console.log(`   POST /api/kb/answer`);
});
