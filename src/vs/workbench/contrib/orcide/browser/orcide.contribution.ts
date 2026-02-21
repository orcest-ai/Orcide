/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Orcest AI. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


// register inline diffs
import './editCodeService.js'

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js'
import './sidebarPane.js'

// register quick edit (Ctrl+K)
import './quickEditActions.js'


// register Autocomplete
import './autocompleteService.js'

// register Context services
// import './contextGatheringService.js'
// import './contextUserChangesService.js'

// settings pane
import './orcideSettingsPane.js'

// register css
import './media/orcide.css'

// update (frontend part, also see platform/)
import './orcideUpdateActions.js'

import './convertToLLMMessageWorkbenchContrib.js'

// tools
import './toolsService.js'
import './terminalToolService.js'

// register Thread History
import './chatThreadService.js'

// ping
import './metricsPollService.js'

// helper services
import './helperServices/consistentItemService.js'

// register selection helper
import './orcideSelectionHelperWidget.js'

// register tooltip service
import './tooltipService.js'

// register onboarding service
import './orcideOnboardingService.js'

// register misc service
import './miscWokrbenchContrib.js'

// register file service (for explorer context menu)
import './fileService.js'

// register source control management
import './orcideSCMService.js'

// ---------- Orcide SSO & Profile services ----------

// SSO authentication service (browser-side)
import './orcideSSOBrowserService.js'

// ---------- common ----------

// llmMessage
import '../common/sendLLMMessageService.js'

// orcideSettings (previously orcideSettings)
import '../common/orcideSettingsService.js'

// refreshModel
import '../common/refreshModelService.js'

// metrics
import '../common/metricsService.js'

// updates
import '../common/orcideUpdateService.js'

// model service
import '../common/orcideModelService.js'

// Orcide SSO service
import '../common/orcideSSOService.js'

// Orcide user profile service
import '../common/orcideUserProfileService.js'

// Orcide collaboration service
import '../common/orcideCollaborationService.js'

// Orcide LangChain integration service
import '../common/orcideLangChainService.js'

// Orcide Git PR generation & deployment service
import '../common/orcideGitService.js'

// Orcide Enterprise & Cursor Ultra features service
import '../common/orcideEnterpriseService.js'
