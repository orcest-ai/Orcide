/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { OrcideCommandBar } from './OrcideCommandBar.js'
import { OrcideSelectionHelperMain } from './OrcideSelectionHelper.js'

export const mountOrcideCommandBar = mountFnGenerator(OrcideCommandBar)
export const mountOrcideSelectionHelper = mountFnGenerator(OrcideSelectionHelperMain)
