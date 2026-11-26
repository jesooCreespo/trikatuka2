import { Component, computed, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { RunController } from '@/app/core/run-controller';
import { Wizard } from '@/app/core/wizard';
import { I18n } from '@/i18n/i18n';
import { CATEGORIES, type Category } from '@/lib/library';
import type { ItemResult } from '@/transfer/engine';
import { RunDetails } from './run-details';
import { CategoryIcon } from './shared';

const isDone = (status: string) => status !== 'pending' && status !== 'running';

/** One pass over the results (they can be thousands and update several times a second). */
function progressOf(results: ItemResult[]) {
  const totals = new Map<Category, { total: number; done: number }>();
  let done = 0;
  let current: ItemResult | undefined;
  for (const r of results) {
    const entry = totals.get(r.item.category) ?? { total: 0, done: 0 };
    entry.total++;
    if (isDone(r.status)) {
      entry.done++;
      done++;
    } else if (r.status === 'running') {
      current ??= r;
    }
    totals.set(r.item.category, entry);
  }
  const perCategory = CATEGORIES.flatMap((category) => {
    const entry = totals.get(category);
    return entry ? [{ category, ...entry }] : [];
  });
  return { perCategory, done, current, total: results.length };
}

@Component({
  selector: 'app-step-run',
  imports: [NgIcon, HlmButtonImports, HlmCardImports, HlmProgressImports, CategoryIcon, RunDetails],
  // Warn before leaving the page while a transfer runs.
  host: { class: 'mx-auto block max-w-2xl', '(window:beforeunload)': '$event.preventDefault()' },
  template: `
    <section hlmCard>
      <div hlmCardHeader>
        <h1 hlmCardTitle class="flex items-center gap-2 text-2xl tracking-tight">
          <ng-icon name="lucideLoaderCircle" class="text-primary animate-spin" aria-hidden="true" />
          {{ i18n.t('run.title') }}
        </h1>
        <p hlmCardDescription>{{ i18n.t('run.subtitle') }}</p>
      </div>
      <div hlmCardContent class="space-y-6">
        <div class="space-y-2" role="status" aria-live="polite">
          <div class="flex items-baseline justify-between text-sm">
            <span class="text-muted-foreground truncate">
              {{
                progress().current
                  ? i18n.t('run.current', { name: progress().current!.item.name })
                  : i18n.t('run.preparing')
              }}
            </span>
            <span class="shrink-0 font-medium tabular-nums">
              {{ i18n.t('run.overall', { done: progress().done, total: progress().total }) }}
            </span>
          </div>
          <hlm-progress
            [value]="percent(progress().done, progress().total)"
            [attr.aria-label]="i18n.t('run.overallLabel')"
            class="h-3"
          >
            <hlm-progress-indicator />
          </hlm-progress>
          @if (etaMinutes(); as minutes) {
            <p class="text-muted-foreground text-xs">{{ i18n.tn('run.eta', minutes) }}</p>
          }
        </div>

        <ul class="space-y-3">
          @for (row of progress().perCategory; track row.category) {
            <li class="space-y-1.5">
              <div class="flex items-center justify-between text-sm">
                <span class="flex items-center gap-2">
                  <app-category-icon [category]="row.category" class="text-muted-foreground" />
                  {{ i18n.t('categories.' + row.category) }}
                </span>
                <span class="text-muted-foreground tabular-nums">
                  {{ i18n.t('run.overall', { done: row.done, total: row.total }) }}
                </span>
              </div>
              <hlm-progress
                [value]="percent(row.done, row.total)"
                [attr.aria-label]="i18n.t('categories.' + row.category)"
                class="h-1.5"
              >
                <hlm-progress-indicator />
              </hlm-progress>
            </li>
          }
        </ul>

        <app-run-details [results]="results()" />

        @if (slowByDesign()) {
          <div class="flex gap-3 rounded-lg border p-4 text-sm">
            <ng-icon name="lucideInfo" class="text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <div class="space-y-1">
              <p class="font-medium">{{ i18n.t('run.keepOrderTitle') }}</p>
              <p class="text-muted-foreground">{{ i18n.t('run.keepOrderNote') }}</p>
            </div>
          </div>
        }

        <div class="flex justify-end">
          <button hlmBtn variant="outline" (click)="run.stop()" [disabled]="run.stopping()">
            @if (run.stopping()) {
              <ng-icon name="lucideLoaderCircle" class="animate-spin" />
              {{ i18n.t('run.stopping') }}
            } @else {
              <ng-icon name="lucideSquare" />
              {{ i18n.t('run.stop') }}
            }
          </button>
        </div>
      </div>
    </section>
  `,
})
export class StepRun {
  protected readonly i18n = inject(I18n);
  protected readonly run = inject(RunController);
  private readonly wizard = inject(Wizard);
  protected readonly results = this.wizard.results;
  protected readonly progress = computed(() => progressOf(this.results()));
  /**
   * With "keep order", liked songs go one per second (plus the request itself), so the remaining
   * time can be estimated. Other transfers are too fast or too variable to estimate.
   */
  protected readonly etaMinutes = computed(() => {
    if (!this.wizard.options().keepOrder) return 0;
    const remaining = this.results().filter(
      (r) => r.item.category === 'tracks' && (r.status === 'pending' || r.status === 'running'),
    ).length;
    return remaining ? Math.ceil((remaining * 1.2) / 60) : 0;
  });
  /** "Keep order" saves liked songs one per second: tell the user why it is slow. */
  protected readonly slowByDesign = computed(
    () => this.wizard.options().keepOrder && (this.wizard.selectedItems().tracks?.length ?? 0) > 0,
  );

  protected percent(done: number, total: number) {
    return total ? (done / total) * 100 : 0;
  }
}
