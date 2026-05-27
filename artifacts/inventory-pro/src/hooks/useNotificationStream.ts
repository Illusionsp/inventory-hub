import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListNotificationsQueryKey } from "@workspace/api-client-react";

export function useNotificationStream(): void {
  const queryClient = useQueryClient();
  const activeRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeRef.current = true;
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    const url = `${base}/api/notifications/stream`;

    async function connect(): Promise<void> {
      if (!activeRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const token = sessionStorage.getItem("tab_session");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(url, {
          headers,
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          if (activeRef.current) setTimeout(connect, 5_000);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (activeRef.current) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "new_notification") {
                  queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
                }
              } catch { }
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        if (activeRef.current) setTimeout(connect, 5_000);
      }
    }

    void connect();

    return () => {
      activeRef.current = false;
      abortRef.current?.abort();
    };
  }, [queryClient]);
}
