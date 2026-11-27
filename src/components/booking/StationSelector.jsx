export function StationSelector({
  stepNumber = 2,
  stations = [],
  selectedStationId,
  onSelect,
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {stepNumber}. Profesional o estación
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
            selectedStationId === null
              ? "border-amber-400 bg-amber-400 text-zinc-950"
              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
          }`}
        >
          Cualquier disponible
        </button>

        {stations.map((station) => {
          const isSelected = selectedStationId === station.id;
          return (
            <button
              key={station.id}
              type="button"
              onClick={() => onSelect(station.id)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                isSelected
                  ? "border-amber-400 bg-amber-400 text-zinc-950"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {station.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}