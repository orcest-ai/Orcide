/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { isWeb } from '../../../../base/common/platform.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { OrcideCheckUpdateResponse } from './orcideUpdateServiceTypes.js';



export interface IOrcideUpdateService {
	readonly _serviceBrand: undefined;
	check: (explicit: boolean) => Promise<OrcideCheckUpdateResponse>;
}


export const IOrcideUpdateService = createDecorator<IOrcideUpdateService>('OrcideUpdateService');


// implemented by calling channel
export class OrcideUpdateService implements IOrcideUpdateService {

	readonly _serviceBrand: undefined;
	private readonly orcideUpdateService: IOrcideUpdateService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		// creates an IPC proxy to use metricsMainService.ts
		this.orcideUpdateService = ProxyChannel.toService<IOrcideUpdateService>(mainProcessService.getChannel('orcide-channel-update'));
	}


	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	check: IOrcideUpdateService['check'] = async (explicit) => {
		const res = await this.orcideUpdateService.check(explicit)
		return res
	}
}

if (!isWeb) {
	registerSingleton(IOrcideUpdateService, OrcideUpdateService, InstantiationType.Eager);
} else {
	class OrcideUpdateServiceWeb implements IOrcideUpdateService {
		readonly _serviceBrand: undefined;
		check = async () => ({ type: 'noUpdate' }) as any;
	}
	registerSingleton(IOrcideUpdateService, OrcideUpdateServiceWeb, InstantiationType.Eager);
}


