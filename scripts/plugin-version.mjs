import {
  packageJsonPath,
  pluginManifestPath,
  readJson,
  sortVersionManifestEntries,
  validatePluginManifest,
  versionsManifestPath,
  writeJson,
} from "./plugin-utils.mjs";

function shouldValidateOnly(argv) {
  return argv.includes("--validate");
}

async function validateOnly() {
  const packageJson = await readJson(packageJsonPath);
  const pluginManifest = await readJson(pluginManifestPath);

  if (!packageJson || typeof packageJson !== "object") {
    throw new Error("package.json must contain an object.");
  }

  validatePluginManifest(pluginManifest);

  const packageVersion = String(packageJson.version ?? "").trim();
  if (!packageVersion) {
    throw new Error("package.json version is required.");
  }
}

async function syncPluginVersion() {
  const packageJson = await readJson(packageJsonPath);
  const pluginManifest = await readJson(pluginManifestPath);
  const versionsManifest = await readJson(versionsManifestPath, {});

  if (!packageJson || typeof packageJson !== "object") {
    throw new Error("package.json must contain an object.");
  }

  if (!versionsManifest || typeof versionsManifest !== "object" || Array.isArray(versionsManifest)) {
    throw new Error("versions.json must contain an object.");
  }

  validatePluginManifest(pluginManifest, { requireVersion: false });

  const packageVersion = String(packageJson.version ?? "").trim();
  if (!packageVersion) {
    throw new Error("package.json version is required.");
  }

  pluginManifest.version = packageVersion;
  versionsManifest[packageVersion] = {
    minEngineVersion: String(pluginManifest.minEngineVersion ?? "").trim(),
    minInterfaceVersion: String(pluginManifest.minInterfaceVersion ?? "").trim(),
  };

  await writeJson(pluginManifestPath, pluginManifest);
  await writeJson(versionsManifestPath, sortVersionManifestEntries(versionsManifest));

  process.stdout.write(`Synchronized plugin.json and versions.json for version ${packageVersion}.\n`);
}

if (shouldValidateOnly(process.argv.slice(2))) {
  await validateOnly();
} else {
  await syncPluginVersion();
}
