// Constantes de style des documents imprimables (contrat, factures).
// Centralisé ici pour pouvoir A/B tester les deux options de rendu du logo
// dans le bandeau d'en-tête sans toucher aux 3 fichiers.

// ─── Option C (par défaut) ────────────────────────────────────────────────
// Logo PNG transparent + bandeau dans la couleur que tu choisis.
// Le logo flotte sans cadre visible, peu importe la couleur du bandeau.
export const DOC_LOGO_SRC = "/logo-navbar-transparent.png";
export const DOC_BANNER_BG = "#e4e0db";

// ─── Option B (à activer pour tester le match parfait du fond) ────────────
// Logo PNG original (avec son fond crème natif #e6e0dc) + bandeau
// exactement de la même teinte. Pas de rectangle visible autour du logo
// car les deux couleurs se confondent.
//
//   export const DOC_LOGO_SRC = "/logo-navbar.png";
//   export const DOC_BANNER_BG = "#e6e0dc";
//
// Pour basculer : commenter le bloc Option C ci-dessus, décommenter le bloc
// Option B juste au-dessus, redémarrer / rebuild.
