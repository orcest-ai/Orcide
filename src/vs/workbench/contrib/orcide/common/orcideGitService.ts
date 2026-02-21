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

// ─── Git & PR Integration for Orcide ─────────────────────────────────────────

const ORCIDE_GIT_STORAGE_KEY = 'orcide.gitIntegrationState';

export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'gitea';

export type GitRemoteConfig = {
	provider: GitProvider;
	owner: string;
	repo: string;
	defaultBranch: string;
	apiBaseUrl: string;
	token?: string;
};

export type PullRequestDraft = {
	title: string;
	body: string;
	sourceBranch: string;
	targetBranch: string;
	labels?: string[];
	reviewers?: string[];
	assignees?: string[];
	isDraft: boolean;
};

export type PullRequest = {
	id: string;
	number: number;
	title: string;
	body: string;
	state: 'open' | 'closed' | 'merged';
	sourceBranch: string;
	targetBranch: string;
	author: string;
	labels: string[];
	reviewers: string[];
	assignees: string[];
	isDraft: boolean;
	url: string;
	createdAt: number;
	updatedAt: number;
	mergedAt?: number;
};

export type DeploymentTarget = {
	id: string;
	name: string;
	type: 'render' | 'vercel' | 'netlify' | 'custom';
	url: string;
	branch: string;
	autoDeployEnabled: boolean;
	lastDeployedAt?: number;
	lastDeployStatus?: 'success' | 'failed' | 'in_progress' | 'cancelled';
};

export type Deployment = {
	id: string;
	targetId: string;
	commitSha: string;
	branch: string;
	status: 'queued' | 'building' | 'deploying' | 'success' | 'failed' | 'cancelled';
	url?: string;
	logs?: string;
	startedAt: number;
	completedAt?: number;
};

export type BranchInfo = {
	name: string;
	isDefault: boolean;
	lastCommitSha: string;
	lastCommitMessage: string;
	lastCommitAuthor: string;
	lastCommitDate: number;
	aheadOfDefault: number;
	behindDefault: number;
};

export type CommitInfo = {
	sha: string;
	message: string;
	author: string;
	authorEmail: string;
	date: number;
	files: string[];
};

export type GitServiceState = {
	remote: GitRemoteConfig | null;
	pullRequests: PullRequest[];
	deploymentTargets: DeploymentTarget[];
	deployments: Deployment[];
	currentBranch: string | null;
	branches: BranchInfo[];
	isConnected: boolean;
};


// ─── Service Interface ──────────────────────────────────────────────────────────

export interface IOrcideGitService {
	readonly _serviceBrand: undefined;
	readonly state: GitServiceState;
	onDidChangeState: Event<void>;
	onDidCreatePR: Event<PullRequest>;
	onDidDeploymentUpdate: Event<Deployment>;

	// Remote configuration
	configureRemote(config: GitRemoteConfig): void;
	disconnectRemote(): void;
	testRemoteConnection(): Promise<boolean>;

	// Branch operations
	getCurrentBranch(): string | null;
	listBranches(): Promise<BranchInfo[]>;
	createBranch(name: string, fromBranch?: string): Promise<BranchInfo>;
	switchBranch(name: string): Promise<void>;
	deleteBranch(name: string): Promise<void>;

	// Commit operations
	getRecentCommits(branch?: string, limit?: number): Promise<CommitInfo[]>;
	generateCommitMessage(diff: string): Promise<string>;

	// Pull Request operations
	createPullRequest(draft: PullRequestDraft): Promise<PullRequest>;
	updatePullRequest(prId: string, updates: Partial<PullRequestDraft>): Promise<PullRequest>;
	mergePullRequest(prId: string, strategy?: 'merge' | 'squash' | 'rebase'): Promise<PullRequest>;
	closePullRequest(prId: string): Promise<void>;
	listPullRequests(state?: 'open' | 'closed' | 'all'): Promise<PullRequest[]>;
	getPullRequest(prNumber: number): Promise<PullRequest | null>;
	generatePRDescription(sourceBranch: string, targetBranch: string): Promise<string>;

