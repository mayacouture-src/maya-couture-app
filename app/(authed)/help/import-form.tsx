"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Upload
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ImportError = { row: number; field?: string; message: string };
type Report = {
  rowsTotal: number;
  rowsOk: number;
  errors: ImportError[];
  created: number;
  committed: boolean;
};

export function ImportForm({
  entity
}: {
  entity: "products" | "customers";
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setFile(null);
    setReport(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function send(commit: boolean) {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (commit) fd.append("commit", "true");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/import/${entity}`, {
          method: "POST",
          body: fd
        });
        const json = (await res.json()) as Report | { error: string };
        if (!res.ok || "error" in json) {
          setError("error" in json ? json.error : "Erreur inconnue");
          return;
        }
        setReport(json);
        if (commit) {
          // Refresh server data so other pages reflect the new rows
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur réseau");
      }
    });
  }

  // On peut confirmer dès qu'au moins une ligne est valide (le serveur n'insère
  // que celles qui passent la validation, les autres sont ignorées).
  const okToCommit =
    report !== null && report.rowsOk > 0 && !report.committed;

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setReport(null);
            setError(null);
          }}
          className="block w-full max-w-xs cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />

        <button
          type="button"
          disabled={!file || isPending}
          onClick={() => send(false)}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending && !report ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Simuler
        </button>

        {okToCommit && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => send(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Confirmer l&apos;import ({report.rowsOk} ligne
            {report.rowsOk > 1 ? "s" : ""})
          </button>
        )}

        {(file || report || error) && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-zinc-500 underline-offset-2 hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      )}

      {report && <ReportView report={report} />}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const okCount = report.rowsOk;
  const isCommitted = report.committed;

  return (
    <div className="space-y-2">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-lg p-3 text-xs ${
          isCommitted
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : okCount === 0
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {isCommitted ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>
          <strong>{report.rowsTotal}</strong> ligne{report.rowsTotal > 1 ? "s" : ""}{" "}
          traitée{report.rowsTotal > 1 ? "s" : ""} · <strong>{okCount}</strong>{" "}
          OK · <strong>{report.errors.length}</strong> erreur
          {report.errors.length > 1 ? "s" : ""}
          {isCommitted && (
            <>
              {" "}
              ·{" "}
              <strong>
                {report.created} créée{report.created > 1 ? "s" : ""}
              </strong>
            </>
          )}
        </span>
      </div>

      {report.errors.length > 0 && (
        <details className="rounded-lg border border-zinc-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-700">
            Détail des {report.errors.length} erreur
            {report.errors.length > 1 ? "s" : ""}
          </summary>
          <div className="max-h-72 overflow-y-auto px-3 pb-3">
            <ul className="space-y-1 text-xs">
              {report.errors.slice(0, 200).map((e, i) => (
                <li key={i} className="flex gap-2 text-zinc-700">
                  <span className="shrink-0 font-mono text-zinc-400">
                    L.{e.row}
                  </span>
                  {e.field && (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                      {e.field}
                    </span>
                  )}
                  <span className="text-rose-700">{e.message}</span>
                </li>
              ))}
              {report.errors.length > 200 && (
                <li className="pt-2 text-zinc-500">
                  … et {report.errors.length - 200} autres
                </li>
              )}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
