import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeBill, askQuestion, compareBills } from './gemini';
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
import { DEMO_BILL_A, DEMO_BILL_B, DEMO_COMPARE_DATA } from './demoData';

/* ═══════ SVG Icons ═══════ */
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);
const LightbulbIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>
);
const ZapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);
const TriangleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

/* ═══════ Loading Messages ═══════ */
const LOADING_MSGS = [
  'Decoding your utility provider\'s jargon...',
  'Hunting down hidden taxes and surcharges...',
  'Verifying your tariff slab against NEPRA rules...',
  'Crunching the numbers to find your savings...'
];

/* ═══════ Premium Micro-Animations ═══════ */
function AnimatedNumber({ target }) {
  const [num, setNum] = useState(0);
  useEffect(() => {
    let startTimestamp = null;
    const duration = 1200; // 1.2s

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      setNum(Math.floor(ease * target));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setNum(target);
      }
    };

    const rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [target]);
  return <>{num.toLocaleString()}</>;
}

/* ═══════ Summary Card ═══════ */
function SummaryCard({ data }) {
  const hasIncrease = data.comparisonText?.toLowerCase().includes('more');
  const topReason = data.changeReasons?.[0];

  return (
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
  );
}

/* ═══════ Bill Health Score ═══════ */
function BillHealthScore({ data }) {
  // Calculate score 0-100
  let score = 100;

  if (data.isPastDue) score -= 15;

  const hasIncrease = data.totalAmount > data.previousBillAmount;
  if (hasIncrease && data.previousBillAmount > 0) {
    const pctInc = ((data.totalAmount - data.previousBillAmount) / data.previousBillAmount) * 100;
    score -= Math.min(20, Math.round(pctInc / 2));
  }

  if (data.unitsConsumed > 300) {
    score -= Math.min(20, Math.round((data.unitsConsumed - 300) / 10));
  }

  const warnings = data.charges?.filter(c => c.status === 'WARNING' || c.status === 'OVERDUE') || [];
  score -= (warnings.length * 10);

  score = Math.max(0, Math.min(100, score));

  // Grade
  let grade = 'A';
  let color = 'var(--green)'; // green
  let statusText = 'Excellent';
  if (score < 50) { grade = 'F'; color = 'var(--red)'; statusText = 'Poor'; }
  else if (score < 70) { grade = 'C'; color = 'var(--amber)'; statusText = 'Needs Attention'; }
  else if (score < 85) { grade = 'B'; color = 'var(--blue)'; statusText = 'Good'; }

  return (
    <div className="health-score-card">
      <div className="health-score-header">
        <h4 className="health-score-title">Bill Health Score</h4>
        <span className="health-score-status" style={{ color }}>{statusText}</span>
      </div>
      <div className="health-score-content">
        <div className="health-meter-wrap">
          <div className="health-meter" style={{ background: `conic-gradient(${color} ${score}%, var(--border) ${score}%)` }}>
            <div className="health-meter-inner">
              <span className="health-grade" style={{ color: 'var(--text-dark)' }}>{grade}</span>
              <span className="health-score-val">{score}/100</span>
            </div>
          </div>
        </div>
        <div className="health-score-factors">
          <ul className="health-factor-list">
            <li className={data.isPastDue ? 'negative' : 'positive'}>
              <span className="factor-icon">{data.isPastDue ? '❌' : '✅'}</span>
              <span>Payment status</span>
            </li>
            <li className={hasIncrease ? 'negative' : 'positive'}>
              <span className="factor-icon">{hasIncrease ? '⚠️' : '✅'}</span>
              <span>Usage vs Last Month</span>
            </li>
            <li className={warnings.length > 0 ? 'negative' : 'positive'}>
              <span className="factor-icon">{warnings.length > 0 ? '⚠️' : '✅'}</span>
              <span>{warnings.length} Surcharges/Warnings</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ═══════ Solar Card ═══════ */
function SolarCard({ nm, insights }) {
  if (!nm) return null;
  const insightStyle = { warning: 'solar-insight-warn', tip: 'solar-insight-tip', info: 'solar-insight-info' };
  const insightIcon = { warning: '⚠️', tip: '💡', info: 'ℹ️' };

  // Robust value formatter
  const val = (v, isRate = false) => {
    if (v === undefined || v === null || v === "") return '—';
    const num = Number(v);
    if (isNaN(num)) return v;
    if (isRate) return num.toFixed(3);
    return num.toLocaleString();
  };

  // Calculate energy flow ratio
  const totalFlow = (nm.unitsExported || 0) + (nm.unitsImported || 0);
  const exportPct = totalFlow > 0 ? Math.round(((nm.unitsExported || 0) / totalFlow) * 100) : 50;

  // Quarter settlement progress
  const qMonth = nm.monthInQuarter || 1;

  return (
    <div className="section">
      <h3 className="section-title">🌞 Your Solar Performance Metrics</h3>
      <div className="solar-card">

        {/* Visual Energy Flow Bar */}
        {totalFlow > 0 && (
          <div className="viz-container">
            <div className="viz-header">
              <span style={{ color: 'var(--green)' }}>Exported ({exportPct}%)</span>
              <span style={{ color: 'var(--red)' }}>Imported ({100 - exportPct}%)</span>
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

        {/* Detailed Readings Table */}
        {(nm.importOffPeak !== undefined || nm.importPeak !== undefined) && (
          <div className="solar-tariff-section">
            <h4 className="viz-title">Detailed Reading Breakdown</h4>
            <table className="solar-tariff-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Off-Peak</th>
                  <th>Peak</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">Import (kWh)</td>
                  <td className="val-offpeak">{val(nm.importOffPeak)}</td>
                  <td className="val-peak">{val(nm.importPeak)}</td>
                </tr>
                <tr>
                  <td className="row-label">Export (kWh)</td>
                  <td className="val-offpeak">{val(nm.exportOffPeak)}</td>
                  <td className="val-peak">{val(nm.exportPeak)}</td>
                </tr>
                <tr>
                  <td className="row-label">Net (kWh)</td>
                  <td className="val-offpeak">{val(nm.netOffPeak)}</td>
                  <td className="val-peak">{val(nm.netPeak)}</td>
                </tr>
                {(nm.gopTariffOffPeak !== undefined || nm.gopTariffPeak !== undefined) && (
                  <tr>
                    <td className="row-label">GOP Tariff (Rs)</td>
                    <td className="val-rate">{val(nm.gopTariffOffPeak, true)}</td>
                    <td className="val-rate">{val(nm.gopTariffPeak, true)}</td>
                  </tr>
                )}
              </tbody>
            </table>
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

function ComparisonDashboard({ data, onReset }) {
  const [activeTab, setActiveTab] = useState('overview');
  if (!data) return null;
  const { billA, billB, majorChanges, verdict, solarAnalysis } = data;

  const diff = (billB?.totalAmount || 0) - (billA?.totalAmount || 0);
  const diffPct = billA?.totalAmount > 0 ? Math.round((diff / billA.totalAmount) * 100) : 0;
  const isIncrease = diff > 0;

  // Build charge comparison data for chart
  const chargeMap = {};
  (billA?.charges || []).forEach(c => { chargeMap[c.name] = { a: c.amount || 0, b: 0, statusA: c.status }; });
  (billB?.charges || []).forEach(c => {
    if (chargeMap[c.name]) chargeMap[c.name].b = c.amount || 0;
    else chargeMap[c.name] = { a: 0, b: c.amount || 0, statusB: c.status };
  });
  const chargeRows = Object.entries(chargeMap).filter(([, v]) => v.a > 0 || v.b > 0);
  const maxCharge = Math.max(...chargeRows.map(([, v]) => Math.max(v.a, v.b)), 1);

  const solar = solarAnalysis || {};
  const hasMixedSolar = solar.mixedSolarSituation;
  const solarRec = solar.solarRecommendation;
  const nonSolarBillLabel = solar.nonSolarBill === 'A' ? billA?.month || 'Bill A' : billB?.month || 'Bill B';

  const tabs = ['overview', 'charges', ...(hasMixedSolar ? ['solar'] : [])];

  return (
    <div className="comparison-dashboard">
      {/* Verdict banner */}
      <div className={`cmp-verdict-bar ${isIncrease ? 'increase' : 'decrease'}`}>
        <span className="cmp-verdict-icon">{isIncrease ? '📈' : '📉'}</span>
        <div>
          <div className="cmp-verdict-delta">
            {isIncrease ? '+' : ''}Rs. {Math.abs(diff).toLocaleString()}
            <span className="cmp-verdict-pct"> ({isIncrease ? '+' : ''}{diffPct}%)</span>
          </div>
          <p className="cmp-verdict-text">{verdict}</p>
        </div>
      </div>

      {/* Mixed solar alert */}
      {hasMixedSolar && (
        <div className="cmp-solar-alert">
          <span className="cmp-solar-alert-icon">☀️</span>
          <div>
            <strong>One bill has solar, one doesn't</strong>
            <span> — See the Solar tab for a personalised recommendation for {nonSolarBillLabel}.</span>
          </div>
          <button className="cmp-solar-alert-btn" onClick={() => setActiveTab('solar')}>View →</button>
        </div>
      )}

      {/* Tabs */}
      <div className="cmp-tabs">
        {tabs.map(t => (
          <button key={t} className={`cmp-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'overview' ? '📊 Overview' : t === 'charges' ? '📋 Charges' : '☀️ Solar'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="cmp-section">
          {/* Side-by-side bill cards */}
          <div className="cmp-bill-pair">
            {[{ bill: billA, label: 'Bill A' }, { bill: billB, label: 'Bill B' }].map(({ bill, label }) => (
              <div key={label} className="cmp-bill-card">
                <div className="cmp-bill-label">{label}</div>
                <div className="cmp-bill-month">{bill?.month || '—'}</div>
                {bill?.billType && <div className="cmp-bill-type">{bill.billType}</div>}
                {bill?.isNetMetering && <div className="cmp-solar-badge">☀️ Solar</div>}
                <div className="cmp-bill-amount">Rs. {(bill?.totalAmount || 0).toLocaleString()}</div>
                <div className="cmp-bill-meta">
                  <span>{bill?.unitsConsumed || 0} {bill?.unitLabel || 'kWh'}</span>
                  {bill?.dueDate && <span>Due {bill.dueDate}</span>}
                </div>
                {bill?.isPastDue && <div className="cmp-overdue">⚠️ Past due</div>}
              </div>
            ))}
          </div>

          {/* Visual amount comparison bar */}
          <div className="cmp-amount-bar-section">
            <h4 className="cmp-section-label">Bill Amount Comparison</h4>
            <div className="cmp-amount-bars">
              {[{ bill: billA, label: 'Bill A' }, { bill: billB, label: 'Bill B' }].map(({ bill, label }) => {
                const maxAmt = Math.max(billA?.totalAmount || 0, billB?.totalAmount || 0, 1);
                const pct = Math.max(6, Math.round(((bill?.totalAmount || 0) / maxAmt) * 100));
                const isHigher = (bill?.totalAmount || 0) === Math.max(billA?.totalAmount || 0, billB?.totalAmount || 0);
                return (
                  <div key={label} className="cmp-bar-row">
                    <span className="cmp-bar-label">{label} · {bill?.month}</span>
                    <div className="cmp-bar-track">
                      <div className={`cmp-bar-fill ${isHigher ? 'higher' : 'lower'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="cmp-bar-val">Rs. {(bill?.totalAmount || 0).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Usage comparison */}
          {(billA?.unitsConsumed > 0 || billB?.unitsConsumed > 0) && (
            <div className="cmp-amount-bar-section">
              <h4 className="cmp-section-label">Units Consumed</h4>
              <div className="cmp-amount-bars">
                {[{ bill: billA, label: 'Bill A' }, { bill: billB, label: 'Bill B' }].map(({ bill, label }) => {
                  const maxU = Math.max(Math.abs(billA?.unitsConsumed || 0), Math.abs(billB?.unitsConsumed || 0), 1);
                  const pct = Math.max(6, Math.round((Math.abs(bill?.unitsConsumed || 0) / maxU) * 100));
                  return (
                    <div key={label} className="cmp-bar-row">
                      <span className="cmp-bar-label">{label} · {bill?.month}</span>
                      <div className="cmp-bar-track">
                        <div className="cmp-bar-fill units" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="cmp-bar-val">{(bill?.unitsConsumed || 0).toLocaleString()} {bill?.unitLabel || 'kWh'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cost per unit comparison */}
          {((billA?.totalAmount > 0 && billA?.unitsConsumed > 0) || (billB?.totalAmount > 0 && billB?.unitsConsumed > 0)) && (
            <div className="cmp-amount-bar-section">
              <h4 className="cmp-section-label">Cost per Unit</h4>
              <div className="cmp-amount-bars">
                {[{ bill: billA, label: 'Bill A' }, { bill: billB, label: 'Bill B' }].map(({ bill, label }) => {
                  const getCpu = (b) => {
                    if (b?.netMetering?.gopTariffOffPeak) return b.netMetering.gopTariffOffPeak;
                    if (b?.costPerUnit) return b.costPerUnit;
                    return (b?.unitsConsumed > 0 ? b.totalAmount / b.unitsConsumed : 0);
                  };
                  const cpuA = getCpu(billA);
                  const cpuB = getCpu(billB);
                  const cpu = getCpu(bill);
                  const maxCpu = Math.max(cpuA, cpuB, 1);
                  const pct = Math.max(6, Math.round((cpu / maxCpu) * 100));
                  return (
                    <div key={label} className="cmp-bar-row">
                      <span className="cmp-bar-label">{label} · {bill?.month}</span>
                      <div className="cmp-bar-track">
                        <div className="cmp-bar-fill" style={{ width: `${pct}%`, background: 'var(--amber)' }} />
                      </div>
                      <span className="cmp-bar-val">Rs. {cpu.toFixed(2)} / {bill?.unitLabel || 'kWh'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Solar side-by-side meters */}
          {(billA?.isNetMetering || billB?.isNetMetering) && (
            <div className="cmp-solar-meters">
              <h4 className="cmp-section-label">⚡ Solar Performance</h4>
              <div className="cmp-bill-pair">
                {[{ bill: billA, label: 'Bill A' }, { bill: billB, label: 'Bill B' }].map(({ bill, label }) => (
                  <div key={label} className="cmp-solar-mini">
                    <div className="cmp-solar-mini-title">{label} {bill?.isNetMetering ? '☀️' : '🔌'}</div>
                    {bill?.isNetMetering && bill?.netMetering ? (
                      <>
                        <div className="cmp-solar-row"><span>Exported</span><span className="green">{bill.netMetering.unitsExported} kWh</span></div>
                        <div className="cmp-solar-row"><span>Imported</span><span className="red">{bill.netMetering.unitsImported} kWh</span></div>
                        <div className="cmp-solar-row"><span>Net</span><span>{bill.netMetering.netPosition} kWh</span></div>
                        <div className="cmp-solar-row"><span>Credit</span><span>Rs. {(bill.netMetering.creditValue || 0).toLocaleString()}</span></div>
                      </>
                    ) : (
                      <div className="cmp-solar-none">No solar data</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHARGES TAB ── */}
      {activeTab === 'charges' && (
        <div className="cmp-section">
          {/* Major changes list */}
          {majorChanges?.length > 0 && (
            <div className="cmp-major-changes">
              <h4 className="cmp-section-label">Major Changes</h4>
              {majorChanges.map((c, i) => {
                const up = c.diffAmount > 0;
                return (
                  <div key={i} className="cmp-change-row">
                    <div className="cmp-change-left">
                      <div className="cmp-change-name">{c.chargeName}</div>
                      <div className="cmp-change-desc">{c.explanation}</div>
                      {(c.amountA != null || c.amountB != null) && (
                        <div className="cmp-change-detail">
                          Bill A: <strong>Rs. {(c.amountA || 0).toLocaleString()}</strong>
                          &nbsp;→ Bill B: <strong>Rs. {(c.amountB || 0).toLocaleString()}</strong>
                        </div>
                      )}
                    </div>
                    <div className={`cmp-change-diff ${up ? 'red' : 'green'}`}>
                      {up ? '+' : ''}Rs. {Math.abs(c.diffAmount).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Side-by-side charge bar chart */}
          {chargeRows.length > 0 && (
            <div className="cmp-charge-chart">
              <h4 className="cmp-section-label">All Charges — Side by Side</h4>
              {chargeRows.map(([name, vals]) => (
                <div key={name} className="cmp-charge-row">
                  <div className="cmp-charge-name">{name}</div>
                  <div className="cmp-charge-bars">
                    <div className="cmp-charge-bar-wrap a">
                      <div className="cmp-charge-bar bill-a" style={{ width: `${Math.max(4, (vals.a / maxCharge) * 100)}%` }} />
                      <span className="cmp-charge-bar-val">Rs. {vals.a.toLocaleString()}</span>
                    </div>
                    <div className="cmp-charge-bar-wrap b">
                      <div className="cmp-charge-bar bill-b" style={{ width: `${Math.max(4, (vals.b / maxCharge) * 100)}%` }} />
                      <span className="cmp-charge-bar-val">Rs. {vals.b.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="cmp-charge-legend">
                <span className="cmp-legend-dot a" /> Bill A &nbsp;&nbsp;
                <span className="cmp-legend-dot b" /> Bill B
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SOLAR TAB ── */}
      {activeTab === 'solar' && (
        <div className="cmp-section">
          {/* Solar status comparison */}
          <div className="cmp-solar-status-grid">
            {[{ bill: billA, label: 'Bill A', hasSolar: solar.billAHasSolar }, { bill: billB, label: 'Bill B', hasSolar: solar.billBHasSolar }].map(({ bill, label, hasSolar }) => (
              <div key={label} className={`cmp-solar-status-card ${hasSolar ? 'has-solar' : 'no-solar'}`}>
                <div className="cmp-solar-status-icon">{hasSolar ? '☀️' : '🔌'}</div>
                <div className="cmp-solar-status-name">{label} — {bill?.month}</div>
                <div className="cmp-solar-status-tag">{hasSolar ? 'Solar / Net Metering' : 'Grid Only'}</div>
                {hasSolar && bill?.netMetering && (
                  <div className="cmp-solar-mini-stats">
                    <div>Exported: <b>{bill.netMetering.unitsExported} kWh</b></div>
                    <div>Imported: <b>{bill.netMetering.unitsImported} kWh</b></div>
                  </div>
                )}
                {!hasSolar && (
                  <div className="cmp-no-solar-hint">⬇️ Could save big with solar</div>
                )}
              </div>
            ))}
          </div>

          {/* Solar recommendation */}
          {solarRec && (
            <div className="cmp-solar-rec-card">
              <div className="cmp-solar-rec-header">
                <span className="cmp-solar-rec-emoji">☀️</span>
                <div>
                  <h3 className="cmp-solar-rec-headline">{solarRec.headline}</h3>
                  <div className="cmp-solar-rec-sub">Recommendation for {nonSolarBillLabel}</div>
                </div>
              </div>
              <p className="cmp-solar-rec-body">{solarRec.body}</p>

              <div className="cmp-solar-metrics">
                <div className="cmp-solar-metric">
                  <div className="cmp-solar-metric-val">{solarRec.estimatedSystemKw} kW</div>
                  <div className="cmp-solar-metric-label">Recommended System</div>
                </div>
                <div className="cmp-solar-metric">
                  <div className="cmp-solar-metric-val">{solarRec.estimatedMonthlySavings}</div>
                  <div className="cmp-solar-metric-label">Est. Monthly Savings</div>
                </div>
                <div className="cmp-solar-metric">
                  <div className="cmp-solar-metric-val">{solarRec.paybackYears} yrs</div>
                  <div className="cmp-solar-metric-label">Payback Period</div>
                </div>
              </div>

              {solarRec.topReasons?.length > 0 && (
                <ul className="cmp-solar-reasons">
                  {solarRec.topReasons.map((r, i) => (
                    <li key={i}><span className="cmp-solar-reason-check">✓</span> {r}</li>
                  ))}
                </ul>
              )}

              <div className="cmp-solar-rec-footer">
                See the <strong>Solar</strong> bill above — their monthly cost is up to 70% lower using solar.
              </div>
            </div>
          )}

          {!hasMixedSolar && (
            <div className="cmp-solar-same">
              {solar.billAHasSolar && solar.billBHasSolar
                ? '✅ Both bills have solar — you are already maximizing savings!'
                : '⚡ Neither bill has solar. Consider solar to significantly reduce future bills.'}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="cmp-footer">
        <button className="btn-secondary" onClick={onReset}>
          <RefreshIcon /> Compare other bills
        </button>
      </div>
    </div>
  );
}

/* ═══════ Intersection Observer Hook ═══════ */
function useIntersectionObserver(dependency) {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    const timeout = setTimeout(() => {
      const elements = document.querySelectorAll('.animate-on-scroll:not(.animate-in)');
      elements.forEach(el => observer.observe(el));
    }, 100);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [dependency]);
}

/* ═══════ MAIN APP ═══════ */
export default function App() {
  const [screen, setScreen] = useState('landing'); // landing | loading | dashboard | comparison | official-docs
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [billData, setBillData] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [dragOver2, setDragOver2] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // -- Comparison States --
  const [compareMode, setCompareMode] = useState(false);
  const [file2, setFile2] = useState(null);
  const [preview2, setPreview2] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const fileInput2Ref = useRef(null);

  // -- Demo Mode interceptors will use isDemo flag directly --

  // Loading message rotation
  useEffect(() => {
    if (screen !== 'loading') return;
    const interval = setInterval(() => setLoadingMsg(m => (m + 1) % LOADING_MSGS.length), 2000);
    return () => clearInterval(interval);
  }, [screen]);

  useIntersectionObserver(screen);

  // Listen for OfficialDocs close event
  useEffect(() => {
    const handler = () => setScreen('landing');
    window.addEventListener('official-docs-close', handler);
    return () => window.removeEventListener('official-docs-close', handler);
  }, []);

  const handleFile = useCallback((f, target = 'file1') => {
    if (!f) return;
    const valid = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!valid.includes(f.type)) { setError('Please upload a JPG, PNG, or PDF file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('File must be under 10MB.'); return; }
    setError(null);
    setIsDemo(false);

    if (target === 'file1') {
      setFile(f);
      if (f.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(f));
      } else {
        setPreview(null);
      }
    } else {
      setFile2(f);
      if (f.type.startsWith('image/')) {
        setPreview2(URL.createObjectURL(f));
      } else {
        setPreview2(null);
      }
    }
  }, []);

  const handleDrop = useCallback((e, target = 'file1') => {
    e.preventDefault();
    if (target === 'file1') setDragOver(false);
    if (target === 'file2') setDragOver2(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f, target);
  }, [handleFile]);

  const handleAnalyze = async () => {
    setError(null);
    setScreen('loading');
    setLoadingMsg(0);

    if (isDemo) {
      setTimeout(() => {
        setBillData(JSON.parse(JSON.stringify(DEMO_BILL_A)));
        setScreen('dashboard');
        setActiveTab('overview');
      }, 1500);
      return;
    }

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

  const handleCompare = async () => {
    setError(null);
    setScreen('loading');
    setLoadingMsg(0);

    if (isDemo) {
      setTimeout(() => {
        setCompareData(DEMO_COMPARE_DATA);
        setScreen('comparison');
      }, 1500);
      return;
    }

    try {
      const data = await compareBills(file, file2);
      setCompareData(data);
      setScreen('comparison');
    } catch (err) {
      console.error(err);
      setError('Failed to compare bills. Please try again with clearer images.');
      setScreen('landing');
    }
  };

  const reset = () => {
    setScreen('landing');
    setFile(null);
    setPreview(null);
    setFile2(null);
    setPreview2(null);
    setBillData(null);
    setCompareData(null);
    setError(null);
    setCompareMode(false);
    setIsDemo(false);
  };

  const navigateToSection = (id) => {
    if (screen !== 'landing' || file) {
      reset();
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container header-inner">
          <div className="logo" onClick={reset}>
            <img src="/logo.webp" alt="Bill-y Logo" className="logo-img" />
            <span className="logo-text">Bill-y</span>
          </div>
          <nav className="header-nav">
            <a href="#features" onClick={(e) => { e.preventDefault(); navigateToSection('features'); }}>Features</a>
            <a href="#compare" onClick={(e) => { e.preventDefault(); navigateToSection('compare'); }}>Compare</a>
            <a href="#docs" onClick={(e) => { e.preventDefault(); setScreen('official-docs'); }}>Knowledge Base</a>
          </nav>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              className={`demo-switch-container ${isDemo ? 'active' : ''}`}
              onClick={() => setIsDemo(!isDemo)}
              title="Toggle Global Demo Mode"
            >
              <span className="demo-label">Demo Mode</span>
              <div className="demo-switch">
                <div className="demo-switch-handle"></div>
              </div>
            </div>
            <button
              className="theme-toggle"
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}
            >
              {theme === 'light' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              )}
            </button>
            <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => {
              if (isDemo) {
                setFile({ name: 'demo-bill-A.jpg', size: 145820, type: 'image/jpeg' });
                setPreview('/demo-bill.jpg');
              } else {
                fileInputRef.current?.click();
              }
            }}>
              Scan a bill
            </button>
          </div>
        </div>
      </header>

      {/* LANDING SCREEN */}
      {screen === 'landing' && (
        <main className="landing">
          {!file ? (
            <>
              <div className="hero-container">
                <div className="hero-content">
                  <div className="hero-badge animate-entrance stagger-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Stop overpaying for utilities.
                  </div>

                  <h1 className="hero-title animate-entrance stagger-2">
                    Decode your bill.<br />Lower your costs.
                  </h1>

                  <p className="hero-subtitle animate-entrance stagger-3">
                    Upload your LESCO, SNGPL, or WASA bill. We'll explain the hidden charges, verify your tariff, and find ways to save.
                  </p>

                  <div className="hero-actions animate-entrance stagger-4">
                    <button className="btn-primary hover-spring" onClick={() => {
                      setCompareMode(false);
                      if (isDemo) {
                        setFile({ name: 'demo-bill-A.jpg', size: 145820, type: 'image/jpeg' });
                        setPreview('/demo-bill.jpg');
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}>
                      Scan your bill
                    </button>
                    <button className={`btn-secondary hover-spring ${compareMode ? 'active' : ''}`} onClick={() => {
                      setCompareMode(true);
                      if (isDemo) {
                        setFile({ name: 'demo-bill-A.jpg', size: 145820, type: 'image/jpeg' });
                        setPreview('/demo-bill.jpg');
                        setFile2({ name: 'demo-bill-B.jpg', size: 182400, type: 'image/jpeg' });
                        setPreview2('/demo-bill.jpg');
                      }
                    }}>
                      Compare two bills
                    </button>
                    <button className="btn-nepra hover-spring" onClick={() => setScreen('official-docs')}>
                      Search knowledge base
                    </button>
                  </div>

                  <div className="hero-meta animate-entrance stagger-4" style={{ marginTop: '1.5rem' }}>
                    No signup required • Takes 5 seconds • 100% free
                  </div>

                  <div className="trusted-by animate-entrance stagger-4" style={{ marginTop: '3rem' }}>
                    <span className="trusted-title">Supports all major Pakistani utility providers</span>
                    <div className="trusted-logos">
                      <span className="t-logo hover-spring">LESCO <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
                      <span className="t-logo hover-spring">SNGPL <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
                      <span className="t-logo hover-spring">WASA <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>
                    </div>
                  </div>
                </div>

                <div className="hero-visual animate-entrance stagger-2">
                  {compareMode ? (
                    <div className="compare-upload-grid">
                      <div
                        className={`upload-box ${dragOver ? 'drag-over' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => handleDrop(e, 'file1')}
                        onClick={() => {
                          if (!file) {
                            if (isDemo) {
                              setFile({ name: 'demo-bill-A.jpg', size: 145820, type: 'image/jpeg' });
                              setPreview('/demo-bill.jpg');
                            } else {
                              fileInputRef.current?.click();
                            }
                          }
                        }}
                      >
                        {preview ? <img src={preview} alt="Bill 1" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}><span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>1</span>First bill (Baseline)</div>}
                      </div>
                      <div
                        className={`upload-box ${dragOver2 ? 'drag-over' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOver2(true); }}
                        onDragLeave={() => setDragOver2(false)}
                        onDrop={e => handleDrop(e, 'file2')}
                        onClick={() => {
                          if (!file2) {
                            if (isDemo) {
                              setFile2({ name: 'demo-bill-B.jpg', size: 182400, type: 'image/jpeg' });
                              setPreview2('/demo-bill.jpg');
                            } else {
                              fileInput2Ref.current?.click();
                            }
                          }
                        }}
                      >
                        {preview2 ? <img src={preview2} alt="Bill 2" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}><span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>2</span>Second bill (Current)</div>}
                      </div>
                    </div>
                  ) : (
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
                        <button
                          className={`abstract-node animate-pulse-glow hover-spring ${dragOver ? 'drag-over' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={e => handleDrop(e, 'file1')}
                          onClick={() => !file && fileInputRef.current?.click()}
                          aria-label="Upload Bill"
                        >
                          <div className="node-logo" style={{ fontSize: '32px', fontWeight: '600', fontFamily: 'var(--font-sans)', color: 'var(--text-main)' }}>
                            Δ
                          </div>
                        </button>
                      </div>

                      {/* Connector 2 */}
                      <div className="diagram-connector">
                        <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                          <path d="M0 12 H 28" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                          <polygon points="24,8 32,12 24,16" fill="currentColor" />
                        </svg>
                      </div>

                      {/* Right Value Block (Premium Insights Card) */}
                      <div className="hero-code-block insight-card">
                        {/* Warning Header */}
                        <div className="insight-warning-header">
                          <AlertIcon />
                          <span>You are overpaying</span>
                        </div>

                        <div className="insight-body">
                          <div className="insight-label">Total Bill</div>
                          <div className="insight-value">
                            Rs. <AnimatedNumber target={14500} />
                          </div>
                          <div className="insight-diff text-red">
                            <svg className="pulse-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                            Rs. 2,300 higher than usual
                          </div>

                          <div className="insight-item">
                            <XIcon />
                            <span>High Fuel Adjustment detected</span>
                          </div>

                          <div className="insight-action">
                            <LightbulbIcon />
                            <span>You can save Rs. 800 next month</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <div className="error-banner" style={{ position: 'absolute', bottom: '-80px', width: '100%' }}>{error}</div>}
                </div>

                <div className="scroll-indicator" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                  <span>Explore Features</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
                  </svg>
                </div>
              </div>

              {/* FEATURE SECTIONS */}
              <div id="features" className="feature-sections-container">
                {/* Feature 1 */}
                <section className="feature-showcase">
                  <div className="feature-showcase-text animate-on-scroll fade-up">
                    <div className="feature-badge" style={{ color: 'var(--blue)', background: 'var(--blue-light)' }}>Clear Breakdown</div>
                    <h2>See exactly what you're paying for</h2>
                    <p>Utility bills are filled with jargon. We translate FPA, surcharges, and unit tiers into plain English so you know exactly where your money goes.</p>
                    <ul className="feature-list">
                      <li><span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center' }}><CheckIcon /></span> Automatic tariff verification</li>
                      <li><span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center' }}><CheckIcon /></span> Hidden tax identification</li>
                      <li><span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center' }}><CheckIcon /></span> Plain English explanations</li>
                    </ul>
                  </div>
                  <div className="feature-showcase-visual animate-on-scroll fade-left delay-200">
                    <div className="mockup-card hover-lift">
                      <div className="mockup-header">
                        <span className="mockup-dot"></span>
                        <span className="mockup-dot"></span>
                        <span className="mockup-dot"></span>
                      </div>
                      <div className="mockup-body">
                        <div className="mockup-item">
                          <span className="mockup-icon" style={{ color: 'var(--amber)' }}><ZapIcon /></span>
                          <div className="mockup-text">
                            <h4>Fuel Price Adjustment</h4>
                            <p>Rs. 2,450 charged this month due to nationwide fuel costs.</p>
                          </div>
                        </div>
                        <div className="mockup-item warning">
                          <span className="mockup-icon" style={{ color: 'var(--red)' }}><AlertIcon /></span>
                          <div className="mockup-text">
                            <h4>Slab Change Detected</h4>
                            <p>You crossed 300 units. Your per-unit cost increased by 40%.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Feature 2 */}
                <section id="compare" className="feature-showcase reverse">
                  <div className="feature-showcase-text animate-on-scroll fade-up">
                    <div className="feature-badge" style={{ color: 'var(--amber)', background: 'var(--amber-light)' }}>Smart Comparison</div>
                    <h2>Find out why your bill spiked</h2>
                    <p>Stop guessing why your bill jumped this month. Upload your current and previous bills to instantly see which exact charges, taxes, or unit rates caused the increase.</p>
                    <button className="btn-secondary" style={{ marginTop: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }} onClick={() => { setCompareMode(true); window.scrollTo({ top: 0, behavior: 'smooth' }); fileInput2Ref.current?.click(); }}>Compare your bills</button>
                  </div>
                  <div className="feature-showcase-visual animate-on-scroll fade-right delay-200">
                    <div className="mockup-diff-table hover-lift">
                      <div className="diff-row header"><span>Charge</span><span>Change</span></div>
                      <div className="diff-row"><span>Energy Cost</span><span className="text-red">+ Rs. 1,200</span></div>
                      <div className="diff-row"><span>Fuel Adj.</span><span className="text-green">- Rs. 400</span></div>
                      <div className="diff-row"><span>Gov Taxes</span><span className="text-red">+ Rs. 350</span></div>
                      <div className="diff-row total"><span>Total Difference</span><span className="text-red">+ Rs. 1,150</span></div>
                    </div>
                  </div>
                </section>

                {/* Feature 3 */}
                <section className="feature-showcase">
                  <div className="feature-showcase-text animate-on-scroll fade-up">
                    <div className="feature-badge" style={{ color: 'var(--green)', background: 'var(--green-light)' }}>Knowledge Base</div>
                    <h2>Official rules, simplified</h2>
                    <p>Don't fall for billing mistakes. Access NEPRA guidelines, solar net-metering regulations, and tax exemptions through an AI-powered search that answers your specific questions instantly.</p>
                    <button className="btn-secondary" style={{ marginTop: '1rem', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }} onClick={() => setScreen('official-docs')}>Search the Docs</button>
                  </div>
                  <div className="feature-showcase-visual animate-on-scroll fade-left delay-200">
                    <div className="mockup-search hover-lift">
                      <div className="mockup-search-bar">What is the tax rate for non-filers?</div>
                      <div className="mockup-search-result">
                        <strong>Section 235A:</strong> Non-filers are subject to a 7.5% advance tax on electricity bills exceeding Rs. 25,000...
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="file-ready-sequence">
              <div className="file-ready-steps">
                <div className="step-item done"><div className="step-dot"></div><span>{compareMode ? (file && file2 ? 'Bills uploaded' : 'Bill uploaded') : 'Bill uploaded'}</span></div>
                <div className="step-line"></div>
                <div className={`step-item ${compareMode && !file2 ? '' : 'active'}`}><div className="step-dot"></div><span>Ready to analyze</span></div>
                <div className="step-line dim"></div>
                <div className="step-item"><div className="step-dot"></div><span>Get insights</span></div>
              </div>
              <div className="file-ready-card">
                {compareMode ? (
                  <div className="compare-file-pair">
                    {/* Bill 1 - already uploaded */}
                    <div className="file-preview" style={{ marginTop: 0 }}>
                      {preview ? <img src={preview} alt="Bill 1" className="file-preview-thumb" /> : <div className="file-preview-thumb pdf-thumb">PDF</div>}
                      <div className="file-preview-info">
                        <span className="file-preview-name">{file.name}</span>
                        <span className="file-preview-size">{(file.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); if (!file2) setCompareMode(false); }}><XIcon /></button>
                    </div>

                    {/* Bill 2 - upload slot or uploaded */}
                    {file2 ? (
                      <div className="file-preview" style={{ marginTop: 0 }}>
                        {preview2 ? <img src={preview2} alt="Bill 2" className="file-preview-thumb" /> : <div className="file-preview-thumb pdf-thumb">PDF</div>}
                        <div className="file-preview-info">
                          <span className="file-preview-name">{file2.name}</span>
                          <span className="file-preview-size">{(file2.size / 1024).toFixed(0)} KB</span>
                        </div>
                        <button className="file-remove" onClick={(e) => { e.stopPropagation(); setFile2(null); setPreview2(null); }}><XIcon /></button>
                      </div>
                    ) : (
                      <button className="second-bill-slot" onClick={() => fileInput2Ref.current?.click()}>
                        <span className="second-bill-plus">+</span>
                        <span className="second-bill-label">Add 2nd bill</span>
                      </button>
                    )}
                  </div>
                ) : (
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
                )}

                {compareMode ? (
                  <button className="btn-primary file-ready-btn" onClick={handleCompare} disabled={!file || !file2}>
                    Compare My Bills
                  </button>
                ) : (
                  <button className="btn-primary file-ready-btn" onClick={handleAnalyze} id="analyze-btn">
                    Analyze My Bill
                  </button>
                )}
                <p className="file-ready-hint">Takes ~5 seconds • AI-powered analysis</p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="upload-input"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={e => handleFile(e.target.files?.[0], 'file1')}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: 0, height: 0, overflow: 'hidden' }}
          />
          <input
            ref={fileInput2Ref}
            type="file"
            className="upload-input"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={e => handleFile(e.target.files?.[0], 'file2')}
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
            {/* Demo Banner */}
            {isDemo && (
              <div className="demo-banner">
                <span className="demo-banner-icon">🎮</span>
                <span className="demo-banner-text">
                  <strong>Demo Mode</strong> — This is sample LESCO bill data.
                </span>
                <button className="demo-banner-cta" onClick={() => { reset(); setTimeout(() => fileInputRef.current?.click(), 100); }}>
                  Upload your real bill →
                </button>
              </div>
            )}

            {/* Critical Alerts */}
            {billData.isNetMetering && billData.netMetering?.expMdi > billData.netMetering?.dgCapacity && (
              <div className="critical-alert">
                <div className="critical-alert-icon">⚠️</div>
                <div className="critical-alert-content">
                  <h4 className="critical-alert-title">Export Limit Exceeded</h4>
                  <p className="critical-alert-text">
                    Your peak export was <strong>{billData.netMetering.expMdi} kW</strong> but your approved limit is <strong>{billData.netMetering.dgCapacity} kW</strong>. Lower your inverter export setting to avoid potential penalties.
                  </p>
                </div>
              </div>
            )}

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
              <div className="dash-kpi-card">
                <span className="dash-kpi-label">AI Confidence</span>
                <span className={`dash-kpi-value ${billData.confidenceScore >= 90 ? 'success' : billData.confidenceScore >= 70 ? 'warning' : 'danger'}`}>
                  {billData.confidenceScore || 0}%
                  <span className="confidence-dot"></span>
                </span>
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
                  {(() => {
                    const warnings = billData.charges?.filter(c => c.status === 'WARNING') || [];
                    const hasIncrease = billData.comparisonText?.toLowerCase().includes('more');
                    if (warnings.length > 0 || hasIncrease) {
                      return (
                        <div className="verdict-bar warning" style={{ marginBottom: 'var(--space-lg)' }}>
                          <span>🚨</span>
                          <span>
                            {hasIncrease ? billData.comparisonText + '. ' : ''}
                            {warnings.length > 0 ? `${warnings.length} suspicious charge${warnings.length > 1 ? 's' : ''} found.` : ''}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="overview-top-grid">
                    <SummaryCard data={billData} />
                    <BillHealthScore data={billData} />
                  </div>
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

      {/* COMPARISON DASHBOARD */}
      {screen === 'comparison' && (
        <main className="dashboard">
          <ComparisonDashboard data={compareData} onReset={reset} />
        </main>
      )}

      {/* OFFICIAL DOCS */}
      {screen === 'official-docs' && <KnowledgeBase isDemo={isDemo} />}

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-grid">
              <div className="footer-col">
                <h4>Bill-y</h4>
                <ul>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); reset(); window.scrollTo({top: 0, behavior: 'smooth'}); }}>Home</a></li>
                  <li><a href="#features" onClick={(e) => { e.preventDefault(); navigateToSection('features'); }}>Features</a></li>
                  <li><a href="#compare" onClick={(e) => { e.preventDefault(); navigateToSection('compare'); }}>Compare Bills</a></li>
                  <li><a href="#docs" onClick={(e) => { e.preventDefault(); setScreen('official-docs'); }}>Knowledge Base</a></li>
                </ul>
              </div>
              <div className="footer-col">
                <h4>Utility Providers</h4>
                <ul>
                  <li><a href="#" onClick={(e) => e.preventDefault()}>LESCO (Electric)</a></li>
                  <li><a href="#" onClick={(e) => e.preventDefault()}>SNGPL (Gas)</a></li>
                  <li><a href="#" onClick={(e) => e.preventDefault()}>WASA (Water)</a></li>
                  <li><a href="#" onClick={(e) => e.preventDefault()}>K-Electric (Soon)</a></li>
                </ul>
              </div>
              <div className="footer-col">
                <h4>Open Source</h4>
                <ul>
                  <li><a href="https://github.com/Sinnan1/bill-y" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
                  <li><a href="#" onClick={(e) => e.preventDefault()}>MIT License</a></li>
                </ul>
              </div>
            </div>

            <div className="footer-bottom">
              <div className="footer-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <img src="/logo.webp" alt="Bill-y Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>Bill-y</span>
              </div>
              <div className="footer-credit">
                <span>A project for</span>
                <span className="badge-ai-sekho">AI Sekho 2026</span>
                <span>By Google</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 'var(--space-md)' }}>
                © 2026 Bill-y. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
