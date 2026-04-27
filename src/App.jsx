import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeBill, askQuestion } from './gemini';
import { generatePDF } from './pdf';
import {
  ConsumptionTrendChart,
  ChargeBreakdownChart,
  BillComparisonChart,
  BillingTimeline,
  SavingsMeter,
  UsageGauge,
  BillingCalendar
} from './Charts';
import KnowledgeBase from './KnowledgeBase';

/* ═══════ SVG Icons ═══════ */
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ═══════ Loading Messages ═══════ */
const LOADING_MSGS = [
  'Reading your bill...',
  'Identifying all charges...',
  'Calculating what changed...',
  'Preparing your breakdown...'
];

/* ═══════ Premium Micro-Animations ═══════ */
function AnimatedNumber({ target }) {
  const [num, setNum] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1200; // 1.2s
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setNum(target);
        clearInterval(timer);
      } else {
        setNum(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <>{num.toLocaleString()}</>;
}

/* ═══════ Summary Card ═══════ */
function SummaryCard({ data }) {
  const warnings = data.charges?.filter(c => c.status === 'WARNING') || [];
  const hasIncrease = data.comparisonText?.toLowerCase().includes('more');
  const topReason = data.changeReasons?.[0];

  return (
    <div className="section">
      {(warnings.length > 0 || hasIncrease) && (
        <div className="verdict-bar warning">
          <span>🚨</span>
          <span>
            {hasIncrease ? data.comparisonText + '. ' : ''}
            {warnings.length > 0 ? `${warnings.length} suspicious charge${warnings.length > 1 ? 's' : ''} found.` : ''}
          </span>
        </div>
      )}
      <div className="summary-card">
        <div className="summary-row">
          <div className="summary-left">
            <span className="bill-type-badge">{data.billType}</span>
            <div className="summary-amount">
              <small>Rs. </small>{(data.totalAmount || 0).toLocaleString()}
            </div>
            {data.comparisonText && (
              <span className="summary-change-tag">{data.comparisonText}</span>
            )}
            
            {/* Visual Comparison Chart */}
            {data.previousBillAmount > 0 && (
              <div className="cost-comparison-chart">
                <div className="chart-row">
                  <span className="chart-label">Last Month</span>
                  <div className="chart-bar-wrap">
                    <div className="chart-bar prev-bar" style={{ width: `${Math.max(10, (data.previousBillAmount / Math.max(data.previousBillAmount, data.totalAmount)) * 100)}%` }}></div>
                  </div>
                  <span className="chart-val">Rs. {data.previousBillAmount.toLocaleString()}</span>
                </div>
                <div className="chart-row">
                  <span className="chart-label">This Month</span>
                  <div className="chart-bar-wrap">
                    <div className={`chart-bar curr-bar ${hasIncrease ? 'danger' : 'success'}`} style={{ width: `${Math.max(10, (data.totalAmount / Math.max(data.previousBillAmount, data.totalAmount)) * 100)}%` }}></div>
                  </div>
                  <span className="chart-val">Rs. {data.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            )}
            
          </div>
          <div className="summary-right">
            <div className="meta-item"><span className="meta-label">Due</span><span className={`meta-value ${data.isPastDue ? 'danger' : ''}`}>{data.dueDate}{data.isPastDue ? ' ⚠️' : ''}</span></div>
            <div className="meta-item"><span className="meta-label">Units</span><span className="meta-value">{data.unitsConsumed} {data.unitLabel || ''}</span></div>
            <div className="meta-item"><span className="meta-label">Period</span><span className="meta-value">{data.billingMonth}</span></div>
          </div>
        </div>
        {topReason && (
          <div className="summary-insight">
            <span className="insight-icon">{topReason.icon}</span>
            <div><strong>{topReason.title}</strong> — {topReason.explanation}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════ Solar Card ═══════ */
function SolarCard({ nm, insights }) {
  if (!nm) return null;
  const insightStyle = { warning: 'solar-insight-warn', tip: 'solar-insight-tip', info: 'solar-insight-info' };
  const insightIcon = { warning: '⚠️', tip: '💡', info: 'ℹ️' };

  // Calculate energy flow ratio
  const totalFlow = (nm.unitsExported || 0) + (nm.unitsImported || 0);
  const exportPct = totalFlow > 0 ? Math.round(((nm.unitsExported || 0) / totalFlow) * 100) : 50;
  
  // Quarter settlement progress
  const qMonth = nm.monthInQuarter || 1;

  return (
    <div className="section">
      <h3 className="section-title">🌞 Your Solar Performance</h3>
      <div className="solar-card">
        
        {/* Visual Energy Flow Bar */}
        {totalFlow > 0 && (
          <div className="viz-container">
            <div className="viz-header">
              <span style={{color: 'var(--green)'}}>Exported ({exportPct}%)</span>
              <span style={{color: 'var(--red)'}}>Imported ({100 - exportPct}%)</span>
            </div>
            <div className="energy-bar">
              <div className="energy-bar-export" style={{ width: `${exportPct}%` }}></div>
              <div className="energy-bar-import" style={{ width: `${100 - exportPct}%` }}></div>
            </div>
          </div>
        )}

        <div className="solar-stats">
          <div className="solar-stat"><span className="icon">🌞</span><span className="label">Sent to Grid</span><span className="value">{nm.unitsExported?.toLocaleString()} kWh</span></div>
          <div className="solar-stat"><span className="icon">🏠</span><span className="label">Used from Grid</span><span className="value">{nm.unitsImported?.toLocaleString()} kWh</span></div>
          <div className="solar-stat"><span className="icon">⚡</span><span className="label">Net Balance</span><span className="value">{nm.netPosition?.toLocaleString()} kWh</span></div>
          <div className="solar-stat"><span className="icon">💰</span><span className="label">Credit Earned</span><span className="value">Rs. {nm.creditValue?.toLocaleString()}</span></div>
        </div>

        {/* Quarterly Settlement Timeline */}
        {qMonth && (
          <div className="viz-container settlement-viz">
            <h4 className="viz-title">Quarterly Settlement Progress</h4>
            <div className="timeline">
              <div className={`timeline-step ${qMonth >= 1 ? 'active' : ''}`}><span>1</span><small>Month 1</small></div>
              <div className="timeline-line"></div>
              <div className={`timeline-step ${qMonth >= 2 ? 'active' : ''}`}><span>2</span><small>Month 2</small></div>
              <div className="timeline-line"></div>
              <div className={`timeline-step ${qMonth === 3 ? 'active' : ''} ${qMonth === 3 ? 'settlement' : ''}`}><span>3</span><small>Settlement</small></div>
            </div>
          </div>
        )}

        {insights?.length > 0 && (
          <div className="solar-insights">
            {insights.map((ins, i) => (
              <div key={i} className={`solar-insight ${insightStyle[ins.type] || 'solar-insight-info'}`}>
                <span className="solar-insight-icon">{insightIcon[ins.type] || 'ℹ️'}</span>
                <div>
                  <strong>{ins.title}</strong>
                  <p>{ins.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {nm.isOverExporting && !insights?.some(i => i.type === 'warning') && (
          <div className="solar-insight solar-insight-warn">
            <span className="solar-insight-icon">⚠️</span>
            <div>
              <strong>Export limit exceeded</strong>
              <p>Your peak export was {nm.expMdi} kW but your approved limit is {nm.dgCapacity} kW. Lower your inverter export setting to avoid penalties.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════ Charge Table ═══════ */
function ChargeTable({ charges }) {
  const [showTable, setShowTable] = useState(false);
  const [expanded, setExpanded] = useState(null);
  if (!charges?.length) return null;
  const statusClass = s => {
    const m = { NORMAL: 'status-normal', FIXED: 'status-fixed', GOVERNMENT: 'status-government', OVERDUE: 'status-overdue', WARNING: 'status-warning' };
    return m[s] || 'status-fixed';
  };
  return (
    <div className="section">
      <button className="section-toggle" onClick={() => setShowTable(!showTable)}>
        <span className="section-title" style={{ marginBottom: 0 }}>📋 Full Charge Breakdown ({charges.length} items)</span>
        <span className="toggle-icon">{showTable ? '−' : '+'}</span>
      </button>
      {showTable && (
        <div className="charge-table" style={{ marginTop: 'var(--space-md)' }}>
          <div className="charge-table-header">
            <span>Charge</span><span>Amount</span><span>Status</span><span></span>
          </div>
          {charges.map((c, i) => (
            <div key={i} className={`charge-row-wrap ${expanded === i ? 'open' : ''}`}>
              <div className="charge-row" onClick={() => setExpanded(expanded === i ? null : i)}>
                <span className="charge-name">{c.name}</span>
                <span className="charge-amount">Rs. {(c.amount || 0).toLocaleString()}</span>
                <span className={`status-badge ${statusClass(c.status)}`}>
                  {c.status === 'OVERDUE' ? '⚠️ ' : ''}{c.status}
                </span>
                <span className="charge-toggle">{expanded === i ? '−' : '+'}</span>
              </div>
              {expanded === i && (
                <div className="charge-explain-row">{c.explanation}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════ Change Reasons ═══════ */
function ChangeReasons({ reasons }) {
  if (!reasons?.length) return null;
  const colorMap = { usage: 'red', government: 'amber', seasonal: 'blue' };
  return (
    <div className="section">
      <h3 className="section-title">📊 Why Did My Bill Change?</h3>
      <div className="change-cards">
        {reasons.map((r, i) => (
          <div className="change-card" key={i}>
            <div className={`change-icon ${colorMap[r.type] || 'amber'}`}>{r.icon}</div>
            <div><h4>{r.title}</h4><p>{r.explanation}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ Recommendations ═══════ */
function Recommendations({ recs }) {
  if (!recs?.length) return null;
  const effortClass = e => {
    const m = { EASY: 'effort-easy', MEDIUM: 'effort-medium', HARD: 'effort-hard' };
    return m[e] || 'effort-easy';
  };
  return (
    <div className="section">
      <h3 className="section-title">💡 What You Can Actually Do</h3>
      <div className="action-cards">
        {recs.map((r, i) => (
          <div className="action-card" key={i}>
            <div className="action-card-top">
              <span className={`effort-badge ${effortClass(r.effort)}`}>{r.effort}</span>
              {r.savings && <span className="savings-badge">Save {r.savings}</span>}
            </div>
            <div><h4>{r.title}</h4><p>{r.explanation}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ Overcharge Alert ═══════ */
function OverchargeAlert({ data }) {
  const warnings = data.charges?.filter(c => c.status === 'WARNING') || [];
  const hasIncrease = data.comparisonText?.toLowerCase().includes('more');
  if (warnings.length === 0 && !hasIncrease) return null;
  const parts = [];
  if (hasIncrease) parts.push(data.comparisonText);
  if (warnings.length > 0) parts.push(`${warnings.length} suspicious charge${warnings.length > 1 ? 's' : ''} detected: ${warnings.map(c => c.name).join(', ')}`);
  return (
    <div className="section">
      <div className="overcharge-alert">
        <div className="overcharge-icon">🚨</div>
        <div className="overcharge-content">
          <h3>You may be overpaying</h3>
          <p>{parts.join('. ')}.</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════ Chat Section ═══════ */
function ChatSection({ billData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const answer = await askQuestion(q, billData);
      setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    } catch (err) {
      console.error(err);
      if (err.message?.includes('429') || err.message?.toLowerCase().includes('quota')) {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, the Gemini API quota has been exceeded for this key. Please try again later.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I could not process that question. Please try again.' }]);
      }
    }
    setLoading(false);
  };

  const chips = (() => {
    const base = ['Why is my bill so high?'];
    const warnings = billData?.charges?.filter(c => c.status === 'WARNING') || [];
    if (warnings.length > 0) base.push(`What is ${warnings[0].name}?`);
    if (billData?.comparisonText) base.push('Why did my bill change this month?');
    base.push('How can I reduce my next bill?');
    if (billData?.isNetMetering) base.push('How is my solar performing?');
    return base.slice(0, 5);
  })();

  return (
    <div className="section">
      <h3 className="section-title">💬 Ask Anything</h3>
      <div className="chat-section">
        {messages.length === 0 && (
          <div className="chat-chips">
            {chips.map(c => <button key={c} className="chat-chip" onClick={() => send(c)}>{c}</button>)}
          </div>
        )}
        {messages.length > 0 && (
          <div className="chat-messages">
            {messages.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>)}
            {loading && <div className="chat-msg assistant" style={{ opacity: 0.6 }}>Thinking...</div>}
            <div ref={endRef} />
          </div>
        )}
        <div className="chat-input-wrap" style={{ marginTop: messages.length ? 16 : 0 }}>
          <input
            className="chat-input"
            placeholder="Ask about your bill..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            disabled={loading}
          />
          <button className="chat-send" onClick={() => send()} disabled={!input.trim() || loading}>
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════ MAIN APP ═══════ */
export default function App() {
  const [screen, setScreen] = useState('landing'); // landing | loading | dashboard | official-docs
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [billData, setBillData] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Loading message rotation
  useEffect(() => {
    if (screen !== 'loading') return;
    const interval = setInterval(() => setLoadingMsg(m => (m + 1) % LOADING_MSGS.length), 2000);
    return () => clearInterval(interval);
  }, [screen]);

  // Listen for OfficialDocs close event
  useEffect(() => {
    const handler = () => setScreen('landing');
    window.addEventListener('official-docs-close', handler);
    return () => window.removeEventListener('official-docs-close', handler);
  }, []);

  const handleFile = useCallback((f) => {
    if (!f) return;
    const valid = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!valid.includes(f.type)) { setError('Please upload a JPG, PNG, or PDF file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('File must be under 10MB.'); return; }
    setError(null);
    setFile(f);
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleAnalyze = async () => {
    setError(null);
    setScreen('loading');
    setLoadingMsg(0);
    try {
      const data = await analyzeBill(file);
      setBillData(data);
      setScreen('dashboard');
    } catch (err) {
      console.error(err);
      if (err.message?.includes('429') || err.message?.toLowerCase().includes('quota')) {
        setError('Gemini API quota exceeded. Please try again later.');
      } else if (err.message?.includes('API_KEY') || err.message?.includes('401') || err.message?.includes('403')) {
        setError('Server authentication error. Please contact support.');
      } else {
        setError('Failed to analyze the bill. Please try again with a clearer image.');
      }
      setScreen('landing');
    }
  };



  const reset = () => {
    setScreen('landing');
    setFile(null);
    setPreview(null);
    setBillData(null);
    setError(null);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container header-inner">
          <div className="logo" onClick={reset} style={{ cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}>
              <path d="M12 2L2 22h20L12 2zm0 6l5.5 11h-11L12 8z"/>
            </svg>
            Bill-y
          </div>
          <nav className="header-nav">
            <a href="#products">Products</a>
            <a href="#docs">Docs</a>
            <a href="#pricing">Pricing</a>
            <a href="#resources">Resources</a>
          </nav>
          <div className="header-actions">
            <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => fileInputRef.current?.click()}>
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* LANDING SCREEN */}
      {screen === 'landing' && (
        <main className="landing">
          {!file ? (
            <div className="hero-container">
              <div className="hero-content">
                <div className="hero-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Most Pakistanis don’t understand their bills.
                </div>

                <h1 className="hero-title">
                  Understand your bill.<br/>Stop overpaying.
                </h1>
                
                <p className="hero-subtitle">
                  Upload your LESCO, SNGPL or WASA bill — we explain every charge and show exactly how to reduce your costs.
                </p>
                
                <div className="hero-actions">
                  <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                    Analyze My Bill
                  </button>
                  <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    See Example Breakdown
                  </button>
                  <button className="btn-nepra" onClick={() => setScreen('official-docs')}>
                    📖 Official Docs
                  </button>
                </div>

                <div className="hero-meta">
                  No signup required • Takes 5 seconds • 100% free
                </div>

                <div className="trusted-by">
                  <span className="trusted-title">Supports all major Pakistani utility providers</span>
                  <div className="trusted-logos">
                    <span className="t-logo">LESCO <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                    <span className="t-logo">SNGPL <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                    <span className="t-logo">WASA <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                  </div>
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-diagram">
                  {/* Left Documents Stack */}
                  <div className="hero-docs-grid">
                    <div className="mini-doc">
                      <div className="mini-doc-lines">
                        <div className="mini-line" style={{ width: '70%' }}></div>
                        <div className="mini-line" style={{ width: '50%' }}></div>
                        <div className="mini-line" style={{ width: '80%' }}></div>
                      </div>
                    </div>
                    <div className="mini-doc" style={{ animationDelay: '0.2s', opacity: 0.7 }}>
                      <div className="mini-doc-lines">
                        <div className="mini-line" style={{ width: '60%' }}></div>
                        <div className="mini-line" style={{ width: '90%' }}></div>
                        <div className="mini-line" style={{ width: '40%' }}></div>
                      </div>
                    </div>
                    <div className="mini-doc" style={{ animationDelay: '0.4s', opacity: 0.4 }}>
                      <div className="mini-doc-lines">
                        <div className="mini-line" style={{ width: '80%' }}></div>
                        <div className="mini-line" style={{ width: '60%' }}></div>
                        <div className="mini-line" style={{ width: '70%' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Connector 1 */}
                  <div className="diagram-connector">
                    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                      <path d="M0 12 H 28" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                      <polygon points="24,8 32,12 24,16" fill="currentColor" />
                    </svg>
                  </div>

                  {/* Center Upload Node */}
                  <div className="hero-center-wrapper">
                    <div
                      className={`abstract-node ${dragOver ? 'drag-over' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => !file && fileInputRef.current?.click()}
                    >
                      <div className="node-logo" style={{ fontSize: '32px', fontWeight: '600', fontFamily: 'var(--font-sans)', color: '#0F172A' }}>
                        Δ
                      </div>
                    </div>
                  </div>

                  {/* Connector 2 */}
                  <div className="diagram-connector">
                    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                      <path d="M0 12 H 28" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                      <polygon points="24,8 32,12 24,16" fill="currentColor" />
                    </svg>
                  </div>

                  {/* Right Value Block (Premium Insights Card) */}
                  <div className="hero-code-block">
                    {/* Warning Header */}
                    <div style={{ background: '#FEF2F2', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #FEE2E2' }}>
                      <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                      <span style={{ color: '#991B1B', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>You are overpaying</span>
                    </div>

                    <div style={{ padding: '24px', textAlign: 'left' }}>
                      <div style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Bill</div>
                      <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0F172A', lineHeight: '1', marginBottom: '8px', letterSpacing: '-1px' }}>
                        Rs. <AnimatedNumber target={14500} />
                      </div>
                      <div style={{ color: '#EF4444', fontSize: '0.95rem', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg className="pulse-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                        Rs. 2,300 higher than usual
                      </div>
                      
                      <div style={{ padding: '0 0 16px', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>❌</span>
                        <span style={{ color: '#475569', fontSize: '0.95rem', fontWeight: '500' }}>High Fuel Adjustment detected</span>
                      </div>

                      <div className="glow-green" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>💡</span>
                        <span style={{ color: '#166534', fontSize: '0.95rem', fontWeight: '700' }}>You can save Rs. 800 next month</span>
                      </div>
                    </div>
                  </div>
                </div>

                {error && <div className="error-banner" style={{ position: 'absolute', bottom: '-80px', width: '100%' }}>{error}</div>}
              </div>
            </div>
          ) : (
            <div className="file-ready-sequence">
              <div className="file-ready-steps">
                <div className="step-item done"><div className="step-dot"></div><span>Bill uploaded</span></div>
                <div className="step-line"></div>
                <div className="step-item active"><div className="step-dot"></div><span>Ready to analyze</span></div>
                <div className="step-line dim"></div>
                <div className="step-item"><div className="step-dot"></div><span>Get insights</span></div>
              </div>
              <div className="file-ready-card">
                <div className="file-preview" style={{ marginTop: 0 }}>
                  {preview ? (
                    <img src={preview} alt="Bill preview" className="file-preview-thumb" />
                  ) : (
                    <div className="file-preview-thumb" style={{ background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', color: 'var(--text-muted)' }}>PDF</div>
                  )}
                  <div className="file-preview-info">
                    <span className="file-preview-name">{file.name}</span>
                    <span className="file-preview-size">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }} aria-label="Remove file">
                    <XIcon />
                  </button>
                </div>
                <button className="btn-primary file-ready-btn" onClick={handleAnalyze} id="analyze-btn">
                  Analyze My Bill
                </button>
                <p className="file-ready-hint">Takes ~5 seconds • AI-powered analysis</p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="upload-input"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={e => handleFile(e.target.files?.[0])}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
          />
        </main>
      )}

      {/* LOADING SCREEN */}
      {screen === 'loading' && (
        <main className="loading-screen">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" />
          </div>
          <div className="loading-status">{LOADING_MSGS[loadingMsg]}</div>
        </main>
      )}

      {/* DASHBOARD */}
      {screen === 'dashboard' && billData && (
        <main className="dashboard">
          <div className="container">
            {/* KPI Strip */}
            <div className="dash-kpi-strip">
              <div className="dash-kpi-card">
                <span className="dash-kpi-label">Total Amount</span>
                <span className="dash-kpi-value">Rs. {(billData.totalAmount || 0).toLocaleString()}</span>
              </div>
              <div className="dash-kpi-card">
                <span className="dash-kpi-label">Units Consumed</span>
                <span className="dash-kpi-value">{billData.unitsConsumed || 0} {billData.unitLabel || ''}</span>
              </div>
              {billData.previousBillAmount > 0 && (
                <div className="dash-kpi-card">
                  <span className="dash-kpi-label">vs Last Month</span>
                  <span className={`dash-kpi-value ${billData.totalAmount > billData.previousBillAmount ? 'danger' : 'success'}`}>
                    {billData.totalAmount > billData.previousBillAmount ? '▲' : '▼'} {Math.abs(Math.round(((billData.totalAmount - billData.previousBillAmount) / billData.previousBillAmount) * 100))}%
                  </span>
                </div>
              )}
              <div className="dash-kpi-card">
                <span className="dash-kpi-label">Due Date</span>
                <span className={`dash-kpi-value ${billData.isPastDue ? 'danger' : ''}`}>{billData.dueDate || 'N/A'}{billData.isPastDue ? ' ⚠️' : ''}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="dash-tabs-container">
              <button className={`dash-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
              <button className={`dash-tab ${activeTab === 'breakdown' ? 'active' : ''}`} onClick={() => setActiveTab('breakdown')}>Breakdown</button>
              <button className={`dash-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
              {billData.isNetMetering && (
                <button className={`dash-tab ${activeTab === 'solar' ? 'active' : ''}`} onClick={() => setActiveTab('solar')}>Solar</button>
              )}
            </div>

            {/* Tab Content */}
            <div className="dash-panel">
              {activeTab === 'overview' && (
                <>
                  <SummaryCard data={billData} />
                  <Recommendations recs={billData.recommendations} />
                </>
              )}
              {activeTab === 'breakdown' && (
                <>
                  <ChargeBreakdownChart charges={billData.charges} />
                  <ChargeTable charges={billData.charges} />
                  <div className="section">
                    <div className="gauges-grid">
                      <SavingsMeter estimatedSavings={billData.estimatedSavings} recommendations={billData.recommendations} />
                      <UsageGauge unitsConsumed={billData.unitsConsumed} unitLabel={billData.unitLabel} billType={billData.billType} />
                    </div>
                  </div>
                </>
              )}
              {activeTab === 'history' && (
                <>
                  <ConsumptionTrendChart data={billData} />
                  <BillComparisonChart recentBills={billData.recentBills} unitLabel={billData.unitLabel} />
                  <BillingCalendar data={billData} />
                  <BillingTimeline data={billData} />
                </>
              )}
              {activeTab === 'solar' && billData.isNetMetering && (
                <SolarCard nm={billData.netMetering} insights={billData.solarInsights} />
              )}
            </div>

            {/* Footer Actions */}
            <div className="footer-actions">
              <button className="btn-primary" onClick={() => generatePDF(billData)}>
                <DownloadIcon /> Download Summary
              </button>
              <button className="btn-secondary" onClick={reset}>
                <RefreshIcon /> Analyze Another Bill
              </button>
            </div>

            {/* Floating Chat */}
            <button className="floating-chat-btn" onClick={() => setIsChatOpen(!isChatOpen)} aria-label="Toggle AI Chat">
              {isChatOpen ? <XIcon /> : <span style={{ fontSize: '1.4rem' }}>💬</span>}
            </button>
            
            {isChatOpen && (
              <div className="floating-chat-panel">
                <ChatSection billData={billData} />
              </div>
            )}
          </div>
        </main>
      )}

      {/* OFFICIAL DOCS */}
      {screen === 'official-docs' && <KnowledgeBase />}
    </div>
  );
}
