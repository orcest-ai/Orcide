/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest.ai. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * OAuth2/OIDC SSO type definitions for Orcide IDE.
 * Used by the OrcestSSOAuth module to authenticate users via login.orcest.ai.
 */

// ---- Configuration ----

export interface SSOConfig {
	/** The OIDC issuer URL (e.g. https://login.orcest.ai) */
	issuer: string;
	/** OAuth2 client ID */
	clientId: string;
	/** OAuth2 client secret (if applicable for confidential client flows) */
	clientSecret: string;
	/** The callback/redirect URL after SSO login */
	callbackUrl: string;
}


// ---- Token types ----

export interface SSOTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	id_token: string;
	scope: string;
}


// ---- User types ----

export interface SSOUser {
	/** OIDC subject identifier */
	sub: string;
	/** Display name */
	name: string;
	/** Email address */
	email: string;
	/** User role (e.g. 'admin', 'developer', 'viewer') */
	role: string;
	/** Internal user ID in the Orcest system */
	user_id: string;
	/** User preferences synced from the Orcest platform */
	preferences: Record<string, any>;
}


// ---- Auth state ----

export interface SSOAuthState {
	/** Whether the user is currently authenticated */
	isAuthenticated: boolean;
	/** The current access token, or null if not authenticated */
	accessToken: string | null;
	/** The refresh token for obtaining new access tokens */
	refreshToken: string | null;
	/** The ID token (JWT) from the OIDC provider */
	idToken: string | null;
	/** The authenticated user profile, or null */
	user: SSOUser | null;
	/** Timestamp (ms) when the access token expires */
	expiresAt: number | null;
}

export const defaultSSOAuthState: SSOAuthState = {
	isAuthenticated: false,
	accessToken: null,
	refreshToken: null,
	idToken: null,
	user: null,
	expiresAt: null,
};


// ---- Error types ----

export interface SSOError {
	code: string;
	message: string;
	details?: unknown;
}


// ---- SSO Settings Fields (for persistence in VoidSettingsService) ----

export interface SSOSettingsFields {
	ssoAccessToken: string;
	ssoRefreshToken: string;
	ssoIdToken: string;
	ssoTokenExpiresAt: number;
	ssoUserSub: string;
	ssoUserName: string;
	ssoUserEmail: string;
	ssoUserRole: string;
	ssoUserId: string;
}

export const defaultSSOSettingsFields: SSOSettingsFields = {
	ssoAccessToken: '',
	ssoRefreshToken: '',
	ssoIdToken: '',
	ssoTokenExpiresAt: 0,
	ssoUserSub: '',
	ssoUserName: '',
	ssoUserEmail: '',
	ssoUserRole: '',
	ssoUserId: '',
};


// ---- OIDC Discovery ----

export interface OIDCDiscoveryDocument {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint: string;
	jwks_uri: string;
	end_session_endpoint?: string;
	revocation_endpoint?: string;
	scopes_supported?: string[];
	response_types_supported?: string[];
	grant_types_supported?: string[];
}
