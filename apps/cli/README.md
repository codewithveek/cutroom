# cutroom

**Turn a codebase into product videos, on open models.**

`cutroom` reads a repository and renders finished product videos (launch films, feature drops, tutorials, explainers, teasers and social cutdowns) as 16:9, 9:16, 1:1 or 4:5 MP4s with voiceover, music, captions and a thumbnail. Gemma (via Ollama) writes the brief and the storyboard, every claim is audited against the code, you approve it, and Remotion renders it.

In **Local mode** (the default) nothing leaves your machine: a privacy guard refuses non-local providers and an egress guard blocks every non-loopback connection while the run executes.

## Requirements

- Node.js 22 or newer
- [ffmpeg](https://ffmpeg.org) on your `PATH` (or `FFMPEG_PATH`)
- [Ollama](https://ollama.com) with a Gemma model: `ollama pull gemma4:e4b`
- Chrome Headless Shell is downloaded by Remotion on the first render; set `BROWSER_EXECUTABLE` to use your own Chromium.

## Use

```bash
npx cutroom setup                  # once, online: downloads the Kokoro voice model (~90 MB)
npx cutroom make --repo . --preset launch-editorial --ratios 16:9,9:16
```

`cutroom` prints the storyboard and the claim audit table, then asks for approval. `--yes` approves automatically when no claim is unsupported. Outputs land in `.cutroom/runs/<run-id>/deliverables/`.

Everything lives in `CUTROOM_DATA_DIR` (default `.cutroom` in the current directory): runs, the voice model and caches. To share one voice model across projects, set `CUTROOM_DATA_DIR=~/.cutroom` for both `setup` and `make`.

| Flag | Meaning |
|---|---|
| `--repo <path\|git-url\|app.zip>` | The product to film (required) |
| `--preset` | `launch-editorial` (default) and five more; sets type, look, length and ratios |
| `--ratios` | Comma-separated: `16:9,9:16,1:1,4:5` |
| `--privacy` | `local` (default), `hybrid`, `cloud` |
| `--look`, `--type`, `--seconds`, `--voice`, `--music` | Override the preset |
| `--yes` | Approve when no claim is unsupported |
| `--direction` | A free-text steer for the storyboard ("for developers, focus on the CLI") |
| `--watermark` | A "created with cutroom" badge in the bottom-right corner |
| `--silent` | No voiceover |

Model and voice settings come from environment variables: `OLLAMA_HOST`, `MODEL_ID`, `KOKORO_DTYPE`, `ELEVENLABS_API_KEY` (Cloud mode), `RENDER_API_BASE_URL` and `RENDER_API_TOKEN` (Hybrid mode).

## Licences

Cutroom is MIT. It renders with [Remotion](https://www.remotion.dev), which is free for individuals and companies of up to three people; larger companies need a [Remotion company licence](https://www.remotion.dev/license). Voices come from [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0); fonts are SIL OFL.

Source, web app and docs: <https://github.com/codewithveek/cutroom>.
