#!/bin/sh
# Starter serveren som brukeren «node», også når lagringsvolumet er montert som root
# (Railway og andre plattformer gjør det, og en bind-mount fra verten kan ha en annen eier).
set -e
DATA="${DATA_DIR:-/data}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA"
  # chown bare når det trengs, så oppstarten er rask også med mange filer.
  if [ "$(stat -c %U "$DATA")" != "node" ]; then
    chown -R node:node "$DATA"
  fi
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
