import { build } from "esbuild";
import { fileURLToPath } from "node:url";

/** Use the same local fonts and CSS for standalone, embed and SVG outputs. */
export async function bundledStyles(name = "styles.css") {
  const file = fileURLToPath(new URL(`../../src/render/${name}`, import.meta.url));
  const result = await build({ entryPoints: [file], bundle: true, write: false, loader: { ".woff2": "dataurl" } });
  return result.outputFiles[0].text;
}
