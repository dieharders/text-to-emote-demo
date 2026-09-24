import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const APP_NAME = "EmoBuff";

/**
 * The one folder this app writes to: engine installs, model weights, logs.
 *
 * Per-user and outside the app bundle on purpose. Writing next to the executable would break
 * the macOS code-signing seal, and a per-user folder needs no admin rights on any platform.
 * Uninstalling an engine is deleting `engines/<id>/` under it.
 *
 * `EB_DATA_ROOT` overrides it, so a source run (see .env.example) never touches the data of an
 * installed copy.
 */
export function dataDir(): string {
  const override = process.env.EB_DATA_ROOT?.trim();
  if (override) return resolve(override);

  const home = homedir();
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), APP_NAME);
  }
  if (process.platform === "darwin") return join(home, "Library", "Application Support", APP_NAME);
  return join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), APP_NAME);
}

/** Where one engine keeps everything it downloads and writes. */
export const engineDir = (engineId: string) => join(dataDir(), "engines", engineId);
