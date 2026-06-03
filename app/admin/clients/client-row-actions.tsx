"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExternalLink, Trash2, Play, Pause, Loader2 } from "lucide-react";
import Link from "next/link";

type Props = {
  clientId: string;
  clientName: string;
  status: string;
};

export function ClientRowActions({ clientId, clientName, status }: Props) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isActive = status === "ACTIVE";

  async function handleToggle() {
    setToggling(true);
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isActive ? "INACTIVE" : "ACTIVE" }),
      });
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Delete &quot;{clientName}&quot;?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={cn(buttonVariants({ variant: "destructive", size: "xs" }), "gap-1")}
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Yes
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className={cn(buttonVariants({ variant: "ghost", size: "xs" }))}
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/admin/clients/${clientId}`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        <ExternalLink className="h-3.5 w-3.5 mr-1" />
        Open
      </Link>

      <button
        onClick={handleToggle}
        disabled={toggling}
        title={isActive ? "Pause auto-report" : "Resume auto-report"}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          isActive ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {toggling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isActive ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        onClick={() => setConfirmDelete(true)}
        title="Delete client"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-destructive hover:text-destructive")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
