import { Component, computed, inject, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { I18n } from '@/i18n/i18n';
import { CATEGORIES, type Category } from '@/lib/library';
import type { ItemResult, ItemStatus } from '@/transfer/engine';
import { CategoryIcon, reasonText } from './shared';

const STATUS_ICON: Record<ItemStatus, { name: string; color: string }> = {
  pending: { name: 'lucideCircle', color: 'text-muted-foreground' },
  running: { name: 'lucideLoaderCircle', color: 'text-primary animate-spin' },
  ok: { name: 'lucideCircleCheck', color: 'text-success' },
  skipped: { name: 'lucideCircleMinus', color: 'text-muted-foreground' },
  failed: { name: 'lucideCircleX', color: 'text-destructive' },
  cancelled: { name: 'lucideCircleDashed', color: 'text-warning' },
};

const isDone = (status: ItemStatus) => status !== 'pending' && status !== 'running';

/** One row: status, name and either the current phase (with a bar) or the outcome. */
@Component({
  selector: 'app-run-item',
  imports: [NgIcon, HlmProgressImports],
  host: { class: 'flex items-start gap-3 px-3 py-2' },
  template: `
    <span class="mt-0.5 inline-flex" [class]="icon().color">
      <ng-icon [name]="icon().name" aria-hidden="true" />
    </span>
    <div class="min-w-0 flex-1 space-y-1">
      <p class="truncate text-sm font-medium">
        {{ result().item.name }}
        <span class="sr-only">: {{ i18n.t('itemStatus.' + result().status) }}</span>
      </p>
      @if (phase(); as p) {
        <p class="text-muted-foreground text-xs tabular-nums">{{ p.text }}</p>
        @if (p.percent !== null) {
          <hlm-progress [value]="p.percent" [attr.aria-label]="p.text" class="h-1">
            <hlm-progress-indicator />
          </hlm-progress>
        }
      } @else if (detail()) {
        <p class="text-muted-foreground truncate text-xs">{{ detail() }}</p>
      }
    </div>
  `,
})
export class RunItem {
  protected readonly i18n = inject(I18n);
  readonly result = input.required<ItemResult>();

  protected readonly icon = computed(() => STATUS_ICON[this.result().status]);
  protected readonly phase = computed(() => {
    const r = this.result();
    const p = r.progress;
    if (r.status !== 'running' || !p) return null;
    if (p.phase === 'creating') return { text: this.i18n.t('run.phaseCreating'), percent: null };
    const key = p.phase === 'reading' ? 'run.phaseReading' : 'run.phaseAdding';
    return {
      text: this.i18n.t(key, { done: p.done, total: p.total }),
      percent: p.total ? (p.done / p.total) * 100 : null,
    };
  });
  protected readonly detail = computed(() => reasonText(this.i18n, this.result()));
}

/** Per-item progress, grouped by category in collapsible sections (playlists open). */
@Component({
  selector: 'app-run-details',
  imports: [NgIcon, CategoryIcon, RunItem],
  host: { class: 'block space-y-2' },
  template: `
    <h2 class="text-sm font-medium">{{ i18n.t('run.detailsTitle') }}</h2>
    @for (group of groups(); track group.category) {
      <details class="group rounded-lg border" [open]="group.category === 'playlists'">
        <summary
          class="focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-3 [&::-webkit-details-marker]:hidden"
        >
          <span class="flex items-center gap-2">
            <ng-icon
              name="lucideChevronDown"
              class="text-muted-foreground -rotate-90 transition-transform group-open:rotate-0"
              aria-hidden="true"
            />
            <app-category-icon [category]="group.category" class="text-muted-foreground" />
            {{ i18n.t('categories.' + group.category) }}
          </span>
          <span class="text-muted-foreground tabular-nums">
            {{ i18n.t('run.overall', { done: group.done, total: group.items.length }) }}
          </span>
        </summary>
        <ul class="max-h-80 divide-y overflow-y-auto border-t">
          @for (result of group.items; track result.key) {
            <!-- Sections can hold thousands of rows: skip layout for the off-screen ones. -->
            <li class="[contain-intrinsic-size:auto_3rem] [content-visibility:auto]">
              <app-run-item [result]="result" />
            </li>
          }
        </ul>
      </details>
    }
  `,
})
export class RunDetails {
  protected readonly i18n = inject(I18n);
  readonly results = input.required<ItemResult[]>();

  protected readonly groups = computed(() => {
    const byCategory = new Map<Category, ItemResult[]>();
    for (const r of this.results()) {
      const list = byCategory.get(r.item.category) ?? [];
      list.push(r);
      byCategory.set(r.item.category, list);
    }
    return CATEGORIES.flatMap((category) => {
      const items = byCategory.get(category);
      return items ? [{ category, items, done: items.filter((r) => isDone(r.status)).length }] : [];
    });
  });
}
