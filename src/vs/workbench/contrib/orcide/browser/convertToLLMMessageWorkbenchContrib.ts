/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IOrcideModelService } from '../common/orcideModelService.js';

class ConvertContribWorkbenchContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.orcide.convertcontrib'
	_serviceBrand: undefined;

	constructor(
		@IOrcideModelService private readonly orcideModelService: IOrcideModelService,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
	) {
		super()

		const initializeURI = (uri: URI) => {
			this.workspaceContext.getWorkspace()
			const orcideRulesURI = URI.joinPath(uri, '.orciderules')
			this.orcideModelService.initializeModel(orcideRulesURI)
		}

		// call
		this._register(this.workspaceContext.onDidChangeWorkspaceFolders((e) => {
			[...e.changed, ...e.added].forEach(w => { initializeURI(w.uri) })
		}))
		this.workspaceContext.getWorkspace().folders.forEach(w => { initializeURI(w.uri) })
	}
}


registerWorkbenchContribution2(ConvertContribWorkbenchContribution.ID, ConvertContribWorkbenchContribution, WorkbenchPhase.BlockRestore);
