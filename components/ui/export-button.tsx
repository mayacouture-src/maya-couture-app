"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

// Bouton "Exporter" + menu CSV/Excel.
// Reprend les filtres courants de l'URL pour l'export reflète ce qui est visible.
export function ExportButton({
  entity,
  className
}: {
  entity:
    | "products"
    | "rentals"
    | "customers"
    | "sales"
    | "cash"
    | "operations"
    | "users";
  className?: string;
}) {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function buildHref(format: "csv" | "xlsx") {
    const usp = new URLSearchParams();
    sp.forEach((v, k) => usp.set(k, v));
    usp.set("format", format);
    return `/api/export/${entity}?${usp.toString()}`;
  }

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-3.5 w-3.5" />
        Exporter
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-glow"
        >
          <a
            role="menuitem"
            href={buildHref("xlsx")}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-700 hover:bg-brand-50/60 hover:text-brand-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Excel (.xlsx)</span>
          </a>
          <a
            role="menuitem"
            href={buildHref("csv")}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-700 hover:bg-brand-50/60 hover:text-brand-700"
          >
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            <span>CSV (.csv)</span>
          </a>
        </div>
      )}
    </div>
  );
}
