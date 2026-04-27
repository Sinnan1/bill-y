import { useState, useEffect, useCallback } from 'react';
import { embedText, askWithContext } from './gemini';

/* ═══════ Cosine Similarity ═══════ */
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

/* ═══════ SVG Icons ═══════ */
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const DocIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

/* ═══════ Suggested Questions ═══════ */
const SUGGESTED_QUESTIONS = [
  'What are my rights as an electricity consumer?',
  'How is the Fuel Price Adjustment calculated?',
  'What should I do if my bill is too high?',
  'How do I file a complaint against LESCO?',
  'What is the deadline for paying my bill before disconnection?',
];

export default function OfficialDocs() {
  const [docs, setDocs] = useState([]);
  const [allChunks, setAllChunks] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load all docs on mount
  useEffect(() => {
    fetch('/docs-registry.json')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load docs registry.');
        return r.json();
      })
      .then(async registry => {
        setDocs(registry);

        // Load all embedding files in parallel
        const loaded = await Promise.all(
          registry.map(async (doc) => {
            try {
              const res = await fetch(doc.embeddingsFile);
              if (!res.ok) throw new Error(`Failed to load ${doc.id}`);
              const data = await res.json();
              const valid = data.filter(d => d.embedding?.length > 0 && d.chunk?.length > 0);
              return valid.map(d => ({
                chunk: d.chunk,
                embedding: d.embedding,
                docId: doc.id,
                docName: doc.name,
              }));
            } catch (e) {
              console.warn(`Could not load ${doc.id}:`, e.message);
              return [];
            }
          })
        );

        const flat = loaded.flat();
        if (!flat.length) throw new Error('No valid embeddings found in any document.');
        setAllChunks(flat);
        setLoadingDocs(false);
      })
      .catch(err => {
        setDocsError(err.message);
        setLoadingDocs(false);
      });
  }, []);

  const ask = useCallback(async (q) => {
    const text = q || question.trim();
    if (!text || loading) return;
    if (!allChunks?.length) { setError('Documents not loaded yet.'); return; }

    setQuestion(text);
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);

    try {
      // 1. Embed the question
      const questionEmbedding = await embedText(text);

      // 2. Cosine similarity search across ALL docs
      const scored = allChunks.map(c => ({
        ...c,
        score: cosineSimilarity(questionEmbedding, c.embedding)
      }));
      scored.sort((a, b) => b.score - a.score);
      const topChunks = scored.slice(0, 5);

      // 3. Build context grouped by doc
      const contextParts = [];
      topChunks.forEach((c, i) => {
        contextParts.push(`[${i + 1}] [${c.docName}]\n${c.chunk}`);
      });
      const context = contextParts.join('\n\n');

      // 4. Ask Gemini with context
      const response = await askWithContext(text, context);

      setAnswer(response);
      setSources(topChunks.map((c, i) => ({
        id: i + 1,
        text: c.chunk,
        docName: c.docName,
        score: Math.round(c.score * 1000) / 1000
      })));
    } catch (err) {
      console.error(err);
      setError(err.message?.includes('quota') || err.message?.includes('429')
        ? 'API quota exceeded. Please try again later.'
        : 'Failed to get an answer. Please try again.'
      );
    }
    setLoading(false);
  }, [question, loading, allChunks]);

  return (
    <div className="official-docs">
      {/* Header */}
      <header className="nepra-header">
        <div className="nepra-header-inner">
          <button className="nepra-back" onClick={() => window.dispatchEvent(new CustomEvent('official-docs-close'))}>
            <BackIcon /> Back
          </button>
          <div className="nepra-title">
            <DocIcon />
            <span>Official Docs</span>
          </div>
          <div className="nepra-badge">Gov Sources</div>
        </div>
      </header>

      {/* Main */}
      <main className="nepra-main">
        {/* Hero */}
        <div className="nepra-hero">
          <h1>Ask official documents</h1>
          <p>Get instant, cited answers from official government documents. Short and simple — no jargon.</p>
        </div>

        {/* Doc list */}
        {!loadingDocs && !docsError && docs.length > 0 && (
          <div className="docs-list">
            {docs.map(doc => (
              <div key={doc.id} className="docs-list-item">
                <span className="docs-list-dot" />
                <span className="docs-list-name">{doc.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Loading / Error */}
        {loadingDocs && (
          <div className="nepra-status loading">
            <div className="nepra-spinner" />
            Loading {docs.length || ''} official documents...
          </div>
        )}
        {docsError && (
          <div className="nepra-status error">
            ⚠️ {docsError} Make sure <code>docs-registry.json</code> and embedding files are in <code>public/</code>.
          </div>
        )}

        {/* Search */}
        {!loadingDocs && !docsError && (
          <div className="nepra-search-wrap">
            <div className="nepra-search-box">
              <SearchIcon />
              <input
                type="text"
                placeholder="e.g. What are my consumer rights?"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ask()}
                disabled={loading}
              />
              <button
                className="nepra-search-btn"
                onClick={() => ask()}
                disabled={!question.trim() || loading}
              >
                {loading ? '...' : <SendIcon />}
              </button>
            </div>

            {/* Suggested questions */}
            {!answer && !loading && (
              <div className="nepra-chips">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q} className="nepra-chip" onClick={() => ask(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div className="nepra-answer">
            <div className="nepra-answer-header">
              <span className="nepra-answer-label">Answer</span>
              <span className="nepra-answer-meta">From official government documents</span>
            </div>
            <div className="nepra-answer-body">{answer}</div>
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="nepra-sources">
            <h4 className="nepra-sources-title">Sources</h4>
            {sources.map(s => (
              <div key={s.id} className="nepra-source">
                <span className="nepra-source-id">[{s.id}]</span>
                <span className="nepra-source-doc">{s.docName}</span>
                <span className="nepra-source-text">{s.text}</span>
                <span className="nepra-source-score">score: {s.score}</span>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && <div className="nepra-error">{error}</div>}
      </main>
    </div>
  );
}
