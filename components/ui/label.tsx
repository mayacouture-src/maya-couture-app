import { cn } from "@/lib/cn";

export function Label({
  htmlFor,
  children,
  hint,
  required,
  className
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-700">
        {children}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </label>
      {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
    </div>
  );
}
