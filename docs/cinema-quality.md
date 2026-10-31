# Cinema va film oqimi

Yangi uzun film/serial implementatsiyasi va amaldagi sozlamalar: [film-workflow.md](film-workflow.md). Quyidagi qaydlar avvalgi qisqa sahna oqimiga tegishli.

# Cinema internal preview

Cinema adds separated dialogue and music/effects, expressive Uzbek speech, and selective segment regeneration to the existing settings → processing → Studio flow. It is disabled by default. No production configuration was enabled by this change.

Set `CINEMA_ENABLED=true`, `CINEMA_USER_IDS` to a comma-separated list of internal user IDs, and configure `FAL_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`. Restart the backend. Existing migration startup/backup handling applies migration `012_cinema_quality`. Back up the database and persistent uploads together.

`GET /api/dubbing/capabilities` returns `cinema: {enabled, ready, maxDuration: null}`. Browser preflight checks availability and locally measurable duration before transferring a file. Direct URL imports have no reliable duration before download; the server checks their real duration before processing/reserving credits. Provider authentication/quota is verified by actual provider requests; capability checks indicate configuration presence, not live provider health.

Start with `qualityMode: "cinema"` in `POST /api/dubbing/process`. A saved project with an owned source is required. Optional `glossary` is an object of names and preferred translations. Cinema uses WAV extraction, SAM Audio `quality`, WAV outputs, 60-second chunks and 5-second overlap. Both stems must match source duration within 120 ms. Clean dialogue drives new transcription and clone sampling; existing editable transcripts are retained. Compressed five-minute ASR input remains a single transcription request. Gemini proposes delivery only; uncertain analysis and overlapping speech get review flags.

Cinema speech uses `eleven_v3`, including site voices and temporary speaker clones. Provider errors never switch voices or providers. Each speaker still needs at least 10 seconds of clean sample material. Corrections to speaker labels are accepted for Cinema against the original trusted segment IDs and time boundaries. Per-job consent fields are now deprecated and no longer required.

Studio offers original, clean dialogue, background, and finished audio, plus text, speaker, voice and expression edits. `POST /api/dubbing/projects/:projectId/regenerate` accepts nonempty `segmentIds`, optional `speechCadence`, and the legacy optional `voiceCloningConsent` field (ignored). It snapshots the current edits. Changed voice assignments invalidate every affected speaker segment. Other unsynthesized text/expression edits must be included in the selection; the job reports them if omitted. Completed speech is cached by source, text, voice/sample identity, model, delivery and timing; unchanged segments do not call TTS again. Selected audio and the existing background are remixed into a new master. Auto translations can be shortened at most twice when speech exceeds the safe 1.45× tempo bound. Edited text fails with `translation_too_long` and `needs_edit`, without rewriting it.

Speech Cadence is bounded to each original Cinema segment window, including at scene end; it cannot introduce additional overlap or cut speech. Cinema never mixes the original soundtrack back in, including on an FFmpeg error. Previous output media IDs remain attached on failure. Output publication and credit consumption occur together in a SQLite transaction with revision and worker lease checks. Only one dubbing job per project is allowed. Transcription and dubbing cannot run concurrently on the same project.

Automatic remains 1× and cloning 1.5×. Credit reservation/consumption/refund is idempotent per job. An explicit regeneration is a new billed job using the same scene-duration tariff. Internal provider work is separately journaled in `cinema_artifacts`, including input parameters and completed results. These records are not a dollar invoice; reconcile real spend with provider usage/billing reports during the listening trial.

## Interrupted provider requests

Completed artifacts survive restarts and failed jobs. Paid requests first write a `pending` journal entry; a crash, timeout or rejected request leaves that entry quarantined. Automatic recovery/retry refuses to send the identical request again when the provider outcome is uncertain, and the job refunds reserved customer credits. This deliberately requires operator recovery instead of potentially charging the same provider request twice. Inspect `cinema_artifacts` by project/stage/state and compare the provider dashboard outcome. Restore a verified completed result or remove a pending entry only after verifying that replay is appropriate. Do not blindly clear pending entries on restart. Expression analysis is advisory and can fail into review flags; primary separation/transcription/translation/TTS failures stop the render.

Audio artifacts remain in persistent uploads and media assets. Deleting the project removes its cache journal via foreign-key cascade; existing media lifecycle/retention policy still applies. No audio data or filesystem cache paths are added to capability/job payloads.

## Listening release gate

Automated tests use generated audio and mocked providers; they do not establish movie-dubbing quality. Keep the feature restricted until an Uzbek-speaking reviewer signs off all five 1–5 minute scenes:

| Scene | Required listening evidence |
| --- | --- |
| Dialogue over music | Original words unintelligible in residual; important music retained |
| Strong effects | Important sound effects retained, no clipping or drift |
| Whisper | Correct voice, natural Uzbek meaning, credible delivery |
| Shout | Correct voice and expression, no clipped endings |
| Overlapping speech | Stable character identity, review flags, no additional overlap |

For each scene record source identifier/permission, duration, library-vs-clone mode, chosen voice IDs, provider spend, transcript/meaning review, leakage, retained music/effects, delivery, sentence endings, and reviewer/date. Compare with Standard. Repeat one-segment edit, one speaker-voice change, provider failure, and interrupted-job recovery. Verify unaffected segments make no new speech calls and customer minutes are not duplicated. Validate site voices and clones separately on Eleven v3. Leave the public rollout disabled until these records pass review. Telephone filtering, room acoustics, lip animation are outside the short-scene preview; full-length films use the separate Film workflow.

Provider references: [SAM Audio schema](https://fal.ai/models/fal-ai/sam-audio/separate/api), [Gemini audio analysis](https://ai.google.dev/gemini-api/docs/audio), [ElevenLabs models](https://elevenlabs.io/docs/overview/models).
