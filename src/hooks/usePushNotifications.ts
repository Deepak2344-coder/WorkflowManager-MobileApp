import { useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase, SUPABASE_URL } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

async function retry<T extends { error?: any }>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    const result = await fn();
    if (result && typeof result === "object" && "error" in result && !(result as any).error) return result;
    if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
    if (i === retries - 1) return result;
  }
  return fn();
}

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

        const { error } = await retry(() => supabase.from("push_tokens").upsert(
          { member_id: user.id, token, updated_at: new Date().toISOString() },
          { onConflict: "member_id" }
        ));
        if (error) {
          console.error("Push token upsert error:", error);
          Alert.alert("Notification Setup", `Failed to save push token: ${error.message}`);
        } else {
          console.log("Push token saved");
        }

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

const FETCH_TIMEOUT = 15_000;

export async function notify(type: "notice" | "update" | "task" | "join_request" | "request_approved" | "request_rejected", record_id: string, team_id?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { console.log("notify: no session"); return; }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type, record_id, team_id }),
      signal: controller.signal,
    });
    clearTimeout(id);
    const text = await res.text();
    if (!res.ok) {
      console.error("notify error:", text);
      Alert.alert("Notification Error", `Server returned ${res.status}: ${text}`);
    } else {
      console.log("notify response:", text);
    }
  } catch (e: any) {
    console.error("notify fetch error:", e.message);
    Alert.alert("Notification Error", `Failed to send: ${e.message}`);
  }
}
