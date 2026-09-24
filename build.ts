/**
 * Build EmoBuff into a single executable (markdown-to-pdf's build.ts, adapted).
 *
 *   bun run build                          this machine's platform
 *   bun run build.ts --target=windows-x64  one platform (cross-compiles)
 *   bun run build:all                      every platform
 *
 * Output goes to dist/: `emobuff-<platform>[.exe]`, plus `EmoBuff.app` (and a zip of it) for
 * macOS and a `.desktop` file for Linux. The binary holds the whole app, UI included. The
 * decision engine's heavy parts (Python, packages, weights) are NOT in it: they download at
 * runtime, on the user's first "Set up".
 */
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pkg from "./package.json";

const TARGETS = [
  { name: "darwin-arm64", target: "bun-darwin-arm64", ext: "" },
  { name: "windows-x64", target: "bun-windows-x64", ext: ".exe" },
  { name: "linux-x64", target: "bun-linux-x64", ext: "" },
  { name: "linux-arm64", target: "bun-linux-arm64", ext: "" },
] as const;

const args = process.argv.slice(2);
const host = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
const requested = args.find((a) => a.startsWith("--target="))?.split("=")[1] ?? host;
const selected = args.includes("--all") ? TARGETS : TARGETS.filter((t) => t.name === requested);

if (selected.length === 0) {
  console.error(`Unknown target "${requested}". Available: ${TARGETS.map((t) => t.name).join(", ")}`);
  process.exit(1);
}

/**
 * The UI's stylesheet is built by the Tailwind CLI, not the bundler, and a missing one does not
 * fail anything: the app just ships unstyled. So check for it.
 */
const css = "src/client/generated.css";
if (!existsSync(css) || statSync(css).size < 1024) {
  console.error(`${css} is missing. Run \`bun run build\` (it builds the CSS first) or \`bun run build:css\`.`);
  process.exit(1);
}

mkdirSync("dist", { recursive: true });

for (const { name, target, ext } of selected) {
  const outfile = `dist/emobuff-${name}${ext}`;
  console.log(`Building ${name}…`);
  const result = await Bun.build({
    // Both entrypoints: the worker is discovered from main.ts's `new Worker("./src/worker.ts")`,
    // but must also be listed or the binary fails to resolve it at launch.
    entrypoints: ["./main.ts", "./src/worker.ts"],
    compile: { outfile, target },
    minify: true,
    sourcemap: "linked",
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`  → ${outfile}`);
  if (name.startsWith("darwin")) makeMacApp(outfile, name);
  if (name.startsWith("linux")) writeDesktopFile(outfile, name);
}
console.log("\nDone.");

/** Wrap the macOS binary in an .app bundle, ad-hoc sign it, and zip it for sharing. */
function makeMacApp(binary: string, name: string) {
  const app = "dist/EmoBuff.app";
  rmSync(app, { recursive: true, force: true });
  mkdirSync(`${app}/Contents/MacOS`, { recursive: true });
  mkdirSync(`${app}/Contents/Resources`, { recursive: true });
  cpSync(binary, `${app}/Contents/MacOS/emobuff`);
  chmodSync(`${app}/Contents/MacOS/emobuff`, 0o755);
  writeFileSync(
    `${app}/Contents/Info.plist`,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>EmoBuff</string>
  <key>CFBundleDisplayName</key><string>EmoBuff</string>
  <key>CFBundleIdentifier</key><string>com.openbrew.emobuff</string>
  <key>CFBundleVersion</key><string>${pkg.version}</string>
  <key>CFBundleShortVersionString</key><string>${pkg.version}</string>
  <key>CFBundleExecutable</key><string>emobuff</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`,
  );

  if (process.platform !== "darwin") {
    console.log(`  → ${app} (unsigned: signing needs macOS)`);
    return;
  }
  // Apple Silicon refuses to run an unsigned binary ("Killed: 9", no dialog), and the compiled
  // binary's inherited signature is invalid, so ad-hoc sign the whole bundle. Clear extended
  // attributes first: codesign rejects "detritus" like Finder info.
  Bun.spawnSync(["xattr", "-cr", app]);
  const sign = Bun.spawnSync(["codesign", "--force", "--sign", "-", app]);
  console.log(sign.exitCode === 0 ? `  → ${app} (ad-hoc signed)` : `  ⚠ codesign failed: ${sign.stderr.toString()}`);

  const zip = `dist/EmoBuff-${name}.zip`;
  rmSync(zip, { force: true });
  Bun.spawnSync(["ditto", "-c", "-k", "--keepParent", app, zip]);
  console.log(`  → ${zip}`);
}

/** A launcher entry for Linux desktops (point Exec at wherever the binary is installed). */
function writeDesktopFile(binary: string, name: string) {
  const file = `dist/emobuff-${name}.desktop`;
  writeFileSync(
    file,
    `[Desktop Entry]
Type=Application
Name=EmoBuff
Comment=Pixel-art character studio
Exec=${resolve(binary)}
Terminal=false
Categories=Graphics;Education;
`,
  );
  console.log(`  → ${file}`);
}
