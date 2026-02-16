/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';

export const IVoidDefaultsService = createDecorator<IVoidDefaultsService>('voidDefaultsService');

export interface IVoidDefaultsService {
	readonly _serviceBrand: undefined;
	readonly openRouterApiKey: string;
	readonly defaultModel: string;
}

/** No-op when no server-provided defaults (desktop, or web without env) */
class NoopVoidDefaultsService implements IVoidDefaultsService {
	readonly _serviceBrand: undefined;
	readonly openRouterApiKey = '';
	readonly defaultModel = '';
}

registerSingleton(IVoidDefaultsService, NoopVoidDefaultsService, InstantiationType.Delayed);
