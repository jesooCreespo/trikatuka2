import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideLanguages } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { I18n } from '@/i18n/i18n';

/**
 * The privacy policy, as written by the app's owner. The text is legal content: it is kept
 * verbatim and in English only (translations would not be authoritative). Edit the wording
 * only on the owner's instructions; this component only gives it the app's layout.
 */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink, NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideArrowLeft, lucideLanguages })],
  host: { class: 'block space-y-6' },
  templateUrl: './privacy.html',
})
export class Privacy {
  protected readonly i18n = inject(I18n);
  protected readonly english = computed(() => this.i18n.lang() === 'en');
}
