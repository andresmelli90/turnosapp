import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTenantBooking } from "../../hooks/useTenantBooking";
import { getAvailableSlots, pickAvailableStationId } from "../../utils/availability";
import { ServiceSelector } from "../../components/booking/ServiceSelector";
import { StationSelector } from "../../components/booking/StationSelector";
import { DateStripPicker } from "../../components/booking/DateStripPicker";
import { TimeSlotGrid } from "../../components/booking/TimeSlotGrid";
import { BookingSummaryBar } from "../../components/booking/BookingSummaryBar";

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

function getNextDays(count = 14) {
  const days = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    days.push({ iso, label, displayDate: formatDisplayDate(iso) });
  }
  return days;
}

function addMinutesToTime(startTime, minutesToAdd) {
  const [hours, minutes] = startTime.slice(0, 5).split(":").map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}

export function PublicBookingPage() {
  const { slug } = useParams();
  const days = useMemo(() => getNextDays(14), []);

  const {
    loading,
    error,
    tenant,
    stations,
    services,
    schedules,
    appointments,
    createBooking,
  } = useTenantBooking(slug);

  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(days[0]?.iso ?? "");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  useEffect(() => {
    if (services.length > 0 && !selectedServiceId) {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId]
  );

  const showStationPicker =
    Boolean(tenant?.allow_station_choice) && stations.length > 1;

  const availableSlots = useMemo(() => {
    if (!selectedService || !selectedDate) return [];
    return getAvailableSlots({
      dateStr: selectedDate,
      durationMinutes: selectedService.duration_minutes,
      stations,
      schedules,
      appointments,
      selectedStationId,
    });
  }, [
    selectedService,
    selectedDate,
    stations,
    schedules,
    appointments,
    selectedStationId,
  ]);

  const canConfirm = Boolean(
    tenant &&
      selectedService &&
      selectedDate &&
      selectedSlot &&
      clientName.trim().length >= 2 &&
      clientPhone.trim().length >= 7
  );

  function resetSlot() {
    setSelectedSlot(null);
    setSubmitError(null);
    setConfirmedBooking(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canConfirm || !selectedService || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const assignedStationId =
        selectedStationId ??
        pickAvailableStationId({
          dateStr: selectedDate,
          startTime: selectedSlot,
          durationMinutes: selectedService.duration_minutes,
          stations,
          schedules,
          appointments,
        });

      if (!assignedStationId) {
        resetSlot();
        throw new Error("No quedó ninguna estación libre para ese horario. Elegí otro.");
      }

      const startTimeFormatted = `${selectedSlot.slice(0, 5)}:00`;
      const endTimeFormatted = addMinutesToTime(
        selectedSlot,
        selectedService.duration_minutes
      );

      const saved = await createBooking({
        station_id: assignedStationId,
        service_id: selectedService.id,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        date: selectedDate,
        start_time: startTimeFormatted,
        end_time: endTimeFormatted,
      });

      const stationObj = stations.find((s) => s.id === assignedStationId);

      setConfirmedBooking({
        ...saved,
        serviceName: selectedService.name,
        price: selectedService.price,
        stationName: stationObj?.name ?? "Estación asignada",
      });
      setSelectedSlot(null);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center px-4 text-sm">
        Cargando agenda...
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center space-y-2">
          <p className="text-base font-semibold text-white">Enlace no disponible</p>
          <p className="text-xs text-zinc-400">
            {error ?? "No encontramos el comercio solicitado."}
          </p>
        </div>
      </div>
    );
  }

  const stepDate = showStationPicker ? 3 : 2;
  const stepSlot = showStationPicker ? 4 : 3;
  const stepClient = showStationPicker ? 5 : 4;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-28">
      <div className="mx-auto max-w-md px-4 pt-6 space-y-6">
        {/* Encabezado */}
        <header className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-lg font-bold text-amber-400">
            {tenant.business_name?.[0]?.toUpperCase() ?? "T"}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">
              {tenant.business_name}
            </h1>
            <p className="text-xs text-zinc-400">
              Reservá en segundos • Sin registro
            </p>
          </div>
        </header>

        <form id="public-booking-form" onSubmit={handleSubmit} className="space-y-6">
          <ServiceSelector
            stepNumber={1}
            services={services}
            selectedServiceId={selectedServiceId}
            onSelect={(id) => {
              setSelectedServiceId(id);
              resetSlot();
            }}
          />

          {showStationPicker && (
            <StationSelector
              stepNumber={2}
              stations={stations}
              selectedStationId={selectedStationId}
              onSelect={(id) => {
                setSelectedStationId(id);
                resetSlot();
              }}
            />
          )}

          <DateStripPicker
            stepNumber={stepDate}
            days={days}
            selectedDate={selectedDate}
            onSelect={(iso) => {
              setSelectedDate(iso);
              resetSlot();
            }}
          />

          <TimeSlotGrid
            stepNumber={stepSlot}
            slots={availableSlots}
            selectedSlot={selectedSlot}
            onSelect={(slot) => {
              setSelectedSlot(slot);
              setSubmitError(null);
              setConfirmedBooking(null);
            }}
          />

          {/* Datos del cliente */}
          <section className="space-y-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {stepClient}. Tus datos para el recordatorio
            </h2>
            <div className="space-y-2.5">
              <input
                type="text"
                required
                placeholder="Tu nombre y apellido"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
              />
              <input
                type="tel"
                required
                placeholder="WhatsApp (ej. 2615551234)"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </section>
        </form>

        {submitError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
            {submitError}
          </div>
        )}

        {confirmedBooking && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100 space-y-1">
            <p className="font-semibold text-emerald-300">¡Turno confirmado!</p>
            <p>
              {confirmedBooking.serviceName} • {formatDisplayDate(confirmedBooking.date)} a las{" "}
              {confirmedBooking.start_time.slice(0, 5)}
            </p>
            <p className="text-xs text-emerald-200/80">
              {confirmedBooking.stationName} • Cliente: {confirmedBooking.client_name}
            </p>
          </div>
        )}
      </div>

      <BookingSummaryBar
        service={selectedService}
        date={selectedDate}
        slot={selectedSlot}
        canConfirm={canConfirm}
        submitting={submitting}
      />
    </div>
  );
}