/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * IMainProcessService for web workbench when connected to code-server.
 * Delegates channel access to the remote agent connection so Void AI etc. work.
 */

import { IChannel, IServerChannel, getDelayedChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { IRemoteAgentService } from '../common/remoteAgentService.js';

export class RemoteMainProcessService implements IMainProcessService {
	readonly _serviceBrand: undefined;

	constructor(
		private readonly _remoteAgentService: IRemoteAgentService,
	) { }

	getChannel(channelName: string): IChannel {
		const connection = this._remoteAgentService.getConnection();
		if (!connection) {
			return getDelayedChannel(Promise.reject(new Error(`No remote connection for channel: ${channelName}`)));
		}
		return connection.getChannel(channelName);
	}

	registerChannel(_channelName: string, _channel: IServerChannel<string>): void {
		// Not supported in remote - channels are on server
	}
}
