import {
  ApplicationRef,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { apiForAuth, Session } from '@/app/core/session';
import { Toasts } from '@/app/core/toasts';
import { Wizard } from '@/app/core/wizard';
import { I18n } from '@/i18n/i18n';
import { prepareLogin, startLogin, type PreparedLogin } from '@/lib/spotify/auth';
import type { Slot } from '@/lib/spotify/types';
import { AccountChip, accountName } from './shared';

/** `view-transition-name` must be a CSS identifier; Spotify ids may contain dots. */
const transitionName = (id: string) => `account-${id.replace(/[^\w-]/g, '-')}`;

/** One side of the connection: the account we copy from, or the one we copy to. */
@Component({
  selector: 'app-account-card',
  imports: [NgIcon, HlmButtonImports, HlmCardImports, AccountChip],
  host: { class: 'block' },
  template: `
    <section hlmCard class="h-full">
      <div hlmCardHeader>
        <h2 hlmCardTitle>{{ i18n.t(isOld() ? 'connect.oldCard' : 'connect.newCard') }}</h2>
        <p hlmCardDescription>{{ i18n.t(isOld() ? 'connect.oldBody' : 'connect.newBody') }}</p>
      </div>
      <div hlmCardContent class="space-y-3">
        @if (account(); as acc) {
          <!-- The transition name follows the account, so a swap animates it across the cards. -->
          <div
            class="bg-muted/40 flex items-center justify-between gap-3 rounded-lg border p-3"
            [style.view-transition-name]="viewTransition()"
          >
            <app-account-chip [profile]="acc.profile" />
            <button hlmBtn variant="outline" size="sm" (click)="session.signOut(slot())">
              <ng-icon name="lucideLogOut" />
              {{ i18n.t('connect.signOut') }}
            </button>
          </div>
        } @else {
          <button
            hlmBtn
            size="lg"
            class="w-full"
            (click)="login()"
            [disabled]="busy() || !prepared()"
          >
            @if (busy()) {
              <ng-icon name="lucideLoaderCircle" class="animate-spin" />
            }
            {{ i18n.t(busy() ? 'connect.signingIn' : 'connect.signIn') }}
          </button>
        }
        @if (error() && !account()) {
          <p role="alert" class="text-destructive text-sm">{{ error() }}</p>
        }
      </div>
    </section>
  `,
})
export class AccountCard implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly session = inject(Session);
  private readonly toasts = inject(Toasts);

  readonly slot = input.required<Slot>();

  protected readonly isOld = computed(() => this.slot() === 'old');
  protected readonly account = computed(() => this.session.accounts()[this.slot()]);
  protected readonly viewTransition = computed(() => {
    const account = this.account();
    return account ? transitionName(account.profile.id) : null;
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  /** A login is prepared ahead of time so the click can open the popup without awaiting. */
  protected readonly prepared = signal<PreparedLogin | null>(null);

  ngOnInit() {
    this.prepare();
  }

  private prepare() {
    prepareLogin(this.slot()).then(
      (p) => this.prepared.set(p),
      (e: unknown) => this.error.set(e instanceof Error ? e.message : String(e)),
    );
  }

  protected async login() {
    const prepared = this.prepared();
    if (!prepared) return;
    // Synchronous, first thing in the click handler: see `startLogin`.
    const pending = startLogin(prepared);
    this.prepared.set(null);
    this.prepare();
    this.error.set(null);
    this.busy.set(true);
    try {
      const auth = await pending;
      const profile = await apiForAuth(auth).me();
      // Selections and cached libraries are kept per account, so nothing needs clearing.
      this.session.setAccount(this.slot(), { auth, profile });
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      if (code === 'popup-closed') return;
      const message =
        code === 'popup-blocked'
          ? this.i18n.t('connect.popupBlocked')
          : this.i18n.t('connect.loginFailed', { message: code });
      this.error.set(message);
      this.toasts.error(message);
    } finally {
      this.busy.set(false);
    }
  }
}

/** Step 1: connect both accounts, and swap them if needed. */
@Component({
  selector: 'app-step-connect',
  imports: [NgIcon, HlmButtonImports, AccountCard],
  host: { class: 'block space-y-6' },
  template: `
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">{{ i18n.t('connect.title') }}</h1>
      <p class="text-muted-foreground">{{ i18n.t('connect.body') }}</p>
    </div>

    <div class="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
      <app-account-card slot="old" class="h-full" />
      <button
        hlmBtn
        variant="outline"
        size="icon-lg"
        class="mx-auto rounded-full"
        (click)="swap()"
        [disabled]="!canSwap()"
        [attr.aria-label]="i18n.t('connect.swap')"
        [title]="i18n.t('connect.swap')"
      >
        <!-- ng-icon sets its own display, so the responsive visibility lives on wrappers. -->
        <span class="hidden md:inline-flex" aria-hidden="true"
          ><ng-icon name="lucideArrowRightLeft"
        /></span>
        <span class="inline-flex md:hidden" aria-hidden="true"
          ><ng-icon name="lucideArrowUpDown"
        /></span>
      </button>
      <app-account-card slot="new" class="h-full" />
    </div>

    <!-- Announces swaps to screen readers. -->
    <p class="sr-only" role="status" aria-live="polite">{{ announcement() }}</p>

    @if (sameAccount()) {
      <p
        role="alert"
        class="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm"
      >
        {{ i18n.t('connect.sameAccount') }}
      </p>
    }

    <div class="flex justify-end">
      <button hlmBtn (click)="wizard.goTo('select')" [disabled]="!ready()">
        {{ i18n.t('connect.continue') }}
        <ng-icon name="lucideArrowRight" />
      </button>
    </div>

    <div class="bg-card flex gap-3 rounded-lg border p-4 text-sm">
      <ng-icon name="lucideInfo" class="text-primary mt-0.5 shrink-0" aria-hidden="true" />
      <div class="space-y-1">
        <p class="font-medium">{{ i18n.t('connect.tipTitle') }}</p>
        <p class="text-muted-foreground">{{ i18n.t('connect.tip') }}</p>
      </div>
    </div>
  `,
})
export class StepConnect {
  protected readonly i18n = inject(I18n);
  protected readonly session = inject(Session);
  protected readonly wizard = inject(Wizard);
  private readonly appRef = inject(ApplicationRef);

  protected readonly announcement = signal('');
  protected readonly sameAccount = computed(() => {
    const { old, new: target } = this.session.accounts();
    return Boolean(old && target && old.profile.id === target.profile.id);
  });
  protected readonly canSwap = computed(() => {
    const { old, new: target } = this.session.accounts();
    return Boolean(old && target) && !this.sameAccount();
  });
  protected readonly ready = this.canSwap;

  /**
   * Swaps From and To. Libraries are cached and selections kept per account, so swapping back
   * reloads nothing from Spotify. The cards' accounts trade places with a view transition.
   */
  protected swap() {
    if (!this.canSwap()) return;
    const apply = () => {
      this.session.swap();
      // The last results describe the previous direction.
      this.wizard.setResults([]);
      const { old, new: target } = this.session.accounts();
      if (old && target) {
        this.announcement.set(
          this.i18n.t('connect.swapped', {
            from: accountName(old.profile),
            to: accountName(target.profile),
          }),
        );
      }
      // Render now, so the view transition captures the new state.
      this.appRef.tick();
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof document.startViewTransition === 'function' && !reduceMotion) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }
}
