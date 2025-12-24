import { useState, useEffect } from "react";
import { collaboratorApi } from "@/lib/collaborator";
import { useAuthStore } from "@/lib/store/auth.store";

export function usePermissions() {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        const perms = await collaboratorApi.getMyPermissions();
        setPermissions(perms);
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user]);

  const hasPermission = (page: string): boolean => {
    if (user?.role === 'ADMIN') return true;
    return permissions.some(p => p.page === page && p.canView);
  };

  const canEdit = (page: string): boolean => {
    if (user?.role === 'ADMIN') return true;
    return permissions.some(p => p.page === page && p.canEdit);
  };

  return { permissions, hasPermission, canEdit, loading };
}
