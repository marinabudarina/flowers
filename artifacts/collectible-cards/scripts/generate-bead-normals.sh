#!/usr/bin/env bash
# Build-time tool only. The app serves the resulting PNG, not Rust/WASM.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git clone --quiet https://github.com/Hugo-Dz/spritefusion-sprite-normals.git "$work/generator"
git -C "$work/generator" checkout --quiet --detach d14b06726cabab09c68a403ce2e684a52efbfe4c
for artwork in google-beaded-floral argon-beaded-four; do
magick "$root/public/$artwork.webp" \
  -alpha on -channel A -fx 'max(r,max(g,b))' +channel "$work/beads.png"
CARGO_TARGET_DIR="${TMPDIR:-/tmp}/spritefusion-sprite-normals-target" \
  cargo run --release --locked --manifest-path "$work/generator/Cargo.toml" -- \
  "$work/beads.png" -o "$root/public/$artwork.normals.png" \
  --normal-strength 1.5 --detail-strength 3 --detail-scale 0.6 \
  --shape-strength 0.8 --shape-radius 3 --force
done
