import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { I18n } from '@/i18n/i18n';

@Component({
  selector: 'app-help',
  imports: [RouterLink, NgIcon, HlmButtonImports, HlmCardImports],
  providers: [provideIcons({ lucideArrowLeft })],
  host: { class: 'block space-y-6' },
  template: `
    <a hlmBtn variant="ghost" size="sm" routerLink="/" class="-ml-2">
      <ng-icon name="lucideArrowLeft" />
      {{ i18n.t('help.back') }}
    </a>
    <div class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight">{{ i18n.t('help.title') }}</h1>
      <p class="text-muted-foreground max-w-prose">{{ i18n.t('help.intro') }}</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <section hlmCard>
        <div hlmCardHeader>
          <h2 hlmCardTitle>{{ i18n.t('help.stepsTitle') }}</h2>
        </div>
        <div hlmCardContent>
          <ol class="list-decimal space-y-1.5 pl-5">
            @for (step of steps; track step) {
              <li>{{ i18n.t('help.' + step) }}</li>
            }
          </ol>
        </div>
      </section>
      <section hlmCard>
        <div hlmCardHeader>
          <h2 hlmCardTitle>{{ i18n.t('help.rulesTitle') }}</h2>
        </div>
        <div hlmCardContent>
          <ul class="list-disc space-y-1.5 pl-5">
            <li>{{ i18n.t('help.ruleCopy') }}</li>
            <li>{{ i18n.t('help.ruleFollow') }}</li>
            <li>{{ i18n.t('help.ruleLocal') }}</li>
          </ul>
        </div>
      </section>
      <section hlmCard class="md:col-span-2">
        <div hlmCardHeader>
          <h2 hlmCardTitle>{{ i18n.t('help.orderTitle') }}</h2>
        </div>
        <div hlmCardContent>
          <p class="max-w-prose">{{ i18n.t('help.order') }}</p>
        </div>
      </section>
    </div>

    <p class="text-sm">
      <a class="text-primary underline-offset-4 hover:underline" routerLink="/privacy">{{
        i18n.t('help.privacy')
      }}</a>
    </p>
  `,
})
export class Help {
  protected readonly i18n = inject(I18n);
  protected readonly steps = ['step1', 'step2', 'step3', 'step4'];
}
