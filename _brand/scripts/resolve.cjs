// Resolve optional build deps (sharp, opentype.js) from _brand/node_modules or known sibling installs.
const path = require("path");
const roots = [
  path.join(__dirname, ".."),
  path.join(__dirname, "../../kiorex-platform/apps/mobile"),
  path.join(__dirname, "../../kiorex-platform"),
  "/private/tmp/claude-501/-Users-shall--claude-spares-spare-WluYAN/4b62abbd-15dd-4d07-9114-584bae6ad2ed/scratchpad/gen-logo",
];
module.exports = function (name) {
  for (const r of roots) { try { return require(require.resolve(name, { paths: [r] })); } catch {} }
  throw new Error(`Cannot resolve ${name}; run npm i in _brand`);
};
module.exports.JOST = path.join(__dirname, "../../kiorex-platform/apps/mobile/node_modules/@expo-google-fonts/jost/500Medium/Jost_500Medium.ttf");
