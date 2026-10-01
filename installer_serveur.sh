#!/usr/bin/env bash
# BLM · SuperBots : installation du serveur (Ubuntu ou Debian), en une commande.
# Installe Node, Ollama (Llama) et ton backend.js, puis le lance comme un service qui redémarre tout seul.
# Usage :  curl -fsSL https://raw.githubusercontent.com/samuelhaihornberg/ViArtificial/main/installer_serveur.sh | sudo bash
#   ou   :  sudo bash installer_serveur.sh
# Réglages (facultatifs, en tête de commande) :  MODEL=llama3.2:1b  PAGE=https://samuelhaihornberg.github.io  DRY_RUN=1 (affiche sans rien faire)
# Rien ici ne contient de clé. Ollama n'en demande aucune.
set -euo pipefail

MODEL="${MODEL:-llama3.2:3b}"
PAGE="${PAGE:-https://samuelhaihornberg.github.io}"                       # origine de ta page (sans le chemin /ViArtificial/)
RAW="${RAW:-https://raw.githubusercontent.com/samuelhaihornberg/ViArtificial/main/backend.js}"
DIR="${DIR:-/opt/blm}"
PORT="${PORT:-8787}"
DRY="${DRY_RUN:-0}"

say() { printf '\n==> %s\n' "$*"; }
run() { printf '+ %s\n' "$*"; if [ "$DRY" != "1" ]; then "$@"; fi; }
sh_run() { printf '+ %s\n' "$*"; if [ "$DRY" != "1" ]; then bash -c "$*"; fi; }

if [ "$DRY" != "1" ] && [ "$(id -u)" -ne 0 ]; then echo "Lance ce script avec sudo."; exit 1; fi
if [ "$DRY" != "1" ] && ! command -v apt-get >/dev/null 2>&1; then echo "Ce script est prévu pour Ubuntu ou Debian (apt-get introuvable)."; exit 1; fi

say "1/7 Outils de base"
run apt-get update -y
run apt-get install -y curl ca-certificates

say "2/7 Node (version 18 ou plus)"
need_node=1
if command -v node >/dev/null 2>&1; then
  v="$(node -v | sed 's/^v//; s/\..*//')"; if [ "${v:-0}" -ge 18 ]; then need_node=0; fi
fi
if [ "$need_node" = "1" ]; then
  sh_run "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -"
  run apt-get install -y nodejs
else echo "Node déjà présent : $(node -v)"; fi

say "3/7 Ollama (le moteur de Llama, gratuit)"
if ! command -v ollama >/dev/null 2>&1; then sh_run "curl -fsSL https://ollama.com/install.sh | sh"; else echo "Ollama déjà présent."; fi
run systemctl enable --now ollama
if [ "$DRY" != "1" ]; then
  for i in $(seq 1 30); do curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break; sleep 2; done
  curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || { echo "Ollama ne répond pas sur 127.0.0.1:11434 : regarde « systemctl status ollama »."; exit 1; }
fi

say "4/7 Le modèle $MODEL (plusieurs minutes, quelques Go)"
run ollama pull "$MODEL"

say "5/7 Le backend dans $DIR"
if [ "$DRY" != "1" ] && ! id blm >/dev/null 2>&1; then useradd --system --home "$DIR" --shell /usr/sbin/nologin blm; fi
run mkdir -p "$DIR"
run curl -fsSL "$RAW" -o "$DIR/backend.js"
if [ "$DRY" != "1" ] && [ ! -f "$DIR/.env" ]; then
  cat > "$DIR/.env" <<ENV
# BLM · réglages du serveur public (aucune clé ici)
HOST=127.0.0.1
PORT=$PORT
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=$MODEL
CORS_ORIGIN=$PAGE
ALLOW_CLIENT_CHOICE=0
TRUST_PROXY=1
LLM_DAILY_CAP=300
IP_DAILY_CAP=30
MAX_CONCURRENT=2
ENV
  echo "Fichier $DIR/.env créé."
else echo "Réglages : $DIR/.env gardé tel quel (ou simulation)."; fi
if [ "$DRY" != "1" ]; then chown -R blm:blm "$DIR"; chmod 600 "$DIR/.env"; fi

say "6/7 Le service (redémarre tout seul)"
if [ "$DRY" != "1" ]; then
  cat > /etc/systemd/system/blm.service <<UNIT
[Unit]
Description=BLM SuperBots backend
After=network-online.target ollama.service
Wants=network-online.target

[Service]
User=blm
WorkingDirectory=$DIR
ExecStart=$(command -v node) $DIR/backend.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT
fi
run systemctl daemon-reload
run systemctl enable --now blm
run systemctl restart blm

say "7/7 Vérification"
if [ "$DRY" != "1" ]; then
  sleep 3
  curl -fsS "http://127.0.0.1:$PORT/api/status" | head -c 400 || { echo; echo "Le backend ne répond pas : « journalctl -u blm -n 50 »."; exit 1; }
  echo
fi
cat <<FIN

Le backend tourne sur ce serveur, en local seulement (127.0.0.1:$PORT). Prochaine étape : le rendre joignable en HTTPS
(Tailscale Funnel, par exemple), puis écrire son adresse dans la balise « blm-backend » de index.html.
Voir les journaux : journalctl -u blm -f      Mettre à jour backend.js : relance ce script.
FIN
