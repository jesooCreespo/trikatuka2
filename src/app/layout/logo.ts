import { Component } from '@angular/core';

/** Two opposite arrows: moving things from one account to the other. */
@Component({
  selector: 'app-logo',
  host: { class: 'inline-block shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 32 32" class="size-full">
      <rect width="32" height="32" rx="8" class="fill-primary" />
      <path
        d="M9 12h11l-3-3M23 20H12l3 3"
        fill="none"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="stroke-primary-foreground"
      />
    </svg>
  `,
})
export class Logo {}
