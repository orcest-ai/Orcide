/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Server-side Void channels for code-server/web deployment.
 * Enables AI/LLM features when accessing via agent.orcest.ai or similar.
 */

import { ProxyChannel } from '../../base/parts/ipc/common/ipc.js';
import { IMetricsService } from '../../workbench/contrib/void/common/metricsService.js';
import { LLMMessageChannel } from '../../workbench/contrib/void/electron-main/sendLLMMessageChannel.js';

/** No-op metrics for server - no PostHog/telemetry in server context */
class ServerMetricsService implements IMetricsService {
	readonly _serviceBrand: undefined;
	capture(_event: string, _params: Record<string, any>): void {
		// noop
	}
	setOptOut(_val: boolean): void {
		// noop
	}
	async getDebuggingProperties(): Promise<object> {
		return { server: true };
	}
}

export function createVoidChannels() {
	const metricsService = new ServerMetricsService();
	const sendLLMMessageChannel = new LLMMessageChannel(metricsService);
	const metricsChannel = ProxyChannel.fromService(metricsService);
	return {
		metricsService,
		sendLLMMessageChannel,
		metricsChannel,
	};
}
