import type { AlertEntry } from "../../domain/types";

export function createAlertFixtures(now = Date.now()): AlertEntry[] {
  const isoMinutesAgo = (minutesAgo: number) =>
    new Date(now - minutesAgo * 60_000).toISOString();
  const isoDaysAgo = (daysAgo: number, hour: number, minute: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  return [
    {
      id: "a1",
      title: "Temperature Too High",
      severity: "critical",
      unit: "Chamber Three",
      message:
        "Temperature is 39.2°C, above the safe range. Check the heater and ventilation.",
      timestamp: isoMinutesAgo(12),
      acknowledged: false,
    },
    {
      id: "a2",
      title: "Water Reservoir Low",
      severity: "warning",
      unit: "Chamber Three",
      message:
        "Water reservoir low (12%). Refill the mist maker to keep humidity stable.",
      timestamp: isoMinutesAgo(25),
      acknowledged: false,
    },
    {
      id: "a3",
      title: "Egg Turning Overdue",
      severity: "critical",
      unit: "Chamber Three",
      message:
        "Egg turning overdue by 40 minutes. Turn eggs to prevent sticking.",
      timestamp: isoMinutesAgo(40),
      acknowledged: false,
    },
    {
      id: "a4",
      title: "Running on Battery",
      severity: "warning",
      unit: "Chamber Three",
      message: "Running on battery with 23% remaining. Restore power soon.",
      timestamp: isoMinutesAgo(65),
      acknowledged: false,
    },
    {
      id: "a5",
      title: "Humidity Out of Range",
      severity: "warning",
      unit: "Chamber Two",
      message: "Humidity is 51%, below the target. Add water to the reservoir.",
      timestamp: isoMinutesAgo(88),
      acknowledged: false,
    },
    {
      id: "a6",
      title: "Water Reservoir Low",
      severity: "warning",
      unit: "Chamber Two",
      message: "Water reservoir is low. Top it up soon.",
      timestamp: isoDaysAgo(1, 18, 25),
      acknowledged: true,
    },
    {
      id: "a7",
      title: "Candling Due",
      severity: "info",
      unit: "Chamber Two",
      message: "Candling reminder: second candling due today.",
      timestamp: isoDaysAgo(1, 14, 10),
      acknowledged: true,
    },
    {
      id: "a8",
      title: "Eggs Turned",
      severity: "info",
      unit: "Chamber One",
      message: "Eggs turned successfully.",
      timestamp: isoDaysAgo(1, 9, 45),
      acknowledged: true,
    },
    {
      id: "a9",
      title: "Grid Power Lost",
      severity: "warning",
      unit: "Chamber Three",
      message: "Grid power was lost. The incubator switched to battery backup.",
      timestamp: isoDaysAgo(7, 16, 40),
      acknowledged: true,
    },
    {
      id: "a10",
      title: "Daily Summary",
      severity: "info",
      unit: "Chamber One",
      message: "Daily summary: all readings within safe range.",
      timestamp: isoDaysAgo(7, 11, 15),
      acknowledged: true,
    },
    {
      id: "a11",
      title: "Reservoir Refilled",
      severity: "info",
      unit: "Chamber One",
      message: "Water reservoir refilled to 100%.",
      timestamp: isoDaysAgo(7, 8, 30),
      acknowledged: true,
    },
    {
      id: "a12",
      title: "Hatch Day Approaching",
      severity: "info",
      unit: "Chamber Three",
      message: "Hatch day is approaching. Expected hatch is in 3 days.",
      timestamp: isoDaysAgo(7, 6, 5),
      acknowledged: true,
    },
  ];
}
