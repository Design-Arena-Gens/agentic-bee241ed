const MONTH_CACHE = new Map<string, MonthEnergySnapshot>();

type EnergyImpactType = "reduction" | "shift" | "generation";

export interface EnergyTask {
  id: string;
  title: string;
  time: string;
  description: string;
  impact: {
    type: EnergyImpactType;
    value: number;
  };
  status: "planned" | "completed";
}

export interface EnergyInsight {
  label: string;
  change: number;
  description: string;
}

export interface DemandResponseEvent {
  id: string;
  date: string;
  window: string;
  priority: "low" | "medium" | "high";
  incentive: string;
  recommendation: string;
}

export interface EnergyDay {
  date: string;
  usageKwh: number;
  solarGenerationKwh: number;
  peakUsageKwh: number;
  offPeakUsageKwh: number;
  carbonKg: number;
  costUsd: number;
  baselineKwh: number;
  insights: EnergyInsight[];
  tasks: EnergyTask[];
}

export interface MonthEnergySnapshot {
  monthStart: string;
  label: string;
  days: EnergyDay[];
  totals: {
    usageKwh: number;
    solarGenerationKwh: number;
    netGridKwh: number;
    carbonKg: number;
    baselineKwh: number;
    costUsd: number;
    targetKwh: number;
  };
  demandEvents: DemandResponseEvent[];
  recommendations: string[];
  weeklyAverages: number[];
}

interface BuildTaskConfig {
  day: number;
  tasks: Omit<EnergyTask, "id" | "status">[];
}

function buildMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function createRng(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function deriveTasks(day: number, rng: () => number): EnergyTask[] {
  const presets: BuildTaskConfig[] = [
    {
      day: 2,
      tasks: [
        {
          title: "Optimize thermostat schedule",
          time: "07:30",
          description: "Adjust weekday morning setpoints to reduce HVAC runtime.",
          impact: { type: "reduction", value: 2.4 },
        },
      ],
    },
    {
      day: 5,
      tasks: [
        {
          title: "Schedule EV charging",
          time: "23:00",
          description: "Shift EV charging to off-peak window for demand response incentive.",
          impact: { type: "shift", value: 6.1 },
        },
      ],
    },
    {
      day: 12,
      tasks: [
        {
          title: "Panel cleaning",
          time: "09:00",
          description: "Rinse rooftop panels to improve solar harvest.",
          impact: { type: "generation", value: 3.8 },
        },
      ],
    },
    {
      day: 18,
      tasks: [
        {
          title: "Load tuning workshop",
          time: "15:30",
          description: "Review automation scripts for HVAC and lighting.",
          impact: { type: "reduction", value: 1.9 },
        },
        {
          title: "Battery discharge planning",
          time: "19:00",
          description: "Allocate battery discharge for peak window.",
          impact: { type: "shift", value: 4.6 },
        },
      ],
    },
    {
      day: 24,
      tasks: [
        {
          title: "Demand response rehearsal",
          time: "16:00",
          description: "Test automated load curtailment scenario.",
          impact: { type: "reduction", value: 2.8 },
        },
      ],
    },
  ];

  const preset = presets.find((config) => config.day === day);
  if (preset) {
    return preset.tasks.map((task, index) => ({
      ...task,
      id: `${day}-preset-${index}`,
      status: "planned" as const,
    }));
  }

  // Occasionally add ad-hoc maintenance items.
  if (rng() > 0.8) {
    return [
      {
        id: `${day}-adhoc`,
        title: "Inspect standby loads",
        time: "21:30",
        description: "Verify vampire loads and smart plug schedules.",
        impact: { type: "reduction", value: parseFloat((1.2 + rng()).toFixed(1)) },
        status: "planned",
      },
    ];
  }

  return [];
}

function generateInsights(day: EnergyDay, rng: () => number): EnergyInsight[] {
  const insights: EnergyInsight[] = [
    {
      label: "HVAC runtime",
      change: parseFloat(((day.usageKwh - day.baselineKwh) / day.baselineKwh).toFixed(2)),
      description:
        day.usageKwh > day.baselineKwh
          ? "Usage rose above baseline due to higher cooling load."
          : "Usage stayed below baseline thanks to optimized thermostat scheduling.",
    },
  ];

  if (day.solarGenerationKwh > 12 && rng() > 0.3) {
    insights.push({
      label: "Solar harvest",
      change: parseFloat(((day.solarGenerationKwh - 10) / 10).toFixed(2)),
      description: "Higher solar yield captured during midday peak generation.",
    });
  }

  if (day.peakUsageKwh > 14) {
    insights.push({
      label: "Peak window",
      change: parseFloat(((day.peakUsageKwh - 12) / 12).toFixed(2)),
      description: "Peak window loads climbed. Consider shifting dishwasher or laundry.",
    });
  }

  return insights;
}

function createDemandEvents(year: number, month: number, rng: () => number): DemandResponseEvent[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const events: DemandResponseEvent[] = [];
  const eventCount = 2 + Math.floor(rng() * 2);

  for (let index = 0; index < eventCount; index += 1) {
    const day = 5 + Math.floor(rng() * (daysInMonth - 10));
    const priority = rng() > 0.65 ? "high" : rng() > 0.35 ? "medium" : "low";
    const windowStartHour = 15 + Math.floor(rng() * 3);
    const windowEndHour = windowStartHour + 2;
    events.push({
      id: `${year}-${month}-${index}`,
      date: new Date(year, month, day).toISOString(),
      window: `${windowStartHour}:00-${windowEndHour}:00`,
      priority,
      incentive: priority === "high" ? "$40 credit" : priority === "medium" ? "$25 credit" : "$15 credit",
      recommendation:
        priority === "high"
          ? "Pre-cool the building and discharge battery during the event window."
          : "Shift flexible loads and monitor HVAC staging during the event window.",
    });
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function buildMonth(year: number, month: number): MonthEnergySnapshot {
  const key = buildMonthKey(year, month);
  if (MONTH_CACHE.has(key)) {
    return MONTH_CACHE.get(key)!;
  }

  const rng = createRng(year * 97 + month * 31 + 2024);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: EnergyDay[] = [];
  let totalUsage = 0;
  let totalSolar = 0;
  let totalCarbon = 0;
  let totalCost = 0;
  let totalBaseline = 0;

  for (let dayIndex = 0; dayIndex < daysInMonth; dayIndex += 1) {
    const day = dayIndex + 1;
    const seasonalModifier = 0.9 + rng() * 0.2;
    const baseline = 28 + Math.sin((day / daysInMonth) * Math.PI) * 5;
    const usage = baseline * seasonalModifier + rng() * 4 - 1.5;
    const solar = 11 + Math.cos((day / daysInMonth) * Math.PI) * 4 + rng() * 1.8;
    const peakShare = 0.42 + rng() * 0.08;
    const peakUsage = usage * peakShare;
    const offPeak = usage - peakUsage;
    const cost = usage * 0.18 + peakUsage * 0.07;
    const carbon = (usage - solar * 0.55) * 0.45;

    const tasks = deriveTasks(day, rng);
    const energyDay: EnergyDay = {
      date: new Date(year, month, day).toISOString(),
      usageKwh: parseFloat(usage.toFixed(1)),
      solarGenerationKwh: parseFloat(Math.max(solar, 2.5).toFixed(1)),
      peakUsageKwh: parseFloat(peakUsage.toFixed(1)),
      offPeakUsageKwh: parseFloat(Math.max(offPeak, 0).toFixed(1)),
      carbonKg: parseFloat(Math.max(carbon, 3.5).toFixed(1)),
      costUsd: parseFloat(cost.toFixed(2)),
      baselineKwh: parseFloat(baseline.toFixed(1)),
      insights: [],
      tasks,
    };

    energyDay.insights = generateInsights(energyDay, rng);

    totalUsage += energyDay.usageKwh;
    totalSolar += energyDay.solarGenerationKwh;
    totalCarbon += energyDay.carbonKg;
    totalCost += energyDay.costUsd;
    totalBaseline += energyDay.baselineKwh;

    days.push(energyDay);
  }

  const weeklyAverages: number[] = [];
  for (let start = 0; start < days.length; start += 7) {
    const slice = days.slice(start, start + 7);
    const avg = slice.reduce((sum, d) => sum + d.usageKwh, 0) / slice.length;
    weeklyAverages.push(parseFloat(avg.toFixed(1)));
  }

  const snapshot: MonthEnergySnapshot = {
    monthStart: new Date(year, month, 1).toISOString(),
    label: formatMonthLabel(year, month),
    days,
    totals: {
      usageKwh: parseFloat(totalUsage.toFixed(1)),
      solarGenerationKwh: parseFloat(totalSolar.toFixed(1)),
      netGridKwh: parseFloat((totalUsage - totalSolar).toFixed(1)),
      carbonKg: parseFloat(totalCarbon.toFixed(1)),
      baselineKwh: parseFloat(totalBaseline.toFixed(1)),
      costUsd: parseFloat(totalCost.toFixed(2)),
      targetKwh: parseFloat((totalBaseline * 0.95).toFixed(1)),
    },
    demandEvents: createDemandEvents(year, month, rng),
    recommendations: [
      "Shift flexible loads (EV, laundry) fully into off-peak windows.",
      "Pre-cool the facility before peak alert days to ride through curtailments.",
      "Leverage battery discharge to cap evening peaks above 15 kWh.",
      "Audit standby baseload and eliminate devices drawing >8 W overnight.",
    ],
    weeklyAverages,
  };

  MONTH_CACHE.set(key, snapshot);
  return snapshot;
}

function formatMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

export function getMonthSnapshot(date: Date): MonthEnergySnapshot {
  return buildMonth(date.getFullYear(), date.getMonth());
}

export function getAdjacentMonth(date: Date, offset: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + offset);
  next.setDate(1);
  return next;
}

export function formatShortDate(dateIso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateIso));
}

export function formatWeekday(dateIso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(new Date(dateIso));
}
