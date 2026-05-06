"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

export function PrintToolbar({ backHref, title }: { backHref: string; title: string }) {
  return (
    <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <p className="text-xs uppercase tracking-wider text-zinc-400">{title}</p>
        <button
          onClick={() => window.print()}
          className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
        >
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
      </div>
    </div>
  );
}
