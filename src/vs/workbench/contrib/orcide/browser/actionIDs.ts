// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const ORCIDE_CTRL_L_ACTION_ID = 'orcide.ctrlLAction'

export const ORCIDE_CTRL_K_ACTION_ID = 'orcide.ctrlKAction'

export const ORCIDE_ACCEPT_DIFF_ACTION_ID = 'orcide.acceptDiff'

export const ORCIDE_REJECT_DIFF_ACTION_ID = 'orcide.rejectDiff'

export const ORCIDE_GOTO_NEXT_DIFF_ACTION_ID = 'orcide.goToNextDiff'

export const ORCIDE_GOTO_PREV_DIFF_ACTION_ID = 'orcide.goToPrevDiff'

export const ORCIDE_GOTO_NEXT_URI_ACTION_ID = 'orcide.goToNextUri'

export const ORCIDE_GOTO_PREV_URI_ACTION_ID = 'orcide.goToPrevUri'

export const ORCIDE_ACCEPT_FILE_ACTION_ID = 'orcide.acceptFile'

export const ORCIDE_REJECT_FILE_ACTION_ID = 'orcide.rejectFile'

export const ORCIDE_ACCEPT_ALL_DIFFS_ACTION_ID = 'orcide.acceptAllDiffs'

export const ORCIDE_REJECT_ALL_DIFFS_ACTION_ID = 'orcide.rejectAllDiffs'
