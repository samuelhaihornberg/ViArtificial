// Parseur COFF : lit les blocs <co ...> ... </co> des fichiers bots/*.coff.
// Une règle s'écrit : <code> <opérateur> <clé>: <valeur>   ex. « k1 🧠 capacité: Nom | objet, objet »
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function parseCOFF(source, fichier = "") {
  const texte = source.replace(/<!--[\s\S]*?-->/g, "");
  const bots = [], erreurs = [];
  const re = /<co\b([^>]*)>([\s\S]*?)<\/co>/g;
  let m;
  while ((m = re.exec(texte))) {
    const at = {};
    m[1].replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { at[k] = v; });
    if (!at.bot) { erreurs.push(`${fichier} : bloc <co> sans attribut bot`); continue; }
    const regles = [];
    for (const ligne of m[2].split("\n")) {
      const t = ligne.trim();
      if (!t) continue;
      const r = t.match(/^([a-z]\d+)\s+(\S+)\s+([^:]+?):\s*(.*)$/u);
      if (r) regles.push({ code: r[1], op: r[2], cle: norm(r[3]), valeur: r[4].trim() });
      else erreurs.push(`${fichier} (${at.bot}) : ligne ignorée « ${t.slice(0, 60)} »`);
    }
    bots.push(construireBot(at, regles));
  }
  return { bots, erreurs };
}

function construireBot(at, regles) {
  const un = (c) => (regles.find((r) => r.cle === c) || {}).valeur || "";
  const tous = (c) => regles.filter((r) => r.cle === c).map((r) => r.valeur.split("|").map((x) => x.trim()));
  const liste = (s, sep) => (s || "").split(sep).map((x) => x.trim()).filter(Boolean);
  return {
    id: at.bot, nom: at.nom || at.bot, famille: at.famille || "", couleur: at.couleur || "#666666", classe: at.classe || "arriere",
    role: un("role"), temperament: un("temperament"), voix: un("voix"), reglePropre: un("regle propre"),
    mots: liste(un("mots"), ",").map(norm),
    echelle: Object.fromEntries(liste(un("echelle"), "|").map((x) => x.split("=").map((s) => s.trim()))),
    capacites: tous("capacite").map(([nom, objets]) => ({ nom, objets: liste(objets, ",") })),
    gadgets: tous("gadget").map(([nom, domaine, fonctions]) => ({ nom, domaine, fonctions: liste(fonctions, ";") })),
    pourContre: tous("pour-contre").map(([capacite, nom, pour, contre]) => ({ capacite, nom, pour, contre })),
    modes: tous("mode").map(([id, consigne]) => ({ id, consigne })),
    droits: tous("droit").map(([nom, textes, mots]) => ({ nom, textes, mots: liste(mots, ",").map(norm) })),
    refus: liste(un("refus"), ",").map(norm),
    limiteBalancier: un("limite balancier") ? Number(un("limite balancier")) : null,
  };
}

export function chargerFamille(dossier) {
  const bots = [], erreurs = [];
  for (const f of readdirSync(dossier).filter((f) => f.endsWith(".coff")).sort()) {
    const r = parseCOFF(readFileSync(join(dossier, f), "utf8"), f);
    bots.push(...r.bots);
    erreurs.push(...r.erreurs);
  }
  return { bots, erreurs };
}
