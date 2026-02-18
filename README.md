# Welcome to Void.

<div align="center">
	<img
		src="./src/vs/workbench/browser/parts/editor/media/slice_of_void.png"
	 	alt="Void Welcome"
		width="300"
	 	height="300"
	/>
</div>

Void is the open-source Cursor alternative.

Use AI agents on your codebase, checkpoint and visualize changes, and bring any model or host locally. Void sends messages directly to providers without retaining your data.

This repo contains the full sourcecode for Void. If you're new, welcome!

- 🧭 [Website](https://voideditor.com)

- 👋 [Discord](https://discord.gg/RSNjgaugJs)

- 🚙 [Project Board](https://github.com/orgs/voideditor/projects/2)


## Note

We've paused work on the Void IDE (this repo) to explore a few novel coding ideas. We want to focus on innovation over feature-parity. Void will continue running, but without maintenance some existing features might stop working over time. Depending on the direction of our new work, we might not resume Void as an IDE.

We won't be actively reviewing Issues and PRs, but we will respond to all [email](mailto:hello@voideditor.com) inquiries on building and maintaining your own version of Void while we're paused. 

## Reference

Void is a fork of the [vscode](https://github.com/microsoft/vscode) repository. For a guide to the codebase, see [VOID_CODEBASE_GUIDE](https://github.com/voideditor/void/blob/main/VOID_CODEBASE_GUIDE.md).

For a guide on how to develop your own version of Void, see [HOW_TO_CONTRIBUTE](https://github.com/voideditor/void/blob/main/HOW_TO_CONTRIBUTE.md) and [void-builder](https://github.com/voideditor/void-builder).




## Orcest AI / RainyModel Configuration

Orcide connects to the [RainyModel](https://rm.orcest.ai) LLM proxy for unified model routing across free, internal, and premium backends.

### Setup

1. Open Orcide Settings (gear icon in sidebar)
2. Select **OpenAI-Compatible** as the provider
3. Configure:
   - **baseURL**: `https://rm.orcest.ai/v1`
   - **API Key**: Your RainyModel API key
4. Add models and assign to features:

| Feature | Recommended Model |
|---------|------------------|
| Chat | `rainymodel/chat` |
| Quick Edit (Ctrl+K) | `rainymodel/code` |
| Autocomplete | `rainymodel/code` |
| Apply | `rainymodel/auto` |

### Available Models

- `rainymodel/auto` - General purpose, cost-optimized routing
- `rainymodel/chat` - Conversation and Persian language
- `rainymodel/code` - Code generation and completion
- `rainymodel/agent` - Complex agent tasks (long context)

### Routing

RainyModel routes requests: FREE (HF/ollamafreeapi) -> INTERNAL (Ollama) -> PREMIUM (OpenRouter).
Use the `X-RainyModel-Policy` header for custom routing (auto, uncensored, premium, free).

## Support
You can always reach us in our Discord server or contact us via email: hello@voideditor.com.
