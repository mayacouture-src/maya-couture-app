import { Filter, Plus, Search, Tag } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  category?: string;
  type?: "rentable" | "sellable" | "";
  stock?: "in" | "out" | "";
}>;

export default async function ProductsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const category = params.category ?? "";
  const type = params.type ?? "";
  const stock = params.stock ?? "";

  const products = await prisma.product.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { reference: { contains: q, mode: "insensitive" } },
                { designer: { contains: q, mode: "insensitive" } }
              ]
            }
          : {},
        category ? { category } : {},
        type === "rentable" ? { isRentable: true } : {},
        type === "sellable" ? { isSellable: true } : {}
      ]
    },
    include: {
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
      photos: { take: 1, orderBy: { order: "asc" } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const filtered = products.filter((p) => {
    if (stock === "in") return p.variants.some((v) => v.quantityCurrent > 0);
    if (stock === "out") return p.variants.every((v) => v.quantityCurrent === 0);
    return true;
  });

  const categories = await prisma.product.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" }
  });

  const hasFilter = !!(q || category || type || stock);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Atelier"
        title="Catalogue"
        description="Toutes les robes proposées à la location ou à la vente."
        action={
          <div className="flex items-center gap-2">
            <ExportButton entity="products" />
            <LinkButton href="/products/new">
              <Plus className="h-4 w-4" />
              Nouvelle robe
            </LinkButton>
          </div>
        }
      />

      <FiltersBar
        q={q}
        category={category}
        type={type}
        stock={stock}
        categories={categories.map((c) => c.category).filter(Boolean) as string[]}
      />

      {filtered.length === 0 ? (
        <EmptyCatalog hasFilter={hasFilter} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const totalQty = p.variants.reduce((acc, v) => acc + v.quantityCurrent, 0);
            const distinctColors = Array.from(new Set(p.variants.map((v) => v.colorHex || v.color)));
            return (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="group surface flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-glow"
              >
                <CardCover
                  photoUrl={p.photos[0]?.url}
                  name={p.name}
                  colors={distinctColors}
                />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      {p.reference}
                      {p.category ? ` · ${p.category}` : ""}
                    </p>
                    <h3 className="mt-1 font-serif text-xl text-zinc-900">{p.name}</h3>
                    {p.designer && (
                      <p className="mt-0.5 text-xs text-zinc-500">{p.designer}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                    {p.isRentable && (
                      <span>
                        <span className="text-zinc-500">Loc.&nbsp;</span>
                        <span className="font-semibold text-zinc-900">
                          {formatCurrency(Number(p.rentalPrice))}
                        </span>
                      </span>
                    )}
                    {p.isSellable && (
                      <span>
                        <span className="text-zinc-500">Vente&nbsp;</span>
                        <span className="font-semibold text-zinc-900">
                          {formatCurrency(Number(p.salePrice))}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center gap-2 text-xs text-zinc-500">
                    <Tag className="h-3.5 w-3.5" />
                    <span>
                      {p.variants.length} variante{p.variants.length > 1 ? "s" : ""} ·{" "}
                      <span className="text-zinc-700">{totalQty}</span> en stock
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FiltersBar({
  q,
  category,
  type,
  stock,
  categories
}: {
  q: string;
  category: string;
  type: string;
  stock: string;
  categories: string[];
}) {
  return (
    <form action="/products" className="surface flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
        <Filter className="h-3.5 w-3.5" />
        Filtres
      </div>

      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Nom, référence, créateur…"
          className="focus-ring w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-zinc-400"
        />
      </div>

      <FilterSelect
        name="category"
        label="Catégorie"
        defaultValue={category}
        options={[
          { value: "", label: "Toutes" },
          ...categories.map((c) => ({ value: c, label: c }))
        ]}
      />

      <FilterSelect
        name="type"
        label="Type"
        defaultValue={type}
        options={[
          { value: "", label: "Tous" },
          { value: "rentable", label: "Louable" },
          { value: "sellable", label: "Vendable" }
        ]}
      />

      <FilterSelect
        name="stock"
        label="Stock"
        defaultValue={stock}
        options={[
          { value: "", label: "Tout" },
          { value: "in", label: "En stock" },
          { value: "out", label: "Épuisé" }
        ]}
      />

      <div className="ml-auto flex gap-2">
        <Link
          href="/products"
          className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Réinitialiser
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800"
        >
          Appliquer
        </button>
      </div>
    </form>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  options
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="focus-ring rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CardCover({
  photoUrl,
  name,
  colors
}: {
  photoUrl?: string;
  name: string;
  colors: string[];
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className="aspect-[4/5] w-full object-cover"
      />
    );
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-brand-100 via-white to-pink-100">
      <span className="font-serif text-7xl text-brand-600/40">{initial}</span>
      {colors.length > 0 && (
        <div className="absolute bottom-3 left-3 flex gap-1">
          {colors.slice(0, 6).map((c, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full ring-2 ring-white"
              style={{ backgroundColor: c.startsWith("#") ? c : "#888" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyCatalog({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="surface relative overflow-hidden p-12 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-white" />
      {hasFilter ? (
        <>
          <p className="font-serif text-xl text-zinc-900">Aucune robe trouvée</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Modifie les filtres ou réinitialise pour voir tout le catalogue.
          </p>
        </>
      ) : (
        <>
          <p className="font-serif text-xl text-zinc-900">Le catalogue est vide</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Ajoute ta première robe pour commencer à gérer les variantes, les locations
            et les ventes.
          </p>
          <div className="mt-5">
            <LinkButton href="/products/new">
              <Plus className="h-4 w-4" />
              Ajouter ma première robe
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
