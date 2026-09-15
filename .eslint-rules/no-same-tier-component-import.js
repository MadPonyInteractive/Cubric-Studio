const path = require('path');

// Tier -> tiers it may import from (.claude/rules/components.md § 4-Tier hierarchy).
// Blocks import all tiers, so they are not listed.
const ALLOWED = {
  Primitives: [],
  Compounds: ['Primitives'],
  Organisms: ['Primitives', 'Compounds'],
};
const TIERS = ['Primitives', 'Compounds', 'Organisms', 'Blocks'];

// { tier, component } for a file under js/components/<Tier>/, else null. The component is the
// path through the first Mpi* folder, so a grouping folder (Compounds/LandingPages) is not one.
function locate(root, file) {
  const dirs = path.relative(root, file).split(path.sep).slice(0, -1);
  if (!TIERS.includes(dirs[0])) return null;
  const k = dirs.findIndex((d) => d.startsWith('Mpi'));
  return { tier: dirs[0], component: (k < 0 ? dirs : dirs.slice(0, k + 1)).join('/') };
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce the component tier rule: never import a component from the same or a higher tier',
      category: 'Best Practices',
    },
  },
  create(context) {
    const root = path.join(context.cwd, 'js', 'components');
    const from = locate(root, context.filename);
    if (!from || !ALLOWED[from.tier]) {
      return {};
    }

    // Resolve the specifier against the importing file; the raw string of a sibling-relative
    // import (../MpiX/MpiX.js) never names its tier.
    function check(node) {
      const source = node.source && node.source.value;
      if (typeof source !== 'string') return;
      let target;
      if (source.startsWith('.')) target = path.resolve(path.dirname(context.filename), source);
      else if (source.startsWith('/js/')) target = path.join(context.cwd, source);
      else return;

      const to = locate(root, target);
      if (!to || to.component === from.component || ALLOWED[from.tier].includes(to.tier)) return;
      context.report({
        node,
        message: `${from.tier} may not import from ${to.tier} (${to.component}). Tier rule: .claude/rules/components.md.`,
      });
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};
