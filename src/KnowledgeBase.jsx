import { useState, useEffect, useCallback, useRef } from 'react';
import { searchDocs, askWithContextStream } from './gemini';

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

/* ═══════ Category Config ═══════ */
const CATEGORY_META = {
  government: { icon: '🏛️', label: 'Government', color: '#1e40af' },
  guide:      { icon: '📘', label: 'Guide',      color: '#059669' },
  faq:        { icon: '❓', label: 'FAQ',         color: '#d97706' },
};

/* ═══════ Loading Stage Messages ═══════ */
const STAGE_MESSAGES = {
  searching:  'Scanning pages across documents...',
  generating: 'Reading relevant sections...',
  streaming:  '',
};

/* ═══════ Suggested Questions ═══════ */
const SUGGESTED_QUESTIONS = [
  'What are my rights as an electricity consumer?',
  'How is the Fuel Price Adjustment calculated?',
  'What should I do if my bill is too high?',
  'How do I file a complaint against LESCO?',
  'What is the deadline for paying my bill before disconnection?',
];

/* ═══════ Answer Renderer ═══════ */
function renderAnswer(text, onCiteClick, isStreaming, maxSources = 99) {
  if (!text) return null;

  // Parse inline: **bold** and [N] or [N - Doc Name] citations
  function parseInline(str, keyPrefix) {
    const parts = [];
    const regex = /\*\*(.+?)\*\*|\[(\d+)(?:\s*[-\u2013]\s*[^\]]+)?\]/g;
    let last = 0, match, idx = 0;
    while ((match = regex.exec(str)) !== null) {
      if (match.index > last) parts.push(str.slice(last, match.index));
      if (match[1] !== undefined) {
        // Bold
        parts.push(<strong key={`${keyPrefix}-b-${idx++}`}>{match[1]}</strong>);
      } else if (match[2] !== undefined) {
        const num = parseInt(match[2], 10);
        if (num >= 1 && num <= maxSources) {
          // Valid citation — clickable badge
          parts.push(
            <button
              key={`${keyPrefix}-c-${idx++}`}
              className="kb-cite-badge"
              onClick={() => onCiteClick && onCiteClick(num)}
              title={`Jump to source ${num}`}
            >
              {num}
            </button>
          );
        } else {
          // Out-of-range — render as dimmed text, not a badge
          parts.push(
            <span key={`${keyPrefix}-x-${idx++}`} className="kb-cite-invalid" title="Source not available">
              [{num}]
            </span>
          );
        }
      }
      last = match.index + match[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts;
  }

  const lines = text.split('\n');
  const elements = [];
  let bullets = [];
  let key = 0;

  function flushBullets() {
    if (bullets.length === 0) return;
    elements.push(
      <ul key={`ul-${key++}`} className="kb-answer-list">
        {bullets}
      </ul>
    );
    bullets = [];
  }

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) { flushBullets(); return; }

    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    if (h3) {
      flushBullets();
      elements.push(<h4 key={`h-${key++}`} className="kb-answer-h3">{parseInline(h3[1], `h-${key}`)}</h4>);
      return;
    }
    if (h2) {
      flushBullets();
      elements.push(<h3 key={`h-${key++}`} className="kb-answer-h2">{parseInline(h2[1], `h-${key}`)}</h3>);
      return;
    }

    const bullet = line.match(/^[\*\-\u2022]\s+(.+)/);
    if (bullet) {
      bullets.push(<li key={`li-${i}`}>{parseInline(bullet[1], `li-${i}`)}</li>);
      return;
    }

    flushBullets();
    elements.push(
      <p key={`p-${key++}`} className="kb-answer-p">
        {parseInline(line, `p-${key}`)}
      </p>
    );
  });

  flushBullets();

  if (isStreaming && elements.length > 0) {
    const last = elements[elements.length - 1];
    elements[elements.length - 1] = (
      <span key="last-wrap">
        {last}
        <span className="kb-cursor" />
      </span>
    );
  }

  return elements;
}

