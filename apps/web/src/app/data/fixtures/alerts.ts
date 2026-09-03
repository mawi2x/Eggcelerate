import type { AlertEntry } from "../../domain/types";

export function createAlertFixtures(now = Date.now()): AlertEntry[] {
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  return [
    { id: "a1", title: "Temperature Too High", severity: "critical", unit: "Chamber Three", message: "Temperature is 39.2°C, above the safe range. Check the heater and ventilation.", timestamp: iso(12), acknowledged: false },
    { id: "a2", title: "Water Reservoir Low", severity: "warning", unit: "Chamber Three", message: "Water reservoir low (12%). Refill the mist maker to keep humidity stable.", timestamp: iso(25), acknowledged: false },
    { id: "a3", title: "Egg Turning Overdue", severity: "critical", unit: "Chamber Three", message: "Egg turning overdue by 40 minutes. Turn eggs to prevent sticking.", timestamp: iso(40), acknowledged: false },
    { id: "a4", title: "Running on Battery", severity: "warning", unit: "Chamber Three", message: "Running on battery with 23% remaining. Restore power soon.", timestamp: iso(65), acknowledged: false },
    { id: "a5", title: "Humidity Out of Range", severity: "warning", unit: "Chamber Two", message: "Humidity is 51%, below the target. Add water to the reservoir.", timestamp: iso(88), acknowledged: false },
    { id: "a6", title: "Water Reservoir Low", severity: "warning", unit: "Chamber Two", message: "Water reservoir is low. Top it up soon.", timestamp: iso(110), acknowledged: true },
    { id: "a7", title: "Candling Due", severity: "info", unit: "Chamber Two", message: "Candling reminder: second candling due today.", timestamp: iso(130), acknowledged: true },
    { id: "a8", title: "Eggs Turned", severity: "info", unit: "Chamber One", message: "Eggs turned successfully.", timestamp: iso(160), acknowledged: true },
    { id: "a9", title: "Grid Power Lost", severity: "warning", unit: "Chamber Three", message: "Grid power was lost. The incubator switched to battery backup.", timestamp: iso(200), acknowledged: true },
    { id: "a10", title: "Daily Summary", severity: "info", unit: "Chamber One", message: "Daily summary: all readings within safe range.", timestamp: iso(300), acknowledged: true },
    { id: "a11", title: "Reservoir Refilled", severity: "info", unit: "Chamber One", message: "Water reservoir refilled to 100%.", timestamp: iso(360), acknowledged: true },
    { id: "a12", title: "Hatch Day Approaching", severity: "info", unit: "Chamber Three", message: "Hatch day is approaching. Expected hatch is in 3 days.", timestamp: iso(500), acknowledged: true },
  ];
}
