// Package the build for a host that wraps the page in its own document and
// serves only common web file types (this is what a Claude Artifact is).
//
//   npm run build && npm run package:artifact      -> dist-artifact/
//
// Two things differ from dist/:
//   - slayer.html is page content only (title, style, markup, scripts): the
//     host supplies <html>/<head>/<body>.
//   - .glb is not a type such a host serves, so each model ships as JSON
//     holding the same bytes in base64. A small shim in the page answers the
//     game's .glb requests from those files. The bytes are decoded in script
//     and never fetched from a data: URL, which a strict CSP refuses -- that
//     refusal is silent, and leaves a title screen that ignores every touch.
//
// preview.html is the same page inside a stand-in document, for checking the
// package locally. It is not for publishing.

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const DIST = 'dist';
const OUT = 'dist-artifact';

const html = readFileSync(`${DIST}/index.html`, 'utf8');
const style = html.match(/<style>[\s\S]*?<\/style>/)?.[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1];
const bundle = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+)"[^>]*><\/script>/);
if (!style || !body || !bundle) throw new Error(`could not take ${DIST}/index.html apart; run "npm run build" first`);

const SHIM = `<script>
  // Models ship as JSON (base64 of the .glb) because this host does not serve
  // .glb. Answer the game's model requests from those, decoded here.
  (() => {
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const model = url.match(/^(.*models\\/\\w+)\\.glb$/);
      if (!model) return real(input, init);
      const { glb } = await (await real(model[1] + '.json')).json();
      const bytes = Uint8Array.from(atob(glb), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: { 'content-type': 'model/gltf-binary' } });
    };
  })();
</script>`;

const page = `<title>Slayer</title>
<meta name="claude:viewport-fit-sides" content="cover">
${style}
${body.replace(bundle[0], '').trim()}
${SHIM}
<script type="module" src="${bundle[1]}"></script>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/models`, { recursive: true });
writeFileSync(`${OUT}/slayer.html`, page);
writeFileSync(`${OUT}/preview.html`,
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${page}</body></html>`);
cpSync(`${DIST}/assets`, `${OUT}/assets`, { recursive: true });
cpSync(`${DIST}/art`, `${OUT}/art`, { recursive: true });
for (const file of readdirSync(`${DIST}/models`)) {
  if (!file.endsWith('.glb')) continue;
  const glb = readFileSync(`${DIST}/models/${file}`).toString('base64');
  writeFileSync(`${OUT}/models/${file.replace(/\.glb$/, '.json')}`, JSON.stringify({ glb }));
}

const files = readdirSync(OUT, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile()).map((e) => `${e.parentPath}/${e.name}`.replace(`${OUT}/`, ''));
console.log(`[artifact] ${OUT}/  page: slayer.html  bundle: ${bundle[1]}`);
console.log(files.filter((f) => !f.endsWith('.html')).map((f) => `  ${f}`).join('\n'));
