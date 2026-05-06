import { cn } from "@/lib/cn";

export function FormSection({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-6 border-b border-zinc-200/70 pb-8 last:border-b-0 last:pb-0 lg:grid-cols-3",
        className
      )}
    >
      <header className="lg:col-span-1">
        <h2 className="font-serif text-lg text-zinc-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}
      </header>
      <div className="space-y-4 lg:col-span-2">{children}</div>
    </section>
  );
}

export function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const colsClass = cols === 3 ? "sm:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : "";
  return <div className={cn("grid grid-cols-1 gap-4", colsClass)}>{children}</div>;
}
