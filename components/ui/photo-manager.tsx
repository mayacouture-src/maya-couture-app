"use client";

import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { uploadProductPhoto } from "@/app/(authed)/products/upload-action";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/compress-image";

export type PhotoInput = {
  id?: string;        // existant en DB
  url: string;
  alt?: string | null;
};

// Taille max ACCEPTÉE en entrée : 30 Mo, ce qui couvre les photos iPhone
// 50MP non-compressées. La compression côté client réduit ça à ~300-800 Ko
// avant de partir au serveur (limite serverActions = 6 Mo).
const ORIGINAL_MAX_BYTES = 30 * 1024 * 1024;
const COMPRESSED_MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif"
]);

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function PhotoManager({
  defaultValue,
  name = "photos"
}: {
  defaultValue?: PhotoInput[];
  name?: string;
}) {
  const [photos, setPhotos] = useState<PhotoInput[]>(() => defaultValue ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const serialized = useMemo(() => JSON.stringify(photos), [photos]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrors([]);
    startTransition(async () => {
      const newErrors: string[] = [];
      for (const file of Array.from(files)) {
        // Validation client AVANT l'appel Server Action — sinon Next.js
        // rejette le body au-dessus de la limite serverActions et plante
        // avant que notre check côté serveur ne s'exécute.
        if (file.size === 0) {
          newErrors.push(`${file.name} : fichier vide`);
          continue;
        }
        if (file.size > ORIGINAL_MAX_BYTES) {
          newErrors.push(
            `${file.name} : trop volumineux (${formatSize(file.size)} — max 30 Mo en entrée)`
          );
          continue;
        }
        if (file.type && !ACCEPTED_TYPES.has(file.type)) {
          newErrors.push(
            `${file.name} : format non supporté (JPG, PNG, WEBP ou AVIF)`
          );
          continue;
        }

        // Compression : resize sur 2000px de long côté + JPEG 85%.
        // Pour une photo iPhone 50MP de 12 Mo, ça redescend à ~400 Ko
        // sans perte visuelle perceptible sur un écran d'ordi/téléphone.
        let toUpload = file;
        try {
          toUpload = await compressImage(file);
        } catch {
          // Si la compression échoue (HEIC non décodable, etc.), on
          // continue avec l'original et on laissera le serveur juger.
        }

        if (toUpload.size > COMPRESSED_MAX_BYTES) {
          newErrors.push(
            `${file.name} : encore trop gros après compression (${formatSize(toUpload.size)}). Réduis la résolution avant.`
          );
          continue;
        }

        const fd = new FormData();
        fd.set("file", toUpload);
        try {
          const result = await uploadProductPhoto(fd);
          if ("error" in result) {
            newErrors.push(`${file.name} : ${result.error}`);
            continue;
          }
          setPhotos((curr) => [...curr, { url: result.url, alt: null }]);
        } catch (e) {
          newErrors.push(
            `${file.name} : ${e instanceof Error ? e.message : "envoi impossible"}`
          );
        }
      }
      if (newErrors.length) setErrors(newErrors);
    });
  };

  const removeAt = (idx: number) => {
    setPhotos((curr) => curr.filter((_, i) => i !== idx));
  };

  const setAsCover = (idx: number) => {
    setPhotos((curr) => {
      if (idx === 0) return curr;
      const next = [...curr];
      const [moved] = next.splice(idx, 1);
      next.unshift(moved);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={serialized} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, idx) => (
          <figure
            key={photo.url}
            className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.alt ?? ""}
              className="h-full w-full object-cover"
            />
            {idx === 0 && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 shadow-sm backdrop-blur">
                <Star className="h-3 w-3 fill-brand-600 text-brand-600" />
                Couverture
              </span>
            )}
            <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/40 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              {idx !== 0 && (
                <button
                  type="button"
                  onClick={() => setAsCover(idx)}
                  className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-zinc-700 backdrop-blur hover:bg-white"
                >
                  Mettre en couverture
                </button>
              )}
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label="Retirer"
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-700 backdrop-blur hover:bg-white hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </figure>
        ))}

        <DropZone
          onFiles={handleFiles}
          onClick={() => inputRef.current?.click()}
          pending={pending}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map((err, i) => (
            <li
              key={i}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700"
            >
              {err}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-zinc-500">
        JPG, PNG, WEBP ou AVIF · jusqu&apos;à 30 Mo en entrée (compressées
        automatiquement à ~2000px / qualité 85%). La première photo sert de
        couverture sur les cartes du catalogue.
      </p>
    </div>
  );
}

function DropZone({
  onFiles,
  onClick,
  pending
}: {
  onFiles: (files: FileList) => void;
  onClick: () => void;
  pending: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        if (e.dataTransfer.files) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-xs font-medium transition",
        hover
          ? "border-brand-400 bg-brand-50/60 text-brand-700"
          : "border-zinc-300 bg-zinc-50/40 text-zinc-500 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
      )}
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <ImagePlus className="h-5 w-5" />
      )}
      <span>{pending ? "Envoi…" : "Ajouter des photos"}</span>
    </button>
  );
}
