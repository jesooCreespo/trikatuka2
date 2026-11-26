import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { CATEGORIES, type Category, type LibraryItem } from '@/lib/library'
import type { ItemResult, TransferOptions } from '@/transfer/engine'

export const STEPS = ['connect-old', 'connect-new', 'select', 'review', 'run', 'report'] as const
export type Step = (typeof STEPS)[number]

type SelectionMap = Record<Category, Record<string, LibraryItem>>

const emptySelection = (): SelectionMap =>
  Object.fromEntries(CATEGORIES.map((c) => [c, {}])) as unknown as SelectionMap

interface WizardState {
  step: Step
  /** Selected items per category, keyed by id so selection survives paging and filtering. */
  selection: SelectionMap
  options: TransferOptions
  /** Results of the last (or current) run. Not persisted. */
  results: ItemResult[]
  goTo: (step: Step) => void
  toggle: (item: LibraryItem, selected?: boolean) => void
  setSelected: (category: Category, items: LibraryItem[], selected: boolean) => void
  clearSelection: () => void
  setOption: <K extends keyof TransferOptions>(key: K, value: TransferOptions[K]) => void
  setResults: (results: ItemResult[]) => void
  /** Re-select only the failed/cancelled items of the last run, for a retry. */
  selectRetryable: () => void
  reset: () => void
}

export const useWizard = create<WizardState>()(
  persist(
    (set, get) => ({
      step: 'connect-old',
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
          return { selection: { ...s.selection, [item.category]: current } }
        }),
      setSelected: (category, items, selected) =>
        set((s) => {
          const current = { ...s.selection[category] }
          for (const item of items) {
            if (selected) current[item.id] = item
            else delete current[item.id]
          }
          return { selection: { ...s.selection, [category]: current } }
        }),
      clearSelection: () => set({ selection: emptySelection() }),
      setOption: (key, value) => set((s) => ({ options: { ...s.options, [key]: value } })),
      setResults: (results) => set({ results }),
      selectRetryable: () => {
        const selection = emptySelection()
        for (const r of get().results) {
          if (r.status === 'failed' || r.status === 'cancelled') {
            selection[r.item.category][r.item.id] = r.item
          }
        }
        set({ selection })
      },
      reset: () => set({ step: 'connect-old', selection: emptySelection(), results: [] }),
    }),
    {
      name: 'trikatuka:wizard',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        // A run can't survive a reload, so never come back to the "run" step.
        step: s.step === 'run' ? 'report' : s.step,
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

export function selectedItems(selection: SelectionMap): Partial<Record<Category, LibraryItem[]>> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, Object.values(selection[c])]))
}

export function selectionCount(selection: SelectionMap): number {
  return CATEGORIES.reduce((n, c) => n + Object.keys(selection[c]).length, 0)
}
