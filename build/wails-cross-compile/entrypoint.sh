#!/bin/bash

if [ $# -lt 1 ]; then
  echo "Usage: $0 <OS> [options]"
  exit 1
fi

OS=$1

shift
OPTS=$@

# lowercase
OS=$(tr '[:upper:]' '[:lower:]' <<<"$OS")

set -e
if [ "$OS" == "windows" ]; then
  export CC=x86_64-w64-mingw32-gcc GOOS=windows
  go clean -cache -modcache
  wails build -skipbindings ${OPTS}
elif [ "$OS" == "linux" ]; then
  go clean -cache -modcache
  wails build ${OPTS}
fi
exit 0