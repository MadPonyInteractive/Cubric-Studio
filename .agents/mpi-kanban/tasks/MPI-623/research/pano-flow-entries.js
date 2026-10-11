// ---- commandRegistry.js, after flowOutpaint ----
    // MPI-623. The 360 Panorama Flow: a prompt, or a picture plus an optional prompt, in; a
    // seam-clean 2K equirect out, which flowService then Converts (8K + depth) so the card
    // lands as a scene. ONE graph: a lazy switch on the picture loader's `loaded` picks the
    // text or the outpaint branch, so the picture is optional HERE, not just at the op layer.
    flowPano360: {
        label: 'Flow: 360 Panorama',
        progressLabel: 'Making the panorama',
        mediaType: MEDIA_TYPE.IMAGE,        // OUTPUT type
        requiresImages: 0,
        mediaInputs: [
            { key: 'image1', mediaType: MEDIA_TYPE.IMAGE, title: 'Input_Image', required: false },
        ],
        promptRequired: false,
        universal: true,
    },

// ---- tests/inject-params-titles.test.cjs ----
test('the 360 Panorama Flow carries its I/O titles (MPI-623)', () => {
    const file = 'flow_pano360.json';
    const have = titlesOf(file);
    for (const title of ['input_image', 'input_positive', 'input_seed', 'output_image']) {
        assert.ok(have.has(title), `${file} must carry a node titled "${title}"`);
    }
});

// ---- flowsRegistry.js FlowDef JSDoc ----
 * @property {boolean} [landsAsScene] - The landed card is Converted to a 360 scene before the run
 *                                       reports done (MPI-623, flowService `sceneCallbacks`).

// ---- flowsRegistry.js FLOWS, appended ----
    // MPI-623 — 360 Panorama (2.1). Krea 2 Raw + the accelerator (fast tier only: the bench's
    // quality tier came out WORSE, validation.md § Phase 4 bench test) under Mickmumpitz's two
    // MIT 360 LoRAs. No picture: text -> 360. A picture: it is placed at 70 degrees across and
    // the rest of the sphere is outpainted round it (Ostris edit pack). Both end in a wrap-seam
    // pass at 2K; then `landsAsScene` Converts the card (AnimeSharp to 8K + MoGe depth), the same
    // Convert as the right-click, so it opens in the Scene workspace on a left-click.
    {
        id: 'pano-360',
        title: '360 Panorama',
        preview: 'flow-pano-360.webp',
        description: 'Make a 360 panorama you can look around and walk through in 3D, from a description '
            + 'or from a picture. With a picture, the rest of the world around it is painted in; the '
            + 'finished panorama is 8K and opens in the 3D Scene.',
        requiredModels: [{ label: 'Render model', models: ['krea2'] }],
        requiredDeps: ['krea2-360-t2i-lora', 'krea2-360-outpaint-lora'],
        requiredPlugins: ['scene-convert'],
        operation: 'flowPano360',
        workflow: 'flow_pano360.json',
        landsAsScene: true,
        mediaType: 'image',
        type: 'create',
        inputSchema: {
            media: [
                { type: 'image', mode: 'upto', max: 1, roles: ['image1'], labels: ['Picture (optional)'] },
            ],
        },
        fields: [
            {
                id: 'positive', type: 'text', rows: 3, label: 'Describe the place',
                placeholder: 'A cosy cartoon village in a forest clearing, warm afternoon light',
            },
        ],
    },
