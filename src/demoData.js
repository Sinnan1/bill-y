/**
 * Demo Mode Data
 * Contains simulated data for the Main Dashboard, Comparison Dashboard, and Knowledge Base.
 */

export const DEMO_BILL_A = {
  confidenceScore: 98,
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
    importOffPeak: 659,
    importPeak: 236,
    exportOffPeak: 1648,
    exportPeak: 0,
    netOffPeak: -989,
    netPeak: 236,
    gopTariffOffPeak: 34.53,
    gopTariffPeak: 46.85,
    unitsImported: 895, 
    unitsExported: 1648,
    netPosition: -753, 
    creditValue: 0, 
    isOverExporting: true,
    expMdi: 16.06,
    dgCapacity: 13.34,
    monthInQuarter: 1,
    accumulatedCredit: 0,
    monthsToSettlement: 2
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

  estimatedSavings: 14500,
  savingsProjection: [
    { month: "May 2026", projectedUnits: -900, projectedAmount: 4214 },
    { month: "Jun 2026", projectedUnits: -200, projectedAmount: 4214 }
  ]
};

DEMO_BILL_A.recentBills = DEMO_BILL_A.recentBills.map(b => ({
  ...b,
  costPerUnit: b.units !== 0 ? Math.round(Math.abs(b.amount / b.units) * 100) / 100 : 0
}));


export const DEMO_BILL_B = {
  billType: "Standard Domestic Bill",
  billingMonth: "Apr 2026",
  totalAmount: 38450,
  dueDate: "29 Apr 2026",
  isPastDue: false,
  unitsConsumed: 850,
  unitLabel: "kWh",
  previousBillAmount: 35200,
  comparisonText: "Rs. 3,250 more than last month",
  isNetMetering: false,
  issueDate: "21 Apr 2026",

  netMetering: null,

  solarInsights: [],

  charges: [
    {
      name: "Cost of Electricity",
      amount: 28900,
      explanation: "Base energy charge for 850 units consumed.",
      status: "NORMAL"
    },
    {
      name: "FPA (Fuel Price Adj)",
      amount: 3200,
      explanation: "Fuel price adjustment applied to previous month's usage.",
      status: "NORMAL"
    },
    {
      name: "GST & Taxes",
      amount: 6350,
      explanation: "General Sales Tax and other government levies.",
      status: "GOVERNMENT"
    }
  ],

  changeReasons: [
    {
      icon: "📈",
      title: "High energy consumption",
      explanation: "Your usage increased by 40 units compared to last month due to seasonal changes.",
      type: "usage"
    }
  ],

  recommendations: [
    {
      effort: "HIGH",
      title: "Install a 10kW Solar System",
      explanation: "Based on your consistent high usage, a 10kW solar system could eliminate your energy charges entirely.",
      savings: "Rs. 35,000+"
    }
  ],

  consumptionHistory: [
    { month: "Apr 2025", units: 750, amount: 32000 },
    { month: "May 2025", units: 950, amount: 45000 },
    { month: "Jun 2025", units: 1200, amount: 65000 },
    { month: "Jul 2025", units: 1100, amount: 58000 },
    { month: "Aug 2025", units: 1050, amount: 54000 },
    { month: "Sep 2025", units: 900, amount: 41000 },
    { month: "Oct 2025", units: 800, amount: 35000 },
    { month: "Nov 2025", units: 700, amount: 29000 },
    { month: "Dec 2025", units: 650, amount: 26000 },
    { month: "Jan 2026", units: 720, amount: 30000 },
    { month: "Feb 2026", units: 780, amount: 33000 },
    { month: "Mar 2026", units: 810, amount: 35200 },
    { month: "Apr 2026", units: 850, amount: 38450 }
  ],

  recentBills: [
    { month: "Feb 2026", units: 780, amount: 33000 },
    { month: "Mar 2026", units: 810, amount: 35200 },
    { month: "Apr 2026", units: 850, amount: 38450 }
  ]
};

export const DEMO_COMPARE_DATA = {
  billA: {
    month: "Bill A (Solar)",
    totalAmount: DEMO_BILL_A.totalAmount,
    unitsConsumed: DEMO_BILL_A.unitsConsumed,
    costPerUnit: DEMO_BILL_A.costPerUnit || (DEMO_BILL_A.unitsConsumed !== 0 ? Math.abs(DEMO_BILL_A.totalAmount / DEMO_BILL_A.unitsConsumed) : 0),
    isNetMetering: true,
    netMetering: DEMO_BILL_A.netMetering,
    charges: DEMO_BILL_A.charges
  },
  billB: {
    month: "Bill B (No Solar)",
    totalAmount: DEMO_BILL_B.totalAmount,
    unitsConsumed: DEMO_BILL_B.unitsConsumed,
    costPerUnit: DEMO_BILL_B.costPerUnit || (DEMO_BILL_B.unitsConsumed !== 0 ? Math.abs(DEMO_BILL_B.totalAmount / DEMO_BILL_B.unitsConsumed) : 0),
    isNetMetering: false,
    charges: DEMO_BILL_B.charges
  },
  solarAnalysis: {
    bothSolar: false,
    billAHasSolar: true,
    billBHasSolar: false,
    nonSolarBill: 'B',
    recommendedSystem: '10kW System',
    estimatedMonthlySavings: 34000,
    roiMonths: 36
  },
  majorChanges: [
    {
      category: "Cost of Electricity",
      difference: 28900,
      description: "Bill B paid Rs. 28,900 for base energy, whereas Bill A paid Rs. 0 thanks to solar exports."
    },
    {
      category: "Taxes & Levies",
      difference: 5707,
      description: "Bill B paid significantly higher taxes because taxes scale with energy cost."
    }
  ],
  verdict: "Bill A's solar installation saved them Rs. 34,236 compared to Bill B. We highly recommend exploring a 10kW solar system for Bill B."
};

export const DEMO_KNOWLEDGE_DOCS = "Hello! I am currently in Demo Mode, so I'm not connected to the live Gemini API. However, in a real scenario, I would analyze your question against the official LESCO tariff and government NEPRA regulations to provide an accurate, streaming response with citations.";
