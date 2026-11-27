import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useAdminDashboard(selectedDate) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [stations, setStations] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr || !user) {
        throw new Error("Sesión no iniciada.");
      }

      const { data: tenantData, error: tenantErr } = await supabase
        .from("tenants")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (tenantErr || !tenantData) {
        throw new Error("No se encontró un comercio asociado a esta cuenta.");
      }

      const [stRes, srvRes, appRes] = await Promise.all([
        supabase
          .from("stations")
          .select("*")
          .eq("tenant_id", tenantData.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("services")
          .select("*")
          .eq("tenant_id", tenantData.id)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("appointments")
          .select("*, services(name, duration_minutes, price)")
          .eq("tenant_id", tenantData.id)
          .eq("date", selectedDate)
          .neq("status", "cancelled")
          .order("start_time", { ascending: true }),
      ]);

      setTenant(tenantData);
      setStations(stRes.data ?? []);
      setServices(srvRes.data ?? []);
      setAppointments(appRes.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function cancelAppointment(appointmentId) {
    const { error: cancelErr } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId);

    if (cancelErr) {
      throw new Error("No se pudo cancelar el turno.");
    }

    setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
  }

  async function markReminderSent(appointmentId) {
    const { error: updateErr } = await supabase
      .from("appointments")
      .update({ reminder_sent: true })
      .eq("id", appointmentId);

    if (!updateErr) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, reminder_sent: true } : a))
      );
    }
  }

  async function createManualAppointment(payload) {
    const { data, error: insertErr } = await supabase
      .from("appointments")
      .insert([{ ...payload, tenant_id: tenant.id, status: "confirmed" }])
      .select("*, services(name, duration_minutes, price)")
      .single();

    if (insertErr) {
      if (insertErr.code === "23P01") {
        throw new Error("Esa estación ya tiene un turno superpuesto en ese horario.");
      }
      throw new Error("No se pudo agendar el turno manual.");
    }

    setAppointments((prev) =>
      [...prev, data].sort((a, b) => a.start_time.localeCompare(b.start_time))
    );
    return data;
  }

  return {
    loading,
    error,
    tenant,
    stations,
    services,
    appointments,
    cancelAppointment,
    markReminderSent,
    createManualAppointment,
    refresh: loadDashboard,
  };
}