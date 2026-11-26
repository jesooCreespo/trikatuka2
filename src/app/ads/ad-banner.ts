import { afterNextRender, Component, type ElementRef, inject, input, viewChild } from '@angular/core';
import { I18n } from '@/i18n/i18n';
import { loadAdSense } from './adsense';
import { adsConfig, type AdsConfig } from './config';

/** A responsive AdSense unit. Renders nothing, and loads nothing, unless ads are enabled. */
@Component({
  selector: 'app-ad-banner',
  host: { class: 'block' },
  template: `
    @if (config(); as ads) {
      <aside class="mx-auto w-full max-w-4xl px-4" [attr.aria-label]="i18n.t('ads.label')">
        <p class="mb-1 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
          {{ i18n.t('ads.label') }}
        </p>
        <ins
          #unit
          class="adsbygoogle block min-h-[90px]"
          [attr.data-ad-client]="ads.client"
          [attr.data-ad-slot]="ads.slot"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </aside>
    }
  `,
})
export class AdBanner {
  protected readonly i18n = inject(I18n);
  readonly config = input<AdsConfig | null>(adsConfig);
  private readonly unit = viewChild<ElementRef<HTMLModElement>>('unit');

  constructor() {
    afterNextRender(() => {
      const config = this.config();
      const ins = this.unit()?.nativeElement;
      if (!config || !ins || ins.dataset['adsbygoogleStatus']) return;
      loadAdSense(config);
      try {
        (window.adsbygoogle ??= []).push({});
      } catch {
        // Ad blockers or AdSense errors must never break the app.
      }
    });
  }
}
