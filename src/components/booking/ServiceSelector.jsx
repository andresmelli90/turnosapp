export function ServiceSelector({ stepNumber = 1, services = [], selectedServiceId, onSelect }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {stepNumber}. Elegí un servicio
      </h2>
      <div className="space-y-2">
        {services.map((service) => {
          const isSelected = service.id === selectedServiceId;
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service.id)}
              className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition ${
                isSelected
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-white">{service.name}</p>
                <p className="text-xs text-zinc-400">{service.duration_minutes} min</p>
              </div>
              <span className="text-sm font-semibold text-amber-400">
                ${Number(service.price).toLocaleString("es-AR")}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}