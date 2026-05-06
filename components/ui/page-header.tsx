import { Construction } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-serif text-3xl tracking-tight text-zinc-900 sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function ComingSoon({ children }: { children?: React.ReactNode }) {
  return (
    <div className="surface relative overflow-hidden p-10 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-white" />
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Construction className="h-5 w-5" />
      </div>
      <p className="mt-4 font-serif text-xl text-zinc-900">En cours de couture</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
        {children ??
          "Cet écran n'est pas encore prêt. On l'attaque dans une prochaine itération."}
      </p>
    </div>
  );
}
