// Moteurs propres à chaque SuperBot : Golem Motor, B.T.B, Matrixia, CyberSam, Transfusionneur, Producteur.
import { recyclage } from "./regles.js";

/* ───────── GOLEM MOTOR : cycle ① ombre/lumière → ② netteté → ③ couleur → ④ reflet (burst) ───────── */
export const ORDRE_CYCLE = ["ombre", "nettete", "couleur", "reflet"];
export function verifierOrdre(etapes = ORDRE_CYCLE) {
  const demande = etapes.filter((e) => ORDRE_CYCLE.includes(e));
  const ordre = ORDRE_CYCLE.filter((e) => demande.includes(e));
  const change = demande.join() !== ordre.join();
  return { ordre, note: change ? `Règle propre de Golem Motor : ordre remis à ${ordre.join(" → ")}` : "Ordre respecté" };
}
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const c255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function cycleGolem(rgba, w, h, { etapes = ORDRE_CYCLE, force = 0.6 } = {}) {
  if (rgba.length !== w * h * 4) throw new Error("Taille d'image incohérente");
  let px = Float32Array.from(rgba);
  const { ordre, note } = verifierOrdre(etapes);
  const journal = [note], dispersion = { jaune: 0, bleu: 0, rouge: 0 };
  for (const e of ordre) {
    if (e === "ombre") { // ① niveaux : étire les ombres et les lumières (2 % / 98 %), relève un peu les ombres
      const L = []; for (let i = 0; i < px.length; i += 4) L.push(lum(px[i], px[i + 1], px[i + 2]));
      L.sort((a, b) => a - b);
      const lo = L[Math.floor(L.length * 0.02)], hi = L[Math.floor(L.length * 0.98)] || 255, span = Math.max(1, hi - lo), gamma = 1 - 0.15 * force;
      for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) px[i + c] = 255 * Math.pow(Math.min(1, Math.max(0, (px[i + c] - lo) / span)), gamma);
      journal.push(`① ombre/lumière : niveaux ${Math.round(lo)} → ${Math.round(hi)}, gamma ${gamma.toFixed(2)}`);
    }
    if (e === "nettete") { // ② masque flou 3×3
      const src = px.slice(), k = 0.8 * force;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) for (let c = 0; c < 3; c++) {
        let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += src[((y + dy) * w + x + dx) * 4 + c];
        const i = (y * w + x) * 4 + c; px[i] = c255(src[i] + k * (src[i] - s / 9));
      }
      journal.push(`② netteté : masque flou, intensité ${k.toFixed(2)}`);
    }
    if (e === "couleur") { // ③ saturation
      const s = 1 + 0.5 * force;
      for (let i = 0; i < px.length; i += 4) { const l = lum(px[i], px[i + 1], px[i + 2]); for (let c = 0; c < 3; c++) px[i + c] = c255(l + (px[i + c] - l) * s); }
      journal.push(`③ couleur : saturation × ${s.toFixed(2)}`);
    }
    if (e === "reflet") { // ④ burst : les hautes lumières se dispersent en jaune, bleu et rouge (la 4e dimension)
      const src = px.slice(), d = 2, a = 0.25 * force;
      for (let y = d; y < h - d; y++) for (let x = d; x < w - d; x++) {
        const i = (y * w + x) * 4, l = lum(src[i], src[i + 1], src[i + 2]) / 255;
        if (l < 0.75) continue;
        const v = (l - 0.75) * 4 * 255 * a;
        const iR = (y * w + x + d) * 4, iB = (y * w + x - d) * 4, iJ = ((y - d) * w + x) * 4;
        px[iR] = c255(px[iR] + v); px[iB + 2] = c255(px[iB + 2] + v); px[iJ] = c255(px[iJ] + v); px[iJ + 1] = c255(px[iJ + 1] + v);
        dispersion.rouge += v; dispersion.bleu += v; dispersion.jaune += v;
      }
      journal.push("④ reflet : dispersion des hautes lumières (burst)");
    }
  }
  const out = Uint8ClampedArray.from(px);
  return { pixels: out, journal, vixel: vixelMoyen(out, dispersion) };
}
// Vixel : 8 sous-vixels = rouge, vert, bleu, blanc (densité de particules), noir (densité d'ombre), jaune/bleu/rouge du reflet dispersé.
export function vixelMoyen(px, dispersion = { jaune: 0, bleu: 0, rouge: 0 }) {
  const n = px.length / 4; let r = 0, g = 0, b = 0, l = 0;
  for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; l += lum(px[i], px[i + 1], px[i + 2]); }
  const q = (v) => +(v / n / 255).toFixed(3);
  return { rouge: q(r), vert: q(g), bleu: q(b), blanc: q(l), noir: +(1 - q(l)).toFixed(3),
    refletJaune: q(dispersion.jaune), refletBleu: q(dispersion.bleu), refletRouge: q(dispersion.rouge) };
}

