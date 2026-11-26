import { computed, Service } from '@angular/core';
import { CATEGORIES, type Category, type LibraryItem } from '@/lib/library';
import type { ItemResult, TransferOptions } from '@/transfer/engine';
import { persistedSignal } from './persisted-signal';

export const STEPS = ['connect-old', 'connect-new', 'select', 'review', 'run', 'report'] as const;
export type Step = (typeof STEPS)[number];

/** Selected items per category, keyed by id so selection survives paging and filtering. */
export type SelectionMap = Record<Category, Record<string, LibraryItem>>;

const emptySelection = (): SelectionMap =>
  Object.fromEntries(CATEGORIES.map((c) => [c, {}])) as unknown as SelectionMap;

interface WizardState {
  step: Step;
  selection: SelectionMap;
  options: TransferOptions;
  results: ItemResult[];
}

@Service()
export class Wizard {
  private readonly state = persistedSignal<WizardState>(
    () => sessionStorage,
    'trikatuka:wizard',
    1,
    {
      step: 'connect-old',
      selection: emptySelection(),
      options: { keepOrder: false, skipDuplicates: true },
      results: [],
    },
    (s) => ({
      ...s,
      // A run can't survive a reload: never come back to the "run" step.
      step: s.step === 'run' ? 'report' : s.step,
      results: s.results.map((r) =>
        r.status === 'running' || r.status === 'pending' ? { ...r, status: 'cancelled' } : r,
      ),
    }),
  );

  readonly step = computed(() => this.state().step);
  readonly selection = computed(() => this.state().selection);
  readonly options = computed(() => this.state().options);
  readonly results = computed(() => this.state().results);
  readonly selectedItems = computed(() => selectedItems(this.selection()));
  readonly selectionCount = computed(() =>
    CATEGORIES.reduce((n, c) => n + Object.keys(this.selection()[c]).length, 0),
  );

  goTo(step: Step) {
    this.state.update((s) => ({ ...s, step }));
  }

  toggle(item: LibraryItem, selected?: boolean) {
    this.setSelected(item.category, [item], selected ?? !this.selection()[item.category][item.id]);
  }

  setSelected(category: Category, items: LibraryItem[], selected: boolean) {
    this.state.update((s) => {
      const current = { ...s.selection[category] };
      for (const item of items) {
        if (selected) current[item.id] = item;
        else delete current[item.id];
      }
      return { ...s, selection: { ...s.selection, [category]: current } };
    });
  }

  clearSelection() {
    this.state.update((s) => ({ ...s, selection: emptySelection() }));
  }

  setOption<K extends keyof TransferOptions>(key: K, value: TransferOptions[K]) {
    this.state.update((s) => ({ ...s, options: { ...s.options, [key]: value } }));
  }

  setResults(results: ItemResult[]) {
    this.state.update((s) => ({ ...s, results }));
  }

  /** Re-select only the failed/cancelled items of the last run, for a retry. */
  selectRetryable() {
    const selection = emptySelection();
    for (const r of this.results()) {
      if (r.status === 'failed' || r.status === 'cancelled') {
        selection[r.item.category][r.item.id] = r.item;
      }
    }
    this.state.update((s) => ({ ...s, selection }));
  }
}

export function selectedItems(selection: SelectionMap): Partial<Record<Category, LibraryItem[]>> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, Object.values(selection[c])]));
}
