import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase, SUPABASE_URL } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

export function usePushNotifications() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user || registered.current) return;
    registered.current = true;

    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.log("Push permission not granted:", finalStatus);
          return;
        }

        const tokenData = await Notifications.getDevicePushTokenAsync();
        const token = tokenData.data;
        console.log("Got device push token:", token);

        const { error } = await supabase.from("push_tokens").upsert(
          { member_id: user.id, token, updated_at: new Date().toISOString() },
          { onConflict: "member_id" }
        );
        if (error) console.error("Push token upsert error:", error);
        else console.log("Push token saved");

        if (Platform.OS === "android") {
          Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
          });
        }
      } catch (e: any) {
        console.error("Push registration error:", e.message);
      }
    })();
  }, [user]);
}

export async function notify(type: "notice" | "update" | "task", record_id: string, team_id?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { console.log("notify: no session"); return; }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type, record_id, team_id }),
    });
    const text = await res.text();
    if (!res.ok) console.error("notify error:", text);
  } catch (e: any) {
    console.error("notify fetch error:", e.message);
  }
}
