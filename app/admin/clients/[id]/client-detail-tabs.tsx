"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, ExternalLink, RefreshCw, AlertCircle, Send, Mail, BarChart2 } from "lucide-react";

type SyncData = {
  period: { label: string; startDate: string; endDate: string };
  gsc: { clicks: number; impressions: number; ctr: number; position: number; queryCount: number };
  ga4: { sessions: number; activeUsers: number; engagedSessions: number; conversions: number };
  syncedAt: string;
};

type Client = {
  id: string; name: string; domain: string; contactEmail: string;
  ccEmails: string[]; reportSendDay: number; status: string; notes: string | null;
};
type Properties = { gscSiteUrl: string; ga4PropertyId: string; ga4PropertyName: string | null } | null;
type Keyword = { id: string; keyword: string; groupName: string | null; isBrand: boolean; matchType: string };
type Report = {
  id: string; reportMonth: string; status: string;
  generatedAt: string | null; sentAt: string | null;
  pdfUrl: string | null; errorMessage: string | null;
};

export function ClientDetailTabs({
  client,
  properties,
  keywords: initialKeywords,
  reports: initialReports,
}: {
  client: Client;
  properties: Properties;
  keywords: Keyword[];
  reports: Report[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [savingProps, setSavingProps] = useState(false);
  const [keywords, setKeywords] = useState(initialKeywords);
  const [reports, setReports] = useState(initialReports);
  const [newKeyword, setNewKeyword] = useState("");
  const [generatingMonth, setGeneratingMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [testEmailTo, setTestEmailTo] = useState(client.contactEmail);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [syncError, setSyncError] = useState("");

  async function saveDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      await fetch(`/api/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          domain: fd.get("domain"),
          contactEmail: fd.get("contactEmail"),
          ccEmails: (fd.get("ccEmails") as string).split(",").map((s) => s.trim()).filter(Boolean),
          reportSendDay: parseInt(fd.get("reportSendDay") as string) || 5,
          status: fd.get("status"),
          notes: fd.get("notes") || null,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveProperties(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProps(true);
    const fd = new FormData(e.currentTarget);
    try {
      await fetch(`/api/clients/${client.id}/properties`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gscSiteUrl: fd.get("gscSiteUrl"),
          ga4PropertyId: fd.get("ga4PropertyId"),
          ga4PropertyName: fd.get("ga4PropertyName") || null,
        }),
      });
      router.refresh();
    } finally {
      setSavingProps(false);
    }
  }

  async function addKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const res = await fetch(`/api/clients/${client.id}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newKeyword.trim() }),
    });
    if (res.ok) {
      const kw = await res.json();
      setKeywords((prev) => [...prev, kw].sort((a, b) => a.keyword.localeCompare(b.keyword)));
      setNewKeyword("");
    }
  }

  async function deleteKeyword(id: string) {
    await fetch(`/api/clients/${client.id}/keywords/${id}`, { method: "DELETE" });
    setKeywords((prev) => prev.filter((k) => k.id !== id));
  }

  async function sendReport(reportId: string) {
    setSendingId(reportId);
    setSendResult(null);
    try {
      const res = await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setSendResult({ id: reportId, ok: true, msg: "Sent successfully" });
      // Refresh to update status
      const listRes = await fetch(`/api/clients/${client.id}`);
      const clientData = await listRes.json();
      setReports(clientData.monthlyReports ?? []);
    } catch (err) {
      setSendResult({ id: reportId, ok: false, msg: err instanceof Error ? err.message : "Error" });
    } finally {
      setSendingId(null);
    }
  }

  async function sendTestEmail() {
    setSendingTest(true);
    setTestResult("");
    try {
      const res = await fetch("/api/reports/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setTestResult("Test email sent successfully.");
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setSendingTest(false);
    }
  }

  async function fetchLiveData(month: string) {
    setSyncing(true);
    setSyncError("");
    setSyncData(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportMonth: month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncData(data);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Error");
    } finally {
      setSyncing(false);
    }
  }

  async function generateReport(month?: string) {
    const targetMonth = month ?? generatingMonth;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, reportMonth: targetMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate report");

      // Refresh reports list
      const listRes = await fetch(`/api/clients/${client.id}`);
      const clientData = await listRes.json();
      setReports(
        (clientData.monthlyReports ?? []).map((r: Report) => ({
          ...r,
          generatedAt: r.generatedAt ?? null,
          sentAt: r.sentAt ?? null,
        }))
      );
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Error generating report");
    } finally {
      setGenerating(false);
    }
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      GENERATED: "default", SENT: "default", DRAFT: "secondary", FAILED: "destructive",
    };
    return <Badge variant={variants[status] ?? "secondary"}>{status}</Badge>;
  };

  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="properties">Google Properties</TabsTrigger>
        <TabsTrigger value="keywords">Keywords ({keywords.length})</TabsTrigger>
        <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
      </TabsList>

      {/* Details Tab */}
      <TabsContent value="details" className="mt-4">
        <Card className="max-w-lg">
          <CardHeader><CardTitle className="text-base">Client Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveDetails} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={client.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input id="domain" name="domain" defaultValue={client.domain} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" defaultValue={client.contactEmail} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ccEmails">CC Emails</Label>
                <Input id="ccEmails" name="ccEmails" defaultValue={client.ccEmails.join(", ")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reportSendDay">Send Day</Label>
                  <Input id="reportSendDay" name="reportSendDay" type="number" min="1" max="28" defaultValue={client.reportSendDay} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select name="status" id="status" defaultValue={client.status}
                    className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-sm">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" defaultValue={client.notes ?? ""} rows={3} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Properties Tab */}
      <TabsContent value="properties" className="mt-4">
        <Card className="max-w-lg">
          <CardHeader><CardTitle className="text-base">Google Property Mapping</CardTitle></CardHeader>
          <CardContent>
            {!properties && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800 mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                No properties mapped. Reports cannot be generated until this is configured.
              </div>
            )}
            <form onSubmit={saveProperties} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gscSiteUrl">GSC Site URL</Label>
                <Input id="gscSiteUrl" name="gscSiteUrl" defaultValue={properties?.gscSiteUrl ?? ""} required
                  placeholder="https://www.example.com/" />
                <p className="text-xs text-muted-foreground">Exact URL as shown in Google Search Console (with trailing slash if applicable)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ga4PropertyId">GA4 Property ID</Label>
                <Input id="ga4PropertyId" name="ga4PropertyId" defaultValue={properties?.ga4PropertyId ?? ""} required
                  placeholder="123456789" />
                <p className="text-xs text-muted-foreground">Numbers only, found in GA4 Admin → Property Settings</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ga4PropertyName">GA4 Property Name (optional)</Label>
                <Input id="ga4PropertyName" name="ga4PropertyName" defaultValue={properties?.ga4PropertyName ?? ""} />
              </div>
              <Button type="submit" disabled={savingProps}>
                {savingProps && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Properties
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Keywords Tab */}
      <TabsContent value="keywords" className="mt-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Tracked Keywords</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={addKeyword} className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword..."
                className="max-w-xs"
              />
              <Button type="submit" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </form>

            {keywords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No keywords tracked yet.</p>
            ) : (
              <div className="space-y-1">
                {keywords.map((kw) => (
                  <div key={kw.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 group">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{kw.keyword}</span>
                      <Badge variant="secondary" className="text-xs">{kw.matchType}</Badge>
                      {kw.isBrand && <Badge variant="outline" className="text-xs">Brand</Badge>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                      onClick={() => deleteKeyword(kw.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Reports Tab */}
      <TabsContent value="reports" className="mt-4">
        <div className="space-y-4">
          <Card className="max-w-sm">
            <CardHeader><CardTitle className="text-base">Data Preview &amp; Generate</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reportMonth">Report Month</Label>
                <Input
                  id="reportMonth"
                  type="month"
                  value={generatingMonth}
                  onChange={(e) => { setGeneratingMonth(e.target.value); setSyncData(null); }}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fetchLiveData(generatingMonth)}
                  disabled={syncing || !properties}
                >
                  {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart2 className="mr-2 h-4 w-4" />}
                  Refresh Data
                </Button>
                <Button onClick={() => generateReport()} disabled={generating || !properties}>
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {generating ? "Generating..." : "Generate PDF"}
                </Button>
              </div>

              {syncError && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {syncError}
                </div>
              )}

              {syncData && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-xs">
                  <p className="font-medium text-sm">{syncData.period.label} — Live Data</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">Clicks</span>
                    <span className="font-medium">{syncData.gsc.clicks.toLocaleString()}</span>
                    <span className="text-muted-foreground">Impressions</span>
                    <span className="font-medium">{syncData.gsc.impressions.toLocaleString()}</span>
                    <span className="text-muted-foreground">Avg. Position</span>
                    <span className="font-medium">{syncData.gsc.position.toFixed(1)}</span>
                    <span className="text-muted-foreground">CTR</span>
                    <span className="font-medium">{(syncData.gsc.ctr * 100).toFixed(1)}%</span>
                    <span className="text-muted-foreground">Organic Sessions</span>
                    <span className="font-medium">{syncData.ga4.sessions.toLocaleString()}</span>
                    <span className="text-muted-foreground">Active Users</span>
                    <span className="font-medium">{syncData.ga4.activeUsers.toLocaleString()}</span>
                    {syncData.ga4.conversions > 0 && <>
                      <span className="text-muted-foreground">Conversions</span>
                      <span className="font-medium">{syncData.ga4.conversions}</span>
                    </>}
                  </div>
                  <p className="text-muted-foreground pt-1">
                    Synced {new Date(syncData.syncedAt).toLocaleTimeString()}
                  </p>
                </div>
              )}

              {genError && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {genError}
                </div>
              )}
              {!properties && (
                <p className="text-xs text-muted-foreground">Map Google properties first.</p>
              )}
            </CardContent>
          </Card>

          {/* Test email */}
          <Card className="max-w-sm">
            <CardHeader><CardTitle className="text-base">Test Email</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="testEmailTo">Send test to</Label>
                <Input
                  id="testEmailTo"
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                />
              </div>
              {testResult && (
                <p className={`text-xs ${testResult.startsWith("Error") ? "text-destructive" : "text-green-700"}`}>
                  {testResult}
                </p>
              )}
              <Button variant="outline" onClick={sendTestEmail} disabled={sendingTest}>
                {sendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send Test Email
              </Button>
            </CardContent>
          </Card>

          {reports.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Report History</CardTitle></CardHeader>
              <CardContent>
                {sendResult && (
                  <p className={`text-xs mb-3 ${sendResult.ok ? "text-green-700" : "text-destructive"}`}>
                    {sendResult.msg}
                  </p>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Month</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium hidden md:table-cell">Generated</th>
                      <th className="text-left py-2 font-medium hidden md:table-cell">Sent</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2">{r.reportMonth}</td>
                        <td className="py-2">{statusBadge(r.status)}</td>
                        <td className="py-2 text-muted-foreground hidden md:table-cell text-xs">
                          {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground hidden md:table-cell text-xs">
                          {r.sentAt ? new Date(r.sentAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-1">
                            {r.pdfUrl && (
                              <a
                                href={r.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(buttonVariants({ variant: "ghost", size: "xs" }))}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" /> PDF
                              </a>
                            )}
                            <Button
                              variant="ghost"
                              size="xs"
                              title="Re-fetch data and regenerate PDF"
                              onClick={() => generateReport(r.reportMonth)}
                              disabled={generating}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Regen
                            </Button>
                            {r.pdfUrl && (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => sendReport(r.id)}
                                disabled={sendingId === r.id}
                              >
                                {sendingId === r.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Send className="h-3 w-3 mr-1" />}
                                Send
                              </Button>
                            )}
                            {r.errorMessage && !r.pdfUrl && (
                              <span className="text-xs text-destructive" title={r.errorMessage}>Error</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
