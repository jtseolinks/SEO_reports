"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function DashboardRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  function refresh() {
    setSpinning(true);
    startTransition(() => {
      router.refresh();
      setSpinning(false);
    });
  }

  const busy = isPending || spinning;

  return (
    <button
      onClick={refresh}
      disabled={busy}
      className="btn btn-secondary"
      title="רענן נתוני לקוחות"
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
      רענן
    </button>
  );
}
