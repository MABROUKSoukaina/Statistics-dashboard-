// Coded-field decoders — kept in sync with the Python dicts of the same name in
// Generateur_Fiches_IFN/generate_fiche_simple.py (Fiches dendro repo).

export const EXPOSITION: Record<number, string> = { 1: 'Nord', 2: 'Nord-Est', 3: 'Est', 4: 'Sud-Est', 5: 'Sud', 6: 'Sud-Ouest', 7: 'Ouest', 8: 'Nord-Ouest' };
export const TOPO_POS: Record<number, string> = { 1: 'Plat', 2: 'Dépression', 3: 'Sommet', 4: 'Haut versant', 5: 'Mi-versant', 6: 'Bas-versant' };
export const SUBSTRAT: Record<number, string> = { 1: 'Grès', 2: 'Calcaire', 3: 'Schiste', 4: 'Sable', 5: 'Basalte', 6: 'Granite', 7: 'Quartzite', 8: 'Marne', 9: 'Dolomie', 10: 'Autre' };
export const TYPE_SOL: Record<number, string> = { 1: 'Sols peu évolués', 2: 'Sols peu diff./humifères', 3: 'Sols calcimagnésiques', 4: 'Sols isohumiques', 5: 'Vertisols', 6: 'Sols brunifiés', 7: 'Sols podzoliques', 8: 'Autre' };
export const PROFONDEUR_SOL: Record<number, string> = { 0: 'Superficiel', 1: 'Moyennement profond', 2: 'Profond' };
export const COUVERTURE_SOL: Record<number, string> = { 1: 'Couvert boisé fermé', 2: 'Couvert boisé ouvert', 3: 'Bosquet', 4: 'Matorral' };
export const INTENSITE_PARCOURS: Record<number, string> = { 0: 'Nul', 1: 'Faible', 2: 'Moyen', 3: 'Intense' };
export const ETAT_SANITAIRE_GENERAL: Record<number, string> = { 1: 'Bon', 2: 'Moyen', 3: 'Mauvais' };
export const INTENSITE_INCENDIE: Record<number, string> = { 1: 'Partiel', 2: 'Total' };
export const ANCIENNETE_INCENDIE: Record<number, string> = { 1: 'Moins de 5 ans', 2: 'Plus de 5 ans' };
export const EMONDAGE: Record<number, string> = { 0: "Pas d'émondage", 1: 'Moins de 25%', 2: 'Entre 25 et 50%', 3: 'Entre 50 et 75%', 4: 'Supérieur à 75%' };
export const MORTALITE_BRANCHES: Record<number, string> = { 0: 'Pas de mortalité de branches', 1: 'Moins de 25%', 2: 'Entre 25 et 50%', 3: 'Entre 50 et 75%', 4: 'Supérieur à 75%' };
export const POURRITURE_TRONC: Record<number, string> = { 0: 'Pas de pourriture', 1: 'Moins de 25%', 2: 'Entre 25 et 50%', 3: 'Entre 50 et 75%', 4: 'Supérieur à 75%' };
export const CHARBON_MERE: Record<number, string> = { 0: 'Absence', 1: 'Sur les branches et rameaux', 2: 'Sur le tronc' };
