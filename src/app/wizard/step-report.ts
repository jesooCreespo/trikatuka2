import { Component, computed, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { Wizard } from '@/app/core/wizard';
import { I18n } from '@/i18n/i18n';
import { downloadJson } from '@/lib/download';
import { summarize, type ItemResult, type ItemStatus } from '@/transfer/engine';
import { version } from '../../../package.json';
import { Cover, reasonText } from './shared';

const TILES: { status: ItemStatus; color: string }[] = [
  { status: 'ok', color: 'text-success' },
  { status: 'skipped', color: 'text-muted-foreground' },
  { status: 'failed', color: 'text-destructive' },
  { status: 'cancelled', color: 'text-warning' },
];

@Component({
  selector: 'app-step-report',
  imports: [NgIcon, HlmBadgeImports, HlmButtonImports, HlmCardImports, Cover],
  host: { class: 'block space-y-6' },
  template: `
    <div class="flex items-center gap-3">
      <span class="inline-flex text-3xl" [class]="outcome().color" aria-hidden="true">
        <ng-icon [name]="outcome().icon" />
      </span>
      <h1 class="text-2xl font-semibold tracking-tight">{{ i18n.t(outcome().title) }}</h1>
    </div>

    <ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      @for (tile of tiles; track tile.status) {
        <li class="bg-card rounded-xl border p-4">
          <p
            class="text-3xl font-semibold tabular-nums"
            [class]="counts()[tile.status] > 0 ? tile.color : ''"
          >
            {{ counts()[tile.status] }}
          </p>
          <p class="text-muted-foreground text-sm">{{ i18n.t('status.' + tile.status) }}</p>
        </li>
      }
    </ul>

    <div class="bg-card flex gap-3 rounded-lg border p-4 text-sm">
      <ng-icon name="lucideInfo" class="text-primary mt-0.5 shrink-0" aria-hidden="true" />
      <p class="text-muted-foreground">{{ i18n.t('report.spotifyNote') }}</p>
    </div>

    <section hlmCard>
      <div hlmCardHeader>
        <h2 hlmCardTitle>{{ i18n.t('report.problems') }}</h2>
      </div>
      <div hlmCardContent>
        @if (problems().length === 0) {
          <p class="text-muted-foreground">{{ i18n.t('report.noProblems') }}</p>
        } @else {
          <ul class="max-h-96 divide-y overflow-y-auto rounded-lg border">
            @for (r of problems(); track r.key) {
              <!-- The list can hold thousands of rows: skip layout for the off-screen ones. -->
              <li
                class="flex items-center gap-3 px-3 py-2 [contain-intrinsic-size:auto_3.25rem] [content-visibility:auto]"
              >
                <app-cover [item]="r.item" class="size-9" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ r.item.name }}</p>
                  <p class="text-muted-foreground truncate text-xs">
                    {{ i18n.t('categories.' + r.item.category) }}
                    @if (reason(r); as text) {
                      · {{ text }}
                    }
                  </p>
                </div>
                <span hlmBadge [variant]="r.status === 'failed' ? 'destructive' : 'secondary'">
                  {{ i18n.t(r.status === 'failed' ? 'itemStatus.failed' : 'itemStatus.cancelled') }}
                </span>
              </li>
            }
          </ul>
        }
      </div>
    </section>

    <div class="flex flex-wrap items-center justify-end gap-2">
      <button hlmBtn variant="ghost" (click)="downloadReport()">
        <ng-icon name="lucideDownload" />
        {{ i18n.t('report.download') }}
      </button>
      <button hlmBtn variant="outline" (click)="transferMore()">
        <ng-icon name="lucidePlus" />
        {{ i18n.t('report.more') }}
      </button>
      @if (problems().length > 0) {
        <button hlmBtn (click)="retry()">
          <ng-icon name="lucideRotateCcw" />
          {{ i18n.t('report.retry') }}
        </button>
      }
    </div>
  `,
})
export class StepReport {
  protected readonly i18n = inject(I18n);
  private readonly wizard = inject(Wizard);
  protected readonly tiles = TILES;

  protected readonly counts = computed(() => summarize(this.wizard.results()));
  protected readonly problems = computed(() =>
    this.wizard.results().filter((r) => r.status === 'failed' || r.status === 'cancelled'),
  );
  protected readonly outcome = computed(() => {
    const c = this.counts();
    if (c.cancelled > 0)
      return { title: 'report.titleStopped', icon: 'lucideOctagonX', color: 'text-warning' };
    if (c.failed > 0)
      return { title: 'report.titleIssues', icon: 'lucideCircleAlert', color: 'text-destructive' };
    return { title: 'report.titleDone', icon: 'lucideCircleCheck', color: 'text-success' };
  });

  protected reason(r: ItemResult) {
    return reasonText(this.i18n, r);
  }

  protected downloadReport() {
    downloadJson(
      {
        app: 'trikatuka',
        appVersion: version,
        createdAt: new Date().toISOString(),
        summary: this.counts(),
        items: this.wizard.results().map((r) => ({
          category: r.item.category,
          name: r.item.name,
          uri: r.item.uri,
          status: r.status,
          detail: reasonText(this.i18n, r) || undefined,
        })),
      },
      `trikatuka-report-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  protected transferMore() {
    this.wizard.clearSelection();
    this.wizard.setResults([]);
    this.wizard.goTo('select');
  }

  protected retry() {
    this.wizard.selectRetryable();
    this.wizard.goTo('review');
  }
}
