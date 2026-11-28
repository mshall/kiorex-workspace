// Builds Kiorex_Market_GoLive_Egypt.pdf with the shared guide theme (../shared). Usage: node build-guide.mjs [out.pdf]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDoc } from '../shared/kx-doc.mjs';
import { chapters } from './content.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const quickMap = `<h2 style="margin-top:6mm"><span class="sn">?</span><span>Quick map</span></h2>
<table style="font-size:7.8pt"><thead><tr><th>I want to ...</th><th>Go to</th></tr></thead><tbody>
<tr><td>Know exactly what to prepare</td><td>Chapter 02, Before you start</td></tr>
<tr><td>Record the Egypt gate</td><td>Chapter 03, section 3.4 (super admin account)</td></tr>
<tr><td>Check what patients see, or close Egypt again</td><td>Chapter 03, sections 3.3, 3.5 and 3.7</td></tr>
<tr><td>Know what Kiorly can do</td><td>Chapter 04, Part B</td></tr>
<tr><td>Understand sign-in, roles and plans, or see what was tested</td><td>Chapters 05 and 06</td></tr>
<tr><td>Fix a problem</td><td>Chapter 07, Troubleshooting</td></tr></tbody></table>`;
await buildDoc({
  slug: 'golive', out: process.argv[2] || path.join(HERE, 'Kiorex_Market_GoLive_Egypt.pdf'),
  title: 'How to take a market live (Egypt)', eyebrow: 'OPERATIONS GUIDE',
  subtitle: 'Step by step for the founder acting as Kiorex ops and super admin: record the launch gate for <b>market.eg.live</b>, verify what patients see, roll it back, and how Kiorly sign-in, roles and plans work on kx-test today.',
  meta: [['Kiorex and Kiorly', 'Private, for the founder'], ['28 November 2026', 'Updated for kx-test after the end-to-end pass'], ['Edition 2', 'Contains no secrets']],
  footer: 'Private, for the founder. Contains no secrets. Screenshots from private test stacks.',
  chapters: chapters(), quickMap, keywords: ['Kiorex', 'Kiorly', 'market go-live', 'Egypt', 'launch gate'],
});
