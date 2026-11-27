import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useTenantBooking(slug) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [stations, setStations] = useState([]);
  const [services, setServices] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const loadData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    try {
      const { data: tenantData, error: tenantErr } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", slug)
        .single();

      if (tenantErr || !tenantData) {
        throw new Error("Comercio no encontrado.");
      }

      const todayIso = new Date().toISOString().split("T")[0];

      const [stRes, srvRes, schRes, appRes] = await Promise.all([
        supabase.from("stations").select("*").eq("tenant_id", tenantData.id).eq("is_active", true),
        supabase.from("services").select("*").eq("tenant_id", tenantData.id).eq("is_active", true),
        supabase.from("schedules").select("*").eq("tenant_id", tenantData.id),
        supabase
          .from("appointments")
          .select("id, station_id, date, start_time, end_time, status")
          .eq("tenant_id", tenantData.id)
          .gte("date", todayIso)
          .neq("status", "cancelled"),
      ]);

      setTenant(tenantData);
      setStations(stRes.data ?? []);
      setServices(srvRes.data ?? []);
      setSchedules(schRes.data ?? []);
      setAppointments(appRes.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function createBooking(payload) {
    const { data, error: insertErr } = await supabase
      .from("appointments")
      .insert([{ ...payload, tenant_id: tenant.id, status: "confirmed" }])
      .select()
      .single();

    if (insertErr) {
      // Código 23P01 = violación de constraint EXCLUDE (turno recién ocupado por otro cliente)
      if (insertErr.code === "23P01") {
        await loadData();
        throw new Error("Ese horario acaba de ser reservado. Por favor elegí otro.");
      }
      throw new Error("No se pudo confirmar el turno. Intentá nuevamente.");
    }

    setAppointments((prev) => [...prev, data]);
    return data;
  }

  return {
    loading,
    error,
    tenant,
    stations,
    services,
    schedules,
    appointments,
    createBooking,
    refresh: loadData,
  };
}