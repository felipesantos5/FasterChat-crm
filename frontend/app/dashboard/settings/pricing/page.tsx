"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PricingSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/settings/ai");
  }, [router]);

  return null;
}