/* ───────── B.T.B : typage physique des unités (Vérité Physique) ───────── */
const BASE = ["m", "kg", "s", "A", "K", "mol", "cd"];
const d = (...v) => [...v, 0, 0, 0, 0, 0, 0, 0].slice(0, 7);
const UNITES = {
  m: d(1), km: d(1), cm: d(1), mm: d(1), kg: d(0, 1), g: d(0, 1), t: d(0, 1), s: d(0, 0, 1), min: d(0, 0, 1), h: d(0, 0, 1),
  A: d(0, 0, 0, 1), K: d(0, 0, 0, 0, 1), mol: d(0, 0, 0, 0, 0, 1), cd: d(0, 0, 0, 0, 0, 0, 1), L: d(3),
  N: d(1, 1, -2), J: d(2, 1, -2), W: d(2, 1, -3), Pa: d(-1, 1, -2), Hz: d(0, 0, -1), C: d(0, 0, 1, 1), V: d(2, 1, -3, -1), ohm: d(2, 1, -3, -2),
};
const NOMMEES = { N: "newton", J: "joule", W: "watt", Pa: "pascal", Hz: "hertz", C: "coulomb", V: "volt", ohm: "ohm" };
function tokens(s) { return String(s).match(/\d+(?:[.,]\d+)?(?:e-?\d+)?|[A-Za-zΩ_][\w]*|[-+*/^()·]/g) || []; }
function evaluer(expr, valeurDe) {
  const t = tokens(expr).map((x) => (x === "·" ? "*" : x === "Ω" ? "ohm" : x)); let i = 0;
  const err = (m) => { throw new Error(m); };
  const egal = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-9);
  function expression() { let a = terme(); while (t[i] === "+" || t[i] === "-") { i++; const b = terme(); if (!egal(a, b)) err(`On additionne ${ecrire(a)} et ${ecrire(b)} : dimensions différentes`); } return a; }
  function terme() { let a = facteur(); while (t[i] === "*" || t[i] === "/") { const op = t[i++]; const b = facteur(); a = a.map((v, k) => (op === "*" ? v + b[k] : v - b[k])); } return a; }
  function facteur() { let a = unaire(); if (t[i] === "^") { i++; let signe = 1; if (t[i] === "-") { signe = -1; i++; } const n = parseFloat(String(t[i++]).replace(",", ".")); if (Number.isNaN(n)) err("Exposant invalide"); a = a.map((v) => v * n * signe); } return a; }
  function unaire() { if (t[i] === "-" || t[i] === "+") i++; return primaire(); }
  function primaire() {
    const x = t[i++]; if (x === undefined) err("Expression incomplète");
    if (x === "(") { const a = expression(); if (t[i++] !== ")") err("Parenthèse fermante manquante"); return a; }
    if (x === "sqrt") { if (t[i++] !== "(") err("sqrt demande des parenthèses"); const a = expression(); if (t[i++] !== ")") err("Parenthèse fermante manquante"); return a.map((v) => v / 2); }
    if (/^\d/.test(x)) return d();
    const v = valeurDe(x); if (!v) err(`Symbole inconnu : ${x}`); return v;
  }
  const r = expression(); if (i < t.length) err(`Élément inattendu : ${t[i]}`); return r;
}
export function ecrire(dim) {
  const nom = Object.keys(NOMMEES).find((k) => UNITES[k].every((v, j) => v === dim[j]));
  const brut = dim.map((v, j) => (v ? `${BASE[j]}${v === 1 ? "" : "^" + +v.toFixed(3)}` : "")).filter(Boolean).join("·") || "sans dimension";
  return nom ? `${brut} (${NOMMEES[nom]}, ${nom})` : brut;
}
export function typageBTB(equation, unites = {}) {
  try {
    const dims = {};
    for (const [v, u] of Object.entries(unites)) dims[v] = evaluer(u, (s) => UNITES[s]);
    const valeurDe = (s) => dims[s] || UNITES[s];
    const cotes = String(equation).split("=");
    if (cotes.length !== 2) return { homogene: false, message: "Écris une équation avec un seul signe =" };
    const [g, dr] = cotes.map((c) => evaluer(c, valeurDe));
    const ok = g.every((v, k) => Math.abs(v - dr[k]) < 1e-9);
    return { homogene: ok, gauche: ecrire(g), droite: ecrire(dr),
      message: ok ? "Vérité Physique respectée : les deux côtés ont la même dimension." : "B.T.B refuse : les deux côtés n'ont pas la même dimension, le calcul contredit la physique." };
  } catch (e) { return { homogene: false, message: e.message }; }
}

