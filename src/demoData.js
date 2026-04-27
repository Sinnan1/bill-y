/**
 * Demo Mode — Pre-analyzed LESCO bill data
 * Allows users to experience the full dashboard without uploading a real bill.
 * This data mirrors the exact structure returned by the Gemini analysis + addDerivedData().
 */

const DEMO_BILL = {
  billType: "LESCO Net Metering Bill",
  billingMonth: "Apr 2026",
  totalAmount: 4214,
  dueDate: "29 Apr 2026",
  isPastDue: false,
  unitsConsumed: 895, // 659 off-peak + 236 peak
  unitLabel: "kWh",
  previousBillAmount: 10036,
  comparisonText: "Rs. 5,822 less than last month",
  isNetMetering: true,
  issueDate: "21 Apr 2026",

  netMetering: {
    unitsImported: 895, 
    unitsExported: 1648,
    netPosition: -753, 
    creditValue: 0, 
    isOverExporting: true, // EXP-MDI 16.06 > DG-CAPACITY 13.34
    expMdi: 16.06,
    dgCapacity: 13.34,
    monthInQuarter: 1
  },

  solarInsights: [
    {
      title: "Excellent Export Ratio",
      body: "You exported nearly twice as much energy as you imported from the grid this month.",
      type: "info"
    },
    {
      title: "High Peak Usage",
      body: "You consumed 236 peak units which are billed at the highest rate. Shift heavy loads to daytime.",
      type: "tip"
    }
  ],

  charges: [
    {
      name: "Cost of Electricity",
      amount: 0,
      explanation: "Base energy charge. Your solar exports fully covered your off-peak usage, zeroing out these charges.",
      status: "NORMAL"
    },
    {
      name: "Fixed Charges",
      amount: 3571,
      explanation: "Mandatory fixed charge based on your sanctioned load of 9 kW.",
      status: "NORMAL"
    },
    {
      name: "GST (Sales Tax)",
      amount: 643,
      explanation: "General Sales Tax at 18% applied to your fixed charges.",
      status: "GOVERNMENT"
    }
  ],

  changeReasons: [
    {
      icon: "🌞",
      title: "Solar exports covered your usage",
      explanation: "You successfully exported 1,648 units, entirely offsetting your 659 off-peak units and creating a negative net balance.",
      type: "seasonal"
    },
    {
      icon: "📉",
      title: "Bill dropped 58%",
      explanation: "Your bill decreased from Rs. 10,036 last month to Rs. 4,214, primarily due to higher solar generation and lower grid dependency.",
      type: "usage"
    }
  ],

  recommendations: [
    {
      effort: "EASY",
      title: "Shift peak usage to daytime",
      explanation: "You consumed 236 units during peak hours when solar isn't active. Running appliances before 5 PM will utilize your free solar energy instead.",
      savings: "Rs. 9,000+"
    },
    {
      effort: "MEDIUM",
      title: "Check inverter export limit",
      explanation: "Your Peak Export MDI was 16.06 kW, which is higher than your sanctioned capacity of 13.34 kW. Ensure your inverter limits export to avoid potential NEPRA penalties.",
      savings: "Penalty avoidance"
    }
  ],

  consumptionHistory: [
    { month: "Apr 2025", units: 11, amount: 7091 },
    { month: "May 2025", units: 229, amount: 15961 },
    { month: "Jun 2025", units: 1616, amount: 103147 },
    { month: "Jul 2025", units: 1357, amount: 75437 },
    { month: "Aug 2025", units: 1189, amount: 66491 },
    { month: "Sep 2025", units: 778, amount: 42468 },
    { month: "Oct 2025", units: 488, amount: 30060 },
    { month: "Nov 2025", units: 1022, amount: 58941 },
    { month: "Dec 2025", units: 835, amount: 49159 },
    { month: "Jan 2026", units: 773, amount: 45200 },
    { month: "Feb 2026", units: -80, amount: 1646 },
    { month: "Mar 2026", units: -187, amount: 10036 },
    { month: "Apr 2026", units: -753, amount: 4214 }
  ],

  recentBills: [
    { month: "Feb 2026", units: -80, amount: 1646 },
    { month: "Mar 2026", units: -187, amount: 10036 },
    { month: "Apr 2026", units: -753, amount: 4214 }
  ],

  // ─── Derived data (normally computed by addDerivedData on server) ───
  estimatedSavings: 14500,

  savingsProjection: [
    { month: "May 2026", projectedUnits: -900, projectedAmount: 4214 },
    { month: "Jun 2026", projectedUnits: -200, projectedAmount: 4214 }
  ]
};

// Ensure recentBills have costPerUnit
DEMO_BILL.recentBills = DEMO_BILL.recentBills.map(b => ({
  ...b,
  costPerUnit: b.units > 0 ? Math.round((b.amount / b.units) * 100) / 100 : 0
}));

export default DEMO_BILL;
