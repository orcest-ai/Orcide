/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * OAuth2/OIDC SSO authentication for Orcide.
 * Handles authentication flow with login.orcest.ai.
 *
 * Flow:
 *  1. On IDE load, check for existing SSO token in storage.
 *  2. If no valid token, redirect browser to login.orcest.ai authorization endpoint.
 *  3. After successful login, the IdP redirects back with an authorization code.
 *  4. Exchange the code for tokens (access, refresh, id).
 *  5. Fetch user profile from the userinfo endpoint.
 *  6. Store tokens + user info, fire state change event.
 *  7. On subsequent loads, verify token validity and refresh if needed.
 *  8. Display user name in status bar; block IDE without valid token.
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { isWeb } from '../../../../base/common/platform.js';

import {
	SSOAuthState,
	SSOTokenResponse,
	SSOUser,
	defaultSSOAuthState,
} from '../common/ssoTypes.js';

import { SSO_AUTH_STORAGE_KEY } from '../common/storageKeys.js';


// ========================== Constants ==========================

const SSO_ISSUER = 'https://login.orcest.ai';
const SSO_CLIENT_ID = 'orcide';
const SSO_CALLBACK_URL = 'https://ide.orcest.ai/callback';

/** OAuth2 endpoints (derived from OIDC discovery) */
const SSO_ENDPOINTS = {
	authorization: `${SSO_ISSUER}/oauth2/authorize`,
	token: `${SSO_ISSUER}/oauth2/token`,
	userinfo: `${SSO_ISSUER}/oauth2/userinfo`,
	endSession: `${SSO_ISSUER}/oauth2/logout`,
	revoke: `${SSO_ISSUER}/oauth2/revoke`,
} as const;

/** Default scopes requested during authorization */
const SSO_SCOPES = 'openid profile email';

/** Buffer in ms before actual expiry to trigger refresh (5 minutes) */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Interval in ms to check token expiry (60 seconds) */
const TOKEN_CHECK_INTERVAL_MS = 60 * 1000;


// ========================== Service Interface ==========================

export interface IOrcestSSOService {
	readonly _serviceBrand: undefined;

	/** Current authentication state */
	readonly state: SSOAuthState;

	/** Fires when authentication state changes */
	readonly onDidChangeState: Event<SSOAuthState>;

	/**
	 * Build the OAuth2 authorization URL.
	 * @param state Optional opaque state parameter for CSRF protection.
	 * @returns The full authorization URL to redirect the user to.
	 */
	getAuthorizationUrl(state?: string): string;

	/**
	 * Exchange an authorization code for tokens.
	 * @param code The authorization code from the callback.
	 * @param clientSecret The client secret (for confidential clients).
	 * @returns The raw token response from the IdP.
	 */
	exchangeCodeForToken(code: string, clientSecret?: string): Promise<SSOTokenResponse>;

	/**
	 * Verify a token against the SSO server.
	 * @param token The access token to verify.
	 * @returns The user profile if the token is valid, or null if invalid.
	 */
	verifyToken(token: string): Promise<SSOUser | null>;

	/**
	 * Get the user profile from the userinfo endpoint.
	 * @param token The access token.
	 * @returns The authenticated user's profile.
	 */
	getUserInfo(token: string): Promise<SSOUser>;

	/**
	 * Refresh the access token using the stored refresh token.
	 * @returns The new token response, or null if refresh failed.
	 */
	refreshAccessToken(): Promise<SSOTokenResponse | null>;

	/**
	 * Initialize SSO: check stored token, handle callback, or redirect to login.
	 * Should be called on IDE startup.
	 */
	initialize(): Promise<void>;

	/**
	 * Log the user out: clear tokens, optionally redirect to IdP logout.
	 * @param redirectToIdP Whether to redirect to the IdP's logout endpoint.
	 */
	logout(redirectToIdP?: boolean): Promise<void>;

	/**
	 * Check if the current token is still valid (not expired).
	 */
	isTokenValid(): boolean;
}

export const IOrcestSSOService = createDecorator<IOrcestSSOService>('OrcestSSOService');


// ========================== Implementation ==========================

