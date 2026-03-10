"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CollaboratorsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/configuracoes");
  }, [router]);

  return null;
}
