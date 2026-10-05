# LabJack T7 1.0.1

- Refreshed and bundled Engine and Interface SDK snapshots; interface builds no longer need a private neighboring checkout.
- Added SDK hash verification before packaging.
- Rebuilt Windows x64 Release/Debug engine binaries and the interface bundle; interface type checking passed.
- Applied available non-breaking dependency security fixes.

This SDK refresh targets the current DARTWIC 2.0 development host. The engine host
still needs the LabJack LJM driver. No live LabJack hardware was
exercised. The build toolchain still reports eight npm audit findings in the
Vite/esbuild and Tailwind glob dependency chains; resolving them needs a separate
tooling migration. Do not expose a plugin development server to untrusted networks
or build untrusted source.
