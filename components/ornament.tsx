import { Flower2 } from "lucide-react";
import { cn } from "@/lib/cn";

// Trait horizontal avec une petite fleur au centre.
export function Divider({
  className,
  width = 220,
  withFlower = true
}: {
  className?: string;
  width?: number;
  withFlower?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center gap-3 text-brand-700", className)}
      style={{ width }}
      aria-hidden
    >
      <span className="h-px flex-1 bg-current opacity-30" />
      {withFlower && <Flower2 className="h-4 w-4" strokeWidth={1.4} />}
      <span className="h-px flex-1 bg-current opacity-30" />
    </div>
  );
}

// Petite fleur seule (lucide Flower2).
export function Flower({
  className,
  size = 20
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Flower2
      aria-hidden
      strokeWidth={1.4}
      className={cn("text-brand-700", className)}
      style={{ width: size, height: size }}
    />
  );
}
