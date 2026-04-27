/**
 * Generate embeddings from a PDF for Knowledge Base RAG
 *
 * Usage:
 *   1. Place your PDF in the project root
 *   2. Set VITE_GEMINI_API_KEY env var
 *   3. node scripts/generate-embeddings.js --doc-id=nepra-csm-2025 --category=government path/to/nepra-manual.pdf
 *   4. Output: public/embeddings/nepra-csm-2025.json
 *
 * Options:
 *   --doc-id=ID          Required. Unique document identifier.
 *   --category=TYPE      Optional. One of: government, guide, faq (default: guide)
 *   --name="Doc Name"    Optional. Human-readable document name (for auto-registry update)
 *
 * Requirements:
 *   npm install pdf-parse
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Parse Args ───
const VALID_CATEGORIES = ['government', 'guide', 'faq'];
const CATEGORY_ICONS = { government: '🏛️', guide: '📘', faq: '❓' };

function parseArgs() {
  const args = process.argv.slice(2);
  let docId = null;
  let pdfPath = null;
  let category = 'guide';
  let docName = null;

  for (const arg of args) {
    if (arg.startsWith('--doc-id=')) {
      docId = arg.replace('--doc-id=', '').trim();
    } else if (arg.startsWith('--category=')) {
      const val = arg.replace('--category=', '').trim().toLowerCase();
      if (VALID_CATEGORIES.includes(val)) category = val;
      else console.warn(`⚠️ Unknown category "${val}", using "guide"`);
    } else if (arg.startsWith('--name=')) {
      docName = arg.replace('--name=', '').trim();
    } else if (!pdfPath && !arg.startsWith('--')) {
      pdfPath = arg;
    }
  }

  return { docId, pdfPath, category, docName };
}

// ─── Config ───
const { docId, pdfPath, category, docName } = parseArgs();
const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const MODEL = 'gemini-embedding-2';
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

// Init Gemini SDK
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// ─── Helpers ───
function splitIntoChunks(text, size, overlap) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end).trim());
    start += size - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim();
}

async function getEmbedding(text, retryCount = 0) {
  try {
    const result = await ai.models.embedContent({
      model: MODEL,
      contents: [text]
    });
    return result.embeddings[0].values;
  } catch (err) {
    const status = err?.status || err?.cause?.status || err?.response?.status;
    if ((status === 429 || status === 503) && retryCount < 3) {
      const delay = (retryCount + 1) * 2000;
      console.log(`  ⚠️ ${status}, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return getEmbedding(text, retryCount + 1);
    }
    throw err;
  }
}

// ─── Main ───
async function main() {
  if (!docId) {
    console.error('Usage: node scripts/generate-embeddings.js --doc-id=ID [--category=TYPE] [--name="Name"] path/to.pdf');
    console.error('');
    console.error('Categories: government, guide, faq (default: guide)');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/generate-embeddings.js --doc-id=nepra-csm-2025 --category=government ./nepra-manual.pdf');
    process.exit(1);
  }

  if (!pdfPath) {
    console.error('Error: PDF path required.');
    process.exit(1);
  }

  if (!API_KEY) {
    console.error('Error: Set VITE_GEMINI_API_KEY or GEMINI_API_KEY environment variable.');
    process.exit(1);
  }

  if (!ai) {
    console.error('Error: Failed to initialize Gemini SDK.');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, '..', 'public', 'embeddings');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `${docId}.json`);

  console.log(`📄 Reading PDF: ${pdfPath}`);
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const pdfData = await parser.getText();

  console.log(`✅ Extracted ${pdfData.pages} pages, ${pdfData.text.length} chars`);

  const cleaned = cleanText(pdfData.text);
  const chunks = splitIntoChunks(cleaned, CHUNK_SIZE, CHUNK_OVERLAP);

  console.log(`🔪 Split into ${chunks.length} chunks (~${CHUNK_SIZE} chars each)`);
  console.log(`📁 Category: ${category}`);
  console.log(`🚀 Generating embeddings with ${MODEL}...\n`);

  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`  [${i + 1}/${chunks.length}] ${chunk.slice(0, 50).replace(/\n/g, ' ')}... `);

    try {
      const embedding = await getEmbedding(chunk);
      results.push({ chunk, embedding, category });
      console.log('✅');
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }

    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n🎉 Done! Saved ${results.length} embeddings to:`);
  console.log(`   ${outputPath}`);
  console.log(`\n💡 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);

  // Auto-update docs-registry.json
  const registryPath = path.join(__dirname, '..', 'public', 'docs-registry.json');
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const existing = registry.findIndex(d => d.id === docId);
    const entry = {
      id: docId,
      name: docName || (existing >= 0 ? registry[existing].name : docId),
      category,
      authoritative: category === 'government',
      icon: CATEGORY_ICONS[category] || '📄',
      description: existing >= 0 ? registry[existing].description : 'Auto-generated entry',
      embeddingsFile: `/embeddings/${docId}.json`
    };

    if (existing >= 0) {
      registry[existing] = { ...registry[existing], ...entry };
      console.log(`\n📋 Updated existing entry in docs-registry.json`);
    } else {
      registry.push(entry);
      console.log(`\n📋 Added new entry to docs-registry.json`);
    }
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  } catch (err) {
    console.log(`\n⚠️ Could not auto-update docs-registry.json: ${err.message}`);
    console.log(`\n📋 Manually add this to docs-registry.json:`);
    console.log(`   {`);
    console.log(`     "id": "${docId}",`);
    console.log(`     "name": "Your Document Name",`);
    console.log(`     "category": "${category}",`);
    console.log(`     "authoritative": ${category === 'government'},`);
    console.log(`     "icon": "${CATEGORY_ICONS[category] || '📄'}",`);
    console.log(`     "description": "Short description",`);
    console.log(`     "embeddingsFile": "/embeddings/${docId}.json"`);
    console.log(`   }`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
