import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useBexio() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const checkConnection = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsConnected(false);
        return;
      }

      const response = await supabase.functions.invoke("bexio-api", {
        body: { action: "check_connection" },
      });

      if (response.error) {
        setIsConnected(false);
      } else if (response.data?.reconnect_required) {
        // Token expired, user needs to reconnect
        setIsConnected(false);
        toast({
          title: "Bexio-Sitzung abgelaufen",
          description: "Bitte verbinden Sie Bexio erneut.",
          variant: "destructive",
        });
      } else {
        setIsConnected(response.data?.connected ?? false);
      }
    } catch (error) {
      console.error("Error checking Bexio connection:", error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const connect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Fehler",
          description: "Sie müssen angemeldet sein, um Bexio zu verbinden.",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke("bexio-auth", {
        body: { redirectUri: "/finances/invoices" },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Redirect to Bexio OAuth
      if (response.data?.authUrl) {
        const authUrl: string = response.data.authUrl;

        // In Lovable preview the app runs inside an iframe; external auth pages may be blocked there.
        // Open a new tab in that case.
        let inIframe = false;
        try {
          inIframe = window.self !== window.top;
        } catch {
          inIframe = true;
        }

        if (inIframe) {
          const w = window.open(authUrl, "_blank", "noopener,noreferrer");
          if (!w) {
            // Popup blocked; fall back to same-tab navigation.
            window.location.assign(authUrl);
          } else {
            toast({
              title: "Bexio Login geöffnet",
              description: "Bitte schliesse die Verknüpfung im neuen Tab ab.",
            });
          }
        } else {
          window.location.assign(authUrl);
        }
      }
    } catch (error: any) {
      console.error("Error connecting to Bexio:", error);
      toast({
        title: "Verbindungsfehler",
        description: error.message || "Bexio-Verbindung fehlgeschlagen",
        variant: "destructive",
      });
    }
  };

  const disconnect = async () => {
    try {
      await supabase.functions.invoke("bexio-api", {
        body: { action: "disconnect" },
      });
    } catch (e) {
      // Even if the backend call fails, we still mark it disconnected client-side.
      console.warn("Failed to disconnect Bexio tokens:", e);
    } finally {
      setIsConnected(false);
      toast({
        title: "Bexio getrennt",
        description: "Die Verbindung zu Bexio wurde getrennt.",
      });
    }
  };

  const callApi = async (action: string, data?: any) => {
    try {
      const response = await supabase.functions.invoke("bexio-api", {
        body: { action, data },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (error: any) {
      console.error(`Bexio API error (${action}):`, error);
      throw error;
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // Check URL params for connection status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("bexio") === "connected") {
      setIsConnected(true);
      toast({
        title: "Bexio verbunden",
        description: "Ihr Bexio-Konto wurde erfolgreich verknüpft.",
      });
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error")) {
      toast({
        title: "Verbindungsfehler",
        description: `Bexio-Verbindung fehlgeschlagen: ${params.get("error")}`,
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return {
    isConnected,
    isLoading,
    connect,
    disconnect,
    callApi,
    checkConnection,
  };
}
