# MPI-1004 Checklist

- [x] Catalogue: a voice slot lists its library voices (`media[].voices`, sections) in describe_model
- [x] `{ role, voice }` media ref: loop passes it through, MCP accepts it, renderer `buildFlow` resolves it through the picker's decode (`voiceWavFile`); unknown id / slot with no library refuses `INVALID_VOICE`
- [x] Picker calls the shared `voiceWavFile`
- [x] Loop: a Flow run carrying a library voice raises a `voice` card; Pick from the voice library opens the Flow (no voice), Use <voice> runs, a typed reply runs nothing; no agent turn on a click
- [x] Chat: the `voice` card (live + answered redraw)
- [x] `docs/agent/flows.md`: spoken lines (DramaBox first, voice in words, sounds; Chatterbox needs a sample, reads words only; no DramaBox -> pick a library voice, the app asks); MEDIA_REQUIRED offer text
- [x] `docs/agent-chat.md`: the voice ref and card
- [x] Tests: unit (catalogue voices, ref resolve/refuse, loop card), desktop card spec; `npm test`
- [x] Look step 1 (DramaBox voice line with a cough) passed
- [x] Look step 2 failure fixed: packaged Flows' media reach the catalogue (`routes/connector.js`)
- [x] Vinyl sings speech on his mic, DJs music (`MpiAgentChat.js`, spec step)
- [x] Pick from the voice library opens on Inputs with the library open (`pickVoice`)
- [x] Voice previews: switching voices keeps the new one playing (`MpiVoicePicker`)
- [x] Fabio: Pick lands in the library, Use <voice> runs, Vinyl mic by eye (round 4)
- [x] Previews reach the chosen output device (`applySink`)
- [ ] Fabio: previews audible
