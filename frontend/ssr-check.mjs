import { build } from "esbuild";
import React from "react";
import { renderToString } from "react-dom/server";
import { writeFileSync } from "fs";
import { pathToFileURL } from "url";

const result = await build({
  entryPoints: ["src/App.jsx"],
  bundle: true,
  format: "esm",
  write: false,
  loader: { ".js": "jsx", ".jsx": "jsx" },
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
});

const code = result.outputFiles[0].text;
const tmp = "ssr-tmp.mjs";
writeFileSync(tmp, code);

try {
  const mod = await import(pathToFileURL(tmp).href);
  const App = mod.default;
  const html = renderToString(React.createElement(App));
  console.log("RENDER OK, length:", html.length);
  console.log(html.slice(0, 300));
} catch (e) {
  console.error("RENDER FAILED:");
  console.error(e);
} finally {
  try { require("fs").unlinkSync(tmp); } catch {}
}
