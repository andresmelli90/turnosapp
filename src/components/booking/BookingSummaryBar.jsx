function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}

export function BookingSummaryBar({
  service,
  date,
  slot,
  canConfirm,
  submitting,
  formId = "public-booking-form",
}) {
  const formattedDate = formatDisplayDate(date);

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-white">
            {service
              ? `${service.name} • $${Number(service.price).toLocaleString("es-AR")}`
              : "Seleccioná un servicio"}
          </p>
          <p className="truncate text-xs text-zinc-400">
            {formattedDate && slot ? `${formattedDate} • ${slot}` : "Elegí día y horario"}
          </p>
        </div>

        <button
          type="submit"
          form={formId}
          disabled={!canConfirm || submitting}
          className="shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Reservando..." : "Confirmar turno"}
        </button>
      </div>
    </div>
  );
}