"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Download, Loader2, Search } from "lucide-react";
import Link from "next/link";

type GscSite = {
  siteUrl: string;
  permissionLevel: string;
};

type Ga4Property = {
  propertyId: string;
  displayName: string;
  accountId: string;
  accountName: string;
};

type SiteRow = {
  siteUrl: string;
  permissionLevel: string;
  selected: boolean;
  name: string;
  domain: string;
  ga4PropertyId: string;
  ga4PropertyName: string;
  alreadyImported: boolean;
};

function deriveDomain(siteUrl: string): string {
  return siteUrl
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function stripWww(s: string): string {
  return s.replace(/^www\./, "");
}

function autoMatchGa4(domain: string, ga4Properties: Ga4Property[]): Ga4Property | null {
  const clean = stripWww(domain).toLowerCase();
  return (
    ga4Properties.find((p) => {
      const name = p.displayName.toLowerCase();
      return name.includes(clean) || clean.includes(name) ||
        stripWww(name).includes(clean) || clean.includes(stripWww(name));
    }) ?? null
  );
}

export default function ImportGscPage() {
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [ga4Properties, setGa4Properties] = useState<Ga4Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    fetch("/api/google/sites")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        const ga4: Ga4Property[] = data.ga4Properties ?? [];
        const existingDomains  = new Set<string>((data.existingDomains  ?? []).map((d: string) => d.toLowerCase()));
        const existingSiteUrls = new Set<string>(data.existingSiteUrls ?? []);
        setGa4Properties(ga4);
        setRows(
          (data.sites as GscSite[]).map((s) => {
            const domain = deriveDomain(s.siteUrl);
            const match = autoMatchGa4(domain, ga4);
            const alreadyImported =
              existingSiteUrls.has(s.siteUrl) ||
              existingDomains.has(domain.replace(/^www\./, "").toLowerCase());
            return {
              siteUrl: s.siteUrl,
              permissionLevel: s.permissionLevel,
              selected: false,          // ← ברירת מחדל: לא מסומן
              name: stripWww(domain),
              domain,
              ga4PropertyId: match?.propertyId ?? "",
              ga4PropertyName: match?.displayName ?? "",
              alreadyImported,
            };
          })
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleAll(checked: boolean) {
    const selectableUrls = new Set(selectableRows.map(r => r.siteUrl));
    setRows((prev) => prev.map((r) =>
      selectableUrls.has(r.siteUrl) ? { ...r, selected: checked } : r
    ));
  }

  function updateRow<K extends keyof SiteRow>(siteUrl: string, key: K, value: SiteRow[K]) {
    setRows((prev) => prev.map((r) => r.siteUrl === siteUrl ? { ...r, [key]: value } : r));
  }

  function selectGa4(siteUrl: string, propertyId: string) {
    const prop = ga4Properties.find((p) => p.propertyId === propertyId);
    setRows((prev) =>
      prev.map((r) =>
        r.siteUrl === siteUrl
          ? { ...r, ga4PropertyId: propertyId, ga4PropertyName: prop?.displayName ?? "" }
          : r
      )
    );
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected && !r.alreadyImported);
    if (selected.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/clients/import-gsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sites: selected.map((r) => ({
            siteUrl: r.siteUrl,
            name: r.name,
            ga4PropertyId: r.ga4PropertyId,
            ga4PropertyName: r.ga4PropertyName,
          })),
        }),
      });
      const data = await res.json();
      const created = data.results.filter((r: { status: string }) => r.status === "created").length;
      const skipped = data.results.filter((r: { status: string }) => r.status === "skipped").length;
      setDone({ created, skipped });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const [search, setSearch] = useState("");

  const filteredRows = search.trim()
    ? rows.filter(r =>
        r.siteUrl.toLowerCase().includes(search.toLowerCase()) ||
        r.name.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const selectableRows = filteredRows.filter(r => !r.alreadyImported);
  const selectedCount  = rows.filter((r) => r.selected && !r.alreadyImported).length;
  const allSelected    = selectableRows.length > 0 && selectableRows.every((r) => r.selected);

  if (done) {
    return (
      <div className="space-y-6 max-w-lg">
        <div className="rounded-lg border p-8 text-center space-y-4">
          <p className="text-2xl font-semibold">Import complete</p>
          <p className="text-muted-foreground">
            {done.created} client{done.created !== 1 ? "s" : ""} created
            {done.skipped > 0 ? `, ${done.skipped} skipped (already existed)` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Open each client to add contact email and verify the GA4 mapping.
          </p>
          <Link href="/admin/clients" className={cn(buttonVariants())}>
            Go to Clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/clients" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Import from GSC + GA4</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All sites from your GSC account — GA4 matched automatically by name
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading GSC sites and GA4 properties...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-muted-foreground">No sites found in your GSC account.</p>
      )}

      {rows.length > 0 && (
        <>
          {/* Search */}
          <div style={{ position: "relative", maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש לפי דומיין או שם..."
              dir="rtl"
              style={{
                width: "100%", height: 36, paddingInline: "10px 32px",
                border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
                background: "var(--surface)", fontSize: 13,
                fontFamily: "inherit", color: "var(--text)", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          {search && (
            <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: -8 }}>
              מציג {filteredRows.length} מתוך {rows.length} נכסים
            </p>
          )}

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </th>
                  <th className="text-left p-3 font-medium">GSC Site</th>
                  <th className="text-left p-3 font-medium">Client Name</th>
                  <th className="text-left p-3 font-medium">GA4 Property</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.siteUrl}
                    className="border-b last:border-0"
                    style={{ opacity: row.alreadyImported ? 0.5 : 1, background: row.alreadyImported ? "var(--surface-sunken)" : undefined }}
                  >
                    <td className="p-3">
                      {row.alreadyImported ? (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "var(--green-soft)", color: "var(--green)", border: "1px solid var(--green-soft-strong)", whiteSpace: "nowrap" }}>
                          קיים
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => updateRow(row.siteUrl, "selected", e.target.checked)}
                          className="h-4 w-4"
                        />
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {row.siteUrl}
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.siteUrl, "name", e.target.value)}
                        disabled={!row.selected || row.alreadyImported}
                        className="border rounded px-2 py-1 text-sm w-full max-w-[180px] bg-background disabled:opacity-50"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={row.ga4PropertyId}
                        onChange={(e) => selectGa4(row.siteUrl, e.target.value)}
                        disabled={!row.selected || row.alreadyImported}
                        className="border rounded px-2 py-1 text-sm w-full max-w-[260px] bg-background disabled:opacity-50"
                      >
                        <option value="">— No GA4 —</option>
                        {ga4Properties.map((p) => (
                          <option key={p.propertyId} value={p.propertyId}>
                            {p.displayName} ({p.propertyId})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className={cn(buttonVariants(), "gap-2")}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Import {selectedCount > 0 ? `${selectedCount} ` : ""}
              {selectedCount === 1 ? "site" : "sites"}
            </button>
            <p className="text-sm text-muted-foreground">
              Contact email can be added per client after import
            </p>
          </div>
        </>
      )}
    </div>
  );
}