/* ───────── MATRIXIA : découpe du code en matrices (écrans A0 → Z9) et maternes ───────── */
const LETTRES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const adresse = (i) => `${LETTRES[Math.floor(i / 10)] || "?"}${i % 10}`;
export function decouperMatrices(code, lignesParEcran = 40) {
  const L = String(code).split("\n"), n = Math.max(10, Math.min(200, lignesParEcran | 0 || 40));
  const nb = Math.ceil(L.length / n);
  if (nb > 260) return { erreur: `Code trop long : ${nb} écrans pour 260 matrices (A0 à Z9) au maximum.` };
  const fonctions = [];
  const re = /function\s+([\w$]+)|([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[\w$]+\s*=>)|^\s*(?:async\s+)?([\w$]+)\s*\([^)]*\)\s*\{/;
  L.forEach((ligne, i) => {
    const m = ligne.match(re); if (!m) return;
    const nom = m[1] || m[2] || m[3]; if (["if", "for", "while", "switch", "catch"].includes(nom)) return;
    let prof = 0, vu = false, fin = i;
    for (let j = i; j < L.length; j++) { for (const ch of L[j]) { if (ch === "{") { prof++; vu = true; } if (ch === "}") prof--; } if (vu && prof <= 0) { fin = j; break; } if (!vu && j > i + 1) break; }
    fonctions.push({ nom, debut: i + 1, fin: fin + 1 });
  });
  const matrices = Array.from({ length: nb }, (_, k) => ({ adresse: adresse(k), lignes: [k * n + 1, Math.min(L.length, (k + 1) * n)], maternes: [], liens: [] }));
  for (const f of fonctions) {
    const a = Math.floor((f.debut - 1) / n), b = Math.floor((f.fin - 1) / n);
    const complete = a === b;
    matrices[a].maternes.push({ fonction: f.nom, lignes: [f.debut, f.fin], complete, conseil: complete ? "tient sur un écran : bonne" : `trop longue (${f.fin - f.debut + 1} lignes) : à scinder ou à expliquer sur plusieurs matrices` });
    for (let k = a; k < b; k++) matrices[k].liens.push(`<co lien="${adresse(k)}→${adresse(k + 1)}">${f.nom}</co>`);
  }
  return { lignes: L.length, lignesParEcran: n, matrices, bonnes: fonctions.filter((f) => Math.floor((f.debut - 1) / n) === Math.floor((f.fin - 1) / n)).length, total: fonctions.length };
}

/* ───────── CYBERSAM : états des blocs, recyclage et STH ───────── */
export const ETATS = {
  actif: { polarite: "positive", sens: "le bloc sert et réagit", bot: "Golem Motor" },
  passif: { polarite: "positive", sens: "le bloc est présent et discret", bot: "Matrixia" },
  dormant: { polarite: "négative", sens: "le bloc est en veille, réveillé par la perception", bot: "CyberSam" },
  zombie: { polarite: "négative", sens: "le bloc tourne sans servir", bot: "Matrixia" },
  recyclage: { polarite: "abstraite", sens: "la donnée dégradée est copiée, recollée, supprimée", bot: "CyberSam" },
  ressuscite: { polarite: "abstraite", sens: "le bloc revient avec sa mémoire miroir", bot: "ViA" },
  fantome: { polarite: "abstraite", sens: "trace d'un bloc supprimé, visible par reflet", bot: "Mirroria" },
};
// Règle 2 : un changement d'état naît d'une rencontre de perception (+1 ou -1). Table proposée, à valider par l'auteur.
const TRANSITIONS = {
  "+1": { actif: "actif", passif: "actif", dormant: "actif", zombie: "recyclage", recyclage: "ressuscite", ressuscite: "actif", fantome: "ressuscite" },
  "-1": { actif: "passif", passif: "dormant", dormant: "dormant", zombie: "recyclage", recyclage: "fantome", ressuscite: "passif", fantome: "fantome" },
};
export function rencontre(etat, perception) {
  const p = perception >= 0 ? "+1" : "-1";
  if (!ETATS[etat]) return { erreur: `État inconnu : ${etat}. États : ${Object.keys(ETATS).join(", ")}` };
  const suivant = TRANSITIONS[p][etat];
  return { avant: etat, perception: p, apres: suivant, ...ETATS[suivant] };
}
export function recyclerBloc(original, copie) {
  const r = recyclage(original, copie);
  return r.action === "copier"
    ? { ...r, bloc: "actif", resultat: "La copie est gardée (perte sous 1 % et sous 1 Ko)." }
    : { ...r, bloc: "ressuscite", trace: "fantome", resultat: "Copie trop dégradée : l'original est recollé, la copie dégradée est supprimée et devient un fantôme." };
}
export function sth(device) {
  const action = device.etat === "critique" ? "protéger" : device.etat === "reduit" ? "économiser" : "booster";
  const conseils = { protéger: "Couper les calculs lourds, un seul bot, réponses courtes, laisser refroidir.", économiser: "Deux bots au plus, rendu réduit, pas de burst.", booster: "Tous les moteurs autorisés, dans les sécurités du device." };
  return { action, conseil: conseils[action], plafonds: { bots: device.maxBots, jetonsLLM: device.maxJetonsLLM, naissances: device.maxNaissances } };
}

/* ───────── TRANSFUSIONNEUR : fusion temporaire de la famille (sans Justicia) ───────── */
export function transfusion(bots, rng = Math.random) {
  const sources = bots.filter((b) => b.id !== "justicia");
  const nom = "TX-" + Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rng() * 32)]).join("");
  return { nom, sources: sources.map((b) => b.nom), exclus: bots.some((b) => b.id === "justicia") ? ["Justicia"] : [],
    persona: `Tu es ${nom}, une personnalité temporaire née de la fusion de ${sources.map((b) => b.nom).join(", ")}. Tu mêles leurs rôles (${sources.map((b) => b.role.split(";")[0]).join(" / ")}) et tu parles d'une seule voix. Tu disparais après cette réponse et deviens un fantôme rappelable.` };
}

