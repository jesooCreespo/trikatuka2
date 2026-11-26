import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { LibraryStore } from '@/app/core/library-store';
import { RunController } from '@/app/core/run-controller';
import { Session } from '@/app/core/session';
import { Toasts } from '@/app/core/toasts';
import { Wizard } from '@/app/core/wizard';
import { I18n } from '@/i18n/i18n';
import { downloadJson } from '@/lib/download';
import { CATEGORIES, playlistAction, type Category, type LibraryItem } from '@/lib/library';
import { version } from '../../../package.json';
import { AccountChip, accountName, CategoryIcon } from './shared';

@Component({
  selector: 'app-step-review',
  imports: [
    NgIcon,
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmCardImports,
    HlmSwitchImports,
    AccountChip,
    CategoryIcon,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <h1 class="text-2xl font-semibold tracking-tight">{{ i18n.t('review.title') }}</h1>

    @if (session.accounts(); as accounts) {
      <div class="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <section hlmCard class="py-4">
          <div hlmCardContent class="space-y-1.5 px-4">
            <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {{ i18n.t('review.from') }}
            </p>
            @if (accounts.old; as old) {
              <app-account-chip [profile]="old.profile" />
            }
          </div>
        </section>
        <ng-icon
          name="lucideArrowRight"
          class="mx-auto rotate-90 text-xl text-primary sm:rotate-0"
          aria-hidden="true"
        />
        <section hlmCard class="py-4">
          <div hlmCardContent class="space-y-1.5 px-4">
            <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {{ i18n.t('review.to') }}
            </p>
            @if (accounts.new; as target) {
              <app-account-chip [profile]="target.profile" />
            }
          </div>
        </section>
      </div>
    }

    <section hlmCard>
      <div hlmCardHeader>
        <h2 hlmCardTitle>{{ i18n.t('review.whatTitle') }}</h2>
        <div hlmCardAction>
          <button hlmBtn variant="ghost" size="sm" (click)="wizard.goTo('select')">
            <ng-icon name="lucidePencil" />
            {{ i18n.t('review.edit') }}
          </button>
        </div>
      </div>
      <div hlmCardContent>
        <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          @for (category of categories; track category) {
            <li
              class="flex items-center gap-3 rounded-lg border p-3"
              [class.opacity-50]="countOf(category) === 0"
            >
              <span class="grid size-9 place-items-center rounded-md bg-accent text-accent-foreground">
                <app-category-icon [category]="category" />
              </span>
              <div>
                <p class="text-lg leading-tight font-semibold tabular-nums">
                  {{ countOf(category) }}
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ i18n.t('categories.' + category) }}
                  @if (category === 'playlists' && countOf(category) > 0) {
                    ·
                    {{
                      i18n.t('review.playlistsBreakdown', {
                        copy: copyCount(),
                        follow: countOf(category) - copyCount(),
                      })
                    }}
                  }
                </p>
              </div>
            </li>
          }
        </ul>
      </div>
    </section>

    <section hlmCard>
      <div hlmCardHeader>
        <h2 hlmCardTitle>{{ i18n.t('review.optionsTitle') }}</h2>
      </div>
      <div hlmCardContent class="space-y-5">
        <div class="flex items-start justify-between gap-4">
          <label for="opt-skip" class="space-y-0.5">
            <span class="block font-medium">{{ i18n.t('review.skipDuplicates') }}</span>
            <span class="block text-sm text-muted-foreground">{{
              i18n.t('review.skipDuplicatesHint')
            }}</span>
          </label>
          <hlm-switch
            inputId="opt-skip"
            [checked]="wizard.options().skipDuplicates"
            (checkedChange)="wizard.setOption('skipDuplicates', $event)"
          />
        </div>
        <div class="flex items-start justify-between gap-4">
          <label for="opt-order" class="space-y-0.5" [class.opacity-50]="trackCount() === 0">
            <span class="block font-medium">{{ i18n.t('review.keepOrder') }}</span>
            <span class="block text-sm text-muted-foreground">{{
              i18n.t('review.keepOrderHint', { minutes: keepOrderMinutes() })
            }}</span>
          </label>
          <hlm-switch
            inputId="opt-order"
            [checked]="wizard.options().keepOrder && trackCount() > 0"
            [disabled]="trackCount() === 0"
            (checkedChange)="wizard.setOption('keepOrder', $event)"
          />
        </div>
      </div>
    </section>

    <section hlmCard>
      <div hlmCardHeader>
        <h2 hlmCardTitle>{{ i18n.t('review.exportTitle') }}</h2>
        <p hlmCardDescription>{{ i18n.t('review.exportBody') }}</p>
      </div>
      <div hlmCardContent>
        <button hlmBtn variant="outline" (click)="exportBackup()" [disabled]="!!exporting()">
          @if (exporting(); as progress) {
            <ng-icon name="lucideLoaderCircle" class="animate-spin" />
            {{ i18n.t('review.exporting', progress) }}
          } @else {
            <ng-icon name="lucideDownload" />
            {{ i18n.t('review.exportButton') }}
          }
        </button>
      </div>
    </section>

    <div class="flex items-center justify-between gap-3">
      <button hlmBtn variant="ghost" (click)="wizard.goTo('select')">
        <ng-icon name="lucideArrowLeft" />
        {{ i18n.t('connect.back') }}
      </button>
      <hlm-alert-dialog>
        <button hlmAlertDialogTrigger hlmBtn size="lg" [disabled]="wizard.selectionCount() === 0">
          <ng-icon name="lucidePlay" />
          {{ i18n.t('review.start') }}
        </button>
        <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx">
          <hlm-alert-dialog-header>
            <h2 hlmAlertDialogTitle>{{ i18n.t('review.confirmTitle') }}</h2>
            <p hlmAlertDialogDescription>
              {{
                i18n.tn('review.confirmBody', wizard.selectionCount(), { name: targetName() })
              }}
            </p>
          </hlm-alert-dialog-header>
          <hlm-alert-dialog-footer>
            <button hlmAlertDialogCancel (click)="ctx.close()">
              {{ i18n.t('review.cancel') }}
            </button>
            <button hlmAlertDialogAction (click)="ctx.close(); run.start()">
              {{ i18n.t('review.start') }}
            </button>
          </hlm-alert-dialog-footer>
        </hlm-alert-dialog-content>
      </hlm-alert-dialog>
    </div>
  `,
})
export class StepReview {
  protected readonly i18n = inject(I18n);
  protected readonly session = inject(Session);
  protected readonly wizard = inject(Wizard);
  protected readonly run = inject(RunController);
  private readonly library = inject(LibraryStore);
  private readonly toasts = inject(Toasts);

  protected readonly categories = CATEGORIES;
  protected readonly exporting = signal<{ done: number; total: number } | null>(null);

  private readonly items = computed(() => this.wizard.selectedItems());
  protected readonly trackCount = computed(() => this.items().tracks?.length ?? 0);
  protected readonly keepOrderMinutes = computed(() => Math.max(1, Math.ceil(this.trackCount() / 60)));
  protected readonly copyCount = computed(() => {
    const source = this.session.accounts().old?.profile.id ?? '';
    return (this.items().playlists ?? []).filter((p) => playlistAction(p, source) === 'copy')
      .length;
  });
  protected readonly targetName = computed(() => {
    const target = this.session.accounts().new;
    return target ? accountName(target.profile) : '';
  });

  protected countOf(category: Category) {
    return this.items()[category]?.length ?? 0;
  }

  protected async exportBackup() {
    const old = this.session.accounts().old;
    if (!old) return;
    this.exporting.set({ done: 0, total: 0 });
    try {
      // Only needed by the few who export, so it's loaded on demand.
      const { buildBackup } = await import('@/transfer/export');
      const library: Partial<Record<Category, LibraryItem[]>> = {};
      for (const c of CATEGORIES) library[c] = await this.library.load(c);
      const backup = await buildBackup(library, old.profile, this.session.api('old'), version, (done, total) =>
        this.exporting.set({ done, total }),
      );
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(backup, `trikatuka-backup-${old.profile.id}-${date}.json`);
      this.toasts.success(this.i18n.t('review.exportDone'));
    } catch (e) {
      this.toasts.error(
        this.i18n.t('review.exportFailed', { message: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      this.exporting.set(null);
    }
  }
}
