#!/usr/bin/env bash
# Wrap any command so it runs under the Node version pinned in .nvmrc.
#
# Lefthook git hooks run in subshells that don't auto-source nvm; without
# this, `bun --filter <pkg> test` chains hit a build step that wants
# Node >=22.12.0 (Astro 6 / Qwik 2 acceptance test) and fails on whatever
# system Node is on PATH. Sourcing nvm + `nvm use` once here keeps both
# test-astro and test-qwik using the project-pinned Node.
set -e

# shellcheck disable=SC1091
source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
nvm use >/dev/null

exec "$@"
