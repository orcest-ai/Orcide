/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { generateUuid } from '../../../../base/common/uuid.js';

// ─── Enterprise & Cursor Ultra Features for Orcide ──────────────────────────────

const ORCIDE_ENTERPRISE_STORAGE_KEY = 'orcide.enterpriseState';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type LicenseTier = 'free' | 'pro' | 'team' | 'enterprise';

export type LicenseInfo = {
	tier: LicenseTier;
	seats: number;
	usedSeats: number;
	expiresAt: number;
	features: string[];
	orgId?: string;
	orgName?: string;
};

export type SeatAllocation = {
	userId: string;
	email: string;
	name: string;
	role: 'owner' | 'admin' | 'member';
	allocatedAt: number;
	lastActive: number;
};

export type AuditLogEntry = {
	id: string;
	timestamp: number;
	userId: string;
	userEmail: string;
	action: string;
	resource: string;
	details?: Record<string, unknown>;
	ipAddress?: string;
};

export type EnterprisePolicy = {
	requireSSO: boolean;
	allowPersonalAPIKeys: boolean;
	allowedModels: string[];
	maxTokensPerRequest: number;
	maxRequestsPerDay: number;
	dataRetentionDays: number;
	allowExternalModels: boolean;
	allowCodeExport: boolean;
	enforceCodeReview: boolean;
	requireMFA: boolean;
};

export type UsageMetrics = {
	totalRequests: number;
	totalTokensUsed: number;
	requestsByModel: Record<string, number>;
	requestsByUser: Record<string, number>;
	averageLatencyMs: number;
	errorRate: number;
	period: 'daily' | 'weekly' | 'monthly';
	startDate: number;
	endDate: number;
};

// ─── Cursor Ultra Features ──────────────────────────────────────────────────────

export type BackgroundAgent = {
	id: string;
	name: string;
	type: 'code-review' | 'test-generation' | 'documentation' | 'refactoring' | 'security-scan' | 'dependency-update';
	status: 'idle' | 'running' | 'completed' | 'error';
	config: Record<string, unknown>;
	lastRunAt?: number;
	lastResult?: string;
};

export type MultiFileEditSession = {
	id: string;
	files: string[];
	description: string;
	status: 'planning' | 'editing' | 'reviewing' | 'applied' | 'reverted';
	changes: Array<{
		filePath: string;
		originalContent: string;
		newContent: string;
		applied: boolean;
	}>;
	createdAt: number;
};

export type ParallelCompletion = {
	id: string;
	prompt: string;
	models: string[];
	results: Array<{
		model: string;
		content: string;
		latencyMs: number;
		tokenCount: number;
	}>;
	selectedModel?: string;
	status: 'pending' | 'completed' | 'partial';
};

export type UltraFeatures = {
	backgroundAgents: BackgroundAgent[];
	multiFileEditSessions: MultiFileEditSession[];
	parallelCompletionEnabled: boolean;
	predictiveEditingEnabled: boolean;
	smartContextWindowEnabled: boolean;
	bugDetectionEnabled: boolean;
};


// ─── Enterprise State ───────────────────────────────────────────────────────────

export type EnterpriseState = {
	license: LicenseInfo;
	seats: SeatAllocation[];
	policy: EnterprisePolicy;
	auditLog: AuditLogEntry[];
	usageMetrics: UsageMetrics | null;
	ultraFeatures: UltraFeatures;
};


// ─── Service Interface ──────────────────────────────────────────────────────────

export interface IOrcideEnterpriseService {
	readonly _serviceBrand: undefined;
	readonly state: EnterpriseState;
	onDidChangeState: Event<void>;
	onDidChangePolicy: Event<EnterprisePolicy>;
	onDidBackgroundAgentComplete: Event<BackgroundAgent>;

	// License management
	getLicenseInfo(): LicenseInfo;
	isFeatureAvailable(feature: string): boolean;
	getTier(): LicenseTier;

