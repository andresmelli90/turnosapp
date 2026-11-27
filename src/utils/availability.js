export function timeToMinutes(timeStr) {
  const clean = String(timeStr ?? "").slice(0, 5);
  const [hours, minutes] = clean.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

export function getAvailableSlots({
  dateStr,
  durationMinutes,
  stations = [],
  schedules = [],
  appointments = [],
  selectedStationId = null,
  stepMinutes = 15,
}) {
  if (!dateStr || !durationMinutes) return [];

  const [year, month, day] = dateStr.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  const activeStations = stations.filter((s) => s.is_active !== false);
  const candidateStations = selectedStationId
    ? activeStations.filter((s) => s.id === selectedStationId)
    : activeStations;

  if (candidateStations.length === 0) return [];

  const dayAppointments = appointments.filter(
    (a) => a.date === dateStr && a.status !== "cancelled"
  );

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const validSlotsSet = new Set();

  for (const station of candidateStations) {
    const stationSchedules = schedules.filter(
      (sc) => sc.day_of_week === dayOfWeek && sc.station_id === station.id
    );
    const effectiveSchedules =
      stationSchedules.length > 0
        ? stationSchedules
        : schedules.filter(
            (sc) => sc.day_of_week === dayOfWeek && sc.station_id === null
          );

    const stationApps = dayAppointments.filter(
      (a) => a.station_id === station.id
    );

    for (const block of effectiveSchedules) {
      const workStart = timeToMinutes(block.start_time);
      const workEnd = timeToMinutes(block.end_time);

      for (
        let slotStart = workStart;
        slotStart + durationMinutes <= workEnd;
        slotStart += stepMinutes
      ) {
        if (dateStr === todayStr && slotStart <= nowMinutes + 15) {
          continue;
        }

        const slotEnd = slotStart + durationMinutes;
        const hasConflict = stationApps.some((app) =>
          overlaps(
            slotStart,
            slotEnd,
            timeToMinutes(app.start_time),
            timeToMinutes(app.end_time)
          )
        );

        if (!hasConflict) {
          validSlotsSet.add(minutesToTime(slotStart));
        }
      }
    }
  }

  return Array.from(validSlotsSet).sort();
}

export function pickAvailableStationId({
  dateStr,
  startTime,
  durationMinutes,
  stations = [],
  schedules = [],
  appointments = [],
}) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  const slotStart = timeToMinutes(startTime);
  const slotEnd = slotStart + durationMinutes;

  const activeStations = stations.filter((s) => s.is_active !== false);
  const dayApps = appointments.filter(
    (a) => a.date === dateStr && a.status !== "cancelled"
  );

  for (const station of activeStations) {
    const stationSchedules = schedules.filter(
      (sc) => sc.day_of_week === dayOfWeek && sc.station_id === station.id
    );
    const effectiveSchedules =
      stationSchedules.length > 0
        ? stationSchedules
        : schedules.filter(
            (sc) => sc.day_of_week === dayOfWeek && sc.station_id === null
          );

    const fitsSchedule = effectiveSchedules.some(
      (sc) =>
        slotStart >= timeToMinutes(sc.start_time) &&
        slotEnd <= timeToMinutes(sc.end_time)
    );
    if (!fitsSchedule) continue;

    const busy = dayApps
      .filter((a) => a.station_id === station.id)
      .some((app) =>
        overlaps(
          slotStart,
          slotEnd,
          timeToMinutes(app.start_time),
          timeToMinutes(app.end_time)
        )
      );

    if (!busy) return station.id;
  }

  return null;
}