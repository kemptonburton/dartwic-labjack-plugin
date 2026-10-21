#!/usr/bin/env bash
set -euo pipefail

archive="${RUNNER_TEMP:-/tmp}/labjack-ljm-linux-x64.zip"
directory="${RUNNER_TEMP:-/tmp}/labjack-ljm-linux-x64"
curl --fail --location --silent --show-error \
  https://files.labjack.com/installers/LJM/Linux/x64/release/LabJack-LJM_2025-05-07.zip \
  --output "$archive"
mkdir -p "$directory"
unzip -q "$archive" -d "$directory"
installer="$(find "$directory" -type f -name labjack_ljm_installer.run -print -quit)"
if [[ -z "$installer" ]]; then
  echo "The official LJM archive did not contain labjack_ljm_installer.run." >&2
  exit 1
fi
chmod +x "$installer"
sudo "$installer" -- --without-kipling --no-restart-device-rules
sudo ldconfig
ldconfig -p | grep -q 'libLabJackM\.so'
