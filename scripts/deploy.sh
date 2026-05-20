#!/usr/bin/env bash
set -euo pipefail

cd ~/sites/compostmodernism.org
git fetch origin
git checkout main
git pull --ff-only
docker-compose up -d --build
