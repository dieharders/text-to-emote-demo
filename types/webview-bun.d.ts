/**
 * Type stub for `webview-bun`, used by `bun run typecheck` INSTEAD of the package's own source
 * (see tsconfig.typecheck.json for the mapping). The package ships raw .ts that fails `strict`,
 * and routing the import through a variable to hide it from tsc would also hide it from Bun's
 * bundler, which only embeds modules it can find by static analysis of a literal specifier.
 *
 * Only the surface this app uses is declared. Widen it if the app starts using more.
 */
declare module "webview-bun" {
  /** Window size hints. 0 = NONE (resizable), 1 = MIN, 2 = MAX, 3 = FIXED. */
  export type SizeHint = 0 | 1 | 2 | 3;

  export interface Size {
    width: number;
    height: number;
    hint: SizeHint;
  }

  export class Webview {
    title: string;
    size: Size;
    navigate(url: string): void;
    /** Blocks on a native event loop until the window is closed. */
    run(): void;
  }
}
