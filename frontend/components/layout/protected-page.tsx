"use client";

import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProtectedPage({
  children,
  requiredPage,
}: {
  children: React.ReactNode;
  requiredPage: string;
}) {
  const { hasPermission, loading } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !hasPermission(requiredPage)) {
      router.push("/dashboard");
    }
  }, [loading, hasPermission, requiredPage, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!hasPermission(requiredPage)) {
    return null;
  }

  return <>{children}</>;
}
