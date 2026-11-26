import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleHelp, lucideLanguages, lucideMonitor, lucideMoon, lucideSun } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { Theme, type ThemePreference } from '@/app/core/theme';
import { I18n } from '@/i18n/i18n';
import { Logo } from './logo';

@Component({
  selector: 'app-header',
  imports: [RouterLink, NgIcon, Logo, HlmButtonImports, HlmDropdownMenuImports],
  providers: [provideIcons({ lucideCircleHelp, lucideLanguages, lucideMonitor, lucideMoon, lucideSun })],
  host: {
    class:
      'sticky top-0 z-30 block border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60',
  },
  template: `
    <header class="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
      <a routerLink="/" class="flex items-center gap-2.5 rounded-md font-semibold tracking-tight">
        <app-logo class="size-7" />
        <span>Trikatuka</span>
        <span class="hidden text-sm font-normal text-muted-foreground sm:inline">
          {{ i18n.t('app.tagline') }}
        </span>
      </a>
      <div class="ml-auto flex items-center gap-1">
        <button
          hlmBtn
          variant="ghost"
          size="sm"
          [hlmDropdownMenuTrigger]="languageMenu"
          [attr.aria-label]="i18n.t('app.language')"
        >
          <ng-icon name="lucideLanguages" />
          <span class="uppercase">{{ i18n.lang() }}</span>
        </button>
        <ng-template #languageMenu>
          <hlm-dropdown-menu class="w-44">
            <hlm-dropdown-menu-label>{{ i18n.t('app.language') }}</hlm-dropdown-menu-label>
            @for (language of i18n.languages; track language.code) {
              <button
                hlmDropdownMenuRadio
                [checked]="i18n.lang() === language.code"
                (triggered)="i18n.use(language.code)"
              >
                <hlm-dropdown-menu-radio-indicator />
                {{ language.label }}
              </button>
            }
          </hlm-dropdown-menu>
        </ng-template>

        <button
          hlmBtn
          variant="ghost"
          size="icon"
          [hlmDropdownMenuTrigger]="themeMenu"
          [attr.aria-label]="i18n.t('app.theme')"
        >
          <ng-icon [name]="themeIcon()" />
        </button>
        <ng-template #themeMenu>
          <hlm-dropdown-menu class="w-44">
            <hlm-dropdown-menu-label>{{ i18n.t('app.theme') }}</hlm-dropdown-menu-label>
            @for (option of themes; track option.value) {
              <button
                hlmDropdownMenuRadio
                [checked]="theme.preference() === option.value"
                (triggered)="theme.set(option.value)"
              >
                <hlm-dropdown-menu-radio-indicator />
                {{ i18n.t(option.label) }}
              </button>
            }
          </hlm-dropdown-menu>
        </ng-template>

        <a hlmBtn variant="ghost" size="icon" routerLink="/help" [attr.aria-label]="i18n.t('app.help')">
          <ng-icon name="lucideCircleHelp" />
        </a>
      </div>
    </header>
  `,
})
export class Header {
  protected readonly i18n = inject(I18n);
  protected readonly theme = inject(Theme);
  protected readonly themes: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'app.themeSystem' },
    { value: 'light', label: 'app.themeLight' },
    { value: 'dark', label: 'app.themeDark' },
  ];
  protected readonly themeIcon = computed(() => {
    const pref = this.theme.preference();
    return pref === 'dark' ? 'lucideMoon' : pref === 'light' ? 'lucideSun' : 'lucideMonitor';
  });
}
