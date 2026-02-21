/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import Severity from '../../../../base/common/severity.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { INotificationActions, INotificationHandle, INotificationService } from '../../../../platform/notification/common/notification.js';
import { IMetricsService } from '../common/metricsService.js';
import { IOrcideUpdateService } from '../common/orcideUpdateService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import * as dom from '../../../../base/browser/dom.js';
import { IUpdateService } from '../../../../platform/update/common/update.js';
import { OrcideCheckUpdateResponse } from '../common/orcideUpdateServiceTypes.js';
import { IAction } from '../../../../base/common/actions.js';




const notifyUpdate = (res: OrcideCheckUpdateResponse & { message: string }, notifService: INotificationService, updateService: IUpdateService): INotificationHandle => {
	const message = res?.message || 'This is a very old version of Orcide. Please download the latest version! [Orcide](https://orcest.ai/download-beta)!'

	let actions: INotificationActions | undefined

	if (res?.action) {
		const primary: IAction[] = []

		if (res.action === 'reinstall') {
			primary.push({
				label: `Reinstall`,
				id: 'orcide.updater.reinstall',
				enabled: true,
				tooltip: '',
				class: undefined,
				run: () => {
					const { window } = dom.getActiveWindow()
					window.open('https://orcest.ai/download-beta')
				}
			})
		}

		if (res.action === 'download') {
			primary.push({
				label: `Download`,
				id: 'orcide.updater.download',
				enabled: true,
				tooltip: '',
				class: undefined,
				run: () => {
					updateService.downloadUpdate()
				}
			})
		}


		if (res.action === 'apply') {
			primary.push({
				label: `Apply`,
				id: 'orcide.updater.apply',
				enabled: true,
				tooltip: '',
				class: undefined,
				run: () => {
					updateService.applyUpdate()
				}
			})
		}

		if (res.action === 'restart') {
			primary.push({
				label: `Restart`,
				id: 'orcide.updater.restart',
				enabled: true,
				tooltip: '',
				class: undefined,
				run: () => {
					updateService.quitAndInstall()
				}
			})
		}

		primary.push({
			id: 'orcide.updater.site',
			enabled: true,
			label: `Orcide Site`,
			tooltip: '',
			class: undefined,
			run: () => {
				const { window } = dom.getActiveWindow()
				window.open('https://orcest.ai/')
			}
		})

		actions = {
			primary: primary,
			secondary: [{
				id: 'orcide.updater.close',
				enabled: true,
				label: `Keep current version`,
				tooltip: '',
				class: undefined,
				run: () => {
					notifController.close()
				}
			}]
		}
	}
	else {
		actions = undefined
	}

	const notifController = notifService.notify({
		severity: Severity.Info,
		message: message,
		sticky: true,
		progress: actions ? { worked: 0, total: 100 } : undefined,
		actions: actions,
	})

	return notifController
	// const d = notifController.onDidClose(() => {
	// 	notifyYesUpdate(notifService, res)
	// 	d.dispose()
	// })
}
const notifyErrChecking = (notifService: INotificationService): INotificationHandle => {
	const message = `Orcide Error: There was an error checking for updates. If this persists, please get in touch or reinstall Orcide [here](https://orcest.ai/download-beta)!`
	const notifController = notifService.notify({
		severity: Severity.Info,
		message: message,
		sticky: true,
	})
	return notifController
}


const performOrcideCheck = async (
	explicit: boolean,
	notifService: INotificationService,
	orcideUpdateService: IOrcideUpdateService,
	metricsService: IMetricsService,
	updateService: IUpdateService,
): Promise<INotificationHandle | null> => {

	const metricsTag = explicit ? 'Manual' : 'Auto'

	metricsService.capture(`Orcide Update ${metricsTag}: Checking...`, {})
	const res = await orcideUpdateService.check(explicit)
	if (!res) {
		const notifController = notifyErrChecking(notifService);
		metricsService.capture(`Orcide Update ${metricsTag}: Error`, { res })
		return notifController
	}
	else {
		if (res.message) {
			const notifController = notifyUpdate(res, notifService, updateService)
			metricsService.capture(`Orcide Update ${metricsTag}: Yes`, { res })
			return notifController
		}
		else {
			metricsService.capture(`Orcide Update ${metricsTag}: No`, { res })
			return null
		}
	}
}


// Action
let lastNotifController: INotificationHandle | null = null


registerAction2(class extends Action2 {
	constructor() {
		super({
			f1: true,
			id: 'orcide.checkUpdate',
			title: localize2('orcideCheckUpdate', 'Orcide: Check for Updates'),
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const orcideUpdateService = accessor.get(IOrcideUpdateService)
		const notifService = accessor.get(INotificationService)
		const metricsService = accessor.get(IMetricsService)
		const updateService = accessor.get(IUpdateService)

		const currNotifController = lastNotifController

		const newController = await performOrcideCheck(true, notifService, orcideUpdateService, metricsService, updateService)

		if (newController) {
			currNotifController?.close()
			lastNotifController = newController
		}
	}
})

// on mount
class OrcideUpdateWorkbenchContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.orcide.orcideUpdate'
	constructor(
		@IOrcideUpdateService orcideUpdateService: IOrcideUpdateService,
		@IMetricsService metricsService: IMetricsService,
		@INotificationService notifService: INotificationService,
		@IUpdateService updateService: IUpdateService,
	) {
		super()

		const autoCheck = () => {
			performOrcideCheck(false, notifService, orcideUpdateService, metricsService, updateService)
		}

		// check once 5 seconds after mount
		// check every 3 hours
		const { window } = dom.getActiveWindow()

		const initId = window.setTimeout(() => autoCheck(), 5 * 1000)
		this._register({ dispose: () => window.clearTimeout(initId) })


		const intervalId = window.setInterval(() => autoCheck(), 3 * 60 * 60 * 1000) // every 3 hrs
		this._register({ dispose: () => window.clearInterval(intervalId) })

	}
}
registerWorkbenchContribution2(OrcideUpdateWorkbenchContribution.ID, OrcideUpdateWorkbenchContribution, WorkbenchPhase.BlockRestore);
