// Shared design system entry: CSS layers and helpers. Per-document styling never lives in build.mjs or in a document.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export const LAYERS = ['base.css', 'components.css', 'diagrams.css'];
export function designCss() { return LAYERS.map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(here, f), 'utf8')).join('\n'); }
export function chromeJs() { return fs.readFileSync(path.join(here, 'chrome.js'), 'utf8'); }
export { renderDiagram, diagramNames, hasDiagram } from './diagrams.mjs';
