// Compresseur d'image côté client. Utilise <canvas> du navigateur — pas de
// dépendance externe. Tournée pour les photos de robes (≥ 2000px de long
// côté c'est largement suffisant pour le catalogue), pas pour des images
// destinées à l'impression haute résolution.
//
// Usage :
//   const compressed = await compressImage(file);
//   const fd = new FormData(); fd.set("file", compressed);
//   await uploadProductPhoto(fd);

export type CompressOptions = {
  // Long côté max après resize. Au-delà l'image est rétrécie, en-dessous
  // on garde la dimension d'origine.
  maxDimension?: number;
  // Qualité JPEG (0..1). 0.85 ≈ très bon visuel, ~3x plus léger qu'en 1.0.
  quality?: number;
  // Taille en dessous de laquelle on ne compresse PAS (la photo est déjà
  // assez petite, on évite la perte de qualité inutile).
  skipUnderBytes?: number;
};

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 2000,
  quality: 0.85,
  skipUnderBytes: 800 * 1024 // 800 Ko
};

// Charge un File dans une <img> exploitable par <canvas>.
async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = url;
    });
    if (img.decode) {
      try {
        await img.decode();
      } catch {
        // OK : decode() peut throw sur certains formats, le onload a déjà passé.
      }
    }
    return img;
  } finally {
    // L'URL est libérée après que l'image est chargée — l'<img> garde ses pixels.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

// Convertit un canvas en File JPEG.
function canvasToJpeg(
  canvas: HTMLCanvasElement,
  filename: string,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Échec encodage JPEG"));
          return;
        }
        const newName = filename.replace(/\.[^./\\]+$/, "") + ".jpg";
        resolve(
          new File([blob], newName, {
            type: "image/jpeg",
            lastModified: Date.now()
          })
        );
      },
      "image/jpeg",
      quality
    );
  });
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  // Si le fichier est déjà raisonnable et pas trop grand visuellement, on
  // l'envoie tel quel (pas de re-encodage = qualité préservée).
  if (file.size <= opts.skipUnderBytes) return file;

  // PNG avec transparence : si on perd à JPEG on perd l'alpha. Pour les
  // photos de robes ce n'est pas un usage légitime, mais on garde le PNG si
  // c'est petit.
  if (file.type === "image/png" && file.size <= opts.skipUnderBytes * 2) {
    return file;
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    // Si on ne sait pas la lire (HEIC sur Chrome par exemple), on renvoie
    // l'original — la validation côté form/serveur fera le tri.
    return file;
  }

  let { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) return file;

  // Resize : on touche aux dimensions seulement si c'est plus grand que la
  // limite. Sinon on garde la résolution d'origine.
  const longest = Math.max(w, h);
  if (longest > opts.maxDimension) {
    const ratio = opts.maxDimension / longest;
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  let compressed: File;
  try {
    compressed = await canvasToJpeg(canvas, file.name, opts.quality);
  } catch {
    return file;
  }

  // Si malgré la compression le résultat est plus gros que l'original
  // (peut arriver sur de petites images déjà bien encodées), on garde
  // l'original.
  if (compressed.size >= file.size) return file;

  return compressed;
}
