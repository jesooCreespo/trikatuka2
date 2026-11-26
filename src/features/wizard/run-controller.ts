import { toast } from 'sonner'
import { create } from 'zustand'
import i18n from '@/i18n'
import { runTransfer, type ItemResult } from '@/transfer/engine'
import { getApi, useSession } from '@/state/session'
import { selectedItems, useWizard } from '@/state/wizard'

interface RunState {
  running: boolean
  stopping: boolean
}

export const useRun = create<RunState>(() => ({ running: false, stopping: false }))

let controller: AbortController | null = null

/** Pushes results to the store at most every `ms`, plus once at the end. */
function throttled(fn: (r: ItemResult[]) => void, ms = 150) {
  let last = 0
  let pending: ItemResult[] | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    timer = null
    last = Date.now()
    if (pending) fn(pending)
    pending = null
  }
  return {
    push(r: ItemResult[]) {
      pending = r
      if (timer) return
      const wait = Math.max(0, ms - (Date.now() - last))
      timer = setTimeout(flush, wait)
    },
    flush() {
      if (timer) clearTimeout(timer)
      flush()
    },
  }
}

/** Starts the transfer for the current selection. Runs outside React so re-renders can't restart it. */
export async function startRun() {
  if (useRun.getState().running) return
  const { accounts } = useSession.getState()
  const { selection, options, setResults, goTo } = useWizard.getState()
  if (!accounts.old || !accounts.new) return

  controller = new AbortController()
  useRun.setState({ running: true, stopping: false })
  setResults([])
  goTo('run')

  const updates = throttled(setResults)
  try {
    const results = await runTransfer(selectedItems(selection), options, {
      source: getApi('old'),
      target: getApi('new'),
      sourceUserId: accounts.old.profile.id,
      targetUserId: accounts.new.profile.id,
      signal: controller.signal,
      onUpdate: updates.push,
    })
    updates.flush()
    setResults(results)
  } catch (error) {
    updates.flush()
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    controller = null
    useRun.setState({ running: false, stopping: false })
    useWizard.getState().goTo('report')
  }
}

export function stopRun() {
  if (!controller) return
  useRun.setState({ stopping: true })
  controller.abort(new DOMException(i18n.t('run.stopping'), 'AbortError'))
}
