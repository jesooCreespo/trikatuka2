import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '@/i18n/i18n';
import { version } from '../../../package.json';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  host: { class: 'block border-t text-xs text-muted-foreground' },
  template: `
    <footer class="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4">
      <span>
        {{ i18n.t('footer.by', { version }) }}
        <a
          class="underline-offset-4 hover:underline"
          href="http://aknowakowski.blogspot.com"
          target="_blank"
          rel="noreferrer"
          >akn</a
        >
      </span>
      <a
        class="underline-offset-4 hover:underline"
        href="https://paypal.me/aartek"
        target="_blank"
        rel="noreferrer"
        >{{ i18n.t('footer.beer') }}</a
      >
      <a class="underline-offset-4 hover:underline" routerLink="/privacy">{{
        i18n.t('footer.privacy')
      }}</a>
      <span class="sm:ml-auto">{{ i18n.t('footer.disclaimer') }}</span>
    </footer>
  `,
})
export class Footer {
  protected readonly i18n = inject(I18n);
  /** From package.json, so the version shown is never hardcoded. */
  protected readonly version = version;
}
