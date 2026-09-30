// Règles communes du BLM v0, bibliothèque, balancier, lucidité et juridiction.
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { norm } from "./coff.js";

export const REGLES = [
  "Perception : un bloc vaut +1 quand sa perception est autorisée, -1 sinon. Le niveau de perception est le niveau de sécurité.",
  "Changement d'état : il naît d'une rencontre de perception, dans les deux sens.",
  "Voisinage par reflet : une case retrouve sa voisine par le nodule de Mirroria, sans tout relire.",
  "Arrêt : le « plus » continue tant qu'il est sur le bon chemin, et s'arrête à la limite d'autorisation (borne de -1 à +1).",
  "Priorité : Sécurité, puis Système et sous-systèmes, puis Usage urgent, puis Arrière-plan. Le recensement des compétences départage les égalités.",
  "Recyclage : copier tant que la perte reste sous 1 % et sous 1 Ko, sinon recoller l'original non dégradé, puis supprimer la donnée dégradée.",
  "Limite du device : batterie et chaleur, telles que le device les fixe.",
];

export const VERBES = ["Analyser", "Concevoir", "Simuler", "Tester", "Optimiser", "Corriger", "Protéger", "Documenter", "Automatiser", "Valider"];

// Les 10 leçons communes à tous les gadgets : qualité, défaut évité, anti-défaut, seconde qualité partielle.
export const LECONS = [
  ["Racine", "remonte aux racines de", "sens perdu ou déformé", "retour au sens de base avant toute conclusion", "étymologie partielle : sûre pour le mot, incertaine pour l'usage"],
  ["Synonymes", "nomme de plusieurs façons", "vocabulaire pauvre et répétitif", "variété de termes équivalents", "équivalence partielle : le synonyme garde l'essentiel, pas toutes les nuances"],
  ["Anti-antonymes", "cerne par son contraire, puis nuance ce contraire", "pensée en noir et blanc", "nuance de l'opposé par l'anti-antonyme", "négation partielle : ce qui n'est pas X n'est pas forcément Y"],
  ["Synthèse", "conclut en une phrase logique sur", "conclusion bâclée ou absente", "thèse, antithèse, anti-antithèse, puis synthèse", "synthèse partielle : garde l'essentiel, perd des détails"],
  ["Changement", "accompagne le changement de", "affliction du changement : blocage devant la transformation", "transition progressive et réversible", "continuité partielle : une part reste, une part se transforme"],
  ["Visualisation", "rend visible", "abstraction invisible et illisible", "forme, couleur et reflet lisibles", "vue partielle : une face à la fois"],
  ["Compréhension", "relie au tout", "compréhension isolée, hors contexte", "relations explicites avec les voisins", "compréhension partielle : assez pour agir, jamais totale"],
  ["Échelle", "suit de l'atome à la cellule, jusqu'au corps massif,", "confusion entre les échelles", "valeur relative selon l'échelle (le 1 de loin, le 1 de près)", "cohérence partielle : les règles changent avec la taille"],
  ["Perception autorisée", "ne perçoit que dans les limites autorisées", "perception sans permission", "perception bornée de -1 à +1 par la sécurité", "vue partielle par sécurité : mieux vaut voir moins que voir sans droit"],
  ["Trace", "garde la trace par reflet de", "oubli, ou trace qui envahit", "mémoire miroir, fantôme si supprimé", "mémoire partielle : la trace résume, elle ne copie pas tout"],
].map(([nom, qualite, defaut, antiDefaut, secondeQualite], i) => ({ num: i + 1, nom, qualite, defaut, antiDefaut, secondeQualite }));

export const CONTEXTES = [
  ["Seul(e)", "autonomie totale", "aucun regard extérieur pour corriger"], ["En équipe", "savoir partagé", "coordination plus lourde"],
  ["Sous pression", "réponse rapide", "erreurs plus probables"], ["Batterie basse", "consommation réduite", "précision dégradée"],
  ["Sur données dégradées", "tolérance au bruit", "résultats incertains"], ["À grande échelle", "large couverture", "coût de calcul élevé"],
  ["En mode fantôme", "discrétion, sans effet de bord", "presque aucune trace exploitable"], ["Avec perception partielle", "respect de la sécurité", "vue incomplète"],
  ["Pendant une fusion du Transfusionneur", "apport des autres bots", "identité diluée"], ["Après le visa de Justicia", "droits et conformité assurés", "délai supplémentaire"],
].map(([nom, plus, moins]) => ({ nom, plus, moins }));

