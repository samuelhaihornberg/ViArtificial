// BLM SuperBots : serveur HTTP sans dépendance (Node 18 ou plus). Lancer : node server.js
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chargerFamille } from "./src/coff.js";
import { Famille, Llama, ErreurRequete } from "./src/famille.js";
import { limiteDevice, balancier, lucidite, juridiction, classer } from "./src/regles.js";
import { cycleGolem, verifierOrdre, typageBTB, decouperMatrices, rencontre, recyclerBloc, sth, transfusion, naissance, ETATS } from "./src/moteurs.js";

const RACINE = dirname(fileURLToPath(import.meta.url));

// Lecture du fichier .env (sans dépendance) : CLE=valeur, une par ligne.
if (existsSync(join(RACINE, ".env"))) {
  for (const l of readFileSync(join(RACINE, ".env"), "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function creerServeur({ famille, llama = null, forcerDemo = false }) {
  let etatLlama = { ok: false, raison: forcerDemo ? "Mode démo forcé (BLM_MODE=demo)" : "Pas encore vérifié" };
  const verifierLlama = async () => {
    if (forcerDemo || !llama) { famille.llm = null; return; }
    etatLlama = await llama.sante(); famille.llm = etatLlama.ok ? llama : null;
  };
  const naissances = [];
  const page = join(RACINE, "public", "index.html");

  const envoyer = (res, code, corps, type = "application/json; charset=utf-8") => {
    res.writeHead(code, { "Content-Type": type, "Access-Control-Allow-Origin": process.env.CORS_ORIGINE || "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" });
    res.end(type.startsWith("application/json") ? JSON.stringify(corps) : corps);
  };
  const lire = async (req, max = 64 * 1024) => {
    let s = ""; for await (const c of req) { s += c; if (s.length > max) throw new ErreurRequete(`Requête trop grosse (${Math.round(max / 1024)} Ko maximum).`); }
    try { return s ? JSON.parse(s) : {}; } catch { throw new ErreurRequete("Le corps de la requête n'est pas du JSON valide."); }
  };
  const bot = (id) => { const b = famille.parId[id]; if (!b) throw new ErreurRequete(`Bot inconnu : ${id}`); return b; };

  const serveur = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://local"), ch = url.pathname, get = req.method === "GET", post = req.method === "POST";
    try {
      if (req.method === "OPTIONS") return envoyer(res, 204, {});
      if (get && (ch === "/" || ch === "/index.html")) return existsSync(page) ? envoyer(res, 200, readFileSync(page, "utf8"), "text/html; charset=utf-8") : envoyer(res, 404, { erreur: "public/index.html introuvable" });

      /* Famille et bibliothèque */
      if (get && ch === "/api/sante") { await verifierLlama(); return envoyer(res, 200, { ok: true, moteur: famille.llm ? "llama" : "demo", llama: { url: llama?.url, modele: llama?.modele, ...etatLlama }, erreursCOFF: famille.erreursCOFF || [] }); }
      if (get && ch === "/api/bots") return envoyer(res, 200, famille.bots.map((b) => ({ id: b.id, nom: b.nom, famille: b.famille, couleur: b.couleur, classe: b.classe, role: b.role, voix: b.voix, reglePropre: b.reglePropre, modes: b.modes, capacites: b.capacites.length, gadgets: b.gadgets.length, jetons: famille.banque.jetons[b.id] })));
      const mb = ch.match(/^\/api\/bots\/([\w-]+)$/);
      if (get && mb) return envoyer(res, 200, { ...bot(mb[1]), jetons: famille.banque.jetons[mb[1]] });
      if (get && ch === "/api/recherche") return envoyer(res, 200, famille.biblio.chercher(url.searchParams.get("q") || "", { bot: url.searchParams.get("bot") || null, k: Math.min(50, +url.searchParams.get("k") || 10) }).map((r) => ({ score: +r.score.toFixed(2), bot: r.fiche.bot, type: r.fiche.type, texte: r.fiche.texte })));
      if (get && ch === "/api/stats") return envoyer(res, 200, famille.stats());
      if (get && ch === "/api/jetons") return envoyer(res, 200, { jetons: famille.banque.jetons, total: famille.banque.total() });
      if (post && ch === "/api/jetons/reset") { famille.banque.reset(); return envoyer(res, 200, { jetons: famille.banque.jetons, total: famille.banque.total() }); }
      if (post && ch === "/api/demander") return envoyer(res, 200, await famille.demander(await lire(req)));

      /* Golem Motor : cycle 4.5D sur une image RGBA (base64), 256 × 256 au plus */
      if (post && ch === "/api/golem/cycle") {
        const { largeur: w, hauteur: h, pixels, etapes, force } = await lire(req, 1.5 * 1024 * 1024);
        if (!(w > 0 && h > 0 && w * h <= 65536)) throw new ErreurRequete("Image de 256 × 256 pixels au plus.");
        const r = cycleGolem(Buffer.from(String(pixels || ""), "base64"), w, h, { etapes, force });
        return envoyer(res, 200, { largeur: w, hauteur: h, pixels: Buffer.from(r.pixels).toString("base64"), journal: r.journal, vixel: r.vixel });
      }
      if (post && ch === "/api/golem/ordre") return envoyer(res, 200, verifierOrdre((await lire(req)).etapes));

      /* B.T.B : typage des unités */
      if (post && ch === "/api/btb/typage") { const { equation, unites } = await lire(req); return envoyer(res, 200, typageBTB(equation, unites)); }

      /* Matrixia : matrices et maternes */
      if (post && ch === "/api/matrixia/decouper") { const { code, lignesParEcran } = await lire(req, 512 * 1024); return envoyer(res, 200, decouperMatrices(code, lignesParEcran)); }

      /* CyberSam : recyclage, états, STH */
      if (post && ch === "/api/cybersam/recycler") { const { original, copie } = await lire(req, 512 * 1024); return envoyer(res, 200, recyclerBloc(original ?? "", copie ?? "")); }
      if (post && ch === "/api/cybersam/etat") { const { etat, perception } = await lire(req); return envoyer(res, 200, rencontre(etat, Number(perception))); }
      if (get && ch === "/api/cybersam/etats") return envoyer(res, 200, ETATS);
      if (post && ch === "/api/cybersam/sth") return envoyer(res, 200, sth(limiteDevice((await lire(req)).device)));

      /* Balancier, lucidité, juridiction */
      if (post && ch === "/api/balancier") { const { texte } = await lire(req); return envoyer(res, 200, balancier(texte || "", famille.parId.justicia?.limiteBalancier ?? -0.5)); }
      if (post && ch === "/api/lucidite") { const { question = "", reponse = "" } = await lire(req); const b = balancier(reponse); return envoyer(res, 200, { balance: b, ...lucidite({ question, reponse, classe: classer(question), balance: b, fichesUtilisees: famille.biblio.chercher(reponse, { k: 5 }).length }) }); }
      if (post && ch === "/api/justicia/visa") { const { texte } = await lire(req); return envoyer(res, 200, juridiction(texte || "", famille.parId.justicia)); }

      /* Transfusionneur et Producteur */
      if (post && ch === "/api/transfusion") { const { bots = [] } = await lire(req); return envoyer(res, 200, transfusion(bots.map(bot))); }
      if (post && ch === "/api/producteur/naissance") {
        const { parentA, parentB, device } = await lire(req);
        const r = naissance(bot(parentA), bot(parentB), { device: limiteDevice(device), dejaNes: naissances.length, nomsExistants: [...famille.bots, ...naissances].map((b) => b.nom) });
        if (r.enfant) naissances.push(r.enfant);
        return envoyer(res, 200, r.enfant ? { ...r, enfant: { id: r.enfant.id, nom: r.enfant.nom, role: r.enfant.role, mots: r.enfant.mots, parents: r.enfant.parents } } : r);
      }
      if (get && ch === "/api/producteur/arbre") return envoyer(res, 200, naissances.map((e) => ({ nom: e.nom, parents: e.parents })));

      return envoyer(res, 404, { erreur: `Route inconnue : ${req.method} ${ch}` });
    } catch (e) {
      if (e instanceof ErreurRequete) return envoyer(res, 400, { erreur: e.message });
      console.error(e); return envoyer(res, 500, { erreur: "Erreur interne du serveur." });
    }
  });
  serveur.verifierLlama = verifierLlama;
  const t = setInterval(verifierLlama, 60000); t.unref();
  serveur.on("close", () => clearInterval(t));
  return serveur;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { bots, erreurs } = chargerFamille(join(RACINE, "bots"));
  const famille = new Famille({ bots, jetons: join(RACINE, "jetons.json") });
  famille.erreursCOFF = erreurs;
  const llama = new Llama();
  const serveur = creerServeur({ famille, llama, forcerDemo: process.env.BLM_MODE === "demo" });
  await serveur.verifierLlama();
  const port = Number(process.env.PORT || 8787);
  serveur.listen(port, () => {
    const s = famille.stats();
    console.log(`BLM SuperBots prêt : http://localhost:${port}`);
    console.log(`${s.bots} bots, ${s.fiches} fiches BLM, ${s.regles} règles.`);
    console.log(famille.llm ? `LLM : ${llama.modele} via Ollama` : "LLM : aucun, mode démo (lance Ollama puis « ollama pull " + llama.modele + " »).");
    if (erreurs.length) console.warn("Avertissements COFF :", erreurs);
  });
}
