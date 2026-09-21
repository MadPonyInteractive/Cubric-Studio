// A server-absolute specifier (`from '/js/utils/dom.js'`) resolves in the renderer only
// because the app serves the repo root as the web root. Node resolves it against the DRIVE
// root and dies with `ERR_MODULE_NOT_FOUND: Cannot find module 'C:\js\utils\dom.js'`, so
// EVERY module graph that reaches such a file is un-requireable from the CJS suite — and the
// failure surfaces in a test that has nothing to do with the file. MPI-877 lost a day to
// `tests/agent-pinned-settings.test.cjs` breaking because an unrelated import chain ended at
// MpiLevelMeter, and routed around it rather than fixing it (MPI-881).
//
// ESLint's core `no-restricted-imports` cannot express this: its `patterns` use gitignore
// semantics, which STRIP the leading slash, so `/**` matches every specifier and `/*` reports
// `../../factory.js`. Hence a rule.

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Import by relative path — a server-absolute specifier is unresolvable to Node',
      category: 'Possible Errors',
    },
    schema: [],
  },
  create(context) {
    function check(node) {
      const source = node.source && node.source.value;
      if (typeof source !== 'string' || !source.startsWith('/')) return;
      context.report({
        node: node.source,
        message: `Server-absolute import '${source}'. It resolves in the renderer but not in Node, so it breaks the CJS tests. Use a relative path.`,
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