	// Seat management
	allocateSeat(userId: string, email: string, name: string, role: SeatAllocation['role']): SeatAllocation;
	deallocateSeat(userId: string): void;
	getSeats(): SeatAllocation[];
	getAvailableSeats(): number;

	// Policy management
	updatePolicy(policy: Partial<EnterprisePolicy>): void;
	getPolicy(): EnterprisePolicy;
	isActionAllowed(action: string, userId: string): boolean;

	// Audit logging
	logAction(userId: string, userEmail: string, action: string, resource: string, details?: Record<string, unknown>): void;
	getAuditLog(filters?: { userId?: string; action?: string; from?: number; to?: number }): AuditLogEntry[];
	exportAuditLog(format: 'json' | 'csv'): string;

	// Usage metrics
	getUsageMetrics(period?: UsageMetrics['period']): UsageMetrics | null;
	trackUsage(model: string, userId: string, tokens: number, latencyMs: number): void;

	// ─── Cursor Ultra Features ──────────────────────────────────────────────────

	// Background agents
	createBackgroundAgent(agent: Omit<BackgroundAgent, 'id' | 'status'>): BackgroundAgent;
	runBackgroundAgent(agentId: string): Promise<string>;
	stopBackgroundAgent(agentId: string): void;
	getBackgroundAgents(): BackgroundAgent[];

	// Multi-file editing
	startMultiFileEdit(files: string[], description: string): Promise<MultiFileEditSession>;
	applyMultiFileEdit(sessionId: string): Promise<void>;
	revertMultiFileEdit(sessionId: string): Promise<void>;
	getMultiFileEditSessions(): MultiFileEditSession[];

	// Parallel completions
	runParallelCompletion(prompt: string, models?: string[]): Promise<ParallelCompletion>;
	selectCompletionResult(completionId: string, model: string): void;

	// Predictive editing & smart context
	togglePredictiveEditing(enabled: boolean): void;
	toggleSmartContextWindow(enabled: boolean): void;
	toggleBugDetection(enabled: boolean): void;
}

export const IOrcideEnterpriseService = createDecorator<IOrcideEnterpriseService>('orcideEnterpriseService');


// ─── Default State ──────────────────────────────────────────────────────────────

const RAINYMODEL_ENDPOINT = 'https://rm.orcest.ai/v1';

const defaultLicense: LicenseInfo = {
	tier: 'team',
	seats: 50,
	usedSeats: 0,
	expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
	features: [
		'sso',
		'team-management',
		'collaboration',
		'shared-workspaces',
		'audit-log',
		'usage-metrics',
		'background-agents',
		'multi-file-edit',
		'parallel-completions',
		'predictive-editing',
		'smart-context-window',
		'bug-detection',
		'custom-models',
		'priority-support',
		'langchain-integration',
		'git-pr-generation',
		'deployment',
	],
};

const defaultPolicy: EnterprisePolicy = {
	requireSSO: true,
	allowPersonalAPIKeys: false,
	allowedModels: ['rainymodel/auto', 'rainymodel/chat', 'rainymodel/code', 'rainymodel/agent'],
	maxTokensPerRequest: 8192,
	maxRequestsPerDay: 10000,
	dataRetentionDays: 90,
	allowExternalModels: true,
	allowCodeExport: true,
	enforceCodeReview: false,
	requireMFA: false,
};

const defaultUltraFeatures: UltraFeatures = {
	backgroundAgents: [],
	multiFileEditSessions: [],
	parallelCompletionEnabled: true,
	predictiveEditingEnabled: true,
	smartContextWindowEnabled: true,
	bugDetectionEnabled: true,
};


// ─── Service Implementation ─────────────────────────────────────────────────────

class OrcideEnterpriseService extends Disposable implements IOrcideEnterpriseService {
	readonly _serviceBrand: undefined;

	private _state: EnterpriseState;

	private readonly _onDidChangeState = this._register(new Emitter<void>());
	readonly onDidChangeState: Event<void> = this._onDidChangeState.event;

