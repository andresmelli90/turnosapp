import { supabase } from "./supabase";

export async function updateStationName(stationId, nextName) {
  const trimmed = String(nextName ?? "").trim();
  if (!stationId || !trimmed) {
    throw new Error("El nombre del puesto no puede estar vacío.");
  }

  const { data, error } = await supabase
    .from("stations")
    .update({ name: trimmed })
    .eq("id", stationId)
    .select()
    .single();

  if (error) {
    throw new Error("No se pudo actualizar el nombre del puesto.");
  }

  return data;
}