export const CLASSES = [
  { id: "securite", nom: "Sécurité", rang: 1, mots: ["securite", "batterie", "chaleur", "chauffe", "surchauffe", "virus", "piratage", "mot de passe", "danger", "donnee perdue", "arnaque"] },
  { id: "systemes", nom: "Système et sous-systèmes", rang: 2, mots: ["moteur", "code", "serveur", "systeme", "api", "bug", "plante", "gpu", "rendu", "matrice", "fonction", "backend"] },
  { id: "urgence", nom: "Usage urgent", rang: 3, mots: ["urgent", "vite", "demain", "maintenant", "ce soir", "aujourd'hui", "peur", "aide"] },
  { id: "arriere", nom: "Arrière-plan", rang: 4, mots: [] },
];
export const classer = (q) => { const n = norm(q); return CLASSES.find((c) => c.mots.some((w) => n.includes(w))) || CLASSES[3]; };

// Règle 7 : limite du device (batterie en %, chaleur en °C).
export function limiteDevice(d = {}) {
  const batterie = Number.isFinite(d.batterie) ? d.batterie : 100, chaleur = Number.isFinite(d.chaleur) ? d.chaleur : 30;
  const critique = batterie < 15 || chaleur > 45, reduit = !critique && (batterie < 30 || chaleur > 40);
  return { batterie, chaleur, etat: critique ? "critique" : reduit ? "reduit" : "normal",
    maxBots: critique ? 1 : reduit ? 2 : 4, maxJetonsLLM: critique ? 160 : reduit ? 320 : 700,
    maxNaissances: critique ? 0 : reduit ? 2 : 5, contexte: critique || reduit ? "Batterie basse" : null };
}

// Règle 6 : recyclage de CyberSam.
export function perte(original, copie) {
  const a = Buffer.from(String(original)), b = Buffer.from(String(copie));
  let diff = Math.abs(a.length - b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) diff++;
  const n = Math.max(a.length, b.length);
  return { octets: diff, ratio: n ? diff / n : 0 };
}
export function recyclage(original, copie) {
  const p = perte(original, copie);
  const ok = p.ratio < 0.01 && p.octets <= 1024;
  return { ...p, pourcentage: +(p.ratio * 100).toFixed(3), action: ok ? "copier" : "recoller-original" };
}

// Jetons : monnaie interne de priorité.
export class Banque {
  constructor(ids, chemin = null, depart = 100) {
    this.depart = depart; this.chemin = chemin;
    this.jetons = Object.fromEntries(ids.map((id) => [id, depart]));
    if (chemin && existsSync(chemin)) {
      try { const lu = JSON.parse(readFileSync(chemin, "utf8")); for (const id of ids) if (Number.isInteger(lu[id]) && lu[id] >= 0) this.jetons[id] = lu[id]; } catch { /* on garde le départ */ }
    }
  }
  total() { return Object.values(this.jetons).reduce((a, b) => a + b, 0); }
  reset() { for (const id in this.jetons) this.jetons[id] = this.depart; this.sauver(); }
  payer(parlants) {
    const ids = new Set(parlants.map((p) => p.bot.id));
    let caisse = 0;
    for (const p of parlants) { this.jetons[p.bot.id] -= p.mise; caisse += p.mise; }
    const autres = Object.keys(this.jetons).filter((id) => !ids.has(id));
    if (!autres.length) { for (const p of parlants) this.jetons[p.bot.id] += p.mise; return 0; }
    const part = Math.floor(caisse / autres.length); let reste = caisse - part * autres.length;
    for (const id of autres) { this.jetons[id] += part + (reste > 0 ? 1 : 0); if (reste > 0) reste--; }
    this.sauver();
    return caisse;
  }
  sauver() { // sauvegarde contrôlée par la règle de recyclage
    if (!this.chemin) return;
    const contenu = JSON.stringify(this.jetons, null, 1), tmp = this.chemin + ".copie";
    writeFileSync(tmp, contenu);
    if (recyclage(contenu, readFileSync(tmp, "utf8")).action === "copier") renameSync(tmp, this.chemin);
  }
}

