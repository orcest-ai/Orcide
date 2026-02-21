/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';

// ─── LangChain Integration for Orcest Ecosystem ──────────────────────────────

export type LangChainConfig = {
	enabled: boolean;
	rainyModelEndpoint: string;
	ollamaFreeApiEndpoint: string;
	maestristEndpoint: string;
	laminoEndpoint: string;
	defaultChainType: 'conversational' | 'retrieval_qa' | 'agent' | 'sequential';
	memoryType: 'buffer' | 'summary' | 'conversation_buffer_window';
	maxTokens: number;
	temperature: number;
	verbose: boolean;
};

export type LangChainTool = {
	name: string;
	description: string;
	endpoint: string;
	type: 'api' | 'function' | 'retriever';
	enabled: boolean;
};

export type LangChainAgent = {
	id: string;
	name: string;
	description: string;
	model: string;
	tools: string[];
	systemPrompt: string;
	status: 'active' | 'paused' | 'error';
};

export type LangChainState = {
	config: LangChainConfig;
	availableTools: LangChainTool[];
	activeAgents: LangChainAgent[];
	isConnected: boolean;
};

export interface IOrcideLangChainService {
	readonly _serviceBrand: undefined;
	readonly state: LangChainState;
	onDidChangeState: Event<void>;

	// Configuration
	updateConfig(config: Partial<LangChainConfig>): void;
	resetConfig(): void;

	// Tools
	registerTool(tool: Omit<LangChainTool, 'enabled'>): void;
	removeTool(name: string): void;
	enableTool(name: string): void;
	disableTool(name: string): void;
	getAvailableTools(): LangChainTool[];

	// Agent management
	createAgent(agent: Omit<LangChainAgent, 'id' | 'status'>): LangChainAgent;
	removeAgent(agentId: string): void;
	pauseAgent(agentId: string): void;
	resumeAgent(agentId: string): void;
	getActiveAgents(): LangChainAgent[];

	// Chain execution
	executeChain(input: string, chainType?: LangChainConfig['defaultChainType']): Promise<string>;
	executeAgentChain(agentId: string, input: string): Promise<string>;

	// Connection
	testConnection(): Promise<boolean>;
}

export const IOrcideLangChainService = createDecorator<IOrcideLangChainService>('orcideLangChainService');


const defaultLangChainConfig: LangChainConfig = {
	enabled: true,
	rainyModelEndpoint: 'https://rm.orcest.ai/v1',
	ollamaFreeApiEndpoint: 'https://ollamafreeapi.orcest.ai',
	maestristEndpoint: 'https://agent.orcest.ai',
	laminoEndpoint: 'https://llm.orcest.ai',
	defaultChainType: 'agent',
	memoryType: 'conversation_buffer_window',
	maxTokens: 4096,
	temperature: 0.7,
	verbose: false,
};

const defaultOrcestTools: LangChainTool[] = [
	{
		name: 'rainymodel-chat',
		description: 'Chat with RainyModel (auto-routing across free, internal, and premium providers)',
		endpoint: 'https://rm.orcest.ai/v1/chat/completions',
		type: 'api',
		enabled: true,
	},
	{
		name: 'rainymodel-code',
		description: 'Code generation and completion via RainyModel code-specialized models',
		endpoint: 'https://rm.orcest.ai/v1/chat/completions',
		type: 'api',
		enabled: true,
	},
	{
		name: 'maestrist-agent',
		description: 'AI software development agent for complex coding tasks',
		endpoint: 'https://agent.orcest.ai/v1/agent',
		type: 'api',
		enabled: true,
	},
	{
		name: 'lamino-workspace',
		description: 'LLM workspace for collaborative AI conversations',
		endpoint: 'https://llm.orcest.ai/v1/chat',
		type: 'api',
		enabled: true,
	},
	{
		name: 'ollamafreeapi',
		description: 'Free access to 65+ open-source LLMs via distributed Ollama network',
		endpoint: 'https://ollamafreeapi.orcest.ai/api/chat',
		type: 'api',
		enabled: true,
	},
	{
		name: 'file-reader',
		description: 'Read and analyze files from the current workspace',
		endpoint: 'local://file-reader',
		type: 'function',
		enabled: true,
	},
	{
		name: 'code-search',
		description: 'Search across the codebase for relevant code snippets',
		endpoint: 'local://code-search',
		type: 'retriever',
		enabled: true,
	},
];


class OrcideLangChainService extends Disposable implements IOrcideLangChainService {
	readonly _serviceBrand: undefined;

	private _state: LangChainState;

	private readonly _onDidChangeState = this._register(new Emitter<void>());
	readonly onDidChangeState: Event<void> = this._onDidChangeState.event;

	get state(): LangChainState {
		return this._state;
	}

	constructor() {
		super();
		this._state = {
			config: { ...defaultLangChainConfig },
			availableTools: [...defaultOrcestTools],
			activeAgents: [],
			isConnected: false,
		};
		this._checkConnection();
	}

	private async _checkConnection(): Promise<void> {
		try {
			const response = await fetch(`${this._state.config.rainyModelEndpoint.replace('/v1', '')}/health`);
			this._state = { ...this._state, isConnected: response.ok };
		} catch {
			this._state = { ...this._state, isConnected: false };
		}
		this._onDidChangeState.fire();
	}

