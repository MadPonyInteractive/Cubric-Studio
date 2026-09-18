// Desktop-only Playwright config. Browser tests should keep using the existing browser workflow.
module.exports = {
  testDir: './tests/desktop',
  // Hands the run its own free CUBRIC_PORT, so the specs can never attach to an
  // already-running app's server instead of their own. See the file for why.
  globalSetup: require.resolve('./tests/desktop/globalSetup.js'),
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Video only when running locally. A failing CI run recorded ~150 MB of
    // Electron video per upload; the trace already carries the DOM snapshots
    // and the screenshot the failure, for a fraction of the Actions storage.
    video: process.env.CI ? 'off' : 'retain-on-failure'
  },
  outputDir: 'test-results/desktop',
  // MPI-812: Playwright's default is 'always', so every test's output dir survived the
  // run forever — and each one holds a full Electron --user-data-dir. That reached
  // 142.1 GB across 228 session scratchpads (608,891 files, ~60 GB/day on a busy board)
  // and hid from every size sweep, because no single file in it is over 4 MB. A passing
  // test needs none of it. A FAILING one keeps everything — trace, screenshot, video and
  // the profile — which is the case where you actually want to look.
  // ponytail: a failed test still keeps its profile. That is one dir, not 600k files;
  // reap those per-test too if failures ever start costing real space.
  preserveOutput: 'failures-only'
};
