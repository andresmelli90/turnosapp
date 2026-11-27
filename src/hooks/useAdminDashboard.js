import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useAdminDashboard(selectedDate) {
  const [loading, setLoading] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [error, setError] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [stations, setStations] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const fetchAppointmentsForDate = useCallback(async (tenantId, dateStr) => {
    if (!tenantId || !dateStr) return [];
    const { data, error: appErr } = await supabase
      .from("appointments")
      .select("*, services(name, duration_minutes, price)")
      .eq("tenant_id", tenantId)
      .eq("date", dateStr)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    if (appErr) {
      throw new Error("No se pudieron cargar los turnos del día.");
    }

    return data ?? [];
  }, []);

  const loadBaseData = useCallback(async () => {
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

      const [stRes, srvRes] = await Promise.all([
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
      ]);

      if (stRes.error) {
        throw new Error("No se pudieron cargar las estaciones.");
      }
      if (srvRes.error) {
        throw new Error("No se pudieron cargar los servicios.");
      }

      setTenant(tenantData);
      setStations(stRes.data ?? []);
      setServices(srvRes.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (!tenant?.id || !selectedDate) return;

    let active = true;
    setLoadingAppointments(true);
    setError(null);

    fetchAppointmentsForDate(tenant.id, selectedDate)
      .then((rows) => {
        if (active) setAppointments(rows);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingAppointments(false);
      });

    return () => {
      active = false;
    };
  }, [tenant?.id, selectedDate, fetchAppointmentsForDate]);

  const refresh = useCallback(async () => {
    await loadBaseData();
    if (tenant?.id && selectedDate) {
      const rows = await fetchAppointmentsForDate(tenant.id, selectedDate);
      setAppointments(rows);
    }
  }, [loadBaseData, fetchAppointmentsForDate, tenant?.id, selectedDate]);

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
    if (!tenant?.id) {
      throw new Error("No se encontró el comercio activo.");
    }

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
    loadingAppointments,
    error,
    tenant,
    stations,
    services,
    appointments,
    cancelAppointment,
    markReminderSent,
    createManualAppointment,
    refresh,
  };
}