import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { AdBanner } from './ads/ad-banner';
import { Theme } from './core/theme';
import { Footer } from './layout/footer';
import { Header } from './layout/header';
import { I18n } from '@/i18n/i18n';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, AdBanner, HlmToasterImports],
  host: { class: 'flex min-h-dvh flex-col' },
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >{{ i18n.t('app.skipToContent') }}</a
    >
    <app-header />
    <main id="main" class="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10">
      <router-outlet />
    </main>
    <app-ad-banner class="mb-6" />
    <app-footer />
    <hlm-toaster [theme]="theme.preference()" richColors closeButton position="top-center" />
  `,
})
export class App {
  protected readonly i18n = inject(I18n);
  protected readonly theme = inject(Theme);
}
