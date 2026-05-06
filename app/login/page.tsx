import { BrandMark } from "@/components/layout/brand-mark";
import { Divider, Flower } from "@/components/ornament";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#e4e0dd] px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-radial" />

      {/* Décor d'angle — masqué sur mobile (encombrant), visible en sm+ */}
      <Flower size={28} className="absolute left-10 top-10 hidden opacity-70 sm:block" />
      <Flower size={28} className="absolute right-10 top-10 hidden opacity-70 sm:block" />
      <Flower size={28} className="absolute bottom-10 left-10 hidden opacity-70 sm:block" />
      <Flower size={28} className="absolute bottom-10 right-10 hidden opacity-70 sm:block" />

      <CornerBracket className="absolute left-16 top-16 hidden sm:block" pos="tl" />
      <CornerBracket className="absolute right-16 top-16 hidden sm:block" pos="tr" />
      <CornerBracket className="absolute bottom-16 left-16 hidden sm:block" pos="bl" />
      <CornerBracket className="absolute bottom-16 right-16 hidden sm:block" pos="br" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <BrandMark variant="login" width={400} />
          <Divider width={240} />
        </div>

        <div className="surface p-7">
          <h1 className="text-center font-serif text-2xl tracking-tight text-zinc-900">
            Bienvenue.
          </h1>
          <p className="mt-1 text-center text-sm text-zinc-500">
            Connecte-toi pour accéder à l&apos;atelier.
          </p>
          <Divider width={140} className="mx-auto mt-5" />
          <div className="mt-5">
            <LoginForm />
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Divider width={180} />
          <p className="text-[11px] uppercase tracking-[0.22em] text-brand-700">
            Espace de gestion · accès restreint
          </p>
        </div>
      </div>
    </main>
  );
}

function CornerBracket({
  pos,
  className
}: {
  pos: "tl" | "tr" | "bl" | "br";
  className?: string;
}) {
  const sides = {
    tl: "border-l border-t rounded-tl-xl",
    tr: "border-r border-t rounded-tr-xl",
    bl: "border-l border-b rounded-bl-xl",
    br: "border-r border-b rounded-br-xl"
  } as const;
  return (
    <div
      aria-hidden
      className={`pointer-events-none h-12 w-12 border-brand-700/30 ${sides[pos]} ${className ?? ""}`}
    />
  );
}
