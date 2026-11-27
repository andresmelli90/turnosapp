import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Edit2,
  Plus,
  Power,
  Save,
  Scissors,
  Users,
  Store,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ScheduleEditor } from "./ScheduleEditor";

export function SettingsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [stations, setStations] = useState([]);
  const [services, setServices] = useState([]);

  // Estado formulario comercio
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [allowStationChoice, setAllowStationChoice] = useState(true);
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantSavedMsg, setTenantSavedMsg] = useState(false);

  // Estado nueva estación
  const [newStationName, setNewStationName] = useState("");
  const [addingStation, setAddingStation] = useState(false);

  // Estado nuevo servicio / edición de servicio
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(30);
  const [newServicePrice, setNewServicePrice] = useState("");
  const [addingService, setAddingService] = useState(false);

  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceForm, setEditServiceForm] = useState({
    name: "",
    duration_minutes: 30,
    price: 0,
  });

  const [errorMsg, setErrorMsg] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [savingSchedules, setSavingSchedules] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
          navigate("/login", { replace: true });
          return;
        }

        const { data: tenantData, error: tenantErr } = await supabase
          .from("tenants")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (tenantErr || !tenantData) {
          throw new Error("No se encontró el comercio.");
        }

        const [stRes, srvRes, schRes] = await Promise.all([
          supabase
            .from("stations")
            .select("*")
            .eq("tenant_id", tenantData.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("services")
            .select("*")
            .eq("tenant_id", tenantData.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("schedules")
            .select("*")
            .eq("tenant_id", tenantData.id),
        ]);

        setTenant(tenantData);
        setBusinessName(tenantData.business_name);
        setSlug(tenantData.slug);
        setPhone(tenantData.phone ?? "");
        setAllowStationChoice(Boolean(tenantData.allow_station_choice));

        setStations(stRes.data ?? []);
        setServices(srvRes.data ?? []);
        setSchedules(schRes.data ?? []);
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [navigate]);

  // --- Guardar configuración general del comercio ---
  async function handleSaveTenant(e) {
    e.preventDefault();
    if (!tenant || !businessName.trim() || !slug.trim()) return;

    setSavingTenant(true);
    setErrorMsg(null);
    setTenantSavedMsg(false);

    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data, error } = await supabase
      .from("tenants")
      .update({
        business_name: businessName.trim(),
        slug: cleanSlug,
        phone: phone.trim() || null,
        allow_station_choice: allowStationChoice,
      })
      .eq("id", tenant.id)
      .select()
      .single();

    setSavingTenant(false);

    if (error) {
      setErrorMsg(
        error.code === "23505"
          ? "Ese enlace (slug) ya está en uso por otro comercio."
          : "No se pudieron guardar los cambios."
      );
      return;
    }

    setTenant(data);
    setSlug(data.slug);
    setTenantSavedMsg(true);
    setTimeout(() => setTenantSavedMsg(false), 2500);
  }

  // --- Estaciones ---
  async function handleAddStation(e) {
    e.preventDefault();
    if (!tenant || !newStationName.trim()) return;

    setAddingStation(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("stations")
      .insert([
        {
          tenant_id: tenant.id,
          name: newStationName.trim(),
          is_active: true,
        },
      ])
      .select()
      .single();

    setAddingStation(false);

    if (error) {
      setErrorMsg("No se pudo agregar la estación.");
      return;
    }

    // Copiar horarios generales si la estación nueva aún no tiene específicos
    setStations((prev) => [...prev, data]);
    setNewStationName("");
  }

  async function handleToggleStation(station) {
    const activeCount = stations.filter((s) => s.is_active).length;
    if (station.is_active && activeCount <= 1) {
      setErrorMsg("Debe quedar al menos 1 estación activa en el local.");
      return;
    }

    setErrorMsg(null);
    const nextState = !station.is_active;

    const { error } = await supabase
      .from("stations")
      .update({ is_active: nextState })
      .eq("id", station.id);

    if (error) {
      setErrorMsg("No se pudo actualizar el estado de la estación.");
      return;
    }

    setStations((prev) =>
      prev.map((s) => (s.id === station.id ? { ...s, is_active: nextState } : s))
    );
  }

  // --- Servicios ---
  async function handleAddService(e) {
    e.preventDefault();
    if (!tenant || !newServiceName.trim()) return;

    setAddingService(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("services")
      .insert([
        {
          tenant_id: tenant.id,
          name: newServiceName.trim(),
          duration_minutes: Number(newServiceDuration) || 30,
          price: Number(newServicePrice) || 0,
          is_active: true,
        },
      ])
      .select()
      .single();

    setAddingService(false);

    if (error) {
      setErrorMsg("No se pudo crear el servicio.");
      return;
    }

    setServices((prev) => [...prev, data]);
    setNewServiceName("");
    setNewServiceDuration(30);
    setNewServicePrice("");
  }

  function startEditingService(service) {
    setEditingServiceId(service.id);
    setEditServiceForm({
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: service.price,
    });
  }

  async function handleSaveServiceEdit(serviceId) {
    if (!editServiceForm.name.trim()) return;
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("services")
      .update({
        name: editServiceForm.name.trim(),
        duration_minutes: Number(editServiceForm.duration_minutes) || 30,
        price: Number(editServiceForm.price) || 0,
      })
      .eq("id", serviceId)
      .select()
      .single();

    if (error) {
      setErrorMsg("No se pudo actualizar el servicio.");
      return;
    }

    setServices((prev) => prev.map((s) => (s.id === serviceId ? data : s)));
    setEditingServiceId(null);
  }

  async function handleToggleService(service) {
    const activeCount = services.filter((s) => s.is_active).length;
    if (service.is_active && activeCount <= 1) {
      setErrorMsg("Debe quedar al menos 1 servicio activo.");
      return;
    }

    setErrorMsg(null);
    const nextState = !service.is_active;

    const { error } = await supabase
      .from("services")
      .update({ is_active: nextState })
      .eq("id", service.id);

    if (error) {
      setErrorMsg("No se pudo cambiar el estado del servicio.");
      return;
    }

    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, is_active: nextState } : s))
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
        Cargando configuración...
      </div>
    );
  }

  async function handleSaveSchedules(targetStationId, activeBlocks) {
    if (!tenant) return;
    setSavingSchedules(true);
    setErrorMsg(null);
  
    try {
      let deleteQuery = supabase
        .from("schedules")
        .delete()
        .eq("tenant_id", tenant.id);
  
      deleteQuery =
        targetStationId === "general"
          ? deleteQuery.is("station_id", null)
          : deleteQuery.eq("station_id", targetStationId);
  
      const { error: delErr } = await deleteQuery;
      if (delErr) throw new Error("No se pudieron limpiar los horarios anteriores.");
  
      let inserted = [];
      if (activeBlocks.length > 0) {
        const rowsToInsert = activeBlocks.map((b) => ({
          ...b,
          tenant_id: tenant.id,
        }));
        const { data, error: insErr } = await supabase
          .from("schedules")
          .insert(rowsToInsert)
          .select();
        if (insErr) throw new Error("No se pudieron guardar los nuevos horarios.");
        inserted = data ?? [];
      }
  
      setSchedules((prev) => {
        const remaining = prev.filter((s) =>
          targetStationId === "general" ? s.station_id !== null : s.station_id !== targetStationId
        );
        return [...remaining, ...inserted];
      });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSavingSchedules(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-14">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-white">
                Configuración del comercio
              </h1>
              <p className="text-xs text-zinc-400">
                Estaciones, servicios y preferencias de reserva
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6 space-y-6">
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Sección 1: Datos del negocio y modalidad de asignación */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <div className="flex items-center gap-2 text-white">
            <Store className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold">Datos generales y reservas</h2>
          </div>

          <form onSubmit={handleSaveTenant} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Nombre comercial
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Enlace público (slug)
                </label>
                <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                  <span className="text-zinc-500 select-none">/</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-transparent text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5">
              <div>
                <p className="text-sm font-medium text-white">
                  Permitir elegir profesional o estación
                </p>
                <p className="text-xs text-zinc-400">
                  Si está desactivado, el sistema asigna automáticamente el primer puesto
                  libre en el horario elegido.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={allowStationChoice}
                onClick={() => setAllowStationChoice((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  allowStationChoice ? "bg-amber-400" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-zinc-950 transition ${
                    allowStationChoice ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-end gap-3">
              {tenantSavedMsg && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  Cambios guardados
                </span>
              )}
              <button
                type="submit"
                disabled={savingTenant}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {savingTenant ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </section>

        {/* Sección 2: Estaciones / Profesionales */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Users className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold">Estaciones / Profesionales</h2>
            </div>
            <span className="text-xs text-zinc-400">
              {stations.filter((s) => s.is_active).length} activa(s)
            </span>
          </div>

          <form onSubmit={handleAddStation} className="flex gap-2">
            <input
              type="text"
              placeholder="Ej. Sillón 2 - Matías"
              value={newStationName}
              onChange={(e) => setNewStationName(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={addingStation || !newStationName.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </form>

          <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950/60">
            {stations.map((station) => (
              <div
                key={station.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      station.is_active ? "bg-emerald-400" : "bg-zinc-600"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      station.is_active ? "text-white" : "text-zinc-500 line-through"
                    }`}
                  >
                    {station.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleStation(station)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    station.is_active
                      ? "border-zinc-700 text-zinc-300 hover:border-rose-500/50 hover:text-rose-300"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {station.is_active ? "Desactivar" : "Activar"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Sección 3: Servicios */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <div className="flex items-center gap-2 text-white">
            <Scissors className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold">Servicios y precios</h2>
          </div>

          <form
            onSubmit={handleAddService}
            className="grid gap-2 sm:grid-cols-[1fr_110px_120px_auto]"
          >
            <input
              type="text"
              placeholder="Nombre (ej. Corte clásico)"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
            />
            <select
              value={newServiceDuration}
              onChange={(e) => setNewServiceDuration(Number(e.target.value))}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            >
              {[15, 30, 45, 60, 75, 90, 120].map((min) => (
                <option key={min} value={min}>
                  {min} min
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="100"
              placeholder="Precio ($)"
              value={newServicePrice}
              onChange={(e) => setNewServicePrice(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={addingService || !newServiceName.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </form>

          <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950/60">
            {services.map((service) => {
              const isEditing = editingServiceId === service.id;

              return (
                <div key={service.id} className="px-4 py-3">
                  {isEditing ? (
                    <div className="grid gap-2 sm:grid-cols-[1fr_110px_120px_auto] items-center">
                      <input
                        type="text"
                        value={editServiceForm.name}
                        onChange={(e) =>
                          setEditServiceForm((f) => ({ ...f, name: e.target.value }))
                        }
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white"
                      />
                      <select
                        value={editServiceForm.duration_minutes}
                        onChange={(e) =>
                          setEditServiceForm((f) => ({
                            ...f,
                            duration_minutes: Number(e.target.value),
                          }))
                        }
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-white"
                      >
                        {[15, 30, 45, 60, 75, 90, 120].map((min) => (
                          <option key={min} value={min}>
                            {min} min
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={editServiceForm.price}
                        onChange={(e) =>
                          setEditServiceForm((f) => ({ ...f, price: e.target.value }))
                        }
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveServiceEdit(service.id)}
                          className="rounded-lg bg-emerald-500 p-1.5 text-zinc-950 hover:bg-emerald-400"
                          title="Guardar"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingServiceId(null)}
                          className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:text-white"
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            service.is_active ? "text-white" : "text-zinc-500 line-through"
                          }`}
                        >
                          {service.name}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {service.duration_minutes} min • $
                          {Number(service.price).toLocaleString("es-AR")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingService(service)}
                          className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:border-amber-400 hover:text-amber-400 transition"
                          title="Editar servicio"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleService(service)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                            service.is_active
                              ? "border-zinc-700 text-zinc-300 hover:border-rose-500/50 hover:text-rose-300"
                              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {service.is_active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <ScheduleEditor
          stations={stations}
          schedules={schedules}
          onSaveSchedules={handleSaveSchedules}
          saving={savingSchedules}
        />
      </main>
    </div>
  );
}