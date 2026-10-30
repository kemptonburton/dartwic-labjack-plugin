# DARTWIC LabJack T7 Plugin

Current DARTWIC 2.0 engine and interface plugin for LabJack T7 devices through the LabJack LJM runtime.

Engine and Interface SDK snapshots are bundled under `engine/include/sdk` and
`interface/sdk`; no private DARTWIC source checkout is needed to build. Packaging
checks their hashes against `sdk-lock.json`. Use `npm ci` for reproducible installs.

## Features

- Enumerates local USB, Ethernet, and Wi-Fi T7 devices with `LJM_ListAllS`.
- Opens the built-in DARTWIC module-discovery workflow once per device serial number.
- Suggests a configured module, AIN/DIO fixed channels, a stream task, and a digital-write task.
- Supports mixed analog and digital hardware streaming with per-AIN range and negative-channel configuration.
- Supports periodic digital output commands with readback state channels.
- Exposes live connection state and linked tasks/channels on module pages, with LJM compatibility on the plugin page.
- Uses the current engine and interface plugin SDK registration model.

## Discovery settings

Open the plugin's **Discovery & LJM** settings or its **Config Map** sheet in Channel Search to set discovery enablement, scan interval, analog-input suggestions, and AIN/DIO ranges. Both views edit the same workspace settings. Saved discovery changes require an Engine restart; the LJM compatibility status remains alongside the settings map. Existing project overrides must be removed before editing the corresponding workspace setting here.

## Feedback and authority

Stream measurements, digital readbacks, and task diagnostics become observe-only
through `setChannel` on each task start. Publication uses ordinary upserts under
that ownership. Command channels remain writable; completed stop releases the
task's observed channels. Digital writes read `DIO_STATE` back in the same cycle
after any changed outputs are written. Demo mode simulates this feedback.

## Runtime prerequisite

Install the LabJack LJM Basic driver package on the engine host. Windows uses `LabJackM.dll`; Linux uses the system `libLabJackM.so`. The Linux native build links against LJM, so the library and its headers must also be installed on the build host. The package does not bundle or install the vendor driver. The module page reports the loaded library and verifies that its runtime version matches the headers used to build the plugin.

## Build

Set `VCPKG_ROOT` to a vcpkg checkout, then run:

```powershell
npm install
npm run typecheck
cmake --preset windows-clang-release
cmake --build --preset build-windows-clang-release --target copy_engine_plugin
npm run build
```

On Linux, install LJM from [LabJack's Linux x64 installer](https://support.labjack.com/docs/ljm-software-installer-linux-x64), use the `linux-clang-release` and `build-linux-clang-release` CMake presets, or run `npm run package` to build both sides and create `plugin.zip`. The CI-only `npm run ci:setup:linux` command installs a pinned vendor LJM package on the Ubuntu runner. A standalone source checkout uses the same `npm run package` entry point as the release pipeline.

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

The digital-write task prepares its mappings, fixed-channel handles, and reusable
LJM request/readback buffers during configuration. Its periodic body reads the
prepared command handles, performs synchronous LJM calls, then publishes fixed
readback handles. Driver latency and connection recovery remain part of each
tick's elapsed time.

The stream task retains its module and fixed diagnostic handles. It prepares
sample groups before entering the worker read loop, then reuses their capacity
for each LJM read. Stream samples still use the SDK's name-based bulk history
API so their individual timestamps are preserved. Configuration, driver calls,
reconnects, and sample publication can allocate or block; a stream rate setting
alone does not prove a deadline. Repeated connection/stream errors use a
10-second ARGUS firing separation.

The 1.0.0 upgrade intentionally adopts plugin-qualified DARTWIC 2.0 task IDs. Existing `labjack.stream` and `labjack.digital_write` task files should be migrated to the IDs above.

## Discovery setup presentation

Discovery uses the shared SDK resource descriptors: module connection status is listed under the module, and seven stream diagnostic channels are listed under the stream task. Address selections expose channel pickers in an expandable name list. Digital-write state channels follow each chosen command name with `_state`; these required names cannot be changed separately. Review stays compact. The connection monitor is a shared plugin loop rather than a loop created per module. Channel name choices remain in the provisioning draft until Apply.

The connection monitor owns and republishes `{instance}.info.connected` each second after checking the device, with a three-second stale timeout. Task-side failures update internal state; the monitor publishes it through its own channel authority. The shared Interface indicator shows missing or stale observations as unknown.

The specialized module page and connection icons are supplied by the Interface plugin. Deploy both the engine and Interface sides to their respective hosts; deploying only the native binary does not install the UI. Module pages use the shared host runtime overview and connection controls, matching the Modbus plugin while retaining device-specific settings. Reload an already-open Interface after a manual plugin-file deployment to clear cached missing-plugin results.

## Release package contract

Run `npm run package` on each supported native host. It must build both Release and Debug successfully before producing `plugin-win32-x64.zip` on Windows x64 or `plugin-linux-x64.zip` on Linux x64. Windows Debug PDB symbols are required. The ZIP includes `plugin/engine/labjack_t7/`, `plugin/engine-debug/labjack_t7/`, and `plugin/interface/labjack_t7/`; each contains the matching root `plugin.json`, native libraries live in each native tree's `bin/`, and the Interface entry point is `ui/index.js`. Required root configuration and runtime dependencies remain in the package; supporting files ship inside each plugin side's `assets/` directory.

Upload the root `plugin.json` and one or both exact platform ZIPs to the same GitHub release; keep that manifest in the tagged source too. The tag, package, and every manifest must identify the same version. `release-manifest.json` provides generated SHA-256 checksums. Generic `plugin.zip` and separate debug ZIPs are not accepted. The Engine selects its OS and Release/Debug variant; it never falls back to a different OS.

See the [example plugin's full release contract](https://github.com/kemptonburton/dartwic-example-plugin#github-release-contract) for the complete manifest shape and archive tree. Native packaging requires `VCPKG_ROOT`; optionally set `DARTWIC_VCPKG_INSTALLED_DIR` to reuse installed dependencies. Packaging does not deploy, push, or publish.

## Asset ownership

Managed files in this repository's `assets/` ship inside the installed plugin and
are replaced with it. Keep custom shared files in
`workspace/assets/plugins/<plugin-id>/` using the SDK helpers. Project settings
remain project-scoped; local secrets and runtime data belong to Engine instances.
Workspaces contain authored Git-trackable content; installed Engine and Interface
directories contain replaceable software and local state. Plugin installation
does not copy files into workspaces. See `assets/README.md` for the storage rules.

## Stream recording

Stream destinations use `on_value_change` while idle. The worker switches them to `every_value_exclude_autorecord` before submitting its first batch and keeps this mode throughout reconnect attempts. Every accepted sample, including equal values, is selected for recording without periodic cached-value snapshots. After the worker finishes submitting samples, it restores `on_value_change`, allowing ordinary snapshots again.

The worker submits timestamped batches through `upsertChannelValueBulk`. RAPID updates the live channel once with the final sample and records the selected batch samples independently. Sample timestamps are calculated from stream start and scan rate. Use the worker run interval for an exact-stream export; the idle periods can contain baseline snapshots. Device errors and recording queue pressure can still cause missing measurements.
