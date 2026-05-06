"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLOR_PRESETS, SIZE_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/cn";

export type VariantInput = {
  id: string;                 // local key (uuid client-side)
  size: string;
  color: string;
  colorHex: string | null;
  quantityInitial: number;
};

const newRow = (): VariantInput => ({
  id: crypto.randomUUID(),
  size: "",
  color: "",
  colorHex: null,
  quantityInitial: 1
});

export function VariantEditor({
  defaultValue,
  name = "variants"
}: {
  defaultValue?: Omit<VariantInput, "id">[];
  name?: string;
}) {
  const [rows, setRows] = useState<VariantInput[]>(() =>
    (defaultValue && defaultValue.length > 0
      ? defaultValue.map((v) => ({ ...v, id: crypto.randomUUID() }))
      : [newRow()])
  );

  const serialized = useMemo(
    () =>
      JSON.stringify(
        rows.map(({ id: _id, ...rest }) => rest)
      ),
    [rows]
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={serialized} />

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <VariantRow
            key={row.id}
            row={row}
            canRemove={rows.length > 1}
            onChange={(next) =>
              setRows((curr) => curr.map((r) => (r.id === row.id ? { ...r, ...next } : r)))
            }
            onRemove={() => setRows((curr) => curr.filter((r) => r.id !== row.id))}
            index={idx}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((curr) => [...curr, newRow()])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter une variante
      </button>
    </div>
  );
}

function VariantRow({
  row,
  index,
  canRemove,
  onChange,
  onRemove
}: {
  row: VariantInput;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<VariantInput>) => void;
  onRemove: () => void;
}) {
  const [sizeListId] = useState(() => `sizes-${row.id}`);
  const [colorListId] = useState(() => `colors-${row.id}`);

  // Quand on tape un nom de couleur preset, autocomplete le hex
  useEffect(() => {
    if (!row.color) return;
    const preset = COLOR_PRESETS.find(
      (c) => c.name.toLowerCase() === row.color.toLowerCase()
    );
    if (preset && row.colorHex !== preset.hex) {
      onChange({ colorHex: preset.hex });
    }
  }, [row.color, row.colorHex, onChange]);

  return (
    <div className="grid grid-cols-12 gap-2 rounded-xl border border-zinc-200/70 bg-white p-3 shadow-sm">
      <div className="col-span-12 sm:col-span-3">
        {index === 0 && <Label htmlFor={`size-${row.id}`}>Taille</Label>}
        <Input
          id={`size-${row.id}`}
          list={sizeListId}
          value={row.size}
          onChange={(e) => onChange({ size: e.target.value })}
          placeholder="36"
          className={cn(index === 0 && "mt-1.5")}
        />
        <datalist id={sizeListId}>
          {SIZE_PRESETS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <div className="col-span-12 sm:col-span-5">
        {index === 0 && <Label htmlFor={`color-${row.id}`}>Couleur</Label>}
        <div className={cn("flex items-center gap-2", index === 0 && "mt-1.5")}>
          <input
            type="color"
            value={row.colorHex ?? "#7c3aed"}
            onChange={(e) => onChange({ colorHex: e.target.value })}
            aria-label="Sélecteur de couleur"
            className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1"
          />
          <Input
            id={`color-${row.id}`}
            list={colorListId}
            value={row.color}
            onChange={(e) => onChange({ color: e.target.value })}
            placeholder="Bordeaux"
            className="flex-1"
          />
          <datalist id={colorListId}>
            {COLOR_PRESETS.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="col-span-9 sm:col-span-3">
        {index === 0 && <Label htmlFor={`qty-${row.id}`}>Quantité</Label>}
        <Input
          id={`qty-${row.id}`}
          type="number"
          min={1}
          value={row.quantityInitial}
          onChange={(e) =>
            onChange({ quantityInitial: Math.max(1, Number(e.target.value) || 1) })
          }
          className={cn(index === 0 && "mt-1.5")}
        />
      </div>

      <div className="col-span-3 sm:col-span-1 flex items-end justify-end">
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Supprimer cette variante"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
