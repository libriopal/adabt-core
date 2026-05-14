#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# build.sh — Emscripten build script for the DSP WASM kernel.
#
# Usage:
#   ./build.sh           # Default build (Tier 0 safe)
#   ./build.sh --tier 2  # Tier 2+ optimizations (SIMD, larger memory)
#   ./build.sh --debug   # Debug build with assertions
#
# Requirements:
#   - Emscripten SDK (emcc) in PATH
#   - Run from this directory: apps/frontend/src/dsp/wasm/
#
# Output:
#   dsp-kernel.wasm  — The compiled WASM module
#   dsp-kernel.js    — Emscripten JS glue (optional, for standalone testing)
#
# Tier 0 constraints:
#   - INITIAL_MEMORY=256KB, MAXIMUM_MEMORY=1MB
#   - No SIMD (Android Tier 0 may lack it)
#   - No dynamic memory growth (fixed ceiling)
#   - Shared memory enabled (SAB requirement)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Defaults (Tier 0 safe) ──────────────────────────────────────────────────

INITIAL_MEMORY=262144    # 256 KB
MAXIMUM_MEMORY=1048576   # 1 MB
OPTIMIZATION="-O3"
SIMD_FLAG=""
DEBUG_FLAGS=""
TIER=0

# ─── Parse arguments ─────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
    case "$1" in
        --tier)
            TIER="$2"
            shift 2
            ;;
        --debug)
            DEBUG_FLAGS="-g -DDEBUG -s ASSERTIONS=1"
            OPTIMIZATION="-O0"
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# ─── Tier-adaptive memory ceilings ───────────────────────────────────────────

case "$TIER" in
    0|1)
        INITIAL_MEMORY=262144    # 256 KB
        MAXIMUM_MEMORY=1048576   # 1 MB
        SIMD_FLAG=""
        ;;
    2)
        INITIAL_MEMORY=524288    # 512 KB
        MAXIMUM_MEMORY=4194304   # 4 MB
        SIMD_FLAG=""
        ;;
    3|4)
        INITIAL_MEMORY=1048576   # 1 MB
        MAXIMUM_MEMORY=16777216  # 16 MB
        SIMD_FLAG="-msimd128"   # Enable WASM SIMD for Tier 3+
        ;;
esac

# ─── Verify emcc is available ─────────────────────────────────────────────────

if ! command -v emcc &> /dev/null; then
    echo "ERROR: emcc (Emscripten) not found in PATH." >&2
    echo "Install: https://emscripten.org/docs/getting_started/downloads.html" >&2
    exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo " DSP Kernel WASM Build — Tier $TIER"
echo "═══════════════════════════════════════════════════════"
echo " Initial memory : $INITIAL_MEMORY bytes"
echo " Maximum memory : $MAXIMUM_MEMORY bytes"
echo " Optimization   : $OPTIMIZATION"
echo " SIMD           : ${SIMD_FLAG:-disabled}"
echo " Debug          : ${DEBUG_FLAGS:-disabled}"
echo "═══════════════════════════════════════════════════════"

# ─── Compile ──────────────────────────────────────────────────────────────────

emcc dsp-kernel.c \
    $OPTIMIZATION \
    $SIMD_FLAG \
    $DEBUG_FLAGS \
    -s WASM=1 \
    -s STANDALONE_WASM=1 \
    -s EXPORTED_FUNCTIONS='[ \
        "_dsp_kernel_init", \
        "_dsp_kernel_process", \
        "_dsp_kernel_set_freq", \
        "_dsp_kernel_set_gain", \
        "_dsp_kernel_get_overruns", \
        "_dsp_kernel_get_frames_produced", \
        "_dsp_kernel_teardown" \
    ]' \
    -s INITIAL_MEMORY=$INITIAL_MEMORY \
    -s MAXIMUM_MEMORY=$MAXIMUM_MEMORY \
    -s ALLOW_MEMORY_GROWTH=0 \
    -s SHARED_MEMORY=1 \
    -s USE_PTHREADS=0 \
    -s NO_EXIT_RUNTIME=1 \
    -s NO_FILESYSTEM=1 \
    -s MALLOC=none \
    --no-entry \
    -lm \
    -o dsp-kernel.wasm

echo ""
echo "✅ Build complete: dsp-kernel.wasm ($(wc -c < dsp-kernel.wasm) bytes)"
echo "   Tier $TIER — ready for WasmDSPKernel.ts bridge."
