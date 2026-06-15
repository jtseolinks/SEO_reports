"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, ArrowLeft } from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          domain: fd.get("domain"),
          contactEmail: fd.get("contactEmail"),
          ccEmails: (fd.get("ccEmails") as string)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          // Blank → omitted so the client follows the global default send day.
          reportSendDay: (fd.get("reportSendDay") as string)?.trim()
            ? parseInt(fd.get("reportSendDay") as string)
            : null,
          notes: fd.get("notes") || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create client");
      router.push(`/admin/clients/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clients"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Clients
        </Link>
        <h1 className="text-2xl font-semibold">Add Client</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Client Name *</Label>
              <Input id="name" name="name" required placeholder="Acme Corp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain *</Label>
              <Input id="domain" name="domain" required placeholder="acme.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email *</Label>
              <Input id="contactEmail" name="contactEmail" type="email" required placeholder="ceo@acme.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccEmails">CC Emails (comma separated)</Label>
              <Input id="ccEmails" name="ccEmails" placeholder="marketing@acme.com, cto@acme.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportSendDay">Report Send Day (1–28)</Label>
              <Input id="reportSendDay" name="reportSendDay" type="number" min="1" max="28" placeholder="Default from global settings" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" placeholder="Optional notes about this client" rows={3} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Client
              </Button>
              <Link href="/admin/clients" className={cn(buttonVariants({ variant: "outline" }))}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
