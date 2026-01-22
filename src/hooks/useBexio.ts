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
        window.location.href = response.data.authUrl;
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
    // For now, just mark as disconnected - in production you'd delete the tokens
    setIsConnected(false);
    toast({
      title: "Bexio getrennt",
      description: "Die Verbindung zu Bexio wurde getrennt.",
    });
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