	private readonly _onDidChangePolicy = this._register(new Emitter<EnterprisePolicy>());
	readonly onDidChangePolicy: Event<EnterprisePolicy> = this._onDidChangePolicy.event;

	private readonly _onDidBackgroundAgentComplete = this._register(new Emitter<BackgroundAgent>());
	readonly onDidBackgroundAgentComplete: Event<BackgroundAgent> = this._onDidBackgroundAgentComplete.event;

	get state(): EnterpriseState {
		return this._state;
	}

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
		this._state = {
			license: { ...defaultLicense },
			seats: [],
			policy: { ...defaultPolicy },
			auditLog: [],
			usageMetrics: null,
			ultraFeatures: { ...defaultUltraFeatures },
		};
		this._loadFromStorage();
	}

	private _loadFromStorage(): void {
		const stored = this._storageService.get(ORCIDE_ENTERPRISE_STORAGE_KEY, StorageScope.APPLICATION);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				this._state = {
					...this._state,
					...parsed,
					license: { ...defaultLicense, ...(parsed.license ?? {}) },
					policy: { ...defaultPolicy, ...(parsed.policy ?? {}) },
					ultraFeatures: { ...defaultUltraFeatures, ...(parsed.ultraFeatures ?? {}) },
				};
			} catch { /* ignore */ }
		}
		this._onDidChangeState.fire();
	}

	private _saveState(): void {
		const toStore = {
			license: this._state.license,
			seats: this._state.seats,
			policy: this._state.policy,
			ultraFeatures: {
				parallelCompletionEnabled: this._state.ultraFeatures.parallelCompletionEnabled,
				predictiveEditingEnabled: this._state.ultraFeatures.predictiveEditingEnabled,
				smartContextWindowEnabled: this._state.ultraFeatures.smartContextWindowEnabled,
				bugDetectionEnabled: this._state.ultraFeatures.bugDetectionEnabled,
			},
		};
		this._storageService.store(ORCIDE_ENTERPRISE_STORAGE_KEY, JSON.stringify(toStore), StorageScope.APPLICATION, StorageTarget.USER);
	}


	// ── License Management ──────────────────────────────────────────────────────

	getLicenseInfo(): LicenseInfo {
		return this._state.license;
	}

	isFeatureAvailable(feature: string): boolean {
		return this._state.license.features.includes(feature);
	}

	getTier(): LicenseTier {
		return this._state.license.tier;
	}


	// ── Seat Management ─────────────────────────────────────────────────────────

	allocateSeat(userId: string, email: string, name: string, role: SeatAllocation['role']): SeatAllocation {
		const exists = this._state.seats.some(s => s.userId === userId);
		if (exists) throw new Error(`Seat already allocated for user ${userId}`);
		if (this._state.license.usedSeats >= this._state.license.seats) {
			throw new Error('No available seats');
		}

		const seat: SeatAllocation = {
			userId,
			email,
			name,
			role,
			allocatedAt: Date.now(),
			lastActive: Date.now(),
		};

		this._state = {
			...this._state,
			seats: [...this._state.seats, seat],
			license: {
				...this._state.license,
				usedSeats: this._state.license.usedSeats + 1,
			},
		};
		this._saveState();
		this._onDidChangeState.fire();
		return seat;
	}

	deallocateSeat(userId: string): void {
		const had = this._state.seats.some(s => s.userId === userId);
		this._state = {
			...this._state,
			seats: this._state.seats.filter(s => s.userId !== userId),
			license: {
				...this._state.license,
				usedSeats: had ? this._state.license.usedSeats - 1 : this._state.license.usedSeats,
			},
		};
		this._saveState();
		this._onDidChangeState.fire();
	}

	getSeats(): SeatAllocation[] {
		return this._state.seats;
	}

	getAvailableSeats(): number {
		return this._state.license.seats - this._state.license.usedSeats;
	}


	// ── Policy Management ───────────────────────────────────────────────────────

	updatePolicy(policy: Partial<EnterprisePolicy>): void {
		this._state = {
			...this._state,
			policy: { ...this._state.policy, ...policy },
		};
		this._saveState();
		this._onDidChangePolicy.fire(this._state.policy);
		this._onDidChangeState.fire();
	}

	getPolicy(): EnterprisePolicy {
		return this._state.policy;
	}

	isActionAllowed(action: string, _userId: string): boolean {
		switch (action) {
			case 'use-personal-api-keys':
				return this._state.policy.allowPersonalAPIKeys;
			case 'use-external-models':
				return this._state.policy.allowExternalModels;
			case 'export-code':
				return this._state.policy.allowCodeExport;
			default:
				return true;
		}
	}


	// ── Audit Logging ───────────────────────────────────────────────────────────

	logAction(userId: string, userEmail: string, action: string, resource: string, details?: Record<string, unknown>): void {
		const entry: AuditLogEntry = {
			id: generateUuid(),
			timestamp: Date.now(),
			userId,
			userEmail,
			action,
			resource,
			details,
		};
		this._state = {
			...this._state,
			auditLog: [...this._state.auditLog, entry],
		};
		// Keep only last 10000 entries in memory
		if (this._state.auditLog.length > 10000) {
			this._state.auditLog = this._state.auditLog.slice(-10000);
		}
		this._onDidChangeState.fire();
	}

	getAuditLog(filters?: { userId?: string; action?: string; from?: number; to?: number }): AuditLogEntry[] {
		let log = this._state.auditLog;
		if (filters) {
			if (filters.userId) log = log.filter(e => e.userId === filters.userId);
			if (filters.action) log = log.filter(e => e.action === filters.action);
			if (filters.from) log = log.filter(e => e.timestamp >= filters.from!);
			if (filters.to) log = log.filter(e => e.timestamp <= filters.to!);
		}
		return log;
	}

	exportAuditLog(format: 'json' | 'csv'): string {
		if (format === 'json') {
			return JSON.stringify(this._state.auditLog, null, 2);
		}
		const headers = 'id,timestamp,userId,userEmail,action,resource\n';
		const rows = this._state.auditLog.map(e =>
			`${e.id},${new Date(e.timestamp).toISOString()},${e.userId},${e.userEmail},${e.action},${e.resource}`
		).join('\n');
		return headers + rows;
	}


	// ── Usage Metrics ───────────────────────────────────────────────────────────

	getUsageMetrics(_period?: UsageMetrics['period']): UsageMetrics | null {
		return this._state.usageMetrics;
	}

	trackUsage(model: string, userId: string, tokens: number, latencyMs: number): void {
		if (!this._state.usageMetrics) {
			const now = Date.now();
			this._state.usageMetrics = {
				totalRequests: 0,
				totalTokensUsed: 0,
				requestsByModel: {},
				requestsByUser: {},
				averageLatencyMs: 0,
				errorRate: 0,
				period: 'daily',
				startDate: now,
				endDate: now + (24 * 60 * 60 * 1000),
			};
		}

		const metrics = this._state.usageMetrics;
		const totalReqs = metrics.totalRequests + 1;
		metrics.averageLatencyMs = ((metrics.averageLatencyMs * metrics.totalRequests) + latencyMs) / totalReqs;
		metrics.totalRequests = totalReqs;
		metrics.totalTokensUsed += tokens;
		metrics.requestsByModel[model] = (metrics.requestsByModel[model] ?? 0) + 1;
		metrics.requestsByUser[userId] = (metrics.requestsByUser[userId] ?? 0) + 1;

		this._state = { ...this._state, usageMetrics: { ...metrics } };
		this._onDidChangeState.fire();
	}


	// ─── Cursor Ultra: Background Agents ────────────────────────────────────────

	createBackgroundAgent(agent: Omit<BackgroundAgent, 'id' | 'status'>): BackgroundAgent {
		const newAgent: BackgroundAgent = {
			...agent,
			id: generateUuid(),
			status: 'idle',
		};
		this._state = {
			...this._state,
			ultraFeatures: {
				...this._state.ultraFeatures,
				backgroundAgents: [...this._state.ultraFeatures.backgroundAgents, newAgent],
			},
		};
		this._onDidChangeState.fire();
		return newAgent;
	}

	async runBackgroundAgent(agentId: string): Promise<string> {
		const agents = this._state.ultraFeatures.backgroundAgents;
		const idx = agents.findIndex(a => a.id === agentId);
		if (idx === -1) throw new Error(`Background agent ${agentId} not found`);

		const agent = agents[idx];
		const updated = { ...agent, status: 'running' as const, lastRunAt: Date.now() };
		this._updateAgent(idx, updated);

		try {
			const response = await fetch(`${RAINYMODEL_ENDPOINT}/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'rainymodel/agent',
					messages: [
						{
							role: 'system',
							content: `You are a background ${agent.type} agent named "${agent.name}". Perform the requested task thoroughly.`,
						},
						{
							role: 'user',
							content: JSON.stringify(agent.config),
						},
					],
					temperature: 0.3,
					max_tokens: 4096,
				}),
			});

			if (!response.ok) throw new Error(`Agent execution failed: ${response.status}`);
			const data = await response.json();
			const result = data.choices?.[0]?.message?.content ?? '';

			const completed = { ...updated, status: 'completed' as const, lastResult: result };
			this._updateAgent(idx, completed);
			this._onDidBackgroundAgentComplete.fire(completed);
			return result;
		} catch (e) {
			const errored = { ...updated, status: 'error' as const, lastResult: `Error: ${e}` };
			this._updateAgent(idx, errored);
			throw e;
		}
	}

	stopBackgroundAgent(agentId: string): void {
		const idx = this._state.ultraFeatures.backgroundAgents.findIndex(a => a.id === agentId);
		if (idx === -1) return;
		this._updateAgent(idx, {
			...this._state.ultraFeatures.backgroundAgents[idx],
			status: 'idle',
		});
	}

	getBackgroundAgents(): BackgroundAgent[] {
		return this._state.ultraFeatures.backgroundAgents;
	}

	private _updateAgent(idx: number, agent: BackgroundAgent): void {
		const agents = [...this._state.ultraFeatures.backgroundAgents];
		agents[idx] = agent;
		this._state = {
			...this._state,
			ultraFeatures: { ...this._state.ultraFeatures, backgroundAgents: agents },
		};
		this._onDidChangeState.fire();
	}


	// ─── Cursor Ultra: Multi-File Editing ───────────────────────────────────────

	async startMultiFileEdit(files: string[], description: string): Promise<MultiFileEditSession> {
		const session: MultiFileEditSession = {
			id: generateUuid(),
			files,
			description,
			status: 'planning',
			changes: [],
			createdAt: Date.now(),
		};

		this._state = {
			...this._state,
			ultraFeatures: {
				...this._state.ultraFeatures,
				multiFileEditSessions: [...this._state.ultraFeatures.multiFileEditSessions, session],
			},
		};
		this._onDidChangeState.fire();

		// Use RainyModel to plan the edit
		try {
			const response = await fetch(`${RAINYMODEL_ENDPOINT}/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'rainymodel/code',
					messages: [
						{
							role: 'system',
							content: 'You are a multi-file code editor. Plan changes across multiple files based on the description. Return a JSON array of {filePath, description} objects.',
						},
						{
							role: 'user',
							content: `Files: ${files.join(', ')}\n\nDescription: ${description}`,
						},
					],
					temperature: 0.3,
					max_tokens: 2048,
				}),
			});

			if (response.ok) {
				session.status = 'editing';
				this._updateSession(session);
			}
		} catch {
			// Planning failed, keep session in planning status
		}

		return session;
	}

	async applyMultiFileEdit(sessionId: string): Promise<void> {
		const session = this._state.ultraFeatures.multiFileEditSessions.find(s => s.id === sessionId);
		if (!session) throw new Error(`Session ${sessionId} not found`);
		const updated = { ...session, status: 'applied' as const };
		updated.changes = updated.changes.map(c => ({ ...c, applied: true }));
		this._updateSession(updated);
	}

	async revertMultiFileEdit(sessionId: string): Promise<void> {
		const session = this._state.ultraFeatures.multiFileEditSessions.find(s => s.id === sessionId);
		if (!session) throw new Error(`Session ${sessionId} not found`);
		const updated = { ...session, status: 'reverted' as const };
		updated.changes = updated.changes.map(c => ({ ...c, applied: false }));
		this._updateSession(updated);
	}

	getMultiFileEditSessions(): MultiFileEditSession[] {
		return this._state.ultraFeatures.multiFileEditSessions;
	}

	private _updateSession(session: MultiFileEditSession): void {
		const sessions = this._state.ultraFeatures.multiFileEditSessions.map(s =>
			s.id === session.id ? session : s
		);
		this._state = {
			...this._state,
			ultraFeatures: { ...this._state.ultraFeatures, multiFileEditSessions: sessions },
		};
		this._onDidChangeState.fire();
	}


	// ─── Cursor Ultra: Parallel Completions ─────────────────────────────────────

	async runParallelCompletion(prompt: string, models?: string[]): Promise<ParallelCompletion> {
		const targetModels = models ?? ['rainymodel/chat', 'rainymodel/code', 'rainymodel/agent'];

		const completion: ParallelCompletion = {
			id: generateUuid(),
			prompt,
			models: targetModels,
			results: [],
			status: 'pending',
		};

		// Run completions in parallel across multiple models
		const promises = targetModels.map(async (model) => {
			const start = Date.now();
			try {
				const response = await fetch(`${RAINYMODEL_ENDPOINT}/chat/completions`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model,
						messages: [{ role: 'user', content: prompt }],
						temperature: 0.7,
						max_tokens: 2048,
					}),
				});

				if (!response.ok) throw new Error(`${response.status}`);
				const data = await response.json();
				const content = data.choices?.[0]?.message?.content ?? '';
				const tokenCount = data.usage?.total_tokens ?? 0;

				return {
					model,
					content,
					latencyMs: Date.now() - start,
					tokenCount,
				};
			} catch {
				return {
					model,
					content: '',
					latencyMs: Date.now() - start,
					tokenCount: 0,
				};
			}
		});

		const results = await Promise.allSettled(promises);
		completion.results = results
			.filter((r): r is PromiseFulfilledResult<ParallelCompletion['results'][0]> => r.status === 'fulfilled')
			.map(r => r.value)
			.filter(r => r.content.length > 0);

		completion.status = completion.results.length === targetModels.length ? 'completed' : 'partial';

		return completion;
	}

	selectCompletionResult(completionId: string, _model: string): void {
		// Track which model the user preferred for future optimization
		this.logAction('system', '', 'select-completion', completionId, { model: _model });
	}


	// ─── Cursor Ultra: Toggles ──────────────────────────────────────────────────

	togglePredictiveEditing(enabled: boolean): void {
		this._state = {
			...this._state,
			ultraFeatures: { ...this._state.ultraFeatures, predictiveEditingEnabled: enabled },
		};
		this._saveState();
		this._onDidChangeState.fire();
	}

	toggleSmartContextWindow(enabled: boolean): void {
		this._state = {
			...this._state,
			ultraFeatures: { ...this._state.ultraFeatures, smartContextWindowEnabled: enabled },
		};
		this._saveState();
		this._onDidChangeState.fire();
	}

	toggleBugDetection(enabled: boolean): void {
		this._state = {
			...this._state,
			ultraFeatures: { ...this._state.ultraFeatures, bugDetectionEnabled: enabled },
		};
		this._saveState();
		this._onDidChangeState.fire();
	}
}


// ─── Registration ───────────────────────────────────────────────────────────────

registerSingleton(IOrcideEnterpriseService, OrcideEnterpriseService, InstantiationType.Eager);
