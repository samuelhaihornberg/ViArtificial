// Orchestrateur : Llama (via Ollama) écrit, le BLM de la famille SuperBots l'équipe.
import { norm } from "./coff.js";
import { REGLES, classer, limiteDevice, Banque, Bibliotheque, miser, tirage, arbitrer, balancier, lucidite, juridiction } from "./regles.js";
import { transfusion, sth } from "./moteurs.js";

export class ErreurRequete extends Error {}

export class Llama {
  constructor({ url = process.env.OLLAMA_URL || "http://localhost:11434", modele = process.env.OLLAMA_MODELE || "llama3.1:8b" } = {}) {
    this.url = url.replace(/\/$/, ""); this.modele = modele;
  }
  async sante() {
    try {
      const r = await fetch(`${this.url}/api/tags`, { signal: AbortSignal.timeout(2500) });
      const noms = ((await r.json()).models || []).map((m) => m.name);
      const ok = noms.includes(this.modele) || noms.includes(`${this.modele}:latest`);
      return { ok, modeles: noms, raison: ok ? null : `Modèle absent : lance « ollama pull ${this.modele} »` };
    } catch (e) { return { ok: false, raison: `Ollama injoignable à ${this.url}` }; }
  }
  async discuter(systeme, message, maxJetons = 700) {
    const r = await fetch(`${this.url}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(180000),
      body: JSON.stringify({ model: this.modele, stream: false, options: { num_predict: maxJetons, temperature: 0.6 },
        messages: [{ role: "system", content: systeme }, { role: "user", content: message }] }),
    });
    if (!r.ok) throw new Error(`Ollama a répondu ${r.status}`);
    return ((await r.json()).message?.content || "").trim();
  }
}

export class Famille {
  constructor({ bots, jetons = null, llm = null, rng = Math.random }) {
    this.bots = bots;
    this.parId = Object.fromEntries(bots.map((b) => [b.id, b]));
    this.repondants = bots.filter((b) => b.famille !== "Synthèse" && b.famille !== "Descendant");
    this.biblio = new Bibliotheque(bots);
    this.banque = new Banque(bots.map((b) => b.id), jetons);
    this.llm = llm; this.rng = rng;
  }

  prompt(bot, { classe, fiches = [], device, theo = {} }) {
    const l = [`Tu es ${bot.nom}, SuperBot de la famille (${bot.famille}). Réponds en français.`,
      `Rôle : ${bot.role}`, `Tempérament : ${bot.temperament}`, `Ta règle propre : ${bot.reglePropre}`, "",
      "Les 7 règles communes du BLM v0 :", ...REGLES.map((r, i) => `${i + 1}. ${r}`), "",
      `Priorité de cette question : ${classe.nom}. Justicia a le plus de pouvoir sur les règles, Théo donne les possibles, Synerbot décide de la fin.`];
    if (bot.id === "theo") {
      const mode = bot.modes.find((m) => m.id === theo.mode);
      l.push(`Religion choisie par l'utilisateur : ${theo.religion || "non précisée (présente les principales traditions)"}.`);
      if (mode) l.push(`Mode actif (${mode.id}) : ${mode.consigne}`);
    }
    if (device.contexte) l.push(`Contexte du device : ${device.contexte} (batterie ${device.batterie} %, chaleur ${device.chaleur} °C). Sois bref.`);
    if (fiches.length) { l.push("", "Fiches de ta bibliothèque BLM liées à la question (appuie-toi dessus sans les réciter) :"); for (const f of fiches) l.push(`- [${f.fiche.type}] ${f.fiche.texte}`); }
    l.push("", `Réponds court et concret, dans ton rôle. Commence par : « ${bot.voix} »`, "Si tu n'es pas sûr d'un fait, dis-le. Ne présente pas une idée de l'utilisateur comme la tienne.");
    return l.join("\n");
  }

