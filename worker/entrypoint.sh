#!/bin/sh
set -e

mkdir -p /root
mkdir -p "$WORKSPACE_ROOT"
mkdir -p /etc/ssl/certs

for cert in /nix/store/*-nss-cacert-*/etc/ssl/certs/ca-bundle.crt; do
    if [ -f "$cert" ]; then
        ln -sf "$cert" /etc/ssl/certs/ca-certificates.crt
        export SSL_CERT_FILE="$cert"
        export CURL_CA_BUNDLE="$cert"
        export GIT_SSL_CAINFO="$cert"
        export NIX_SSL_CERT_FILE="$cert"
        break
    fi
done

export NIX_REMOTE=daemon
export NIX_CONFIG="experimental-features = nix-command flakes
flake-registry = /tmp/nix-registry.json"
export XDG_CACHE_HOME=/nix-cache

NIX_BIN=$(ls -d /nix/store/*-nix-2.* 2>/dev/null | grep -v '\.drv$' | grep -v '\.patch$' | head -1)
if [ -n "$NIX_BIN" ]; then
    export PATH="${NIX_BIN}/bin:${PATH}"
fi

NIXPKGS="nixpkgs"

BWRAP_PATH=""
RG_PATH=""
EXTRA_PATH=""

if [ -n "$NIX_BIN" ]; then
    BWRAP_PATH="$($NIX_BIN/bin/nix path-info ${NIXPKGS}#bubblewrap 2>/dev/null || true)"
    RG_PATH="$($NIX_BIN/bin/nix path-info ${NIXPKGS}#ripgrep 2>/dev/null || true)"
fi

if [ -n "$NIX_PKGS" ] && [ "$NIX_PKGS" != "[]" ] && [ -n "$NIX_BIN" ]; then
    PKG_LIST=$(echo "$NIX_PKGS" | tr -d '[]"' | tr ',' ' ')
    for pkg in $PKG_LIST; do
        pkg=$(echo "$pkg" | tr -d ' "')
        [ -z "$pkg" ] && continue
        PKG_PATH=$($NIX_BIN/bin/nix path-info "${NIXPKGS}#${pkg}" 2>/dev/null || true)
        if [ -n "$PKG_PATH" ]; then
            EXTRA_PATH="${PKG_PATH}/bin:${EXTRA_PATH}"
        fi
    done
fi

RESOLVED_PATH=""
if [ -n "$BWRAP_PATH" ]; then RESOLVED_PATH="${BWRAP_PATH}/bin:"; fi
if [ -n "$RG_PATH" ]; then RESOLVED_PATH="${RESOLVED_PATH}${RG_PATH}/bin:"; fi
RESOLVED_PATH="${RESOLVED_PATH}${EXTRA_PATH}"
export PATH="${RESOLVED_PATH}${PATH}"

export _BWRAP_BIN=""
if [ -n "$BWRAP_PATH" ] && [ -x "${BWRAP_PATH}/bin/bwrap" ]; then
    export _BWRAP_BIN="${BWRAP_PATH}/bin/bwrap"
fi

exec "$@"
