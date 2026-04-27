import { GoogleGenAI } from "@google/genai";

let ai = null;

export function initGemini(apiKey) {
  if (!apiKey) return;
  ai = new GoogleGenAI({ apiKey });
}

// Auto-init on module load if env key exists
const envKey = import.meta.env?.VITE_GEMINI_API_KEY;
if (envKey) initGemini(envKey);

/* ═══════ Image Compression ═══════ */
function compressImage(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    // PDFs and small images pass through
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
            const compressed = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ═══════ Retry Logic ═══════ */
async function generateWithRetry(config, attempt = 1) {
  if (!ai) throw new Error('API key not set');

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

/* ═══════ JS-side Calculations ═══════ */
function parseSavingsAmount(savingsString) {
  if (!savingsString) return 0;
  const match = savingsString.match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
}

function addDerivedData(data) {
  // Calculate estimatedSavings from recommendations
  const estimatedSavings = (data.recommendations || []).reduce((sum, r) => {
    return sum + parseSavingsAmount(r.savings);
  }, 0);
  data.estimatedSavings = estimatedSavings > 0 ? estimatedSavings : null;

  // Build savingsProjection for next 2 months
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

  // Compute costPerUnit for recentBills if missing
  if (data.recentBills) {
    data.recentBills = data.recentBills.map(b => ({
      ...b,
      costPerUnit: b.costPerUnit || (b.units > 0 ? Math.round((b.amount / b.units) * 100) / 100 : 0)
    }));
  }

  return data;
}

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

IMPORTANT RULES:
- Read EVERY line item — do not skip any charge
- For LESCO: look for Cost of Electricity, Fuel Price Adjustment, FC Surcharge, QTA, Fixed Charges, GST, ED, TV Fee, LP Surcharge, etc.
- For net metering: look for Import/Export readings, MDI, DG-Capacity, credit details
- All amounts in Pakistani Rupees
- If you cannot read a value clearly, make your best estimate and note it
- changeReasons: exactly 3 items
- recommendations: 3-5 items, easiest to hardest
- solarInsights: 2-3 items for net metering bills
- CRITICAL: Extract the 12-month consumption history table if present
- Extract "previous bills" or "bill comparison" section (last 3-6 months)
- Extract bill issue date if printed
- Do NOT calculate costPerUnit, estimatedSavings, or projections — raw values only`;

export async function analyzeBill(file) {
  if (!ai) throw new Error('API key not set');

  // Compress image before sending
  const processedFile = await compressImage(file);
  const base64 = await fileToBase64(processedFile);
  const mimeType = processedFile.type || 'image/jpeg';

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
    config: {
      responseMimeType: 'application/json'
    }
  };

  const result = await generateWithRetry(config);

  const text = result.text;

  // With JSON mode, response should be clean JSON, but keep fallback
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Fix common JSON issues
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
      throw new Error('Failed to parse bill analysis. Please try again with a clearer image.');
    }
  }

  // Add JS-calculated derived fields
  return addDerivedData(parsed);
}

const CHAT_PROMPT_PREFIX = `You are Bill-y, a Pakistani utility bill expert. The user has uploaded a bill and you analyzed it. Here is the analysis data:

`;

const CHAT_PROMPT_SUFFIX = `

Answer the user's question based on this specific bill data. Be conversational, specific with numbers, and helpful. If the question is about something not in the bill, say so honestly. Keep answers concise but thorough. Answer in English.`;

export async function askQuestion(question, billData) {
  if (!ai) throw new Error('API key not set');

  const prompt = CHAT_PROMPT_PREFIX + JSON.stringify(billData, null, 2) + CHAT_PROMPT_SUFFIX + '\n\nUser question: ' + question;

  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  return result.text;
}

/* ═══════ NEPRA Doc Embeddings ═══════ */
export async function embedText(text) {
  if (!ai) throw new Error('API key not set');

  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: [text]
  });

  // The new SDK returns embeddings in result.embeddings[0].values
  return result.embeddings[0].values;
}

/* ═══════ Official Docs Q&A with RAG Context ═══════ */

function buildDocPrompt(question, context, mode = 'government') {
  const toneGuide = mode === 'government'
    ? `You are Official Docs Expert, a STRICT government document assistant for Pakistani utility consumers.
- Be authoritative. Only state facts from the documents.
- Cite your sources precisely as: [1 - Document Name], [2 - Document Name], etc.
- If the answer isn't in the excerpts, say "I couldn't find that in the official documents" and suggest what the user could ask instead.`
    : `You are Knowledge Base Assistant, a helpful guide for Pakistani utility consumers.
- Be conversational and friendly while still accurate.
- Reference your sources naturally, e.g. "According to the NEPRA manual..."
- If the answer isn't in the excerpts, say so honestly and suggest related topics.`;

  return `${toneGuide}

RULES (CRITICAL):
- Write in SHORT, SIMPLE English. 1-2 sentences per point max.
- Every technical term MUST have a simple definition in parentheses. Example: "FPA (Fuel Price Adjustment — extra cost added to your bill for power plant fuel)"
- NEVER use words like: "optimize", "mitigate", "leverage", "facilitate", "utilize"
- Use simple words: "reduce", "save", "avoid", "check", "lower"
- Keep answers under 150 words. Be direct and helpful.

EXCERPTS:
${context}

USER QUESTION: ${question}`;
}

export async function askWithContext(question, context, mode = 'government') {
  if (!ai) throw new Error('API key not set');

  const prompt = buildDocPrompt(question, context, mode);
  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  return result.text;
}

/* ═══════ Streaming RAG Q&A ═══════ */
export async function askWithContextStream(question, context, onChunk, mode = 'government') {
  if (!ai) throw new Error('API key not set');

  const prompt = buildDocPrompt(question, context, mode);

  const response = await ai.models.generateContentStream({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  let fullText = '';
  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      fullText += text;
      onChunk(fullText);
    }
  }

  return fullText;
}
