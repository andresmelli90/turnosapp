import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  MessageCircle,
  Plus,
  Trash2,
  LogOut,
  Clock,
  Phone,
  Settings,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAdminDashboard } from "../../hooks/useAdminDashboard";

function formatLocalDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDate(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return formatLocalDate(dt);
}

function formatWhatsAppUrl(phone, text) {
  const digits = String(phone).replace(/\D/g, "");
  // Normalización básica para Argentina si cargan 10 dígitos (ej. 2615551234 -> 5492615551234)
  const normalized = digits.length === 10 ? `549${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

function addMinutesToTime(startTime, minutesToAdd) {
  const [h, m] = startTime.slice(0, 5).split(":").map(Number);
  const total = h * 60 + m + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(
    2,
    "0"
  )}:00`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const todayIso = useMemo(() => formatLocalDate(new Date()), []);
  const tomorrowIso = useMemo(() => shiftDate(todayIso, 1), [todayIso]);

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado del formulario manual
  const [manualStationId, setManualStationId] = useState("");
  const [manualServiceId, setManualServiceId] = useState("");
  const [manualTime, setManualTime] = useState("10:00");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [modalError, setModalError] = useState(null);
  const [savingManual, setSavingManual] = useState(false);

  const {
    loading,
    error,
    tenant,
    stations,
    services,
    appointments,
    cancelAppointment,
    markReminderSent,
    createManualAppointment,
  } = useAdminDashboard(selectedDate);

  const publicUrl = tenant ? `${window.location.origin}/${tenant.slug}` : "";

  async function handleCopyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  async function handleSendWhatsApp(app, stationName) {
    const timeLabel = app.start_time.slice(0, 5);
    const serviceName = app.services?.name ?? "tu servicio";
    const dayText =
      app.date === tomorrowIso
        ? "mañana"
        : app.date === todayIso
        ? "hoy"
        : `el ${app.date}`;

    const message = `Hola ${app.client_name}, te recordamos tu turno en *${tenant.business_name}* ${dayText} a las *${timeLabel} hs* (${serviceName} - ${stationName}). ¡Te esperamos!`;

    window.open(formatWhatsAppUrl(app.client_phone, message), "_blank", "noopener,noreferrer");
    await markReminderSent(app.id);
  }

  async function handleCancel(app) {
    const confirmed = window.confirm(
      `¿Cancelar el turno de ${app.client_name} a las ${app.start_time.slice(0, 5)}?`
    );
    if (!confirmed) return;

    try {
      await cancelAppointment(app.id);
    } catch (err) {
      alert(err.message);
    }
  }

  function openManualModal(defaultStationId = "") {
    setManualStationId(defaultStationId || stations[0]?.id || "");
    setManualServiceId(services[0]?.id || "");
    setManualTime("10:00");
    setManualName("");
    setManualPhone("");
    setModalError(null);
    setIsModalOpen(true);
  }

  async function handleSaveManual(e) {
    e.preventDefault();
    const serviceObj = services.find((s) => s.id === manualServiceId);
    if (!manualStationId || !serviceObj || !manualName.trim()) return;

    setSavingManual(true);
    setModalError(null);

    try {
      await createManualAppointment({
        station_id: manualStationId,
        service_id: serviceObj.id,
        client_name: manualName.trim(),
        client_phone: manualPhone.trim() || "Sin teléfono",
        date: selectedDate,
        start_time: `${manualTime}:00`,
        end_time: addMinutesToTime(manualTime, serviceObj.duration_minutes),
      });
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSavingManual(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
        Cargando panel de agenda...
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center space-y-4">
          <p className="text-sm text-rose-300">{error ?? "Acceso no autorizado"}</p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950"
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Barra superior */}
      <header className="border-b border-zinc-800 bg-zinc-900/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <h1 className="text-base font-semibold text-white">{tenant.business_name}</h1>
            <p className="text-xs text-zinc-400">
              Agenda diaria • {appointments.length} turno(s) activo(s)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-amber-400 transition"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Link copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-amber-400" />
                  Copiar link de reserva
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => openManualModal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition"
            >
              <Plus className="h-4 w-4" />
              Nuevo turno
            </button>

            <Link
              to="/admin/settings"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-amber-400 transition"
            >
              <Settings className="h-3.5 w-3.5 text-amber-400" />
              Configuración
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="rounded-xl border border-zinc-800 p-2 text-zinc-400 hover:text-white transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Controles de fecha */}
      <main className="mx-auto max-w-7xl px-4 py-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-300 hover:border-zinc-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="relative flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5">
              <Calendar className="h-4 w-4 text-amber-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-white focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-300 hover:border-zinc-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(todayIso)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedDate === todayIso
                  ? "bg-amber-400 text-zinc-950"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(tomorrowIso)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedDate === tomorrowIso
                  ? "bg-amber-400 text-zinc-950"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              Mañana
            </button>
          </div>
        </div>

        {/* Columnas por Estación */}
        {stations.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
            No tenés estaciones activas configuradas.
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.min(stations.length, 4)}, minmax(260px, 1fr))`,
            }}
          >
            {stations.map((station) => {
              const stationApps = appointments.filter((a) => a.station_id === station.id);

              return (
                <section
                  key={station.id}
                  className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
                >
                  {/* Encabezado de estación */}
                  <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold text-white">{station.name}</h2>
                      <p className="text-xs text-zinc-400">
                        {stationApps.length} turno(s)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openManualModal(station.id)}
                      title="Agregar turno en esta estación"
                      className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-1.5 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Lista de turnos de la estación */}
                  <div className="flex-1 space-y-2.5 p-3">
                    {stationApps.length === 0 ? (
                      <p className="py-8 text-center text-xs text-zinc-500">
                        Sin turnos agendados
                      </p>
                    ) : (
                      stationApps.map((app) => (
                        <article
                          key={app.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-3 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                                <Clock className="h-3 w-3" />
                                {app.start_time.slice(0, 5)} - {app.end_time.slice(0, 5)}
                              </span>
                              <h3 className="mt-1.5 text-sm font-medium text-white">
                                {app.client_name}
                              </h3>
                              <p className="text-xs text-zinc-400">
                                {app.services?.name ?? "Servicio"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCancel(app)}
                              title="Cancelar turno"
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-2">
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                              <Phone className="h-3 w-3" />
                              {app.client_phone}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleSendWhatsApp(app, station.name)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                                app.reminder_sent
                                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                  : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                              }`}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {app.reminder_sent ? "Recordado" : "Recordar"}
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Turno Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Agendar turno manual ({selectedDate})
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Estación</label>
                <select
                  value={manualStationId}
                  onChange={(e) => setManualStationId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Servicio</label>
                  <select
                    value={manualServiceId}
                    onChange={(e) => setManualServiceId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                  >
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} ({srv.duration_minutes}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Hora inicio</label>
                  <input
                    type="time"
                    step="900"
                    required
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400">Nombre cliente</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Gómez"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400">WhatsApp</label>
                <input
                  type="tel"
                  placeholder="Ej. 2615551234"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {modalError && (
                <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-200">
                  {modalError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-40"
                >
                  {savingManual ? "Guardando..." : "Guardar turno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}