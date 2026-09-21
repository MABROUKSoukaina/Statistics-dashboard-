// Coded-field decoders — kept in sync with the Python dicts of the same name in
// Generateur_Fiches_IFN/generate_fiche_simple.py (Fiches dendro repo).

export const EXPOSITION: Record<number, string> = { 1: 'Nord', 2: 'Nord-Est', 3: 'Est', 4: 'Sud-Est', 5: 'Sud', 6: 'Sud-Ouest', 7: 'Ouest', 8: 'Nord-Ouest' };
export const TOPO_POS: Record<number, string> = { 1: 'Plat', 2: 'Dépression', 3: 'Sommet', 4: 'Haut versant', 5: 'Mi-versant', 6: 'Bas-versant' };
export const SUBSTRAT: Record<number, string> = { 1: 'Grès', 2: 'Calcaire', 3: 'Schiste', 4: 'Sable', 5: 'Basalte', 6: 'Granite', 7: 'Quartzite', 8: 'Marne', 9: 'Dolomie', 10: 'Autre' };
export const TYPE_SOL: Record<number, string> = { 1: 'Sols peu évolués', 2: 'Sols peu diff./humifères', 3: 'Sols calcimagnésiques', 4: 'Sols isohumiques', 5: 'Vertisols', 6: 'Sols brunifiés', 7: 'Sols podzoliques', 8: 'Autre' };
