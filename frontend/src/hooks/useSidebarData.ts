import { useState, useEffect } from "react";
import { getSession, type AuthSession } from "@/api/auth";
import { apiClient } from "@/api/client";

export function useSidebarData() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentSession = getSession();
    setSession(currentSession);
    
    if (!currentSession) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // 1. Fetch Branch Name
        if (currentSession?.rol === "ADMIN") {
          setBranchName("Gestión Global");
        } else if (currentSession?.sucursalId) {
          const { data: branch } = await apiClient.GET("/api/branches/{id}", {
            params: { path: { id: currentSession.sucursalId } }
          });
          if (branch) setBranchName(branch.nombre || null);
        }

        // 2. Fetch Alerts (Simplified check)
        let count = 0;
        if (currentSession?.rol === "ADMIN") {
          const { data: alerts } = await apiClient.GET("/api/v1/alerts");
          count = alerts?.filter(a => !a.resolved).length ?? 0;
        } else if (currentSession?.sucursalId) {
          const { data: alerts } = await apiClient.GET("/api/v1/alerts", { 
            params: { query: { branchId: currentSession.sucursalId } } 
          });
          count = alerts?.filter(a => !a.resolved).length ?? 0;
        }
        setAlertCount(count);
      } catch (e) {
        console.error("Error fetching sidebar data:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    
    // Polling for alerts every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { session, alertCount, branchName, loading };
}
