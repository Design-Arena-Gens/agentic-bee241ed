"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  EnergyDay,
  EnergyTask,
  MonthEnergySnapshot,
  DemandResponseEvent,
  formatShortDate,
  formatWeekday,
  getAdjacentMonth,
  getMonthSnapshot,
} from "@/lib/energyData";

type TaskFormState = {
  title: string;
  time: string;
  description: string;
  impactValue: string;
  impactType: "reduction" | "shift" | "generation";
};

type TaskStatusMap = Record<string, "planned" | "completed">;
type CustomTaskMap = Record<string, EnergyTask[]>;

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function classNames(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

function getDayKey(dateIso: string) {
  return dateIso.split("T")[0];
}

function summarizeDemandEvents(events: DemandResponseEvent[]) {
  return events.map((event) => ({
    ...event,
    shortDate: formatShortDate(event.date),
  }));
}

export function EnergyCalendar() {
  const [activeMonth, setActiveMonth] = useState(() => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [snapshot, setSnapshot] = useState<MonthEnergySnapshot>(() => getMonthSnapshot(activeMonth));
  const [selectedDay, setSelectedDay] = useState<EnergyDay>(() => snapshot.days[0]);
  const [customTasks, setCustomTasks] = useState<CustomTaskMap>({});
  const [taskStatus, setTaskStatus] = useState<TaskStatusMap>({});
  const [formState, setFormState] = useState<TaskFormState>({
    title: "",
    time: "08:00",
    description: "",
    impactValue: "2.0",
    impactType: "reduction",
  });

  useEffect(() => {
    setSnapshot(getMonthSnapshot(activeMonth));
  }, [activeMonth]);

  useEffect(() => {
    setSelectedDay((prev) => {
      if (prev && getDayKey(prev.date).startsWith(getDayKey(snapshot.monthStart).slice(0, 7))) {
        const updated = snapshot.days.find((day) => getDayKey(day.date) === getDayKey(prev.date));
        if (updated) {
          return updated;
        }
      }
      return snapshot.days[0];
    });
  }, [snapshot]);

  const calendarCells = useMemo(() => {
    const monthStart = new Date(snapshot.monthStart);
    const monthDays = snapshot.days;
    const firstWeekday = monthStart.getDay();
    const leadingBlanks = Array.from({ length: firstWeekday }, (_, index) => ({
      type: "blank" as const,
      id: `blank-${index}`,
    }));
    const dayCells = monthDays.map((day) => ({
      type: "day" as const,
      id: day.date,
      day,
    }));
    return [...leadingBlanks, ...dayCells];
  }, [snapshot]);

  const maxUsage = useMemo(
    () => Math.max(...snapshot.days.map((day) => day.usageKwh)),
    [snapshot.days]
  );

  const combinedSelectedDayTasks = useMemo(() => {
    if (!selectedDay) {
      return [];
    }
    const overrideTasks = customTasks[selectedDay.date] ?? [];
    return [...selectedDay.tasks, ...overrideTasks].sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDay, customTasks]);

  function handleNavigate(offset: number) {
    setActiveMonth((prev) => getAdjacentMonth(prev, offset));
  }

  function handleSelect(day: EnergyDay) {
    setSelectedDay(day);
  }

  function handleTaskToggle(taskId: string) {
    setTaskStatus((prev) => {
      const current = prev[taskId];
      return {
        ...prev,
        [taskId]: current === "completed" ? "planned" : "completed",
      };
    });
  }

  function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDay) {
      return;
    }
    const trimmedTitle = formState.title.trim();
    const trimmedDescription = formState.description.trim();
    if (!trimmedTitle) {
      return;
    }

    const impactValue = Number.parseFloat(formState.impactValue);
    const newTask: EnergyTask = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      time: formState.time,
      description: trimmedDescription || "Custom load adjustment",
      impact: {
        type: formState.impactType,
        value: Number.isFinite(impactValue) ? parseFloat(impactValue.toFixed(1)) : 1,
      },
      status: "planned",
    };

    setCustomTasks((prev) => {
      const current = prev[selectedDay.date] ?? [];
      return {
        ...prev,
        [selectedDay.date]: [...current, newTask],
      };
    });

    setTaskStatus((prev) => ({
      ...prev,
      [newTask.id]: "planned",
    }));

    setFormState((prev) => ({
      ...prev,
      title: "",
      description: "",
    }));
  }

  function handleFormChange<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  const demandEvents = useMemo(
    () => summarizeDemandEvents(snapshot.demandEvents),
    [snapshot.demandEvents]
  );

  return (
    <div className="space-y-10">
      <header className="rounded-3xl bg-gradient-to-r from-emerald-500/20 via-sky-500/15 to-blue-500/20 p-8 shadow-lg ring-1 ring-white/60 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-emerald-600">Energy Command Center</p>
            <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
              {snapshot.label} energy management calendar
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Track daily consumption, coordinate curtailment actions, and stay ahead of demand response
              events with a single operational calendar.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 lg:mt-0 lg:justify-end">
            <div className="rounded-2xl bg-white/80 px-5 py-3 text-sm shadow-md">
              <p className="font-medium text-slate-500">Target envelope</p>
              <p className="text-xl font-semibold text-slate-900">
                {snapshot.totals.targetKwh.toLocaleString()} kWh
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 px-5 py-3 text-sm shadow-md">
              <p className="font-medium text-slate-500">Net grid draw</p>
              <p className="text-xl font-semibold text-emerald-600">
                {snapshot.totals.netGridKwh.toLocaleString()} kWh
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total consumption"
          value={`${snapshot.totals.usageKwh.toLocaleString()} kWh`}
          trend={snapshot.totals.usageKwh - snapshot.totals.baselineKwh}
          helper="vs seasonal baseline"
        />
        <SummaryCard
          label="Solar contribution"
          value={`${snapshot.totals.solarGenerationKwh.toLocaleString()} kWh`}
          trend={(snapshot.totals.solarGenerationKwh / snapshot.totals.usageKwh) * 100}
          helper="of total load"
          trendSuffix="%"
        />
        <SummaryCard
          label="Carbon intensity"
          value={`${snapshot.totals.carbonKg.toLocaleString()} kg`}
          trend={snapshot.totals.carbonKg / snapshot.days.length}
          helper="average per day"
        />
        <SummaryCard
          label="Estimated spend"
          value={`$${snapshot.totals.costUsd.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          trend={(snapshot.totals.costUsd / snapshot.totals.usageKwh) * 100}
          helper="¢ per kWh"
          trendSuffix="¢"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2.2fr_1.3fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase text-emerald-600">Calendar view</p>
              <h2 className="text-2xl font-semibold text-slate-900">{snapshot.label}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => handleNavigate(-1)}
                className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setActiveMonth(new Date())}
                className="rounded-full border border-transparent bg-slate-900 px-4 py-1.5 font-medium text-white transition hover:bg-slate-700"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(1)}
                className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600"
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
            {WEEKDAY_LETTERS.map((letter) => (
              <span key={letter}>{letter}</span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarCells.map((cell) => {
              if (cell.type === "blank") {
                return <div key={cell.id} />;
              }

              const day = cell.day;
              const dayKey = getDayKey(day.date);
              const intensity = Math.min(1, day.usageKwh / maxUsage);
              const isSelected = selectedDay && getDayKey(selectedDay.date) === dayKey;
              const isToday = dayKey === getDayKey(new Date().toISOString());
              const net = day.usageKwh - day.solarGenerationKwh;

              return (
                <button
                  key={cell.id}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={classNames(
                    "group relative flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50/80 p-2 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    isSelected && "border-emerald-500 bg-emerald-50 shadow-md",
                    isToday && !isSelected && "border-sky-200 bg-sky-50"
                  )}
                  style={{
                    backgroundImage: `linear-gradient(135deg, rgba(16, 185, 129, ${0.12 + intensity * 0.15}) 0%, rgba(59, 130, 246, ${
                      0.05 + intensity * 0.1
                    }) 100%)`,
                  }}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{new Date(day.date).getDate()}</span>
                    <span
                      className={classNames(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold transition",
                        net <= 0 ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/20 text-amber-600"
                      )}
                    >
                      {net <= 0 ? "Export" : "Grid"}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-600">
                    {day.usageKwh.toFixed(1)} kWh
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Solar {day.solarGenerationKwh.toFixed(1)} kWh
                  </div>
                  <div className="mt-auto flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-medium">{day.peakUsageKwh.toFixed(1)} pk</span>
                    <span>{day.costUsd.toFixed(2)} $</span>
                  </div>
                </button>
              );
            })}
          </div>

          <WeeklyTrendChart averages={snapshot.weeklyAverages} maxUsage={maxUsage} />
        </div>

        {selectedDay && (
          <aside className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-semibold uppercase text-emerald-600">
                {formatWeekday(selectedDay.date)}
              </p>
              <h3 className="text-2xl font-semibold text-slate-900">{formatShortDate(selectedDay.date)}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {selectedDay.usageKwh.toFixed(1)} kWh consumed •{" "}
                {selectedDay.solarGenerationKwh.toFixed(1)} kWh solar • $
                {selectedDay.costUsd.toFixed(2)} estimated spend
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Load breakdown</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <MetricRow label="Peak window" value={`${selectedDay.peakUsageKwh.toFixed(1)} kWh`} />
                <MetricRow label="Off-peak window" value={`${selectedDay.offPeakUsageKwh.toFixed(1)} kWh`} />
                <MetricRow
                  label="Net grid draw"
                  value={`${Math.max(selectedDay.usageKwh - selectedDay.solarGenerationKwh, 0).toFixed(1)} kWh`}
                />
                <MetricRow label="Carbon" value={`${selectedDay.carbonKg.toFixed(1)} kg`} />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase text-slate-500">Action plan</h4>
              <div className="mt-3 space-y-3">
                {combinedSelectedDayTasks.length === 0 && (
                  <p className="text-sm text-slate-500">No scheduled tasks. Log an action to keep the day optimized.</p>
                )}
                {combinedSelectedDayTasks.map((task) => {
                  const status = taskStatus[task.id] ?? task.status;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleTaskToggle(task.id)}
                      className={classNames(
                        "w-full rounded-2xl border px-4 py-3 text-left transition",
                        status === "completed"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{task.title}</p>
                          <p className="text-xs text-slate-500">{task.description}</p>
                        </div>
                        <span
                          className={classNames(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            task.impact.type === "reduction" && "bg-emerald-500/15 text-emerald-700",
                            task.impact.type === "shift" && "bg-sky-500/20 text-sky-600",
                            task.impact.type === "generation" && "bg-amber-500/15 text-amber-600"
                          )}
                        >
                          {task.impact.type}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                        <span>{task.time}</span>
                        <span>{task.impact.value.toFixed(1)} kWh impact</span>
                        <span>{status === "completed" ? "Marked complete" : "Tap to mark done"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleTaskSubmit} className="mt-auto space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold uppercase text-slate-500">Log quick action</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Title
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(event) => handleFormChange("title", event.target.value)}
                    placeholder="e.g. Pre-cool workspace"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Time
                  <input
                    type="time"
                    value={formState.time}
                    onChange={(event) => handleFormChange("time", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
              </div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Impact (kWh)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formState.impactValue}
                  onChange={(event) => handleFormChange("impactValue", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Action type
                <select
                  value={formState.impactType}
                  onChange={(event) =>
                    handleFormChange("impactType", event.target.value as TaskFormState["impactType"])
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="reduction">Load reduction</option>
                  <option value="shift">Load shift</option>
                  <option value="generation">On-site generation</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notes
                <textarea
                  value={formState.description}
                  onChange={(event) => handleFormChange("description", event.target.value)}
                  placeholder="Add context or owners"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Add action to {formatShortDate(selectedDay.date)}
              </button>
            </form>
          </aside>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1.6fr]">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6">
          <h3 className="text-sm font-semibold uppercase text-emerald-700">Demand response timeline</h3>
          <div className="mt-4 space-y-4">
            {demandEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-emerald-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm"
              >
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{event.shortDate}</p>
                    <p className="text-xs text-slate-500">{event.window}</p>
                  </div>
                  <span
                    className={classNames(
                      "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                      event.priority === "high" && "bg-rose-500/15 text-rose-600",
                      event.priority === "medium" && "bg-amber-500/15 text-amber-600",
                      event.priority === "low" && "bg-emerald-500/15 text-emerald-600"
                    )}
                  >
                    {event.priority} priority
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{event.recommendation}</p>
                <p className="mt-2 text-xs font-semibold text-emerald-600">Incentive: {event.incentive}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Optimization playbook</h3>
          <ul className="mt-4 space-y-4 text-sm text-slate-600">
            {snapshot.recommendations.map((tip, index) => (
              <li key={index} className="rounded-2xl bg-slate-50/80 p-4">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  trend,
  trendSuffix,
}: {
  label: string;
  value: string;
  helper: string;
  trend: number;
  trendSuffix?: string;
}) {
  const positive = trend <= 0;
  const formattedTrend = Number.isFinite(trend) ? Math.abs(trend).toFixed(1) : "0.0";
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p
        className={classNames(
          "mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
          positive ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/20 text-amber-600"
        )}
      >
        {positive ? "Improvement" : "Above baseline"} • {formattedTrend}
        {trendSuffix ?? " kWh"}
      </p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function WeeklyTrendChart({ averages, maxUsage }: { averages: number[]; maxUsage: number }) {
  return (
    <div className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span>Weekly trend</span>
        <span>kWh</span>
      </div>
      <div className="space-y-2">
        {averages.map((average, index) => {
          const fraction = Math.min(1, average / maxUsage);
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Week {index + 1}</span>
                <span>{average.toFixed(1)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all"
                  style={{ width: `${Math.max(fraction * 100, 8)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
