#!/usr/bin/env bash
set -euo pipefail

NAME="weave-imbalance-lock"
PORT=3000

cd "$(dirname "$0")"

echo "Building image: $NAME"
docker build -t "$NAME" .

if docker ps -a --format '{{.Names}}' | grep -Fxq "$NAME"; then
  echo "Removing existing container: $NAME"
  docker rm -f "$NAME" >/dev/null
fi

# Detect the host's LAN IP so the QR code / printed URLs are reachable from
# players' phones. Override with HOST_IP=... ./run.sh if detection picks wrong.
LAN_IP="$(
  ipconfig getifaddr en0 2>/dev/null \
    || ipconfig getifaddr en1 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || echo localhost
)"
HOST_IP="${HOST_IP:-$LAN_IP}"

echo "Starting container: $NAME (port $PORT, host IP $HOST_IP)"
docker run -d \
  --name "$NAME" \
  -p "$PORT:3000" \
  -e "HOST_IP=$HOST_IP" \
  -v "$PWD/config.json:/app/config.json:ro" \
  --restart unless-stopped \
  "$NAME" >/dev/null

cat <<EOF

Weave Imbalance Lock is running.

  DM Console:  http://${HOST_IP}:${PORT}/console
  Player URL:  http://${HOST_IP}:${PORT}/play

Logs:  docker logs -f ${NAME}
Stop:  docker rm -f ${NAME}
EOF
