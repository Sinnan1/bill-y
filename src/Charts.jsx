import { useState, useMemo } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  ReferenceLine, ReferenceArea, RadialBarChart,
  RadialBar, PolarAngleAxis
} from 'recharts';

/* ═══════ COLORS ═══════ */
const COLORS = {
  green: '#10B981',
  greenLight: '#D1FAE5',
  red: '#EF4444',
  redLight: '#FEE2E2',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  blue: '#3B82F6',
  blueLight: '#DBEAFE',
  textMain: '#111827',
  textMuted: '#6B7280',
  textDim: '#9CA3AF',
  border: '#E5E7EB',
  bgSecondary: '#F9FAFB'
};

const STATUS_COLORS = {
  NORMAL: COLORS.green,
  FIXED: COLORS.textDim,
  GOVERNMENT: COLORS.blue,
  OVERDUE: COLORS.red,
  WARNING: COLORS.amber
};

/* ═══════ Custom Tooltip Styles ═══════ */
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && label !== '' && <div className="chart-tooltip-header">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: entry.color }} />
          <span className="chart-tooltip-label">{entry.name}</span>
          <span className="chart-tooltip-value">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ═══════ 1. Consumption Trend Chart ═══════ */
export function ConsumptionTrendChart({ data }) {
  const { chartData, currentMonthIndex, seasonalBands, hasProjection } = useMemo(() => {
    const history = data.consumptionHistory || [];
    const projection = data.savingsProjection || [];
    if (!history.length) return { chartData: [], currentMonthIndex: -1, seasonalBands: [], hasProjection: false };

    const currentMonth = data.billingMonth;
    const idx = history.findIndex(h => h.month === currentMonth);
    const currentIndex = idx >= 0 ? idx : history.length - 1;

    // Build chart data
    const cData = history.map((h, i) => ({
      ...h,
      index: i,
      isCurrent: i === currentIndex,
      costPerUnit: h.units > 0 ? Math.round((h.amount / h.units) * 100) / 100 : 0
    }));

    // Add projection points
    projection.forEach((p, i) => {
      cData.push({
        month: p.month,
        units: p.projectedUnits,
        amount: p.projectedAmount,
        index: history.length + i,
        isProjection: true,
        costPerUnit: p.projectedUnits > 0 ? Math.round((p.projectedAmount / p.projectedUnits) * 100) / 100 : 0
      });
    });

    // Detect seasonal peaks (summer: May-Aug in Pakistan)
    const bands = [];
    const summerMonths = ['May', 'Jun', 'Jul', 'Aug'];
    let inSummer = false;
    let start = null;
    cData.forEach((d, i) => {
      const mon = d.month?.split(' ')[0];
      const isSummer = summerMonths.some(s => mon?.startsWith(s));
      if (isSummer && !inSummer) { inSummer = true; start = i; }
      if (!isSummer && inSummer) { bands.push({ start, end: i - 1 }); inSummer = false; }
    });
    if (inSummer && start !== null) bands.push({ start, end: cData.length - 1 });

    return { chartData: cData, currentMonthIndex: currentIndex, seasonalBands: bands, hasProjection: projection.length > 0 };
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="section">
        <h3 className="section-title">📈 Consumption Trend</h3>
        <div className="chart-empty">
          <span className="chart-empty-icon">📊</span>
          <p>No 12-month history found on this bill.</p>
          <small>Upload a clearer image or check if your bill includes a usage history table.</small>
        </div>
      </div>
    );
  }

  const avgUnits = Math.round(chartData.filter(d => !d.isProjection).reduce((s, d) => s + d.units, 0) / chartData.filter(d => !d.isProjection).length);
  const maxUnits = Math.max(...chartData.map(d => d.units));

  return (
    <div className="section">
      <h3 className="section-title">📈 Consumption Trend</h3>
      <div className="chart-card">
        <div className="chart-header">
          <div className="chart-metric">
            <span className="chart-metric-label">Avg Monthly</span>
            <span className="chart-metric-value">{avgUnits.toLocaleString()} {data.unitLabel}</span>
          </div>
          <div className="chart-metric">
            <span className="chart-metric-label">Peak</span>
            <span className="chart-metric-value">{maxUnits.toLocaleString()} {data.unitLabel}</span>
          </div>
          {data.estimatedSavings > 0 && (
            <div className="chart-metric highlight">
              <span className="chart-metric-label">Potential Savings</span>
              <span className="chart-metric-value" style={{ color: COLORS.green }}>Rs. {data.estimatedSavings.toLocaleString()}/mo</span>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="unitsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projectionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.1} />
                <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="units"
              tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              label={{ value: data.unitLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: COLORS.textDim } }}
            />
            <YAxis
              yAxisId="amount"
              orientation="right"
              tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`}
              label={{ value: 'Amount', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: COLORS.textDim } }}
            />
            <Tooltip content={<ChartTooltip formatter={(v, name) => {
              if (name === 'Units') return `${v.toLocaleString()} ${data.unitLabel}`;
              if (name === 'Amount') return `Rs. ${v.toLocaleString()}`;
              return v;
            }} />} />

            {/* Seasonal highlight bands */}
            {seasonalBands.map((band, i) => (
              <ReferenceArea
                key={i}
                x1={chartData[band.start]?.month}
                x2={chartData[band.end]?.month}
                fill={COLORS.amber}
                fillOpacity={0.04}
                strokeOpacity={0}
              />
            ))}

            {/* Current month reference line */}
            {currentMonthIndex >= 0 && (
              <ReferenceLine
                x={chartData[currentMonthIndex]?.month}
                stroke={COLORS.textDim}
                strokeDasharray="4 4"
                yAxisId="units"
                label={{ value: 'Current', position: 'top', fill: COLORS.textDim, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              />
            )}

            {/* Units Area */}
            <Area
              yAxisId="units"
              type="monotone"
              dataKey="units"
              name="Units"
              stroke={COLORS.blue}
              strokeWidth={2}
              fill="url(#unitsGradient)"
              dot={props => {
                const { cx, cy, payload } = props;
                if (payload.isCurrent) {
                  return <circle cx={cx} cy={cy} r={5} fill={COLORS.blue} stroke="#fff" strokeWidth={2} />;
                }
                if (payload.isProjection) {
                  return <circle cx={cx} cy={cy} r={4} fill={COLORS.green} stroke="#fff" strokeWidth={2} strokeDasharray="2 2" />;
                }
                return <circle cx={cx} cy={cy} r={3} fill={COLORS.blue} stroke="none" opacity={0.6} />;
              }}
              activeDot={{ r: 6, fill: COLORS.blue, stroke: '#fff', strokeWidth: 2 }}
            />

            {/* Amount Line */}
            <Line
              yAxisId="amount"
              type="monotone"
              dataKey="amount"
              name="Amount"
              stroke={COLORS.textMain}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: COLORS.textMain, stroke: '#fff', strokeWidth: 2 }}
            />

            {/* Projection dashed line connecting current to future */}
            {hasProjection && (
              <Line
                yAxisId="units"
                type="monotone"
                dataKey="units"
                stroke={COLORS.green}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls={false}
                data={chartData.filter(d => d.isProjection || d.isCurrent)}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        <div className="chart-footer">
          {seasonalBands.length > 0 && (
            <div className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ background: COLORS.amber, opacity: 0.3 }} />
              <span>Summer peak period</span>
            </div>
          )}
          <div className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: COLORS.blue }} />
            <span>Units consumed</span>
          </div>
          <div className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: COLORS.textMain }} />
            <span>Bill amount</span>
          </div>
          {hasProjection && (
            <div className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ background: COLORS.green }} />
              <span>Projected savings</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════ 2. Charge Breakdown Donut ═══════ */
export function ChargeBreakdownChart({ charges }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const { pieData, total, controllableTotal, fixedTotal } = useMemo(() => {
    if (!charges?.length) return { pieData: [], total: 0, controllableTotal: 0, fixedTotal: 0 };

    // Group by status for color coding, but keep major individual slices
    const grouped = {};
    let otherAmount = 0;
    const sorted = [...charges].sort((a, b) => b.amount - a.amount);

    sorted.forEach((c, i) => {
      if (i < 5) {
        grouped[c.name] = { ...c, key: c.name };
      } else {
        otherAmount += c.amount;
      }
    });
    if (otherAmount > 0) {
      grouped['Other Charges'] = { name: 'Other Charges', amount: otherAmount, status: 'FIXED', key: 'Other Charges' };
    }

    const pdata = Object.values(grouped).map(g => ({
      name: g.name,
      value: g.amount,
      status: g.status,
      color: STATUS_COLORS[g.status] || COLORS.textDim,
      percentage: 0
    }));

    const t = pdata.reduce((s, p) => s + p.value, 0);
    pdata.forEach(p => { p.percentage = Math.round((p.value / t) * 100); });

    const controllable = pdata.filter(p => p.status === 'NORMAL' || p.status === 'WARNING').reduce((s, p) => s + p.value, 0);
    const fixed = pdata.filter(p => p.status === 'FIXED' || p.status === 'GOVERNMENT').reduce((s, p) => s + p.value, 0);

    return { pieData: pdata, total: t, controllableTotal: controllable, fixedTotal: fixed };
  }, [charges]);

  if (!pieData.length) return null;

  const activeSlice = activeIndex !== null ? pieData[activeIndex] : null;

  return (
    <div className="section">
      <h3 className="section-title">🍩 Charge Breakdown</h3>
      <div className="chart-card donut-card">
        <div className="donut-layout">
          <div className="donut-chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={activeIndex !== null ? 110 : 100}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, i) => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      stroke="#fff"
                      strokeWidth={2}
                      opacity={activeIndex === null || activeIndex === i ? 1 : 0.4}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip formatter={(v) => `Rs. ${v.toLocaleString()}`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              {activeSlice ? (
                <>
                  <span className="donut-center-pct">{activeSlice.percentage}%</span>
                  <span className="donut-center-label">{activeSlice.name}</span>
                  <span className="donut-center-value">Rs. {activeSlice.value.toLocaleString()}</span>
                </>
              ) : (
                <>
                  <span className="donut-center-pct">100%</span>
                  <span className="donut-center-label">Total Bill</span>
                  <span className="donut-center-value">Rs. {total.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>

          <div className="donut-legend">
            <div className="donut-control-summary">
              <div className="control-bar">
                <div className="control-bar-fill" style={{ width: `${total > 0 ? (controllableTotal / total) * 100 : 0}%`, background: COLORS.green }} />
              </div>
              <div className="control-bar-labels">
                <span style={{ color: COLORS.green }}>Controllable {Math.round((controllableTotal / total) * 100)}%</span>
                <span style={{ color: COLORS.amber }}>Fixed/Govt {Math.round((fixedTotal / total) * 100)}%</span>
              </div>
            </div>
            {pieData.map((entry, i) => (
              <div
                key={i}
                className={`donut-legend-item ${activeIndex === i ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span className="donut-legend-dot" style={{ background: entry.color }} />
                <span className="donut-legend-name">{entry.name}</span>
                <span className="donut-legend-pct">{entry.percentage}%</span>
                <span className="donut-legend-value">Rs. {entry.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════ 3. Bill Comparison Chart ═══════ */
export function BillComparisonChart({ recentBills, unitLabel }) {
  const data = useMemo(() => {
    if (!recentBills?.length) return [];
    return [...recentBills].map(b => ({
      ...b,
      costPerUnit: b.costPerUnit || (b.units > 0 ? Math.round((b.amount / b.units) * 100) / 100 : 0)
    }));
  }, [recentBills]);

  if (!data.length) {
    return (
      <div className="section">
        <h3 className="section-title">📊 Bill Comparison</h3>
        <div className="chart-empty">
          <span className="chart-empty-icon">📉</span>
          <p>No previous bill data found on this bill.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <h3 className="section-title">📊 Bill Comparison</h3>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="amount"
              tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="cpu"
              orientation="right"
              tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `Rs.${v}`}
            />
            <Tooltip content={<ChartTooltip formatter={(v, name) => {
              if (name === 'Amount') return `Rs. ${v.toLocaleString()}`;
              if (name === 'Units') return `${v.toLocaleString()} ${unitLabel}`;
              if (name === 'Cost/Unit') return `Rs. ${v.toFixed(2)}/${unitLabel}`;
              return v;
            }} />} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} />

            <Bar yAxisId="amount" dataKey="amount" name="Amount" fill={COLORS.textMain} radius={[6, 6, 0, 0]} barSize={32} />
            <Bar yAxisId="amount" dataKey="units" name="Units" fill={COLORS.blue} radius={[6, 6, 0, 0]} barSize={32} />
            <Line
              yAxisId="cpu"
              type="monotone"
              dataKey="costPerUnit"
              name="Cost/Unit"
              stroke={COLORS.amber}
              strokeWidth={2.5}
              dot={{ r: 4, fill: COLORS.amber, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══════ 4. Billing Timeline ═══════ */
export function BillingTimeline({ data }) {
  const { issueDate, dueDate } = data;
  if (!issueDate && !dueDate) return null;

  const now = new Date();
  const due = dueDate ? new Date(dueDate) : null;
  const issued = issueDate ? new Date(issueDate) : null;

  const daysUntilDue = due ? Math.ceil((due - now) / (1000 * 60 * 60 * 24)) : null;
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;

  // Estimate next adjustment window (typically mid-month for FPA)
  const nextAdjustment = new Date(now.getFullYear(), now.getMonth(), 15);
  if (nextAdjustment < now) nextAdjustment.setMonth(nextAdjustment.getMonth() + 1);

  const steps = [];
  if (issued) steps.push({ label: 'Bill Issued', date: issueDate, status: 'done' });
  steps.push({ label: 'Today', date: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), status: 'active' });
  if (due) steps.push({ label: 'Due Date', date: dueDate, status: isOverdue ? 'overdue' : daysUntilDue <= 3 ? 'warning' : 'pending' });
  steps.push({ label: 'Next FPA Update', date: nextAdjustment.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), status: 'future' });

  return (
    <div className="section">
      <h3 className="section-title">📅 Billing Cycle</h3>
      <div className="chart-card timeline-card">
        {daysUntilDue !== null && (
          <div className={`timeline-badge ${isOverdue ? 'overdue' : daysUntilDue <= 3 ? 'warning' : 'normal'}`}>
            {isOverdue ? `⚠️ Overdue by ${Math.abs(daysUntilDue)} days` : daysUntilDue === 0 ? 'Due today!' : `${daysUntilDue} days until due`}
          </div>
        )}
        <div className="billing-timeline">
          {steps.map((step, i) => (
            <div key={i} className={`timeline-node ${step.status}`}>
              <div className="timeline-dot" />
              <div className="timeline-info">
                <span className="timeline-label">{step.label}</span>
                <span className="timeline-date">{step.date}</span>
              </div>
              {i < steps.length - 1 && <div className="timeline-connector" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════ 5. Savings Meter ═══════ */
export function SavingsMeter({ estimatedSavings, recommendations }) {
  if (!estimatedSavings || estimatedSavings <= 0) return null;

  const maxGauge = Math.max(estimatedSavings * 1.3, 1000);
  const pct = Math.min((estimatedSavings / maxGauge) * 100, 100);

  // Segments
  const segments = [
    { label: '0', max: 0 },
    { label: '300', max: 300 },
    { label: '600', max: 600 },
    { label: '1000', max: 1000 },
    { label: `${Math.round(maxGauge)}+`, max: maxGauge }
  ];

  const fillColor = pct > 75 ? COLORS.green : pct > 40 ? COLORS.blue : COLORS.amber;

  return (
    <div className="gauge-card">
      <div className="gauge-header">
        <span className="gauge-icon">💰</span>
        <div>
          <h4 className="gauge-title">Savings Potential</h4>
          <p className="gauge-subtitle">Based on {recommendations?.length || 0} recommendations</p>
        </div>
      </div>
      <div className="savings-meter">
        <div className="savings-meter-track">
          {segments.slice(0, -1).map((seg, i) => {
            const segPct = ((segments[i + 1].max - seg.max) / maxGauge) * 100;
            const segFill = Math.max(0, Math.min(segPct, pct - (seg.max / maxGauge) * 100));
            return (
              <div key={i} className="savings-segment" style={{ width: `${segPct}%` }}>
                <div className="savings-segment-fill" style={{ width: `${(segFill / segPct) * 100}%`, background: fillColor }} />
              </div>
            );
          })}
        </div>
        <div className="savings-meter-labels">
          {segments.map((s, i) => (
            <span key={i} className="savings-meter-label">{s.label}</span>
          ))}
        </div>
        <div className="savings-meter-value" style={{ color: fillColor }}>
          You could save up to <strong>Rs. {estimatedSavings.toLocaleString()}/month</strong>
        </div>
      </div>
    </div>
  );
}

/* ═══════ 6. Usage Gauge ═══════ */
export function UsageGauge({ unitsConsumed, unitLabel, billType }) {
  if (!unitsConsumed) return null;

  // Safe benchmarks for Pakistani households
  const benchmarks = {
    'LESCO Electricity Bill': { avg: 300, label: 'Avg Pakistani home' },
    'SNGPL Gas Bill': { avg: 100, label: 'Avg Pakistani home' },
    'KWSB Water Bill': { avg: 5000, label: 'Avg Pakistani home' },
    'WASA Water Bill': { avg: 5000, label: 'Avg Pakistani home' }
  };

  const benchmark = benchmarks[billType] || { avg: unitsConsumed, label: 'Benchmark' };
  const pct = Math.min((unitsConsumed / benchmark.avg) * 100, 150);

  const data = [
    { name: 'Usage', value: pct, fill: pct > 120 ? COLORS.red : pct > 90 ? COLORS.amber : COLORS.green }
  ];

  return (
    <div className="gauge-card">
      <div className="gauge-header">
        <span className="gauge-icon">⚡</span>
        <div>
          <h4 className="gauge-title">Usage vs Benchmark</h4>
          <p className="gauge-subtitle">{benchmark.label}</p>
        </div>
      </div>
      <div className="usage-gauge-wrap">
        <ResponsiveContainer width="100%" height={180}>
          <RadialBarChart
            cx="50%"
            cy="85%"
            innerRadius="60%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
          >
            <RadialBar
              background={{ fill: COLORS.bgSecondary }}
              dataKey="value"
              cornerRadius={8}
              fill={data[0].fill}
              animationDuration={1200}
            />
            <PolarAngleAxis
              type="number"
              domain={[0, 150]}
              tick={false}
              axisLine={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="usage-gauge-center">
          <span className="usage-gauge-pct">{Math.round(pct)}%</span>
          <span className="usage-gauge-label">of benchmark</span>
        </div>
      </div>
      <div className="usage-gauge-meta">
        <div className="usage-meta-item">
          <span className="usage-meta-value">{unitsConsumed.toLocaleString()}</span>
          <span className="usage-meta-label">Your usage ({unitLabel})</span>
        </div>
        <div className="usage-meta-item">
          <span className="usage-meta-value">{benchmark.avg.toLocaleString()}</span>
          <span className="usage-meta-label">{benchmark.label} ({unitLabel})</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════ 7. Billing Calendar ═══════ */
export function BillingCalendar({ data }) {
  const history = data.consumptionHistory || [];
  if (!history.length) return null;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = data.billingMonth;

  // Determine min/max for color scaling
  const allUnits = history.map(h => h.units);
  const minUnits = Math.min(...allUnits);
  const maxUnits = Math.max(...allUnits);
  const avgUnits = Math.round(allUnits.reduce((a, b) => a + b, 0) / allUnits.length);

  const getCellColor = (units) => {
    if (units === undefined || units === null) return 'transparent';
    if (maxUnits === minUnits) return COLORS.blueLight;
    const ratio = (units - minUnits) / (maxUnits - minUnits);
    if (ratio < 0.33) return COLORS.greenLight;
    if (ratio < 0.66) return COLORS.amberLight;
    return COLORS.redLight;
  };

  const getTextColor = (units) => {
    if (units === undefined || units === null) return COLORS.textDim;
    if (maxUnits === minUnits) return COLORS.blue;
    const ratio = (units - minUnits) / (maxUnits - minUnits);
    if (ratio < 0.33) return COLORS.green;
    if (ratio < 0.66) return COLORS.amber;
    return COLORS.red;
  };

  // Get the year range from history
  const years = [...new Set(history.map(h => h.month.split(' ')[1]))].sort();
  const displayYear = years.length === 1 ? years[0] : `${years[0]}–${years[years.length - 1]}`;

  return (
    <div className="section">
      <h3 className="section-title">📅 Monthly Usage Calendar</h3>
      <div className="chart-card calendar-card">
        <div className="calendar-header">
          <div className="calendar-year">{displayYear}</div>
          <div className="calendar-subtitle">
            {history.length} months of billing history • Avg {avgUnits.toLocaleString()} {data.unitLabel}
          </div>
        </div>

        <div className="calendar-grid">
          {months.map((mon) => {
            // Try to find data for this month across any year
            const entry = history.find(h => h.month.startsWith(mon));
            const isCurrent = currentMonth?.startsWith(mon);
            const units = entry?.units;
            const amount = entry?.amount;

            return (
              <div
                key={mon}
                className={`calendar-cell ${entry ? 'has-data' : ''} ${isCurrent ? 'current' : ''}`}
                style={entry ? { background: getCellColor(units) } : {}}
                title={entry ? `${entry.month}: ${units?.toLocaleString()} ${data.unitLabel} • Rs. ${amount?.toLocaleString()}` : ''}
              >
                <span className="calendar-cell-month">{mon}</span>
                {entry && (
                  <>
                    <span className="calendar-cell-units" style={{ color: getTextColor(units) }}>
                      {units.toLocaleString()}
                    </span>
                    <span className="calendar-cell-amount">
                      Rs. {(amount / 1000).toFixed(1)}k
                    </span>
                  </>
                )}
                {!entry && <span className="calendar-cell-empty">—</span>}
                {isCurrent && <div className="calendar-current-badge">CURRENT</div>}
              </div>
            );
          })}
        </div>

        <div className="calendar-footer">
          <div className="calendar-legend">
            <div className="calendar-legend-item">
              <span className="calendar-legend-swatch" style={{ background: COLORS.greenLight, border: `1px solid ${COLORS.green}` }} />
              <span>Low usage</span>
            </div>
            <div className="calendar-legend-item">
              <span className="calendar-legend-swatch" style={{ background: COLORS.amberLight, border: `1px solid ${COLORS.amber}` }} />
              <span>Medium usage</span>
            </div>
            <div className="calendar-legend-item">
              <span className="calendar-legend-swatch" style={{ background: COLORS.redLight, border: `1px solid ${COLORS.red}` }} />
              <span>High usage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
