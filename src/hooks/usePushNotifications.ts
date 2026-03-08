import { useCallback } from "react";

/**
 * Hook for requesting and managing browser push notification permissions.
 * Shows desktop pop-up notifications when new notifications arrive.
 */
export function usePushNotifications() {
  const isSupported = typeof window !== "undefined" && "Notification" in window;

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const result = await Notification.requestPermission();
    return result === "granted";
  }, [isSupported]);

  const showDesktopNotification = useCallback((title: string, body: string, link?: string | null) => {
    if (!isSupported || Notification.permission !== "granted") return;

    const notification = new Notification(title, {
      body,
      icon: "/mgi-favicon.svg",
      badge: "/mgi-favicon.svg",
      tag: `mgi-${Date.now()}`,
    });

    if (link) {
      notification.onclick = () => {
        window.focus();
        window.location.href = link;
        notification.close();
      };
    } else {
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);
  }, [isSupported]);

  const getPermissionStatus = useCallback((): NotificationPermission | "unsupported" => {
    if (!isSupported) return "unsupported";
    return Notification.permission;
  }, [isSupported]);

  return {
    isSupported,
    requestPermission,
    showDesktopNotification,
    getPermissionStatus,
  };
}
