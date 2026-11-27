export function DateStripPicker({ stepNumber, days = [], selectedDate, onSelect }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {stepNumber}. Elegí el día
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => {
          const isSelected = day.iso === selectedDate;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelect(day.iso)}
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-medium capitalize transition ${
                isSelected
                  ? "border-amber-400 bg-amber-400 text-zinc-950"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {day.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}