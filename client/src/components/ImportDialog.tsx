/**
 * ImportDialog
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-step XLSX import with overwrite protection:
 *
 * Step 1 — FILE PICK + PREVIEW
 *   User drops / selects an XLSX file.
 *   We POST it to /api/import/preview, which returns a summary of each sheet
 *   and flags which months already exist in the DB (conflicts).
 *
 * Step 2 — CONFLICT RESOLUTION (only if conflicts exist)
 *   For each conflicting month, user chooses "Overwrite" or "Skip".
 *   A clear warning explains that overwriting deletes existing entries.
 *
 * Step 3 — COMMIT
 *   POST to /api/import/commit with the file + overwrite/skip decisions.
 *   Show per-month result.
 */
import { useState, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X, SkipForward } from "lucide-react";
import { formatMonthLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SheetSummary {
  month: string;           // "YYYY-MM"
  food: number;
  shopping: number;
  grocery: number;
  total: number;
  hasConflict: boolean;
}

interface PreviewResult {
  summary: SheetSummary[];
  conflicts: string[];
  totalSheets: number;
  debugSheetNames?: string[]; // returned when no sheets matched
}

interface CommitResult {
  ok: boolean;
  results: Record<string, { imported: number; skipped: boolean; overwritten: boolean }>;
}

type ConflictChoice = "overwrite" | "skip";
type Step = "pick" | "preview" | "conflicts" | "committing" | "done";

// ── Component ──────────────────────────────────────────────────────────────────
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]     = useState(false);
  const [file, setFile]             = useState<File | null>(null);
  const [step, setStep]             = useState<Step>("pick");
  const [preview, setPreview]       = useState<PreviewResult | null>(null);
  const [choices, setChoices]       = useState<Record<string, ConflictChoice>>({});
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  // ── Reset on close ─────────────────────────────────────────────────────────
  function handleClose() {
    setFile(null); setStep("pick"); setPreview(null);
    setChoices({}); setCommitResult(null); setError(null); setLoading(false);
    onClose();
  }

  // ── Drop zone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, []);

  function acceptFile(f: File) {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      setError("Please select an Excel (.xlsx) file.");
      return;
    }
    setError(null);
    setFile(f);
  }

  // ── Step 1 → Preview ──────────────────────────────────────────────────────
  async function runPreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
      // If no sheets at all
      if (data.totalSheets === 0) {
        const found = data.debugSheetNames?.length
          ? ` Found sheet(s): ${data.debugSheetNames.map((n: string) => `"${n}"`).join(", ")}.`
          : "";
        setError(`No recognisable month sheets found. Sheet names must be like "Mar 2026", "Jul 2025", etc.${found}`);
        setLoading(false);
        return;
      }
      // Pre-fill choices: all conflicts default to "skip" (safe default)
      const defaultChoices: Record<string, ConflictChoice> = {};
      for (const m of data.conflicts) defaultChoices[m] = "skip";
      setChoices(defaultChoices);
      setStep(data.conflicts.length > 0 ? "conflicts" : "preview");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 → Commit ───────────────────────────────────────────────────────
  async function runCommit() {
    if (!file || !preview) return;
    setLoading(true);
    setError(null);
    setStep("committing");
    try {
      const overwriteMonths = Object.entries(choices).filter(([, v]) => v === "overwrite").map(([k]) => k);
      const skipMonths      = Object.entries(choices).filter(([, v]) => v === "skip").map(([k]) => k);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("overwriteMonths", JSON.stringify(overwriteMonths));
      fd.append("skipMonths", JSON.stringify(skipMonths));

      const res = await fetch("/api/import/commit", { method: "POST", body: fd });
      const data: CommitResult = await res.json();
      if (!res.ok || !data.ok) throw new Error((data as any).error ?? "Import failed");

      setCommitResult(data);
      setStep("done");

      // Invalidate all expense queries so pages refresh
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/month-summaries"] });

      const imported = Object.values(data.results).reduce((s, r) => s + r.imported, 0);
      toast({ title: `Import complete — ${imported} entries loaded` });
    } catch (e: any) {
      setError(e.message);
      setStep("conflicts");
    } finally {
      setLoading(false);
    }
  }

  // ── Conflict-free preview: show summary and go straight to commit ──────────
  function handlePreviewConfirm() {
    runCommit();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const allConflictsDecided = preview
    ? preview.conflicts.every(m => choices[m] === "overwrite" || choices[m] === "skip")
    : false;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-primary" />
            Import from XLSX
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP: PICK ─────────────────────────────────────────────────── */}
        {step === "pick" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Select an XLSX file exported from this app (or in the same format). Each sheet named
              like <span className="font-mono bg-muted px-1 rounded">Mar 2026</span> will be imported
              as that month's expense entries.
            </p>

            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              )}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="import-drop-zone"
            >
              <FileSpreadsheet className={cn("h-10 w-10", dragging ? "text-primary" : "text-muted-foreground")} />
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium">Drop XLSX file here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
                data-testid="import-file-input"
              />
            </div>

            {file && (
              <div className="flex justify-between items-center">
                <button
                  onClick={() => { setFile(null); setError(null); }}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
                <Button size="sm" onClick={runPreview} disabled={loading} data-testid="btn-import-preview">
                  {loading ? "Analysing…" : "Next: Preview →"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: PREVIEW (no conflicts) ───────────────────────────────── */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Found <span className="font-semibold text-foreground">{preview.totalSheets}</span> month sheet{preview.totalSheets !== 1 ? "s" : ""}.
              No conflicts — all months are new.
            </p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Month</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Food</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Shopping</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Grocery</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.summary.map(s => (
                    <tr key={s.month} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{formatMonthLabel(s.month)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.food}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.shopping}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.grocery}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("pick")}>← Back</Button>
              <Button size="sm" onClick={handlePreviewConfirm} disabled={loading} data-testid="btn-import-commit">
                {loading ? "Importing…" : "Import All →"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: CONFLICTS ────────────────────────────────────────────── */}
        {step === "conflicts" && preview && (
          <div className="space-y-4">
            {/* Warning banner */}
            <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {preview.conflicts.length} month{preview.conflicts.length !== 1 ? "s" : ""} already have data
                </p>
                <p className="text-muted-foreground">
                  Choose what to do for each conflicting month. <strong>Overwrite</strong> permanently
                  deletes existing entries and replaces them with the imported data. <strong>Skip</strong>
                  leaves the existing data untouched.
                </p>
              </div>
            </div>

            {/* Per-month choices */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {preview.summary.map(s => (
                <div
                  key={s.month}
                  className={cn(
                    "rounded-md border px-3 py-2.5 flex items-center justify-between gap-3",
                    s.hasConflict ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-muted/20",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatMonthLabel(s.month)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.total} entries ({s.food} food, {s.shopping} shopping, {s.grocery} grocery)
                      {s.hasConflict && <span className="text-yellow-600 dark:text-yellow-400 font-medium"> · has existing data</span>}
                    </p>
                  </div>

                  {s.hasConflict ? (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => setChoices(c => ({ ...c, [s.month]: "skip" }))}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                          choices[s.month] === "skip"
                            ? "bg-muted border-border text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        )}
                        data-testid={`btn-skip-${s.month}`}
                      >
                        <SkipForward className="h-3 w-3" />
                        Skip
                      </button>
                      <button
                        onClick={() => setChoices(c => ({ ...c, [s.month]: "overwrite" }))}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                          choices[s.month] === "overwrite"
                            ? "bg-destructive/15 border-destructive/40 text-destructive"
                            : "border-border text-muted-foreground hover:text-destructive hover:border-destructive/40",
                        )}
                        data-testid={`btn-overwrite-${s.month}`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Overwrite
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-500 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" /> New
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Bulk actions for conflicts */}
            {preview.conflicts.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Conflicts:</span>
                <button
                  className="underline hover:text-foreground"
                  onClick={() => {
                    const all: Record<string, ConflictChoice> = { ...choices };
                    for (const m of preview.conflicts) all[m] = "skip";
                    setChoices(all);
                  }}
                >
                  Skip all
                </button>
                <span>·</span>
                <button
                  className="underline hover:text-destructive"
                  onClick={() => {
                    const all: Record<string, ConflictChoice> = { ...choices };
                    for (const m of preview.conflicts) all[m] = "overwrite";
                    setChoices(all);
                  }}
                >
                  Overwrite all
                </button>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep("pick")}>← Back</Button>
              <Button
                size="sm"
                onClick={runCommit}
                disabled={loading || !allConflictsDecided}
                data-testid="btn-import-confirm"
              >
                {loading ? "Importing…" : "Confirm & Import →"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: COMMITTING ───────────────────────────────────────────── */}
        {step === "committing" && (
          <div className="py-8 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm">Importing data…</p>
          </div>
        )}

        {/* ── STEP: DONE ─────────────────────────────────────────────────── */}
        {step === "done" && commitResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-semibold">Import complete</span>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Month</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Entries</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(commitResult.results)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([month, r]) => (
                    <tr key={month} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{formatMonthLabel(month)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.skipped ? "—" : r.imported}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.skipped ? (
                          <span className="text-muted-foreground">Skipped</span>
                        ) : r.overwritten ? (
                          <span className="text-yellow-500">Overwritten</span>
                        ) : (
                          <span className="text-emerald-500">Imported</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Visit Monthly Entry to review the imported data.
            </p>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleClose} data-testid="btn-import-close">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