	// Deployment operations
	addDeploymentTarget(target: Omit<DeploymentTarget, 'id'>): DeploymentTarget;
	removeDeploymentTarget(targetId: string): void;
	triggerDeployment(targetId: string, branch?: string): Promise<Deployment>;
	getDeploymentStatus(deploymentId: string): Promise<Deployment>;
	listDeployments(targetId?: string): Deployment[];
	cancelDeployment(deploymentId: string): Promise<void>;
}

export const IOrcideGitService = createDecorator<IOrcideGitService>('orcideGitService');


// ─── Orcest API Endpoints ───────────────────────────────────────────────────────

const ORCEST_GIT_API = 'https://api.orcest.ai/v1/git';
const RAINYMODEL_ENDPOINT = 'https://rm.orcest.ai/v1';

// ─── Service Implementation ─────────────────────────────────────────────────────

class OrcideGitService extends Disposable implements IOrcideGitService {
	readonly _serviceBrand: undefined;

	private _state: GitServiceState;

	private readonly _onDidChangeState = this._register(new Emitter<void>());
	readonly onDidChangeState: Event<void> = this._onDidChangeState.event;

	private readonly _onDidCreatePR = this._register(new Emitter<PullRequest>());
	readonly onDidCreatePR: Event<PullRequest> = this._onDidCreatePR.event;

	private readonly _onDidDeploymentUpdate = this._register(new Emitter<Deployment>());
	readonly onDidDeploymentUpdate: Event<Deployment> = this._onDidDeploymentUpdate.event;