/* ───────── SUPERBOT PRODUCTEUR : naissances par variation sous 1 % et 1 Ko ───────── */
export function naissance(a, b, { device, dejaNes = 0, nomsExistants = [], rng = Math.random }) {
  if (dejaNes >= device.maxNaissances) return { refus: "CyberSam", raison: `Plafond de naissances atteint (${device.maxNaissances} pour un device ${device.etat}).` };
  const nom = a.nom.slice(0, Math.ceil(a.nom.length / 2)) + b.nom.slice(Math.floor(b.nom.length / 2)).toLowerCase();
  if (nomsExistants.map((x) => x.toLowerCase()).includes(nom.toLowerCase())) return { refus: "Justicia", raison: `Le nom « ${nom} » copie un bot existant.` };
  const genome = JSON.stringify({ mots: a.mots, capacites: a.capacites, gadgets: a.gadgets });
  const total = Buffer.byteLength(genome), mots = [...a.mots], recus = [];
  let octets = 0;
  for (const m of b.mots.filter((x) => !a.mots.includes(x)).sort(() => rng() - 0.5)) {
    const cout = Buffer.byteLength(m) + 3;
    if ((octets + cout) / total >= 0.01 || octets + cout > 1024) break;
    const k = Math.floor(rng() * mots.length); octets += cout; recus.push({ remplace: mots[k], par: m }); mots[k] = m;
  }
  const enfant = { ...a, id: `${a.id}-${b.id}-${Date.now().toString(36)}`, nom, famille: "Descendant", mots,
    role: `descendant de ${a.nom} et ${b.nom} : ${a.role.split(";")[0]}`, parents: [a.id, b.id] };
  return { enfant, variation: { octets, pourcentage: +((octets / total) * 100).toFixed(3), heritage: recus },
    arbre: { parents: [a.nom, b.nom], note: "Mirroria garde les ancêtres en fantômes rappelables." } };
}
