import { Component, computed, inject, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { STEPS, type Step } from '@/app/core/wizard';
import { I18n } from '@/i18n/i18n';

@Component({
  selector: 'app-stepper',
  imports: [NgIcon],
  template: `
    <nav [attr.aria-label]="progress()">
      <p class="mb-2 text-xs font-medium text-muted-foreground sm:hidden">
        {{ progress() }} · {{ i18n.t('steps.' + current()) }}
      </p>
      <ol class="flex items-center gap-1.5 sm:gap-2">
        @for (step of steps; track step; let i = $index; let last = $last) {
          <li
            class="flex flex-1 items-center gap-1.5 sm:gap-2"
            [attr.aria-current]="i === index() ? 'step' : null"
          >
            <span
              class="grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors"
              [class.border-primary]="i <= index()"
              [class.bg-primary]="i < index()"
              [class.text-primary-foreground]="i < index()"
              [class.text-primary]="i === index()"
              [class.ring-4]="i === index()"
              [class.ring-primary/15]="i === index()"
              [class.text-muted-foreground]="i > index()"
            >
              @if (i < index()) {
                <ng-icon name="lucideCheck" class="text-sm" aria-hidden="true" />
              } @else {
                {{ i + 1 }}
              }
            </span>
            <span
              class="hidden truncate text-sm lg:inline"
              [class.font-medium]="i === index()"
              [class.text-muted-foreground]="i !== index()"
            >
              {{ i18n.t('steps.' + step) }}
            </span>
            @if (!last) {
              <span
                class="h-px min-w-3 flex-1"
                [class.bg-primary]="i < index()"
                [class.bg-border]="i >= index()"
                aria-hidden="true"
              ></span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Stepper {
  protected readonly i18n = inject(I18n);
  readonly current = input.required<Step>();
  protected readonly steps = STEPS;
  protected readonly index = computed(() => STEPS.indexOf(this.current()));
  protected readonly progress = computed(() =>
    this.i18n.t('steps.progress', { current: this.index() + 1, total: STEPS.length }),
  );
}
