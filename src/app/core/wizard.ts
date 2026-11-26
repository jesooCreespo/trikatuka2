import { computed, inject, Service } from '@angular/core';
import { CATEGORIES, type Category, type LibraryItem } from '@/lib/library';
import type { ItemResult, TransferOptions } from '@/transfer/engine';
import { persistedSignal } from './persisted-signal';
import { Session } from './session';

export const STEPS = ['connect', 'select', 'review', 'run', 'report'] as const;
export type Step = (typeof STEPS)[number];

/** Selected items per category, keyed by id so selection survives paging and filtering. */
export type SelectionMap = Record<Category, Record<string, LibraryItem>>;

const emptySelection = (): SelectionMap =>
  Object.fromEntries(CATEGORIES.map((c) => [c, {}])) as unknown as SelectionMap;

interface WizardState {
  step: Step;
  /**
   * Selections per source account id. Swapping the accounts changes the source; swapping back
   * finds the previous selection again.
   */
  selections: Record<string, SelectionMap>;
  options: TransferOptions;
  results: ItemResult[];
}

@Service()
export class Wizard {
  private readonly session = inject(Session);
  private readonly state = persistedSignal<WizardState>(
    () => sessionStorage,
    'trikatuka:wizard',
    // v2: one "connect" step and selections per source account.
    2,
    {
      step: 'connect',
      selections: {},
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

  private readonly sourceId = computed(() => this.session.accounts().old?.profile.id ?? '');

  readonly step = computed(() => this.state().step);
  /** Selection for the current source account. */
  readonly selection = computed(() => this.state().selections[this.sourceId()] ?? emptySelection());
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
    const current = { ...this.selection()[category] };
    for (const item of items) {
      if (selected) current[item.id] = item;
      else delete current[item.id];
    }
    this.setSelection({ ...this.selection(), [category]: current });
  }

  clearSelection() {
    this.setSelection(emptySelection());
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
    this.setSelection(selection);
  }

  private setSelection(selection: SelectionMap) {
    const source = this.sourceId();
    this.state.update((s) => ({ ...s, selections: { ...s.selections, [source]: selection } }));
  }
}

export function selectedItems(selection: SelectionMap): Partial<Record<Category, LibraryItem[]>> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, Object.values(selection[c])]));
}