class OrcestSSOAuth extends Disposable implements IOrcestSSOService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = new Emitter<SSOAuthState>();
	readonly onDidChangeState: Event<SSOAuthState> = this._onDidChangeState.event;

	private _state: SSOAuthState;
	private _tokenCheckTimer: ReturnType<typeof setInterval> | null = null;

	get state(): SSOAuthState {
		return this._state;
	}

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
		this._state = { ...defaultSSOAuthState };
	}


	// ---- Authorization URL ----

	getAuthorizationUrl(state?: string): string {
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: SSO_CLIENT_ID,
			redirect_uri: SSO_CALLBACK_URL,
			scope: SSO_SCOPES,
		});

		if (state) {
			params.set('state', state);
		}

		// Generate and store a nonce for OIDC ID token validation
		const nonce = this._generateNonce();
		params.set('nonce', nonce);
		this._storeNonce(nonce);

		return `${SSO_ENDPOINTS.authorization}?${params.toString()}`;
	}


	// ---- Token Exchange ----

	async exchangeCodeForToken(code: string, clientSecret?: string): Promise<SSOTokenResponse> {
		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: SSO_CALLBACK_URL,
			client_id: SSO_CLIENT_ID,
		});

		if (clientSecret) {
			body.set('client_secret', clientSecret);
		}

		const response = await fetch(SSO_ENDPOINTS.token, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: body.toString(),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
		}

		const tokenResponse: SSOTokenResponse = await response.json();
		return tokenResponse;
	}


	// ---- Token Verification ----

	async verifyToken(token: string): Promise<SSOUser | null> {
		try {
			const user = await this.getUserInfo(token);
			return user;
		} catch {
			return null;
		}
	}


	// ---- User Info ----

	async getUserInfo(token: string): Promise<SSOUser> {
		const response = await fetch(SSO_ENDPOINTS.userinfo, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to fetch user info (${response.status}): ${errorText}`);
		}

		const userInfo: SSOUser = await response.json();
		return userInfo;
	}


	// ---- Token Refresh ----

	async refreshAccessToken(): Promise<SSOTokenResponse | null> {
		const refreshToken = this._state.refreshToken;
		if (!refreshToken) {
			return null;
		}

		try {
			const body = new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: SSO_CLIENT_ID,
			});

			const response = await fetch(SSO_ENDPOINTS.token, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: body.toString(),
			});

			if (!response.ok) {
				console.error('[OrcestSSO] Token refresh failed:', response.status);
				return null;
			}

			const tokenResponse: SSOTokenResponse = await response.json();

			// Update state with new tokens
			await this._handleTokenResponse(tokenResponse);

			return tokenResponse;
		} catch (err) {
			console.error('[OrcestSSO] Token refresh error:', err);
			return null;
		}
	}


	// ---- Initialization ----

	async initialize(): Promise<void> {
		// Step 1: Try to restore from storage
		const restored = this._restoreFromStorage();

		if (restored && this.isTokenValid()) {
			// Token is still valid - verify it against the server
			this._updateState({
				...this._state,
				isAuthenticated: true,
			});

			// Verify in background (don't block startup)
			this._verifyInBackground();

			// Start periodic token check
			this._startTokenCheck();

			return;
		}

		if (restored && this._state.refreshToken) {
			// Token expired but we have a refresh token - try to refresh
			this._updateState({
				...defaultSSOAuthState,
				isAuthenticated: false,
				refreshToken: this._state.refreshToken,
			});

			const refreshed = await this.refreshAccessToken();
			if (refreshed) {
				this._startTokenCheck();
				return;
			}
		}

		// Step 2: Check if this is a callback from the IdP
		if (isWeb) {
			const targetWindow = getActiveWindow();
			const url = new URL(targetWindow.location.href);
			const code = url.searchParams.get('code');
			const stateParam = url.searchParams.get('state');

			if (code) {
				try {
					// Exchange code for tokens
					const tokenResponse = await this.exchangeCodeForToken(code);
					await this._handleTokenResponse(tokenResponse);

					// Clean up the URL (remove code and state params)
					url.searchParams.delete('code');
					url.searchParams.delete('state');
					url.searchParams.delete('session_state');
					targetWindow.history.replaceState({}, '', url.toString());

					this._startTokenCheck();
					return;
				} catch (err) {
					console.error('[OrcestSSO] Code exchange failed:', err);
					this._updateState({
						...defaultSSOAuthState,
						isAuthenticated: false,
					});
				}
			}
		}

		// Step 3: No valid token and no callback - redirect to login
		if (isWeb) {
			this._redirectToLogin();
		}
	}


	// ---- Logout ----

	async logout(redirectToIdP: boolean = true): Promise<void> {
		const idToken = this._state.idToken;

		// Clear local state
		this._clearStorage();
		this._updateState({ ...defaultSSOAuthState });
		this._stopTokenCheck();

		// Optionally redirect to IdP logout
		if (redirectToIdP && isWeb) {
			const params = new URLSearchParams({
				client_id: SSO_CLIENT_ID,
				post_logout_redirect_uri: SSO_CALLBACK_URL,
			});

			if (idToken) {
				params.set('id_token_hint', idToken);
			}

			const targetWindow = getActiveWindow();
			targetWindow.location.href = `${SSO_ENDPOINTS.endSession}?${params.toString()}`;
		}
	}


	// ---- Token Validity Check ----

	isTokenValid(): boolean {
		if (!this._state.accessToken || !this._state.expiresAt) {
			return false;
		}
		return Date.now() < this._state.expiresAt;
	}


	// ========================== Private Methods ==========================

	private async _handleTokenResponse(tokenResponse: SSOTokenResponse): Promise<void> {
		const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);

		// Fetch user info with the new access token
		let user: SSOUser | null = null;
		try {
			user = await this.getUserInfo(tokenResponse.access_token);
		} catch (err) {
			console.error('[OrcestSSO] Failed to fetch user info after token exchange:', err);
		}

		const newState: SSOAuthState = {
			isAuthenticated: true,
			accessToken: tokenResponse.access_token,
			refreshToken: tokenResponse.refresh_token || this._state.refreshToken,
			idToken: tokenResponse.id_token || this._state.idToken,
			user,
			expiresAt,
		};

		this._updateState(newState);
		this._persistToStorage(newState);
	}


	private _updateState(newState: SSOAuthState): void {
		this._state = newState;
		this._onDidChangeState.fire(newState);
	}


	private _redirectToLogin(): void {
		// Generate a random state for CSRF protection
		const csrfState = this._generateNonce();
		this._storageService.store(
			'sso.csrf.state',
			csrfState,
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
		);

		const authUrl = this.getAuthorizationUrl(csrfState);

		const targetWindow = getActiveWindow();
		targetWindow.location.href = authUrl;
	}


	private _verifyInBackground(): void {
		const token = this._state.accessToken;
		if (!token) return;

		this.verifyToken(token).then((user) => {
			if (user) {
				// Update user info if it changed
				if (this._state.user?.sub !== user.sub ||
					this._state.user?.name !== user.name ||
					this._state.user?.email !== user.email) {
					const newState = { ...this._state, user };
					this._updateState(newState);
					this._persistToStorage(newState);
				}
			} else {
				// Token is invalid on the server side - try refresh
				this.refreshAccessToken().then((refreshed) => {
					if (!refreshed) {
						// Refresh also failed - redirect to login
						if (isWeb) {
							this._redirectToLogin();
						}
					}
				});
			}
		}).catch(() => {
			// Network error during verification - don't log out, may be transient
			console.warn('[OrcestSSO] Background token verification failed (network error)');
		});
	}


	// ---- Token Refresh Timer ----

	private _startTokenCheck(): void {
		this._stopTokenCheck();

		this._tokenCheckTimer = setInterval(() => {
			if (!this._state.accessToken || !this._state.expiresAt) {
				return;
			}

			const timeUntilExpiry = this._state.expiresAt - Date.now();

			if (timeUntilExpiry <= TOKEN_REFRESH_BUFFER_MS) {
				// Token is about to expire - refresh it
				this.refreshAccessToken().then((refreshed) => {
					if (!refreshed && isWeb) {
						this._redirectToLogin();
					}
				});
			}
		}, TOKEN_CHECK_INTERVAL_MS);
	}

	private _stopTokenCheck(): void {
		if (this._tokenCheckTimer !== null) {
			clearInterval(this._tokenCheckTimer);
			this._tokenCheckTimer = null;
		}
	}


	// ---- Storage Helpers ----

	private _persistToStorage(state: SSOAuthState): void {
		try {
			const serialized = JSON.stringify({
				accessToken: state.accessToken,
				refreshToken: state.refreshToken,
				idToken: state.idToken,
				expiresAt: state.expiresAt,
				user: state.user,
			});
			this._storageService.store(
				SSO_AUTH_STORAGE_KEY,
				serialized,
				StorageScope.APPLICATION,
				StorageTarget.USER,
			);
		} catch (err) {
			console.error('[OrcestSSO] Failed to persist auth state:', err);
		}
	}

	private _restoreFromStorage(): boolean {
		try {
			const serialized = this._storageService.get(SSO_AUTH_STORAGE_KEY, StorageScope.APPLICATION);
			if (!serialized) return false;

			const parsed = JSON.parse(serialized);
			this._state = {
				isAuthenticated: !!parsed.accessToken,
				accessToken: parsed.accessToken || null,
				refreshToken: parsed.refreshToken || null,
				idToken: parsed.idToken || null,
				expiresAt: parsed.expiresAt || null,
				user: parsed.user || null,
			};
			return true;
		} catch {
			return false;
		}
	}

	private _clearStorage(): void {
		this._storageService.remove(SSO_AUTH_STORAGE_KEY, StorageScope.APPLICATION);
		this._storageService.remove('sso.csrf.state', StorageScope.APPLICATION);
		this._storageService.remove('sso.nonce', StorageScope.APPLICATION);
	}


	// ---- Nonce / CSRF Helpers ----

	private _generateNonce(): string {
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
	}

	private _storeNonce(nonce: string): void {
		this._storageService.store(
			'sso.nonce',
			nonce,
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
		);
	}


	// ---- Cleanup ----

	override dispose(): void {
		this._stopTokenCheck();
		this._onDidChangeState.dispose();
		super.dispose();
	}
}


// ========================== Registration ==========================

registerSingleton(IOrcestSSOService, OrcestSSOAuth, InstantiationType.Eager);


// ========================== Workbench Contribution ==========================

/**
 * SSOGateContribution: Initializes SSO on workbench startup.
 * Blocks IDE functionality if no valid SSO token is present by redirecting to login.
 * Displays the user name in the status bar when authenticated.
 */
class SSOGateContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.orcestSSOGate';

	constructor(
		@IOrcestSSOService private readonly _ssoService: IOrcestSSOService,
	) {
		super();
		this._initializeSSO();
	}

	private async _initializeSSO(): Promise<void> {
		// Kick off the SSO initialization flow
		await this._ssoService.initialize();

		// Listen for state changes to update UI
		this._register(this._ssoService.onDidChangeState((state) => {
			this._onAuthStateChanged(state);
		}));

		// Initial UI update
		this._onAuthStateChanged(this._ssoService.state);
	}

	private _onAuthStateChanged(state: SSOAuthState): void {
		if (state.isAuthenticated && state.user) {
			// Update window title with user info
			this._updateTitleWithUser(state.user);
		}
	}

	private _updateTitleWithUser(user: SSOUser): void {
		if (!isWeb) return;

		const targetWindow = getActiveWindow();

		// Look for or create a status bar item showing the user name
		let ssoStatusEl = targetWindow.document.getElementById('orcest-sso-status');
		if (!ssoStatusEl) {
			const statusBar = targetWindow.document.querySelector('.statusbar-item.right');
			if (statusBar?.parentElement) {
				ssoStatusEl = targetWindow.document.createElement('div');
				ssoStatusEl.id = 'orcest-sso-status';
				ssoStatusEl.className = 'statusbar-item right';
				ssoStatusEl.style.cssText = 'display: flex; align-items: center; padding: 0 8px; cursor: default;';
				statusBar.parentElement.insertBefore(ssoStatusEl, statusBar);
			}
		}

		if (ssoStatusEl) {
			const displayName = user.name || user.email || user.sub;
			ssoStatusEl.textContent = displayName;
			ssoStatusEl.title = `Signed in as ${user.email} (${user.role})`;
		}
	}
}

registerWorkbenchContribution2(SSOGateContribution.ID, SSOGateContribution, WorkbenchPhase.BlockStartup);
