#!/bin/sh
# Run as the deployment operator; Docker handles private certificate file access.
set -eu
umask 077
task_deploy_dir=${EGG_DEPLOY_DIR:-$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)}
cd "$task_deploy_dir"
docker run --rm \
  -v "$task_deploy_dir/infrastructure/https/letsencrypt:/etc/letsencrypt" \
  -v "$task_deploy_dir/infrastructure/https/acme:/var/www/acme" \
  certbot/certbot:v5.8.0 renew --quiet

docker run --rm --entrypoint sh \
  -v "$task_deploy_dir/infrastructure/https/letsencrypt:/certificates:ro" \
  -v "$task_deploy_dir/infrastructure/https/private:/output" \
  certbot/certbot:v5.8.0 -c '
    set -eu
    cp /certificates/live/eggcelerate-dashboard/fullchain.pem /output/server.crt.new
    cp /certificates/live/eggcelerate-dashboard/privkey.pem /output/server.key.new
    chmod 644 /output/server.crt.new
    chmod 600 /output/server.key.new
    mv /output/server.crt.new /output/server.crt
    mv /output/server.key.new /output/server.key
  '
./hardware-compose.sh exec -T dashboard-https nginx -t
./hardware-compose.sh exec -T dashboard-https nginx -s reload
