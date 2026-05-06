// Contenu éditable du contrat de location.
// Si une réservation a `contractArticles` à null en BDD, on affiche les
// articles par défaut ci-dessous. Dès qu'une admin sauvegarde une version
// modifiée pour ce contrat précis, c'est cette version qui prime.

import { z } from "zod";

export type ContractArticle = {
  title: string;
  body: string;
};

export const DEFAULT_CONTRACT_ARTICLES: ContractArticle[] = [
  {
    title: "Engagements",
    body: [
      "La locataire s'engage à restituer les robes dans l'état dans lequel elle les a reçues, à la date convenue.",
      "Tout dégât ou retard pourra entraîner la rétention de tout ou partie de la caution.",
      "La caution est restituée intégralement après inspection si les robes reviennent en parfait état."
    ].join("\n\n")
  },
  {
    title: "Restrictions d'usage",
    body: "L'utilisation de fumigènes est strictement interdite lors du port des robes."
  }
];

// Validation des articles soumis par l'UI d'édition. Limite raisonnable :
// 20 articles max, titre 100 chars, corps 5000 chars.
export const contractArticlesSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1, "Titre requis").max(100),
      body: z.string().trim().min(1, "Contenu requis").max(5000)
    })
  )
  .max(20, "Maximum 20 articles");

// Lit le champ contractArticles (Json) en validant la forme. Retourne null
// si le contenu est invalide ou absent → l'appelant utilise DEFAULT_*.
export function parseContractArticles(value: unknown): ContractArticle[] | null {
  if (value === null || value === undefined) return null;
  const result = contractArticlesSchema.safeParse(value);
  return result.success ? result.data : null;
}
