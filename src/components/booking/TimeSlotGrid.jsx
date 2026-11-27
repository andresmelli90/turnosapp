export function TimeSlotGrid({ stepNumber, slots = [], selectedSlot, onSelect }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {stepNumber}. Elegí un horario
      </h2>
      {slots.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 text-xs text-zinc-400">
          No hay horarios disponibles para esta combinación. Probá con otro día o estación.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const isSelected = slot === selectedSlot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => onSelect(slot)}
                className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                  isSelected
                    ? "border-amber-400 bg-amber-400 text-zinc-950"
                    : "border-zinc-800 bg-zinc-900 text-zinc-100 hover:border-zinc-700"
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}