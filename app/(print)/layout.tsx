import { redirect } from "next/navigation";
import { auth } from "@/auth";
import "../globals.css";

export const dynamic = "force-dynamic";

// Layout minimal sans la coque dashboard — pour les vues imprimables.
export default async function PrintLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <>
      {/*
        Force tous les backgrounds, dégradés, couleurs et ombres à apparaître
        à l'impression. Sans ça, les browsers strippent par défaut les bg
        et le PDF imprimé ne ressemble pas à l'aperçu écran (cartes Période,
        Totaux, badges de statut, etc.).
      */}
      <style>{`
        @media print {
          *, *::before, *::after {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-zinc-100 print:bg-white">{children}</div>
    </>
  );
}
