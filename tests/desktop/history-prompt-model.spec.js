const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-955 — image History's Prompt tool must survive a text-to-image-only
 * active model. `_promptModelFilter` (MpiGroupHistoryBlock.js ~311) now
 * gates the IMAGE model list the same way it already gated video's i2v-only
 * list: a model with no op that takes an image is excluded from
 * `installedModels`, and the block falls back to the first eligible model
 * (mirrors the existing i2v fallback, ~line 322).
 *
 * Before the fix, a model whose `supportedOps` are all text-only (no op
 * requires an image) left `_hasPromptOps()` false for every op, so
 * `_shouldShowPromptBox()` was false, the workspace opened in 'crop' mode
 * instead of 'prompt', and the PromptBox — with it Cue/Stop and the model
 * picker — never mounted (Fabio live, 2026-09-27).
 *
 * The only shipped model with NO image-taking op at all is
 * `flux-schnell-cloud` (`supportedOps: ['t2i']`), a DeepInfra `devOnly` test
 * model. `devOnly` models only appear in `MODELS` on a source/dev run
 * (`BUILD_HASH === 'dev'`, `js/core/buildInfo.js`), which every desktop spec
 * is. It is only "usable" once a cloud key is saved (`isModelUsable` ->
 * `hasCloudKey()`), so this spec saves a throwaway key through the real,
 * local, no-network `secretsClient` / `main/secretsStore.js` IPC round trip
 * against this test's OWN isolated userData profile (`launch.js`) — never
 * the developer's real DeepInfra key.
 */
test.setTimeout(90000);

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAFElEQVR42mNk+M9QzwAEjGQwACdfA/MhYO3qAAAAAElFTkSuQmCC';

const T2I_ONLY_MODEL_ID = 'flux-schnell-cloud';

/**
 * Save a throwaway DeepInfra key (isolated profile, no network call), force
 * modelRegistry's cached `hasCloudKey()` to re-read it, then persist
 * `flux-schnell-cloud` as the workspace's selected image model — the live
 * bug's starting state (the gallery's selected image model had no image op).
 */
async function selectT2IOnlyCloudModel(window) {
  await window.evaluate(async (modelId) => {
    const { secretsClient } = await import('/js/core/secretsClient.js');
    const { refreshCloudKey } = await import('/js/data/modelRegistry.js');
    const saved = await secretsClient.setEndpointKey('deepinfra', 'mpi955-test-key');
    if (!saved?.ok) throw new Error(`setEndpointKey failed: ${JSON.stringify(saved)}`);
    await refreshCloudKey();
    const { state } = await import('/js/state.js');
    state.s_selectedModelIdByType = { image: modelId, video: null };
  }, T2I_ONLY_MODEL_ID);
}

async function setupProject(window) {
  return window.evaluate((imgUrl) => {
    return import('/js/state.js').then(({ state }) => {
      state.currentProject = {
        id: 'pPromptModelTest',
        name: 'Prompt Model Test',
        folderPath: 'C:/tmp/history-prompt-model-test',
        itemGroups: [{
          id: 'gImage',
          type: 'image',
          selectedIndex: 0,
          history: [{ id: 'iImage', type: 'image', filePath: imgUrl, displayName: 'img' }],
        }],
      };
    });
  }, TINY_PNG);
}

async function openGroup(window, groupId) {
  await window.evaluate(async (id) => {
    const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
    navigate(PAGE_GROUP_HISTORY, { groupId: id });
  }, groupId);
  await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-group-history-block')))
    .toBe(true);
}

test('image History falls back to an image-taking model when the selected model is text-to-image only', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await selectT2IOnlyCloudModel(window);
    // Sanity: the cloud key round trip actually landed, or the whole premise
    // (a real, usable, t2i-only model as the starting selection) is void.
    const usable = await window.evaluate(async (modelId) => {
      const { getModelById, isModelUsable } = await import('/js/data/modelRegistry.js');
      const model = getModelById(modelId);
      return { found: !!model, usable: model ? isModelUsable(model) : false, supportedOps: model?.supportedOps };
    }, T2I_ONLY_MODEL_ID);
    expect(usable.found).toBe(true);
    expect(usable.usable).toBe(true);
    expect(usable.supportedOps).toEqual(['t2i']);

    await setupProject(window);
    await openGroup(window, 'gImage');

    // The prompt box mounts on load only when the active model has a
    // prompt-driven op (`_shouldShowPromptBox`) — this is exactly what the
    // live bug broke: no prompt box, no Cue, no Stop, no model picker.
    await expect.poll(() => window.evaluate(() =>
      !!document.querySelector('#prompt-box-mount .mpi-prompt-box')))
      .toBe(true);

    const dom = await window.evaluate(async () => {
      const { getModelsByType, isModelUsable } = await import('/js/data/modelRegistry.js');
      const { isTextOnlyOp } = await import('/js/data/commandRegistry.js');
      const takesImage = (m) => Array.isArray(m?.supportedOps) && m.supportedOps.some(op => !isTextOnlyOp(op));
      const expected = getModelsByType('image').filter(isModelUsable).find(takesImage);
      const badge = document.querySelector('#prompt-box-mount .mpi-prompt-box__badge-model');
      return {
        badgeText: badge?.textContent || '',
        expectedName: expected?.name || null,
        cuePresent: !!document.querySelector('#prompt-box-mount .mpi-prompt-box__cue-btn'),
      };
    });

    expect(dom.expectedName).toBeTruthy();
    expect(dom.expectedName).not.toBe('FLUX Schnell (Cloud)');
    expect(dom.badgeText).toContain(dom.expectedName);
    expect(dom.cuePresent).toBe(true);
  } finally {
    await closeApp(app);
  }
});
