// Extrait toutes les valeurs string d'un FormData en plain object.
// Utilisé pour renvoyer les saisies de l'utilisateur dans le state d'erreur
// d'une server action, afin que le form ne reset pas tout après React 19.
export function valuesFromForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
