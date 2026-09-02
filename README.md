# DARTWIC LabJack T7 Plugin

Current DARTWIC 2.0 engine and interface plugin for LabJack T7 devices through the LabJack LJM runtime.

## Features

- Enumerates local USB, Ethernet, and Wi-Fi T7 devices with `LJM_ListAllS`.
- Opens the built-in DARTWIC module-discovery workflow once per device serial number.
- Suggests a configured module, AIN/DIO fixed channels, a stream task, and a digital-write task.
- Supports mixed analog and digital hardware streaming with per-AIN range and negative-channel configuration.
- Supports periodic digital output commands with readback state channels.
- Exposes live connection state, linked tasks/channels, LJM compatibility, and manual discovery from the module and plugin pages.
- Uses the current engine and interface plugin SDK registration model.

## Runtime prerequisite

Install the LabJack LJM Basic driver package on the engine host. The plugin dynamically uses the system `LabJackM.dll`; the module page reports the loaded library and verifies that its runtime version matches the headers used to build the plugin.

## Build

Set `VCPKG_ROOT` to a vcpkg checkout, then run:

```powershell
npm install
npm run typecheck
cmake --preset windows-clang-release
cmake --build --preset build-windows-clang-release --target copy_engine_plugin
npm run build
```

Release outputs are created under:

- `plugin/engine/labjack_t7`
- `plugin/interface/labjack_t7`

## Deploy

Configure `deployment-settings.json`, then run:

```powershell
npm run deploy
```

The checked-in development settings target DARTWIC's primary engine and interface workspaces.

## Task types

- `labjack_t7.stream`: worker task that streams `AINn` or `DIOn` values into fixed RAPID channels.
- `labjack_t7.digital_write`: periodic task that reads fixed RAPID command channels, writes `DIOn`, and publishes `<channel>_state` readback values.

The 1.0.0 upgrade intentionally adopts plugin-qualified DARTWIC 2.0 task IDs. Existing `labjack.stream` and `labjack.digital_write` task files should be migrated to the IDs above.
