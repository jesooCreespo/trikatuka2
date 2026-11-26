import { Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import type { I18n } from '@/i18n/i18n';
import type { Category, LibraryItem } from '@/lib/library';
import type { UserProfile } from '@/lib/spotify/types';
import type { ItemResult } from '@/transfer/engine';

export const CATEGORY_ICONS: Record<Category, string> = {
  playlists: 'lucideListMusic',
  tracks: 'lucideHeart',
  albums: 'lucideDisc3',
  artists: 'lucideMicVocal',
  shows: 'lucidePodcast',
};

export function accountName(profile: UserProfile): string {
  return profile.display_name || profile.id;
}

/** Human-readable explanation of an item result. */
export function reasonText(i18n: I18n, r: ItemResult): string {
  if (!r.reason) return '';
  if (r.reason === 'result.copied' && r.omitted) {
    return i18n.t('result.copiedOmitted', { added: r.added, omitted: r.omitted });
  }
  // Known reasons are i18n keys; anything else is Spotify's own message.
  return r.reason.startsWith('result.') ? i18n.t(r.reason, { added: r.added ?? 0 }) : r.reason;
}

@Component({
  selector: 'app-category-icon',
  imports: [NgIcon],
  host: { class: 'inline-flex', 'aria-hidden': 'true' },
  template: `<ng-icon [name]="icon()" />`,
})
export class CategoryIcon {
  readonly category = input.required<Category>();
  protected readonly icon = computed(() => CATEGORY_ICONS[this.category()]);
}

/** Cover image of an item (round for artists), or its category icon. */
@Component({
  selector: 'app-cover',
  imports: [CategoryIcon],
  host: {
    class: 'grid shrink-0 place-items-center overflow-hidden bg-muted text-muted-foreground',
    '[class.rounded-full]': 'item().category === "artists"',
    '[class.rounded-md]': 'item().category !== "artists"',
  },
  template: `
    @if (item().imageUrl; as src) {
      <img [src]="src" alt="" loading="lazy" class="size-full object-cover" />
    } @else {
      <app-category-icon [category]="item().category" />
    }
  `,
})
export class Cover {
  readonly item = input.required<LibraryItem>();
}

@Component({
  selector: 'app-account-chip',
  imports: [HlmAvatarImports],
  host: { class: 'flex min-w-0 items-center gap-3' },
  template: `
    <hlm-avatar class="size-9">
      @if (image(); as src) {
        <img hlmAvatarImage [src]="src" alt="" />
      }
      <span hlmAvatarFallback class="bg-accent text-accent-foreground font-semibold">
        {{ name().slice(0, 1).toUpperCase() }}
      </span>
    </hlm-avatar>
    <div class="min-w-0">
      <p class="truncate font-medium">{{ name() }}</p>
      @if (profile().display_name) {
        <p class="text-muted-foreground truncate text-xs">{{ profile().id }}</p>
      }
    </div>
  `,
})
export class AccountChip {
  readonly profile = input.required<UserProfile>();
  protected readonly name = computed(() => accountName(this.profile()));
  protected readonly image = computed(() => this.profile().images?.[0]?.url ?? null);
}
