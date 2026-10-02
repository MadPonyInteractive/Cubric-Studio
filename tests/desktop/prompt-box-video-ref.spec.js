// @ts-check
// 2026-10-02 (Fabio): no cloud model that takes video made a chip for a dropped video.
// `ref2v` requires nothing, so it read as text-only: a video staged on Seedance 2.0 / Wan 3.0
// moved the box to i2v, whose prune deleted it. Unit half: tests/text-only-op.test.cjs.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('a video dropped on a cloud ref2v model stays as a chip on ref2v', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window } = await launchApp(testInfo);
  try {
    const out = await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const [{ Events }, { MpiPromptBox }, { getModelById }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Organisms/MpiPromptBox/MpiPromptBox.js'),
        import('/js/data/modelRegistry.js'),
      ]);
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
      Events.emit('ui:close-all-popups');
      let n = 0;
      const mk = (modelId, operation) => {
        const host = document.createElement('div');
        host.id = `pb-ref-${++n}`;
        document.body.appendChild(host);
        const model = getModelById(modelId);
        const pb = MpiPromptBox.mount(host, { model, modelList: [model], operation });
        let op = operation;
        pb.on('operation-change', ({ operation: next }) => { op = next; });
        // Staged media is saved and restored per box, so a new box starts with the last
        // one's chips (and moved its op during mount, before this listener). Start clean.
        pb.el.clearMedia();
        pb.el.setOperation(operation);
        return { el: pb.el, op: () => op };
      };
      const state = (b) => ({ op: b.op(), images: b.el.imageCount, videos: b.el.videoCount });
      const video = { url: 'C:/fixture/clip.mp4', mediaType: 'video' };
      const image = { url: 'C:/fixture/still.png', mediaType: 'image' };
      const res = {};

      const seedance = mk('seedance-2-cloud', 't2v');
      seedance.el.injectMedia(video);
      res.seedanceT2v = state(seedance);

      const wan = mk('wan3-cloud', 't2v');
      wan.el.injectMedia(video);
      res.wanT2v = state(wan);

      const onI2v = mk('seedance-2-cloud', 'i2v');
      onI2v.el.injectMedia(image);
      onI2v.el.injectMedia(video);
      res.seedanceI2vPlusVideo = state(onI2v);

      const onRef = mk('seedance-2-cloud', 'ref2v');
      onRef.el.injectMedia(image);
      res.seedanceRef2vImage = state(onRef);

      // Unchanged: a lone image on t2v still lands on i2v.
      const img = mk('seedance-2-cloud', 't2v');
      img.el.injectMedia(image);
      res.seedanceT2vImage = state(img);
      return res;
    });
    expect(out.seedanceT2v).toEqual({ op: 'ref2v', images: 0, videos: 1 });
    expect(out.wanT2v).toEqual({ op: 'ref2v', images: 0, videos: 1 });
    expect(out.seedanceI2vPlusVideo).toEqual({ op: 'ref2v', images: 1, videos: 1 });
    expect(out.seedanceRef2vImage).toEqual({ op: 'ref2v', images: 1, videos: 0 });
    expect(out.seedanceT2vImage).toEqual({ op: 'i2v', images: 1, videos: 0 });
  } finally {
    await closeApp(app);
  }
});
