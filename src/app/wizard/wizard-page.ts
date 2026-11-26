import { Component, computed, effect, inject } from '@angular/core';
import { RunController } from '@/app/core/run-controller';
import { Session } from '@/app/core/session';
import { Wizard, type Step } from '@/app/core/wizard';
import { StepConnect } from './step-connect';
import { StepReport } from './step-report';
import { StepReview } from './step-review';
import { StepRun } from './step-run';
import { StepSelect } from './step-select';
import { Stepper } from './stepper';

/** The step that is actually allowed, given which accounts are connected. */
function allowedStep(step: Step, hasOld: boolean, hasNew: boolean, running: boolean): Step {
  if (running) return 'run';
  if (!hasOld) return 'connect-old';
  if (!hasNew && step !== 'connect-old') return 'connect-new';
  if (step === 'run') return 'report';
  return step;
}

@Component({
  selector: 'app-wizard-page',
  imports: [Stepper, StepConnect, StepSelect, StepReview, StepRun, StepReport],
  host: { class: 'block space-y-8' },
  template: `
    <app-stepper [current]="current()" />
    @switch (current()) {
      @case ('connect-old') {
        <app-step-connect slot="old" />
      }
      @case ('connect-new') {
        <app-step-connect slot="new" />
      }
      @case ('select') {
        <app-step-select />
      }
      @case ('review') {
        <app-step-review />
      }
      @case ('run') {
        <app-step-run />
      }
      @case ('report') {
        <app-step-report />
      }
    }
  `,
})
export class WizardPage {
  private readonly wizard = inject(Wizard);
  private readonly session = inject(Session);
  private readonly run = inject(RunController);

  protected readonly current = computed(() =>
    allowedStep(
      this.wizard.step(),
      Boolean(this.session.accounts().old),
      Boolean(this.session.accounts().new),
      this.run.running(),
    ),
  );

  constructor() {
    // Keep the stored step in line with what is allowed (e.g. after signing out), and start each
    // step at the top of the page.
    effect(() => {
      const current = this.current();
      if (current !== this.wizard.step()) this.wizard.goTo(current);
      window.scrollTo({ top: 0 });
    });
  }
}
