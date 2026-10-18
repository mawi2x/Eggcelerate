import { useEffect, useRef } from "react";
import type { AlertEntry } from "../../domain/types";
import { createNotificationSound } from "./notification-sound";

export function useNotificationSounds(
  owner: string | null,
  farmAlerts: AlertEntry[],
  farmReady: boolean,
  localNotifications: AlertEntry[],
) {
  const sound = useRef<ReturnType<typeof createNotificationSound> | null>(null);
  const tracking = useRef<{
    owner: string | null;
    farm: Set<string> | null;
    local: Set<string>;
  }>({ owner: null, farm: null, local: new Set() });

  useEffect(() => {
    if (!owner) return;
    const player = createNotificationSound();
    sound.current = player;
    return () => {
      sound.current = null;
      player.dispose();
    };
  }, [owner]);

  useEffect(() => {
    if (tracking.current.owner !== owner) {
      tracking.current = { owner, farm: null, local: new Set() };
    }
    if (!owner) return;
    const state = tracking.current;
    const announce = (entries: AlertEntry[], seen: Set<string>) => {
      for (const entry of entries) {
        if (!seen.has(entry.id) && !entry.acknowledged) sound.current?.play();
        seen.add(entry.id);
      }
    };
    // The first successful farm fetch is history, not newly arriving alerts.
    if (farmReady) {
      if (state.farm === null) state.farm = new Set(farmAlerts.map((a) => a.id));
      else announce(farmAlerts, state.farm);
    }
    announce(localNotifications, state.local);
  }, [owner, farmAlerts, farmReady, localNotifications]);
}
