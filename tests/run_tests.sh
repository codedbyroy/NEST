#!/usr/bin/env bash
# Builds and runs the host unit tests with strict warnings and sanitizers.
set -euo pipefail
cd "$(dirname "$0")/.."
CORE=firmware/nest_node/src/core
mkdir -p build
g++ -std=c++17 -O1 -g -Wall -Wextra -Werror -fsanitize=address,undefined -fno-omit-frame-pointer \
  -o build/test_core tests/test_core.cpp $CORE/pn_core.cpp $CORE/pn_node.cpp $CORE/pn_env_model.cpp
./build/test_core