  demo(bot, question, fiches) {
    const n = norm(question), vus = bot.mots.filter((w) => n.includes(w));
    return [bot.voix, vus.length ? `Je réagis sur : ${vus.slice(0, 4).join(", ")}.` : "Ce n'est pas mon cœur de métier, je donne mon angle.",
      `Ma règle : ${bot.reglePropre}.`, fiches.length ? `Fiches mobilisées : ${fiches.slice(0, 3).map((f) => f.fiche.texte.split(" ; ")[0]).join(" ; ")}.` : "Aucune fiche de ma bibliothèque ne correspond."].join("\n");
  }

  async generer(systeme, message, device, repli) {
    if (!this.llm) return { texte: repli(), moteur: "demo" };
    try { return { texte: await this.llm.discuter(systeme, message, device.maxJetonsLLM), moteur: "llama" }; }
    catch (e) { return { texte: `${repli()}\n(Llama indisponible : ${e.message})`, moteur: "demo" }; }
  }

  // mode : aleatoire (nb 1 à 4) · choisi (1 à 4 ids) · synerbote (premium) · orl (Théo + Justicia)
  async demander({ question, mode = "aleatoire", bots = [], nb = 2, premium = false, device = {}, theo = {}, autorisations = {} }) {
    question = String(question || "").trim();
    if (!question) throw new ErreurRequete("La question est vide.");
    if (question.length > 4000) throw new ErreurRequete("La question dépasse 4 000 caractères.");
    if (mode === "synerbote" && !premium) throw new ErreurRequete("Le mode Synerboté demande l'abonnement premium.");
    const dev = limiteDevice(device), classe = classer(question);

    let candidats = this.repondants;
    if (mode === "choisi") {
      const ids = [...new Set(bots)].filter((id) => this.parId[id] && this.parId[id].famille !== "Synthèse");
      if (!ids.length) throw new ErreurRequete("Choisis au moins un bot connu.");
      if (ids.length > 4) throw new ErreurRequete("Quatre bots au maximum par réponse.");
      candidats = ids.map((id) => this.parId[id]);
    }
    if (mode === "orl") candidats = [this.parId.theo, this.parId.justicia].filter(Boolean);

    const fichesPar = Object.fromEntries(candidats.map((b) => [b.id, this.biblio.chercher(question, { bot: b.id, k: 5, autorisations })]));
    const offres = candidats.map((b) => miser(b, question, classe, this.banque, { alea: mode === "aleatoire", fiches: fichesPar[b.id].length, rng: this.rng })).sort((a, b) => b.mise - a.mise);
    const plafond = Math.min(dev.maxBots, 4);
    const parlants = mode === "aleatoire" ? tirage(offres, Math.min(Math.max(1, nb | 0), plafond), this.rng) : offres.slice(0, mode === "orl" ? 2 : plafond);
    const journal = arbitrer(parlants, classe);
    if (parlants.length < offres.length && mode === "choisi") journal.push({ qui: "CyberSam", texte: `Limite du device (${dev.etat}) : ${parlants.length} bot(s) sur ${offres.length}.` });
    const caisse = this.banque.payer(parlants);

    const reponses = [];
    for (const p of parlants) {
      const fiches = fichesPar[p.bot.id];
      const { texte, moteur } = await this.generer(this.prompt(p.bot, { classe, fiches, device: dev, theo }), question, dev, () => this.demo(p.bot, question, fiches));
      reponses.push({ bot: p.bot.id, nom: p.bot.nom, couleur: p.bot.couleur, mise: p.mise, competence: p.comp, moteur, texte, fiches: fiches.map((f) => f.fiche.texte) });
    }

    // Synthèse : Superbot + Transfusionneur (synerboté), Mirroria sinon. Justicia reste hors de la fusion.
    let synthese = null;
    if (mode === "synerbote" || reponses.length > 1) {
      const tx = mode === "synerbote" ? transfusion(parlants.map((p) => p.bot), this.rng) : null;
      const nom = tx ? `Superbot · ${tx.nom}` : "Mirroria";
      const fichesSB = this.biblio.chercher(question, { bot: "superbot", k: 3 });
      const sys = [tx ? tx.persona : "Tu es Mirroria, miroir critique de la famille.",
        "Fais une synthèse en quatre temps : thèse, antithèse, anti-antithèse, synthèse. Une ou deux phrases par temps.",
        `Priorité : ${classe.nom}. Garde ce qui est sûr, signale ce qui est incertain.`,
        ...fichesSB.map((f) => `Fiche du Superbot : ${f.fiche.texte}`)].join("\n");
      const avis = reponses.filter((r) => r.bot !== "justicia").map((r) => `${r.nom} : ${r.texte}`).join("\n\n");
      const { texte, moteur } = await this.generer(sys, `Question : ${question}\n\nAvis :\n${avis || "(aucun avis hors Justicia)"}`, dev, () => {
        const [a, b] = reponses;
        return [`Thèse : ${a.nom} ouvre.`, `Antithèse : ${(b || a).nom} conteste ou complète.`, `Anti-antithèse : la règle « ${classe.nom} » tranche le conflit.`, "Synthèse : Synerbot garde la voie la plus sûre et la plus utile."].join("\n");
      });
      synthese = { nom, moteur, texte, transfusion: tx };
    }

    const finale = synthese ? synthese.texte : reponses.map((r) => r.texte).join("\n");
    const justicia = this.parId.justicia;
    const balance = balancier(finale, justicia?.limiteBalancier ?? -0.5);
    const luc = lucidite({ question, reponse: finale, classe, balance, fichesUtilisees: reponses.reduce((s, r) => s + r.fiches.length, 0) });

    // Visa final de Justicia : registre des droits internationaux communs.
    const aRelire = synthese ? synthese.texte : reponses.filter((r) => r.bot !== "justicia").map((r) => r.texte).join(" ");
    const jur = juridiction(`${question} ${aRelire}`, justicia);
    let visaTexte = jur.statut === "accordé" ? "Aucun droit n'est en jeu. Visa : accordé" : jur.statut === "refusé" ? `Demande refusée (${jur.refus.join(", ")}). Visa : refusé` : `Droits en jeu : ${jur.droits.map((d) => `${d.droit} (${d.textes})`).join(" ; ")}. Visa : sous réserve`;
    if (jur.statut === "sous réserve" && this.llm && justicia) {
      const sys = `${this.prompt(justicia, { classe, device: dev })}\n\nTu donnes le visa final. Droits repérés : ${jur.droits.map((d) => `${d.droit} (${d.textes})`).join(" ; ")}. En trois phrases au plus, dis ce qu'il faut vérifier. Termine par « Visa : sous réserve ».`;
      visaTexte = (await this.generer(sys, `Question : ${question}\n\nRéponse à viser :\n${aRelire}`, dev, () => visaTexte)).texte;
    }
    if (balance.sousLaLimite) journal.push({ qui: "Balancier", texte: `Score ${balance.score} sous la limite ${balance.limite} fixée par Justicia : le bouclier anti-défaut s'active.` });

    return { question, mode, priorite: classe, device: dev, sth: sth(dev), journal, caisse, reponses, synthese,
      balance, lucidite: luc, visa: { ...jur, texte: visaTexte }, jetons: { ...this.banque.jetons }, total: this.banque.total() };
  }

  stats() {
    const b = this.biblio.stats(), tri = Object.values(b.parBot).sort((x, y) => y - x);
    let c = 1n; for (const n of tri.slice(0, 4)) c *= BigInt(n);
    return { bots: this.bots.length, fiches: b.total, parType: b.parType, parBot: b.parBot, regles: b.total + REGLES.length + this.bots.length, combinaisons4Bots: c.toString(), puissanceDe10: c.toString().length - 1 };
  }
}
