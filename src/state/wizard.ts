import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { CATEGORIES, type Category, type LibraryItem } from '@/lib/library'
import type { ItemResult, TransferOptions } from '@/transfer/engine'
import { useSession } from './session'

export const STEPS = ['connect', 'select', 'review', 'run', 'report'] as const
export type Step = (typeof STEPS)[number]

type SelectionMap = Record<Category, Record<string, LibraryItem>>

const emptySelection = (): SelectionMap =>
  Object.fromEntries(CATEGORIES.map((c) => [c, {}])) as unknown as SelectionMap

const currentSource = () => useSession.getState().accounts.old?.profile.id ?? ''

interface WizardState {
  step: Step
  /**
   * Selections per source account id. Swapping the accounts changes the source; swapping back
   * finds the previous selection again.
   */
  selections: Record<string, SelectionMap>
  /** The current source's selection (kept in sync with `selections`), as components read it. */
  selection: SelectionMap
  options: TransferOptions
  /** Results of the last (or current) run. */
  results: ItemResult[]
  goTo: (step: Step) => void
  toggle: (item: LibraryItem, selected?: boolean) => void
  setSelected: (category: Category, items: LibraryItem[], selected: boolean) => void
  clearSelection: () => void
  setOption: <K extends keyof TransferOptions>(key: K, value: TransferOptions[K]) => void
  setResults: (results: ItemResult[]) => void
  /** Re-select only the failed/cancelled items of the last run, for a retry. */
  selectRetryable: () => void
  /** Shows the selection of the current source account (after a swap or a new login). */
  syncSource: () => void
}

/** Updates the current selection and remembers it for the current source account. */
const withSelection = (s: WizardState, selection: SelectionMap) => ({
  selection,
  selections: { ...s.selections, [currentSource()]: selection },
})

export const useWizard = create<WizardState>()(
  persist(
    (set, get) => ({
      step: 'connect',
      selections: {},
      selection: emptySelection(),
      options: { keepOrder: false, skipDuplicates: true },
      results: [],
      goTo: (step) => set({ step }),
      toggle: (item, selected) =>
        set((s) => {
          const current = { ...s.selection[item.category] }
          const shouldSelect = selected ?? !current[item.id]
          if (shouldSelect) current[item.id] = item
          else delete current[item.id]
          return withSelection(s, { ...s.selection, [item.category]: current })
        }),
      setSelected: (category, items, selected) =>
        set((s) => {
          const current = { ...s.selection[category] }
          for (const item of items) {
            if (selected) current[item.id] = item
            else delete current[item.id]
          }
          return withSelection(s, { ...s.selection, [category]: current })
        }),
      clearSelection: () => set((s) => withSelection(s, emptySelection())),
      setOption: (key, value) => set((s) => ({ options: { ...s.options, [key]: value } })),
      setResults: (results) => set({ results }),
      selectRetryable: () => {
        const selection = emptySelection()
        for (const r of get().results) {
          if (r.status === 'failed' || r.status === 'cancelled') {
            selection[r.item.category][r.item.id] = r.item
          }
        }
        set((s) => withSelection(s, selection))
      },
      syncSource: () =>
        set((s) => ({ selection: s.selections[currentSource()] ?? emptySelection() })),
    }),
    {
      name: 'trikatuka:wizard',
      // v2: one "connect" step and selections per source account.
      version: 2,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        // A run can't survive a reload, so never come back to the "run" step.
        step: s.step === 'run' ? 'report' : s.step,
        selections: s.selections,
        selection: s.selection,
        options: s.options,
        results: s.results.map((r) =>
          r.status === 'running' || r.status === 'pending'
            ? { ...r, status: 'cancelled' as const }
            : r,
        ),
      }),
    },
  ),
)

// Follow the source account: after a swap or a login, show that account's selection.
useSession.subscribe((state, previous) => {
  if (state.accounts.old?.profile.id !== previous.accounts.old?.profile.id) {
    useWizard.getState().syncSource()
  }
})

export function selectedItems(selection: SelectionMap): Partial<Record<Category, LibraryItem[]>> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, Object.values(selection[c])]))
}

export function selectionCount(selection: SelectionMap): number {
  return CATEGORIES.reduce((n, c) => n + Object.keys(selection[c]).length, 0)
}
