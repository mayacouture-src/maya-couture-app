import Image from "next/image";
import { cn } from "@/lib/cn";

type Variant = "navbar" | "login" | "icon";

// Versions transparentes pour s'intégrer naturellement au fond #e4e0dd
// de la sidebar (et tout autre fond coloré). Les originaux .png restent
// disponibles dans /public en backup (.original.png).
const VARIANTS: Record<Variant, { src: string; w: number; h: number; alt: string }> = {
  navbar: { src: "/logo-navbar-transparent.png", w: 600, h: 380, alt: "Maya Couture" },
  login: { src: "/logo-login.png", w: 480, h: 600, alt: "Maya Couture" },
  icon: { src: "/logo-transparent.png", w: 200, h: 200, alt: "Maya Couture" }
};

export function BrandMark({
  variant = "navbar",
  className,
  width
}: {
  variant?: Variant;
  className?: string;
  width?: number;
}) {
  const v = VARIANTS[variant];
  const w = width ?? (variant === "login" ? 240 : variant === "icon" ? 56 : 180);
  const h = Math.round((w * v.h) / v.w);
  return (
    <Image
      src={v.src}
      alt={v.alt}
      width={v.w}
      height={v.h}
      priority={variant === "login"}
      className={cn(className)}
      style={{ width: w, height: h }}
    />
  );
}
