import type { ReservationStatus } from "@prisma/client";
import { cn } from "@/lib/cn";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/reservation-status";

export function StatusBadge({
  status,
  className
}: {
  status: ReservationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
        STATUS_TONE[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
