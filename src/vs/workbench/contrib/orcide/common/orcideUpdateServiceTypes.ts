/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type OrcideCheckUpdateResponse = {
	message: string,
	action?: 'reinstall' | 'restart' | 'download' | 'apply'
} | {
	message: null,
	actions?: undefined,
} | null


