"use client";

import {
  Check,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X
} from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  DEFAULT_CONTRACT_ARTICLES,
  type ContractArticle
} from "@/lib/contract-template";
import { updateContractArticles } from "./actions";

type Props = {
  reservationId: string;
  initial: ContractArticle[];
  isAdmin: boolean;
  startNumber: number; // Article 1 = robes louées, donc on commence à 2
};

export function ContractArticles({
  reservationId,
  initial,
  isAdmin,
  startNumber
}: Props) {
  const [articles, setArticles] = useState<ContractArticle[]>(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // ─── Mode lecture ────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <section className="space-y-6">
        {articles.map((a, i) => (
          <ArticleView
            key={i}
            n={startNumber + i}
            title={a.title}
            body={a.body}
          />
        ))}

        {isAdmin && (
          <div className="print:hidden">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier les articles
            </button>
          </div>
        )}
      </section>
    );
  }

  // ─── Mode édition ────────────────────────────────────────────────────────
  const move = (idx: number, delta: -1 | 1) => {
    setArticles((curr) => {
      const next = [...curr];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return curr;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const update = (idx: number, patch: Partial<ContractArticle>) => {
    setArticles((curr) => curr.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const remove = (idx: number) => {
    setArticles((curr) => curr.filter((_, i) => i !== idx));
  };

  const add = () => {
    setArticles((curr) => [...curr, { title: "Nouvel article", body: "" }]);
  };

  const resetToDefaults = () => {
    setArticles(DEFAULT_CONTRACT_ARTICLES.map((a) => ({ ...a })));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateContractArticles(reservationId, articles);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
    });
  };

  const cancel = () => {
    setArticles(initial);
    setError(null);
    setEditing(false);
  };

  return (
    <section className="space-y-4 rounded-xl border border-brand-200 bg-brand-50/30 p-4 print:hidden">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
          Édition des articles du contrat
        </p>
        <button
          type="button"
          onClick={resetToDefaults}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-brand-700"
          title="Remplace par les articles par défaut"
        >
          <RotateCcw className="h-3 w-3" />
          Articles par défaut
        </button>
      </div>

      <ul className="space-y-3">
        {articles.map((a, i) => (
          <li
            key={i}
            className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                  aria-label="Monter"
                >
                  ▲
                </button>
                <GripVertical className="h-3 w-3 text-zinc-300" />
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === articles.length - 1}
                  className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                  aria-label="Descendre"
                >
                  ▼
                </button>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Article {startNumber + i}
                  </span>
                  <input
                    value={a.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="Titre"
                    className="focus-ring flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Retirer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea
                  value={a.body}
                  onChange={(e) => update(i, { body: e.target.value })}
                  rows={Math.min(8, Math.max(3, a.body.split("\n").length))}
                  placeholder="Texte de l'article (les lignes vides séparent les paragraphes)"
                  className={cn(
                    "focus-ring w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm leading-relaxed",
                    "font-sans text-zinc-700"
                  )}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-brand-300 hover:bg-white hover:text-brand-700"
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter un article
      </button>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand-200 pt-3">
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <X className="h-3.5 w-3.5" />
          Annuler
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || articles.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Enregistrer
        </button>
      </div>
    </section>
  );
}

function ArticleView({
  n,
  title,
  body
}: {
  n: number;
  title: string;
  body: string;
}) {
  const paragraphs = body.split(/\n{2,}/);
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Article {n} · {title}
      </h2>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-zinc-700">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}
