import { Component, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { Wizard } from '@/app/core/wizard';
import { I18n } from '@/i18n/i18n';
import { CATEGORIES } from '@/lib/library';
import { CategoryPanel } from './category-panel';
import { CategoryIcon } from './shared';

@Component({
  selector: 'app-step-select',
  imports: [NgIcon, HlmBadgeImports, HlmButtonImports, HlmTabsImports, CategoryPanel, CategoryIcon],
  host: { class: 'block space-y-6' },
  template: `
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">{{ i18n.t('select.title') }}</h1>
      <p class="text-muted-foreground">{{ i18n.t('select.subtitle') }}</p>
    </div>

    <hlm-tabs tab="playlists" class="gap-4">
      <hlm-tabs-list class="h-10 w-full justify-start overflow-x-auto overflow-y-hidden">
        @for (category of categories; track category) {
          <button [hlmTabsTrigger]="category" class="flex-none gap-1.5 px-3 py-1.5">
            <app-category-icon [category]="category" />
            {{ i18n.t('categories.' + category) }}
            @if (count(category); as n) {
              <span
                hlmBadge
                class="h-5 min-w-5 rounded-full px-1.5 tabular-nums"
                [attr.aria-label]="i18n.tn('select.selectedCount', n)"
                >{{ n }}</span
              >
            }
          </button>
        }
      </hlm-tabs-list>
      @for (category of categories; track category) {
        <div [hlmTabsContent]="category">
          <!-- Each section loads only when its tab is first opened. -->
          <ng-template hlmTabsContentLazy>
            <app-category-panel [category]="category" />
          </ng-template>
        </div>
      }
    </hlm-tabs>

    <div
      class="bg-background/90 sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur"
    >
      <button hlmBtn variant="ghost" (click)="wizard.goTo('connect-new')">
        <ng-icon name="lucideArrowLeft" />
        {{ i18n.t('connect.back') }}
      </button>
      <span class="text-muted-foreground text-sm tabular-nums" aria-live="polite">
        {{
          wizard.selectionCount() > 0
            ? i18n.tn('select.totalSelected', wizard.selectionCount())
            : i18n.t('select.nothingSelected')
        }}
      </span>
      <button hlmBtn (click)="wizard.goTo('review')" [disabled]="wizard.selectionCount() === 0">
        {{ i18n.t('connect.continue') }}
        <ng-icon name="lucideArrowRight" />
      </button>
    </div>
  `,
})
export class StepSelect {
  protected readonly i18n = inject(I18n);
  protected readonly wizard = inject(Wizard);
  protected readonly categories = CATEGORIES;

  protected count(category: (typeof CATEGORIES)[number]) {
    return Object.keys(this.wizard.selection()[category]).length;
  }
}