export default function KnowledgeBase() {
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [stage, setStage] = useState(null); // null | searching | generating | streaming
  const [error, setError] = useState(null);
  const answerRef = useRef(null);
  const sourceRefs = useRef({});

  // ─── Load docs registry ───
  useEffect(() => {
    fetch('/docs-registry.json')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load docs registry.');
        return r.json();
      })
      .then(registry => {
        setDocs(registry);
        setLoadingDocs(false);
      })
      .catch(err => {
        setDocsError(err.message);
        setLoadingDocs(false);
      });
  }, []);

  // ─── Scroll to a cited source ───
  const scrollToSource = useCallback((num) => {
    const el = sourceRefs.current[num];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('kb-source-highlight');
      setTimeout(() => el.classList.remove('kb-source-highlight'), 1800);
    }
  }, []);

  // ─── Ask with Streaming ───
  const ask = useCallback(async (q) => {
    const text = q || question.trim();
    if (!text || stage) return;

    setQuestion(text);
    setStage('searching');
    setError(null);
    setAnswer(null);
    setSources([]);

    try {
      // 1. Search docs via backend
      const { chunks } = await searchDocs(text);

      if (!chunks?.length) {
        setError('No relevant documents found.');
        setStage(null);
        return;
      }

      setSources(chunks);

      // 2. Stream the answer
      setStage('streaming');
      await askWithContextStream(text, chunks, (progressText) => {
        setAnswer(progressText);
      });

    } catch (err) {
      console.error(err);
      setError(err.message?.includes('quota') || err.message?.includes('429')
        ? 'API quota exceeded. Please try again later.'
        : 'Failed to get an answer. Please try again.'
      );
    }
    setStage(null);
  }, [question, stage]);

  // Auto-scroll answer into view
  useEffect(() => {
    if (answer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [answer]);

  const isLoading = stage !== null;

  return (
    <div className="kb">
      {/* Header */}
      <header className="kb-header">
        <div className="kb-header-inner">
          <button className="kb-back" onClick={() => window.dispatchEvent(new CustomEvent('official-docs-close'))}>
            <BackIcon /> Back
          </button>
          <div className="kb-title">
            <DocIcon />
            <span>Knowledge Base</span>
          </div>
          <div className="kb-badge">
            <span className="kb-badge-dot" />
            {docs.filter(d => d.authoritative).length} Gov Sources
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="kb-main">
        {/* Hero */}
        <div className="kb-hero">
          <h1>Ask official documents</h1>
          <p>Get instant, cited answers from official government documents. Short and simple — no jargon.</p>
        </div>

        {/* Doc list with categories */}
        {!loadingDocs && !docsError && docs.length > 0 && (
          <div className="kb-doc-list">
            {docs.map(doc => {
              const cat = CATEGORY_META[doc.category] || CATEGORY_META.guide;
              return (
                <div key={doc.id} className="kb-doc-item">
                  <span className="kb-doc-icon">{doc.icon || cat.icon}</span>
                  <span className="kb-doc-name">{doc.name}</span>
                  {doc.authoritative && (
                    <span className="kb-verified-badge">✓ Verified</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {loadingDocs && (
          <div className="kb-loading-docs">
            <span>Loading documents...</span>
          </div>
        )}

        {docsError && (
          <div className="kb-status-error">
            ⚠️ {docsError} Make sure <code>docs-registry.json</code> and embedding files are in <code>public/</code>.
          </div>
        )}

        {/* Search */}
        {!loadingDocs && !docsError && (
          <div className="kb-search-wrap">
            <div className="kb-search-box">
              <SearchIcon />
              <input
                type="text"
                placeholder="e.g. What are my consumer rights?"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ask()}
                disabled={isLoading}
              />
              <button
                className="kb-search-btn"
                onClick={() => ask()}
                disabled={!question.trim() || isLoading}
              >
                {isLoading ? <span className="kb-btn-spinner" /> : <SendIcon />}
              </button>
            </div>

            {/* Suggested questions */}
            {!answer && !isLoading && (
              <div className="kb-chips">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q} className="kb-chip" onClick={() => ask(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Progressive Loading Stages */}
        {stage && stage !== 'streaming' && (
          <div className="kb-stage">
            <div className="kb-stage-spinner" />
            <span className="kb-stage-text">{STAGE_MESSAGES[stage]}</span>
          </div>
        )}

        {/* Streaming Answer */}
        {answer && (
          <div className="kb-answer" ref={answerRef}>
            <div className="kb-answer-header">
              <span className="kb-answer-label">Answer</span>
              {sources.some(s => s.authoritative) && (
                <span className="kb-gov-badge">
                  🏛️ Verified Government Source
                </span>
              )}
            </div>
            <div className="kb-answer-body">
              {renderAnswer(answer, scrollToSource, stage === 'streaming', sources.length)}
            </div>
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && !stage && (
          <div className="kb-sources">
            <h4 className="kb-sources-title">Sources used</h4>
            {sources.map(s => {
              const cat = CATEGORY_META[s.category] || CATEGORY_META.guide;
              return (
                <div
                  key={s.id}
                  className="kb-source"
                  ref={el => { sourceRefs.current[s.id] = el; }}
                >
                  <button
                    className="kb-source-id-btn"
                    onClick={() => scrollToSource(s.id)}
                    title={`Source ${s.id}`}
                  >
                    {s.id}
                  </button>
                  <span className="kb-source-icon">{s.icon || cat.icon}</span>
                  <div className="kb-source-content">
                    <div className="kb-source-meta">
                      <span className="kb-source-doc">{s.docName}</span>
                      {s.authoritative && (
                        <span className="kb-source-auth">Gov</span>
                      )}
                      <span className="kb-source-score">score: {s.score}</span>
                    </div>
                    <span className="kb-source-text">{s.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && <div className="kb-error">{error}</div>}
      </main>
    </div>
  );
}