	// Configuration
	updateConfig(config: Partial<LangChainConfig>): void {
		this._state = {
			...this._state,
			config: { ...this._state.config, ...config },
		};
		this._onDidChangeState.fire();
	}

	resetConfig(): void {
		this._state = {
			...this._state,
			config: { ...defaultLangChainConfig },
		};
		this._onDidChangeState.fire();
	}

	// Tools
	registerTool(tool: Omit<LangChainTool, 'enabled'>): void {
		const exists = this._state.availableTools.some(t => t.name === tool.name);
		if (exists) return;
		this._state = {
			...this._state,
			availableTools: [...this._state.availableTools, { ...tool, enabled: true }],
		};
		this._onDidChangeState.fire();
	}

	removeTool(name: string): void {
		this._state = {
			...this._state,
			availableTools: this._state.availableTools.filter(t => t.name !== name),
		};
		this._onDidChangeState.fire();
	}

	enableTool(name: string): void {
		this._state = {
			...this._state,
			availableTools: this._state.availableTools.map(t =>
				t.name === name ? { ...t, enabled: true } : t
			),
		};
		this._onDidChangeState.fire();
	}

	disableTool(name: string): void {
		this._state = {
			...this._state,
			availableTools: this._state.availableTools.map(t =>
				t.name === name ? { ...t, enabled: false } : t
			),
		};
		this._onDidChangeState.fire();
	}

	getAvailableTools(): LangChainTool[] {
		return this._state.availableTools;
	}

	// Agent management
	createAgent(agent: Omit<LangChainAgent, 'id' | 'status'>): LangChainAgent {
		const newAgent: LangChainAgent = {
			...agent,
			id: `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
			status: 'active',
		};
		this._state = {
			...this._state,
			activeAgents: [...this._state.activeAgents, newAgent],
		};
		this._onDidChangeState.fire();
		return newAgent;
	}

	removeAgent(agentId: string): void {
		this._state = {
			...this._state,
			activeAgents: this._state.activeAgents.filter(a => a.id !== agentId),
		};
		this._onDidChangeState.fire();
	}

	pauseAgent(agentId: string): void {
		this._state = {
			...this._state,
			activeAgents: this._state.activeAgents.map(a =>
				a.id === agentId ? { ...a, status: 'paused' as const } : a
			),
		};
		this._onDidChangeState.fire();
	}

	resumeAgent(agentId: string): void {
		this._state = {
			...this._state,
			activeAgents: this._state.activeAgents.map(a =>
				a.id === agentId ? { ...a, status: 'active' as const } : a
			),
		};
		this._onDidChangeState.fire();
	}

	getActiveAgents(): LangChainAgent[] {
		return this._state.activeAgents.filter(a => a.status === 'active');
	}

	// Chain execution
	async executeChain(input: string, chainType?: LangChainConfig['defaultChainType']): Promise<string> {
		const model = chainType === 'agent' ? 'rainymodel/agent' : 'rainymodel/chat';
		try {
			const response = await fetch(`${this._state.config.rainyModelEndpoint}/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model,
					messages: [{ role: 'user', content: input }],
					temperature: this._state.config.temperature,
					max_tokens: this._state.config.maxTokens,
				}),
			});
			if (!response.ok) throw new Error(`Chain execution failed: ${response.status}`);
			const data = await response.json();
			return data.choices?.[0]?.message?.content ?? '';
		} catch (e) {
			throw new Error(`LangChain execution error: ${e}`);
		}
	}

	async executeAgentChain(agentId: string, input: string): Promise<string> {
		const agent = this._state.activeAgents.find(a => a.id === agentId);
		if (!agent) throw new Error(`Agent ${agentId} not found`);
		if (agent.status !== 'active') throw new Error(`Agent ${agentId} is not active`);

		const enabledTools = this._state.availableTools
			.filter(t => t.enabled && agent.tools.includes(t.name))
			.map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description } }));

		try {
			const response = await fetch(`${this._state.config.rainyModelEndpoint}/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: agent.model,
					messages: [
						{ role: 'system', content: agent.systemPrompt },
						{ role: 'user', content: input },
					],
					tools: enabledTools.length > 0 ? enabledTools : undefined,
					temperature: this._state.config.temperature,
					max_tokens: this._state.config.maxTokens,
				}),
			});
			if (!response.ok) throw new Error(`Agent chain failed: ${response.status}`);
			const data = await response.json();
			return data.choices?.[0]?.message?.content ?? '';
		} catch (e) {
			this._state = {
				...this._state,
				activeAgents: this._state.activeAgents.map(a =>
					a.id === agentId ? { ...a, status: 'error' as const } : a
				),
			};
			this._onDidChangeState.fire();
			throw new Error(`Agent execution error: ${e}`);
		}
	}

	// Connection test
	async testConnection(): Promise<boolean> {
		await this._checkConnection();
		return this._state.isConnected;
	}
}

registerSingleton(IOrcideLangChainService, OrcideLangChainService, InstantiationType.Eager);
