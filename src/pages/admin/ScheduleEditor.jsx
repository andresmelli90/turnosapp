import { useEffect, useState } from "react";
import { Clock, Save, Check } from "lucide-react";

const DAYS = [
  { day_of_week: 1, label: "Lunes" },
  { day_of_week: 2, label: "Martes" },
  { day_of_week: 3, label: "Miércoles" },
  { day_of_week: 4, label: "Jueves" },
  { day_of_week: 5, label: "Viernes" },
  { day_of_week: 6, label: "Sábado" },
  { day_of_week: 0, label: "Domingo" },
];

function buildDayRows(schedules, targetStationId) {
  const filtered = schedules.filter((s) =>
    targetStationId === "general" ? s.station_id === null : s.station_id === targetStationId
  );

  return DAYS.map((d) => {
    const match = filtered.find((s) => s.day_of_week === d.day_of_week);
    return {
      day_of_week: d.day_of_week,
      label: d.label,
      enabled: Boolean(match),
      start_time: match ? match.start_time.slice(0, 5) : "09:00",
      end_time: match ? match.end_time.slice(0, 5) : "19:00",
    };
  });
}

export function ScheduleEditor({
  stations = [],
  schedules = [],
  onSaveSchedules,
  saving = false,
}) {
  const [targetStationId, setTargetStationId] = useState("general");
  const [rows, setRows] = useState(() => buildDayRows(schedules, "general"));
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    setRows(buildDayRows(schedules, targetStationId));
  }, [schedules, targetStationId]);

  function toggleDay(dayOfWeek) {
    setRows((prev) =>
      prev.map((r) => (r.day_of_week === dayOfWeek ? { ...r, enabled: !r.enabled } : r))
    );
  }

  function updateTime(dayOfWeek, field, value) {
    setRows((prev) =>
      prev.map((r) => (r.day_of_week === dayOfWeek ? { ...r, [field]: value } : r))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const activeBlocks = rows
      .filter((r) => r.enabled && r.start_time < r.end_time)
      .map((r) => ({
        station_id: targetStationId === "general" ? null : targetStationId,
        day_of_week: r.day_of_week,
        start_time: `${r.start_time}:00`,
        end_time: `${r.end_time}:00`,
      }));

    await onSaveSchedules(targetStationId, activeBlocks);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white">
          <Clock className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold">Horarios de atención</h2>
        </div>

        <select
          value={targetStationId}
          onChange={(e) => setTargetStationId(e.target.value)}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
        >
          <option value="general">Horario general del local</option>
          {stations
            .filter((s) => s.is_active)
            .map((st) => (
              <option key={st.id} value={st.id}>
                Solo {st.name}
              </option>
            ))}
        </select>
      </div>

      <p className="text-xs text-zinc-400">
        {targetStationId === "general"
          ? "Aplica a todas las estaciones que no tengan un horario individual definido."
          : "Sobrescribe el horario general únicamente para esta estación."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950/60">
          {rows.map((row) => {
            const invalidRange = row.enabled && row.start_time >= row.end_time;
            return (
              <div
                key={row.day_of_week}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
              >
                <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-[120px]">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={() => toggleDay(row.day_of_week)}
                    className="h-4 w-4 rounded accent-amber-400"
                  />
                  <span
                    className={`text-sm font-medium ${
                      row.enabled ? "text-white" : "text-zinc-500"
                    }`}
                  >
                    {row.label}
                  </span>
                </label>

                {row.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={row.start_time}
                      onChange={(e) =>
                        updateTime(row.day_of_week, "start_time", e.target.value)
                      }
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500">a</span>
                    <input
                      type="time"
                      value={row.end_time}
                      onChange={(e) =>
                        updateTime(row.day_of_week, "end_time", e.target.value)
                      }
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                    {invalidRange && (
                      <span className="text-[11px] text-rose-400">
                        Fin debe ser mayor
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {savedFeedback && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Horarios actualizados
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Guardando..." : "Guardar horarios"}
          </button>
        </div>
      </form>
    </section>
  );
}