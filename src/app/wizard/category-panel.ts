import { Component, computed, inject, input, type OnInit, output, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { LibraryStore } from '@/app/core/library-store';
import { Session } from '@/app/core/session';
import { Wizard } from '@/app/core/wizard';
import { I18n } from '@/i18n/i18n';
import { matchesSearch, playlistAction, type Category, type LibraryItem } from '@/lib/library';
import { Cover } from './shared';

const PAGE_SIZE = 50;
type PlaylistFilter = 'all' | 'copy' | 'follow';

/** One selectable row: checkbox, cover, name, details and (for playlists) copy/follow badge. */
@Component({
  selector: 'app-item-row',
  imports: [HlmCheckboxImports, HlmBadgeImports, HlmTooltipImports, Cover],
  host: {
    class: 'block transition-colors hover:bg-muted/50',
    '[class.bg-accent/40]': 'checked()',
  },
  template: `
    <label [attr.for]="id()" class="flex cursor-pointer items-center gap-3 px-3 py-2.5">
      <hlm-checkbox [inputId]="id()" [checked]="checked()" (checkedChange)="toggled.emit($event)" />
      <app-cover [item]="item()" class="size-11" />
      <span class="min-w-0 flex-1">
        <span class="block truncate font-medium">{{ item().name }}</span>
        @if (details()) {
          <span class="text-muted-foreground block truncate text-sm">{{ details() }}</span>
        }
      </span>
      @if (action(); as a) {
        <span
          hlmBadge
          [variant]="a === 'copy' ? 'default' : 'secondary'"
          class="shrink-0"
          [hlmTooltip]="i18n.t(a === 'copy' ? 'select.badgeCopyHint' : 'select.badgeFollowHint')"
        >
          {{ i18n.t(a === 'copy' ? 'select.badgeCopy' : 'select.badgeFollow') }}
        </span>
      }
    </label>
  `,
})
export class ItemRow {
  protected readonly i18n = inject(I18n);
  readonly item = input.required<LibraryItem>();
  readonly checked = input(false);
  readonly action = input<'copy' | 'follow' | undefined>(undefined);
  /** Emits the new checked state. */
  readonly toggled = output<boolean>();
  protected readonly id = computed(() => `item-${this.item().category}-${this.item().id}`);
  protected readonly details = computed(() => {
    const item = this.item();
    const count = item.playlist?.itemCount;
    return [item.subtitle, count != null ? this.i18n.tn('select.itemCount', count) : null]
      .filter(Boolean)
      .join(' · ');
  });
}

@Component({
  selector: 'app-category-panel',
  imports: [NgIcon, HlmButtonImports, HlmInputImports, HlmProgressImports, ItemRow],
  host: { class: 'block space-y-3' },
  template: `
    @switch (state().status) {
      @case ('error') {
        <div class="bg-card flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
          <p class="text-destructive">{{ i18n.t('select.loadError') }}</p>
          <button hlmBtn variant="outline" (click)="library.refresh(category())">
            <ng-icon name="lucideRefreshCw" />
            {{ i18n.t('select.retry') }}
          </button>
        </div>
      }
      @case ('ready') {
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-52 flex-1">
            <ng-icon
              name="lucideSearch"
              class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              hlmInput
              type="search"
              class="w-full pl-9"
              [value]="query()"
              (input)="setQuery($any($event.target).value)"
              [placeholder]="i18n.t('select.search')"
              [attr.aria-label]="i18n.t('select.search')"
            />
          </div>
          @if (category() === 'playlists') {
            <!-- A filter, not tabs (there are no panels): toggle buttons in a labelled group. -->
            <div
              role="group"
              [attr.aria-label]="i18n.t('categories.playlists')"
              class="bg-muted inline-flex h-9 items-center rounded-lg p-[3px]"
            >
              @for (option of filters; track option.value) {
                <button
                  type="button"
                  class="focus-visible:ring-ring/50 h-full rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
                  [class.bg-background]="filter() === option.value"
                  [class.shadow-sm]="filter() === option.value"
                  [class.text-foreground]="filter() === option.value"
                  [class.text-muted-foreground]="filter() !== option.value"
                  [attr.aria-pressed]="filter() === option.value"
                  (click)="setFilter(option.value)"
                >
                  {{ i18n.t(option.label) }}
                </button>
              }
            </div>
          }
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            (click)="library.refresh(category())"
            [attr.aria-label]="i18n.t('select.retry')"
          >
            <ng-icon name="lucideRefreshCw" />
          </button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            hlmBtn
            variant="outline"
            size="sm"
            [disabled]="visible().length === 0"
            (click)="wizard.setSelected(category(), visible(), !allVisibleSelected())"
          >
            {{
              allVisibleSelected()
                ? i18n.t('select.clearShown')
                : i18n.t('select.selectAllShown', { count: visible().length })
            }}
          </button>
          <span class="text-muted-foreground tabular-nums">{{
            i18n.tn('select.selectedCount', selectedCount())
          }}</span>
        </div>

        @if (pageItems().length === 0) {
          <div
            class="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center"
          >
            <ng-icon name="lucideInbox" class="text-3xl" aria-hidden="true" />
            <p>
              {{
                query().trim()
                  ? i18n.t('select.noMatches', { query: query().trim() })
                  : i18n.t('select.empty')
              }}
            </p>
          </div>
        } @else {
          <ul class="bg-card divide-y overflow-hidden rounded-xl border">
            @for (item of pageItems(); track item.id) {
              <li>
                <app-item-row
                  [item]="item"
                  [checked]="!!selected()[item.id]"
                  (toggled)="wizard.toggle(item, $event)"
                  [action]="category() === 'playlists' ? actionOf(item) : undefined"
                />
              </li>
            }
          </ul>
        }

        @if (pages() > 1) {
          <div class="flex items-center justify-end gap-2 text-sm">
            <span class="text-muted-foreground mr-2 tabular-nums">
              {{ i18n.t('select.page', { page: currentPage(), pages: pages() }) }}
            </span>
            <button
              hlmBtn
              variant="outline"
              size="icon-sm"
              [disabled]="currentPage() <= 1"
              (click)="page.set(currentPage() - 1)"
              [attr.aria-label]="i18n.t('select.prev')"
            >
              <ng-icon name="lucideChevronLeft" />
            </button>
            <button
              hlmBtn
              variant="outline"
              size="icon-sm"
              [disabled]="currentPage() >= pages()"
              (click)="page.set(currentPage() + 1)"
              [attr.aria-label]="i18n.t('select.next')"
            >
              <ng-icon name="lucideChevronRight" />
            </button>
          </div>
        }
      }
      @default {
        <div class="bg-card space-y-3 rounded-xl border p-6" role="status">
          <p class="text-muted-foreground text-sm">
            {{
              state().progress
                ? i18n.t('select.loading', state().progress!)
                : i18n.t('select.loadingStart')
            }}
          </p>
          <hlm-progress
            [value]="progressPercent()"
            [attr.aria-label]="i18n.t('select.loadingStart')"
          >
            <hlm-progress-indicator />
          </hlm-progress>
          <div class="space-y-2 pt-2" aria-hidden="true">
            @for (n of skeleton; track n) {
              <div class="flex items-center gap-3">
                <div class="bg-muted size-11 animate-pulse rounded-md"></div>
                <div class="bg-muted h-4 flex-1 animate-pulse rounded"></div>
              </div>
            }
          </div>
        </div>
      }
    }
  `,
})
export class CategoryPanel implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly library = inject(LibraryStore);
  protected readonly wizard = inject(Wizard);
  private readonly session = inject(Session);

  readonly category = input.required<Category>();

  protected readonly skeleton = [1, 2, 3, 4, 5];
  protected readonly filters: { value: PlaylistFilter; label: string }[] = [
    { value: 'all', label: 'select.filterAll' },
    { value: 'copy', label: 'select.filterCopy' },
    { value: 'follow', label: 'select.filterFollow' },
  ];
  protected readonly query = signal('');
  protected readonly filter = signal<PlaylistFilter>('all');
  protected readonly page = signal(1);

  protected readonly state = computed(() => this.library.category(this.category())());
  protected readonly selected = computed(() => this.wizard.selection()[this.category()]);
  protected readonly selectedCount = computed(() => Object.keys(this.selected()).length);
  private readonly sourceUserId = computed(() => this.session.accounts().old?.profile.id ?? '');

  protected readonly visible = computed(() => {
    const query = this.query();
    const filter = this.filter();
    return this.state().items.filter(
      (item) => matchesSearch(item, query) && (filter === 'all' || this.actionOf(item) === filter),
    );
  });
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.visible().length / PAGE_SIZE)),
  );
  protected readonly currentPage = computed(() => Math.min(this.page(), this.pages()));
  protected readonly pageItems = computed(() =>
    this.visible().slice((this.currentPage() - 1) * PAGE_SIZE, this.currentPage() * PAGE_SIZE),
  );
  protected readonly allVisibleSelected = computed(
    () => this.visible().length > 0 && this.visible().every((i) => this.selected()[i.id]),
  );
  protected readonly progressPercent = computed(() => {
    const p = this.state().progress;
    return p && p.total ? (p.loaded / p.total) * 100 : 0;
  });

  ngOnInit() {
    this.library.ensureLoaded(this.category());
  }

  protected actionOf(item: LibraryItem) {
    return playlistAction(item, this.sourceUserId());
  }

  protected setQuery(value: string) {
    this.query.set(value);
    this.page.set(1);
  }

  protected setFilter(value: PlaylistFilter) {
    this.filter.set(value);
    this.page.set(1);
  }
}