export function miser(bot, question, classe, banque, { alea = false, fiches = 0, rng = Math.random } = {}) {
  const n = norm(question);
  const comp = bot.mots.filter((w) => n.includes(w)).length + Math.min(fiches, 3);
  const brut = comp * 4 + (bot.classe === classe.id ? 3 : 0) + 1 + (alea ? Math.floor(rng() * 4) : 0);
  return { bot, comp, mise: Math.min(banque.jetons[bot.id] ?? 0, brut) };
}
export function tirage(offres, k, rng = Math.random) {
  const pool = offres.slice(), out = [];
  while (out.length < k && pool.length) {
    let r = rng() * pool.reduce((s, o) => s + Math.max(o.mise, 0.5), 0), i = 0;
    for (; i < pool.length; i++) { r -= Math.max(pool[i].mise, 0.5); if (r <= 0) break; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  return out.sort((a, b) => b.mise - a.mise);
}
// Égalité : Justicia pose la règle, Théo donne les possibles, Synerbot décide de la fin.
export function arbitrer(ordre, classe) {
  const j = [];
  for (let i = 0; i < ordre.length - 1; i++) {
    const a = ordre[i], b = ordre[i + 1];
    if (a.mise !== b.mise) continue;
    j.push({ qui: "Égalité", texte: `${a.bot.nom} et ${b.bot.nom} misent ${a.mise} jetons.` });
    j.push({ qui: "Justicia", texte: `Règle en vigueur : priorité « ${classe.nom} » (rang ${classe.rang}).` });
    j.push({ qui: "Théo", texte: `Possibles : ${a.bot.nom} d'abord (compétence ${a.comp}) ou ${b.bot.nom} d'abord (compétence ${b.comp}).` });
    const aOk = a.bot.classe === classe.id, bOk = b.bot.classe === classe.id;
    const g = aOk !== bOk ? (aOk ? a : b) : a.comp !== b.comp ? (a.comp > b.comp ? a : b) : (a.bot.nom.localeCompare(b.bot.nom, "fr") <= 0 ? a : b);
    if (g === b) { ordre[i] = b; ordre[i + 1] = a; }
    j.push({ qui: "Synerbot", texte: `${g.bot.nom} parle en premier (recensement des compétences).` });
  }
  return j;
}

// Bibliothèque : compétences (10 verbes × 10 objets × 10 capacités), gadgets × 10 leçons, pour/contre.
const VIDES = new Set("le la les un une des de du d l et ou a au aux en dans sur pour par avec sans ce cet cette ces mon ma mes ton ta tes son sa ses je tu il elle on nous vous ils elles que qui quoi est sont fait faire comment quand quel quelle pas ne plus tres bien mais donc car si se y me te lui leur leurs".split(" "));
export const mots = (t) => norm(t).replace(/['’]/g, " ").split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !VIDES.has(w)).map((w) => (w.length > 3 ? w.replace(/aux$/, "al").replace(/[sx]$/, "") : w));

export class Bibliotheque {
  constructor(bots) {
    this.fiches = [];
    for (const b of bots) {
      for (const c of b.capacites) c.objets.forEach((o, io) => VERBES.forEach((v, iv) =>
        this.fiches.push({ bot: b.id, type: "compétence", numero: iv * 10 + io + 1, capacite: c.nom, texte: `${v} ${o}` })));
      for (const g of b.gadgets) {
        this.fiches.push({ bot: b.id, type: "gadget", gadget: g.nom, texte: `${g.nom} (${g.domaine}) : ${g.fonctions.join(", ")}` });
        for (const l of LECONS) this.fiches.push({ bot: b.id, type: "leçon", gadget: g.nom, lecon: l.num,
          texte: `${g.nom}, ${l.nom} : ${l.qualite} ${g.domaine} ; défaut évité : ${l.defaut} ; anti-défaut : ${l.antiDefaut} ; seconde qualité : ${l.secondeQualite}` });
      }
      for (const p of b.pourContre) this.fiches.push({ bot: b.id, type: "pour-contre", capacite: p.capacite, texte: `${p.nom} : pour, ${p.pour} ; contre, ${p.contre}` });
    }
    this.df = new Map();
    for (const f of this.fiches) { f.termes = new Set(mots(`${f.texte} ${f.capacite || ""}`)); f.cache = false; for (const t of f.termes) this.df.set(t, (this.df.get(t) || 0) + 1); }
    this.N = this.fiches.length;
  }
  // Règle 1 : une fiche cachée (backend, sécurité) vaut -1 sans autorisation.
  perception(f, aut = {}) { return !f.cache || aut.cache ? 1 : -1; }
  chercher(q, { bot = null, k = 6, autorisations = {} } = {}) {
    const termes = [...new Set(mots(q))]; if (!termes.length) return [];
    const res = [];
    for (const f of this.fiches) {
      if ((bot && f.bot !== bot) || this.perception(f, autorisations) < 0) continue;
      let s = 0; for (const t of termes) if (f.termes.has(t)) s += Math.log(1 + this.N / (1 + this.df.get(t)));
      if (s > 0) res.push({ fiche: f, score: s });
    }
    res.sort((a, b) => b.score - a.score || a.fiche.texte.localeCompare(b.fiche.texte));
    const vus = new Map(), out = [];
    for (const r of res) { const c = r.fiche.gadget || r.fiche.capacite; if ((vus.get(c) || 0) >= 2) continue; vus.set(c, (vus.get(c) || 0) + 1); out.push(r); if (out.length >= k) break; }
    return out;
  }
  stats() { const t = {}, b = {}; for (const f of this.fiches) { t[f.type] = (t[f.type] || 0) + 1; b[f.bot] = (b[f.bot] || 0) + 1; } return { total: this.N, parType: t, parBot: b }; }
}

// Balance de la cohérence : échelle continue de -1 à +1, 0 = neutralité (état fantôme).
const POSITIFS = ["qualite", "solution", "securis", "equilibr", "clair", "utile", "precis", "juste", "aide", "protege", "reussi", "fiable", "stable", "simple", "rapide", "bon", "bien"];
const NEGATIFS = { erreur: 1, faux: 1, confus: 8, echelle: 8, repet: 2, "noir et blanc": 3, bacle: 4, bloque: 5, peur: 5, illisible: 6, invisible: 6, isole: 7, danger: 9, "sans permission": 9, perte: 10, oubli: 10, perdu: 10, bug: 1, plante: 5, casse: 5, lent: 5, chauffe: 9, echec: 4, probleme: 7, defaut: 1 };
export function balancier(texte, limite = -0.5) {
  const n = norm(texte), a = (w) => new RegExp(`(^|[^a-z])${w}`).test(n);
  const pos = POSITIFS.filter(a);
  const neg = Object.keys(NEGATIFS).filter(a);
  const score = pos.length + neg.length ? +((pos.length - neg.length) / (pos.length + neg.length)).toFixed(2) : 0;
  const bouclier = [...new Set(neg.map((w) => NEGATIFS[w]))].map((num) => {
    const l = LECONS[num - 1];
    return { defaut: l.defaut, antiDefaut: l.antiDefaut, qualiteTrouvee: l.nom, secondeQualite: l.secondeQualite };
  });
  const tendance = score > 0.3 ? "tend vers +1" : score < -0.3 ? "tend vers -1" : "0 : neutralité pure (abstraite comme l'état fantôme)";
  return { score, tendance, qualites: pos, defauts: neg, bouclierAntiDefaut: bouclier, sousLaLimite: score < limite, limite };
}

// Lucidité : sens des mots (appui sur les fiches), coutume du contexte, équilibre, sécurité avant tout. Note de 0 à 10.
const SALUTS = ["salut", "bonjour", "bonsoir", "coucou", "hello", "shalom"];
export function lucidite({ question, reponse, classe, balance, fichesUtilisees = 0 }) {
  const q = norm(question), r = norm(reponse), d = [];
  const sens = fichesUtilisees >= 2 ? 2 : fichesUtilisees; d.push(`sens des mots appuyé sur ${fichesUtilisees} fiche(s) : ${sens}/2`);
  const salut = SALUTS.some((s) => q.startsWith(s)), coutume = !salut || SALUTS.some((s) => r.includes(s)) ? 2 : 0;
  d.push(`coutume du contexte${salut ? " (salut → salut)" : ""} : ${coutume}/2`);
  const equilibre = balance.score >= 0 ? 2 : balance.score >= -0.5 ? 1 : 0; d.push(`équilibre du balancier (${balance.score}) : ${equilibre}/2`);
  let securite = 4;
  if (classe.id === "securite" && !/(securi|protege|arret|coupe|refroidi|sauvegard|prudence|attention)/.test(r)) securite = 1;
  d.push(`sécurité avant tout : ${securite}/4`);
  const note = sens + coutume + equilibre + securite;
  return { note, evolution: note > 5 ? "évolué" : note === 5 ? "stable" : "résistance ou pas compris", details: d };
}

// Juridiction de Justicia : registre des droits internationaux communs (bots/justicia.coff).
export function juridiction(texte, justicia) {
  const n = norm(texte);
  const refus = (justicia?.refus || []).filter((w) => n.includes(w));
  const droits = (justicia?.droits || []).filter((d) => d.mots.some((w) => n.includes(w))).map((d) => ({ droit: d.nom, textes: d.textes, permission: `permission à vérifier : ${d.nom}` }));
  const statut = refus.length ? "refusé" : droits.length ? "sous réserve" : "accordé";
  return { statut, droits, refus, rappel: "Registre limité aux textes internationaux communs ; un juriste confirme pour un cas réel." };
}