	get state(): GitServiceState {
		return this._state;
	}

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
		this._state = {
			remote: null,
			pullRequests: [],
			deploymentTargets: [],
			deployments: [],
			currentBranch: null,
			branches: [],
			isConnected: false,
		};
		this._loadFromStorage();
	}

	private _loadFromStorage(): void {
		const stored = this._storageService.get(ORCIDE_GIT_STORAGE_KEY, StorageScope.APPLICATION);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				this._state = { ...this._state, ...parsed };
			} catch { /* ignore */ }
		}
		this._onDidChangeState.fire();
	}

	private _saveState(): void {
		const toStore = {
			remote: this._state.remote,
			deploymentTargets: this._state.deploymentTargets,
		};
		this._storageService.store(ORCIDE_GIT_STORAGE_KEY, JSON.stringify(toStore), StorageScope.APPLICATION, StorageTarget.USER);
	}


	// ── Remote Configuration ────────────────────────────────────────────────────

	configureRemote(config: GitRemoteConfig): void {
		this._state = { ...this._state, remote: config };
		this._saveState();
		this._onDidChangeState.fire();
	}

	disconnectRemote(): void {
		this._state = {
			...this._state,
			remote: null,
			pullRequests: [],
			branches: [],
			currentBranch: null,
			isConnected: false,
		};
		this._saveState();
		this._onDidChangeState.fire();
	}

	async testRemoteConnection(): Promise<boolean> {
		if (!this._state.remote) return false;
		try {
			const { provider, apiBaseUrl, owner, repo, token } = this._state.remote;
			let url: string;
			switch (provider) {
				case 'github':
					url = `${apiBaseUrl || 'https://api.github.com'}/repos/${owner}/${repo}`;
					break;
				case 'gitlab':
					url = `${apiBaseUrl || 'https://gitlab.com/api/v4'}/projects/${encodeURIComponent(`${owner}/${repo}`)}`;
					break;
				case 'bitbucket':
					url = `${apiBaseUrl || 'https://api.bitbucket.org/2.0'}/repositories/${owner}/${repo}`;
					break;
				case 'gitea':
					url = `${apiBaseUrl}/repos/${owner}/${repo}`;
					break;
			}
			const headers: Record<string, string> = { 'Accept': 'application/json' };
			if (token) {
				headers['Authorization'] = provider === 'gitlab' ? `Bearer ${token}` : `token ${token}`;
			}
			const response = await fetch(url, { headers });
			const connected = response.ok;
			this._state = { ...this._state, isConnected: connected };
			this._onDidChangeState.fire();
			return connected;
		} catch {
			this._state = { ...this._state, isConnected: false };
			this._onDidChangeState.fire();
			return false;
		}
	}


	// ── Branch Operations ───────────────────────────────────────────────────────

	getCurrentBranch(): string | null {
		return this._state.currentBranch;
	}

	async listBranches(): Promise<BranchInfo[]> {
		if (!this._state.remote) throw new Error('No remote configured');
		const { provider, apiBaseUrl, owner, repo, token } = this._state.remote;
		const headers: Record<string, string> = { 'Accept': 'application/json' };
		if (token) {
			headers['Authorization'] = provider === 'gitlab' ? `Bearer ${token}` : `token ${token}`;
		}

		let url: string;
		switch (provider) {
			case 'github':
				url = `${apiBaseUrl || 'https://api.github.com'}/repos/${owner}/${repo}/branches`;
				break;
			case 'gitlab':
				url = `${apiBaseUrl || 'https://gitlab.com/api/v4'}/projects/${encodeURIComponent(`${owner}/${repo}`)}/repository/branches`;
				break;
			default:
				url = `${apiBaseUrl}/repos/${owner}/${repo}/branches`;
		}

		const response = await fetch(url, { headers });
		if (!response.ok) throw new Error(`Failed to list branches: ${response.status}`);
		const data = await response.json();

		const branches: BranchInfo[] = (data as Array<Record<string, unknown>>).map((b: Record<string, unknown>) => ({
			name: (b.name as string) ?? '',
			isDefault: b.name === this._state.remote?.defaultBranch,
			lastCommitSha: ((b.commit as Record<string, unknown>)?.sha as string) ?? '',
			lastCommitMessage: (((b.commit as Record<string, unknown>)?.commit as Record<string, unknown>)?.message as string) ?? '',
			lastCommitAuthor: ((((b.commit as Record<string, unknown>)?.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.name as string) ?? '',
			lastCommitDate: Date.now(),
			aheadOfDefault: 0,
			behindDefault: 0,
		}));

		this._state = { ...this._state, branches };
		this._onDidChangeState.fire();
		return branches;
	}

	async createBranch(name: string, _fromBranch?: string): Promise<BranchInfo> {
		const branch: BranchInfo = {
			name,
			isDefault: false,
			lastCommitSha: '',
			lastCommitMessage: '',
			lastCommitAuthor: '',
			lastCommitDate: Date.now(),
			aheadOfDefault: 0,
			behindDefault: 0,
		};
		this._state = {
			...this._state,
			branches: [...this._state.branches, branch],
			currentBranch: name,
		};
		this._onDidChangeState.fire();
		return branch;
	}

	async switchBranch(name: string): Promise<void> {
		this._state = { ...this._state, currentBranch: name };
		this._onDidChangeState.fire();
	}

	async deleteBranch(name: string): Promise<void> {
		this._state = {
			...this._state,
			branches: this._state.branches.filter(b => b.name !== name),
		};
		this._onDidChangeState.fire();
	}


	// ── Commit Operations ───────────────────────────────────────────────────────

	async getRecentCommits(branch?: string, limit?: number): Promise<CommitInfo[]> {
		if (!this._state.remote) throw new Error('No remote configured');
		const { provider, apiBaseUrl, owner, repo, token } = this._state.remote;
		const headers: Record<string, string> = { 'Accept': 'application/json' };
		if (token) {
			headers['Authorization'] = provider === 'gitlab' ? `Bearer ${token}` : `token ${token}`;
		}

		const branchName = branch ?? this._state.remote.defaultBranch;
		const perPage = limit ?? 20;

		let url: string;
		switch (provider) {
			case 'github':
				url = `${apiBaseUrl || 'https://api.github.com'}/repos/${owner}/${repo}/commits?sha=${branchName}&per_page=${perPage}`;
				break;
			default:
				url = `${apiBaseUrl}/repos/${owner}/${repo}/commits?sha=${branchName}&limit=${perPage}`;
		}

		const response = await fetch(url, { headers });
		if (!response.ok) throw new Error(`Failed to get commits: ${response.status}`);
		const data = await response.json();

		return (data as Array<Record<string, unknown>>).map((c: Record<string, unknown>) => ({
			sha: (c.sha as string) ?? '',
			message: (((c.commit as Record<string, unknown>)?.message as string) ?? ''),
			author: ((((c.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.name as string) ?? ''),
			authorEmail: ((((c.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.email as string) ?? ''),
			date: Date.now(),
			files: [],
		}));
	}

	async generateCommitMessage(diff: string): Promise<string> {
		try {
			const response = await fetch(`${RAINYMODEL_ENDPOINT}/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'rainymodel/code',
					messages: [
						{
							role: 'system',
							content: 'You are a helpful assistant that generates concise, descriptive git commit messages. Follow conventional commit format (feat, fix, refactor, docs, chore, etc). Output only the commit message, nothing else.',
						},
						{
							role: 'user',
							content: `Generate a commit message for the following diff:\n\n${diff}`,
						},
					],
					temperature: 0.3,
					max_tokens: 200,
				}),
			});
			if (!response.ok) throw new Error(`Failed to generate commit message: ${response.status}`);
			const data = await response.json();
			return data.choices?.[0]?.message?.content?.trim() ?? 'chore: update code';
		} catch {
			return 'chore: update code';
		}
	}


	// ── Pull Request Operations ─────────────────────────────────────────────────

	async createPullRequest(draft: PullRequestDraft): Promise<PullRequest> {
		if (!this._state.remote) throw new Error('No remote configured');
		const { provider, apiBaseUrl, owner, repo, token } = this._state.remote;
		const headers: Record<string, string> = {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		};
		if (token) {
			headers['Authorization'] = provider === 'gitlab' ? `Bearer ${token}` : `token ${token}`;
		}

		let url: string;
		let body: Record<string, unknown>;

		switch (provider) {
			case 'github':
				url = `${apiBaseUrl || 'https://api.github.com'}/repos/${owner}/${repo}/pulls`;
				body = {
					title: draft.title,
					body: draft.body,
					head: draft.sourceBranch,
					base: draft.targetBranch,
					draft: draft.isDraft,
				};
				break;
			case 'gitlab':
				url = `${apiBaseUrl || 'https://gitlab.com/api/v4'}/projects/${encodeURIComponent(`${owner}/${repo}`)}/merge_requests`;
				body = {
					title: draft.title,
					description: draft.body,
					source_branch: draft.sourceBranch,
					target_branch: draft.targetBranch,
				};
				break;
			default:
				url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls`;
				body = {
					title: draft.title,
					body: draft.body,
					head: draft.sourceBranch,
					base: draft.targetBranch,
				};
		}

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to create PR: ${response.status} - ${errorText}`);
		}

		const data = await response.json() as Record<string, unknown>;
		const now = Date.now();

		const pr: PullRequest = {
			id: generateUuid(),
			number: (data.number as number) ?? (data.iid as number) ?? 0,
			title: draft.title,
			body: draft.body,
			state: 'open',
			sourceBranch: draft.sourceBranch,
			targetBranch: draft.targetBranch,
			author: '',
			labels: draft.labels ?? [],
			reviewers: draft.reviewers ?? [],
			assignees: draft.assignees ?? [],
			isDraft: draft.isDraft,
			url: (data.html_url as string) ?? (data.web_url as string) ?? '',
			createdAt: now,
			updatedAt: now,
		};

		this._state = {
			...this._state,
			pullRequests: [...this._state.pullRequests, pr],
		};
		this._onDidCreatePR.fire(pr);
		this._onDidChangeState.fire();
		return pr;
	}

	async updatePullRequest(prId: string, updates: Partial<PullRequestDraft>): Promise<PullRequest> {
		const prIndex = this._state.pullRequests.findIndex(p => p.id === prId);
		if (prIndex === -1) throw new Error(`PR ${prId} not found`);

		const existing = this._state.pullRequests[prIndex];
		const updated: PullRequest = {
			...existing,
			title: updates.title ?? existing.title,
			body: updates.body ?? existing.body,
			labels: updates.labels ?? existing.labels,
			reviewers: updates.reviewers ?? existing.reviewers,
			assignees: updates.assignees ?? existing.assignees,
			isDraft: updates.isDraft ?? existing.isDraft,
			updatedAt: Date.now(),
		};

		const pullRequests = [...this._state.pullRequests];
		pullRequests[prIndex] = updated;
		this._state = { ...this._state, pullRequests };
		this._onDidChangeState.fire();
		return updated;
	}

	async mergePullRequest(prId: string, _strategy?: 'merge' | 'squash' | 'rebase'): Promise<PullRequest> {
		const prIndex = this._state.pullRequests.findIndex(p => p.id === prId);
		if (prIndex === -1) throw new Error(`PR ${prId} not found`);

		const existing = this._state.pullRequests[prIndex];
		if (!this._state.remote) throw new Error('No remote configured');

		const { provider, apiBaseUrl, owner, repo, token } = this._state.remote;
		const headers: Record<string, string> = {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		};
		if (token) {
			headers['Authorization'] = provider === 'gitlab' ? `Bearer ${token}` : `token ${token}`;
		}

		let url: string;
		switch (provider) {
			case 'github':
				url = `${apiBaseUrl || 'https://api.github.com'}/repos/${owner}/${repo}/pulls/${existing.number}/merge`;
				break;
			case 'gitlab':
				url = `${apiBaseUrl || 'https://gitlab.com/api/v4'}/projects/${encodeURIComponent(`${owner}/${repo}`)}/merge_requests/${existing.number}/merge`;
				break;
			default:
				url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${existing.number}/merge`;
		}

		const response = await fetch(url, {
			method: 'PUT',
			headers,
			body: JSON.stringify({ merge_method: _strategy ?? 'merge' }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to merge PR: ${response.status} - ${errorText}`);
		}

		const merged: PullRequest = {
			...existing,
			state: 'merged',
			mergedAt: Date.now(),
			updatedAt: Date.now(),
		};

		const pullRequests = [...this._state.pullRequests];
		pullRequests[prIndex] = merged;
		this._state = { ...this._state, pullRequests };
		this._onDidChangeState.fire();
		return merged;
	}

	async closePullRequest(prId: string): Promise<void> {
		const prIndex = this._state.pullRequests.findIndex(p => p.id === prId);
		if (prIndex === -1) throw new Error(`PR ${prId} not found`);

		const pullRequests = [...this._state.pullRequests];
		pullRequests[prIndex] = {
			...pullRequests[prIndex],
			state: 'closed',
			updatedAt: Date.now(),
		};
		this._state = { ...this._state, pullRequests };
		this._onDidChangeState.fire();
	}

	async listPullRequests(state?: 'open' | 'closed' | 'all'): Promise<PullRequest[]> {
		if (state === 'all') return this._state.pullRequests;
		if (state) return this._state.pullRequests.filter(p => p.state === state);
		return this._state.pullRequests.filter(p => p.state === 'open');
	}

	async getPullRequest(prNumber: number): Promise<PullRequest | null> {
		return this._state.pullRequests.find(p => p.number === prNumber) ?? null;
	}

	async generatePRDescription(sourceBranch: string, targetBranch: string): Promise<string> {
		try {
			const commits = await this.getRecentCommits(sourceBranch, 10);
			const commitSummary = commits.map(c => `- ${c.message}`).join('\n');

			const response = await fetch(`${RAINYMODEL_ENDPOINT}/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'rainymodel/code',
					messages: [
						{
							role: 'system',
							content: 'You are a helpful assistant that generates clear, comprehensive pull request descriptions. Include a summary section and a changes section. Use markdown formatting.',
						},
						{
							role: 'user',
							content: `Generate a PR description for merging ${sourceBranch} into ${targetBranch}.\n\nRecent commits:\n${commitSummary}`,
						},
					],
					temperature: 0.5,
					max_tokens: 1000,
				}),
			});
			if (!response.ok) throw new Error(`Failed: ${response.status}`);
			const data = await response.json();
			return data.choices?.[0]?.message?.content ?? '';
		} catch {
			return `## Pull Request\n\nMerging \`${sourceBranch}\` into \`${targetBranch}\``;
		}
	}


	// ── Deployment Operations ───────────────────────────────────────────────────

	addDeploymentTarget(target: Omit<DeploymentTarget, 'id'>): DeploymentTarget {
		const newTarget: DeploymentTarget = {
			...target,
			id: generateUuid(),
		};
		this._state = {
			...this._state,
			deploymentTargets: [...this._state.deploymentTargets, newTarget],
		};
		this._saveState();
		this._onDidChangeState.fire();
		return newTarget;
	}

	removeDeploymentTarget(targetId: string): void {
		this._state = {
			...this._state,
			deploymentTargets: this._state.deploymentTargets.filter(t => t.id !== targetId),
		};
		this._saveState();
		this._onDidChangeState.fire();
	}

	async triggerDeployment(targetId: string, branch?: string): Promise<Deployment> {
		const target = this._state.deploymentTargets.find(t => t.id === targetId);
		if (!target) throw new Error(`Deployment target ${targetId} not found`);

		const deployment: Deployment = {
			id: generateUuid(),
			targetId,
			commitSha: '',
			branch: branch ?? target.branch,
			status: 'queued',
			startedAt: Date.now(),
		};

		this._state = {
			...this._state,
			deployments: [...this._state.deployments, deployment],
		};
		this._onDidDeploymentUpdate.fire(deployment);
		this._onDidChangeState.fire();

		// Trigger deployment via Orcest API
		try {
			const response = await fetch(`${ORCEST_GIT_API}/deploy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: target.type,
					targetUrl: target.url,
					branch: deployment.branch,
					targetName: target.name,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				const updated: Deployment = {
					...deployment,
					status: 'building',
					commitSha: (data as Record<string, string>).commitSha ?? '',
					url: (data as Record<string, string>).deployUrl,
				};
				this._updateDeployment(updated);
				return updated;
			}
		} catch {
			// Deployment trigger failed, mark as failed
			const failed: Deployment = { ...deployment, status: 'failed', completedAt: Date.now() };
			this._updateDeployment(failed);
			return failed;
		}

		return deployment;
	}

	async getDeploymentStatus(deploymentId: string): Promise<Deployment> {
		const deployment = this._state.deployments.find(d => d.id === deploymentId);
		if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);
		return deployment;
	}

	listDeployments(targetId?: string): Deployment[] {
		if (targetId) return this._state.deployments.filter(d => d.targetId === targetId);
		return this._state.deployments;
	}

	async cancelDeployment(deploymentId: string): Promise<void> {
		const deployment = this._state.deployments.find(d => d.id === deploymentId);
		if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);
		this._updateDeployment({
			...deployment,
			status: 'cancelled',
			completedAt: Date.now(),
		});
	}

	private _updateDeployment(updated: Deployment): void {
		const deployments = this._state.deployments.map(d =>
			d.id === updated.id ? updated : d
		);
		this._state = { ...this._state, deployments };
		this._onDidDeploymentUpdate.fire(updated);
		this._onDidChangeState.fire();
	}
}


// ─── Registration ───────────────────────────────────────────────────────────────

registerSingleton(IOrcideGitService, OrcideGitService, InstantiationType.Eager);
