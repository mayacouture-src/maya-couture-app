"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export function Toggle({
  name,
  defaultChecked,
  label,
  description
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "group relative flex cursor-pointer select-none items-start justify-between gap-4 rounded-xl border border-zinc-200/70 bg-white px-4 py-3 transition-all duration-200",
        "hover:border-zinc-300 hover:shadow-sm",
        "has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/40 has-[:checked]:shadow-soft",
        "active:scale-[0.99]"
      )}
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-zinc-900 transition-colors group-has-[:checked]:text-brand-800">
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        )}
      </div>

      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />

      {/* Track */}
      <span
        aria-hidden
        className={cn(
          "relative mt-1 inline-block h-6 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-200 ring-1 ring-inset ring-zinc-200/60",
          "transition-[background-color,box-shadow] duration-300 ease-out",
          "group-has-[:checked]:bg-brand-600 group-has-[:checked]:ring-brand-600/30 group-has-[:checked]:shadow-[inset_0_0_0_1px_rgba(105,21,36,0.25)]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-brand-500/60"
        )}
      >
        {/* Knob */}
        <span
          className={cn(
            "absolute left-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-zinc-900/5",
            "transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
            "group-has-[:checked]:translate-x-5"
          )}
        >
          {/* Check qui apparaît en fade quand activé */}
          <Check
            className={cn(
              "h-3 w-3 text-brand-600 opacity-0 transition-opacity duration-200 delay-150",
              "group-has-[:checked]:opacity-100"
            )}
            strokeWidth={3}
          />
        </span>
      </span>
    </label>
  );
}
