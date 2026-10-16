// The Input_Kept question the app asks for a background change, per Which characters, as JSON (MPI-1154 bench).
//   node asks.mjs > asks.json
import { getFlowById } from '../../../../../js/data/flowsRegistry.js';
import { describeAsks } from '../../../../../js/services/flowEnhance.js';

const flow = getFlowById('video-edit');
const media = [{ role: 'video1', url: 'v' }, { role: 'image1', url: 'i' }];
const kept = who => describeAsks(flow, { Input_Operation: 4, Input_Who: who }, media).find(a => a.to === 'Input_Kept').ask;
// The question before MPI-1154, as a control.
const OLD = 'This picture is a reference for a video edit. Describe only the main person: apparent age and gender, face and skin, hair colour, length and style, and every garment and accessory with its colour. Reply with one or two plain sentences of concrete visual facts, starting at the subject: no preamble, no opinions, and only what is there.';
console.log(JSON.stringify({
    monkey_horse_before: ['mpi1154_monkey_horse_first.png', OLD],
    monkey_horse: ['mpi1154_monkey_horse_first.png', kept('The monkey and the horse ')],
    dancer_named: ['mpi1154_dancer_first.png', kept('the blonde woman')],
    dancer_default: ['mpi1154_dancer_first.png', kept('the person')],
}, null, 1));
