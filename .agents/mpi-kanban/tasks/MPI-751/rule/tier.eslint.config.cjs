// Runs ONLY the parked MPI-751 tier rule, so the shared tree keeps the HEAD rule.
const rule = require('C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-751/rule/no-same-tier-component-import.js');

module.exports = [
  {
    basePath: 'C:/AI/Mpi/Cubric-Vision',
    ignores: ['js/components/factory.js', 'js/vendor/**'],
  },
  {
    basePath: 'C:/AI/Mpi/Cubric-Vision',
    files: ['js/**/*.js'],
    plugins: { mpi: { rules: { 'no-same-tier-component-import': rule } } },
    rules: { 'mpi/no-same-tier-component-import': 'warn' },
  },
];
