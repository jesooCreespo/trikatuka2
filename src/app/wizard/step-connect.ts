import { Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { LibraryStore } from '@/app/core/library-store';
import { apiForAuth, Session } from '@/app/core/session';
import { Toasts } from '@/app/core/toasts';
import { Wizard } from '@/app/core/wizard';
import { I18n } from '@/i18n/i18n';
import { prepareLogin, startLogin, type PreparedLogin } from '@/lib/spotify/auth';
import type { Slot } from '@/lib/spotify/types';
import { AccountChip } from './shared';

@Component({
  selector: 'app-step-connect',
  imports: [NgIcon, HlmButtonImports, HlmCardImports, AccountChip],
  host: { class: 'mx-auto block max-w-xl space-y-4' },
  template: `
    <section hlmCard>
      <div hlmCardHeader>
        <h1 hlmCardTitle class="text-2xl tracking-tight">
          {{ i18n.t(isOld() ? 'connect.oldTitle' : 'connect.newTitle') }}
        </h1>
        <p hlmCardDescription>{{ i18n.t(isOld() ? 'connect.oldBody' : 'connect.newBody') }}</p>
      </div>
      <div hlmCardContent class="space-y-4">
        @if (account(); as acc) {
          <div class="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
            <div class="min-w-0">
              <p class="mb-1.5 text-xs text-muted-foreground">{{ i18n.t('connect.connectedAs') }}</p>
              <app-account-chip [profile]="acc.profile" />
            </div>
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
        @if (sameAsOther()) {
          <p
            role="alert"
            class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {{ i18n.t('connect.sameAccount') }}
          </p>
        }
        @if (error() && !account()) {
          <p role="alert" class="text-sm text-destructive">{{ error() }}</p>
        }
      </div>
      <div hlmCardFooter class="justify-between gap-2">
        @if (isOld()) {
          <span></span>
        } @else {
          <button hlmBtn variant="ghost" (click)="wizard.goTo('connect-old')">
            <ng-icon name="lucideArrowLeft" />
            {{ i18n.t('connect.back') }}
          </button>
        }
        <button
          hlmBtn
          (click)="wizard.goTo(isOld() ? 'connect-new' : 'select')"
          [disabled]="!account() || sameAsOther()"
        >
          {{ i18n.t('connect.continue') }}
          <ng-icon name="lucideArrowRight" />
        </button>
      </div>
    </section>

    @if (!isOld()) {
      <div class="flex gap-3 rounded-lg border bg-card p-4 text-sm">
        <ng-icon name="lucideInfo" class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <div class="space-y-1">
          <p class="font-medium">{{ i18n.t('connect.tipTitle') }}</p>
          <p class="text-muted-foreground">{{ i18n.t('connect.tip') }}</p>
        </div>
      </div>
    }
  `,
})
export class StepConnect implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly session = inject(Session);
  protected readonly wizard = inject(Wizard);
  private readonly library = inject(LibraryStore);
  private readonly toasts = inject(Toasts);

  readonly slot = input.required<Slot>();
  protected readonly isOld = computed(() => this.slot() === 'old');
  protected readonly account = computed(() => this.session.accounts()[this.slot()]);
  private readonly other = computed(
    () => this.session.accounts()[this.slot() === 'old' ? 'new' : 'old'],
  );
  protected readonly sameAsOther = computed(() => {
    const account = this.account();
    const other = this.other();
    return Boolean(account && other && account.profile.id === other.profile.id);
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
      if (this.isOld() && profile.id !== this.account()?.profile.id) {
        // A different source account: the old selection and cached library no longer apply.
        this.wizard.clearSelection();
        this.library.clear();
      }
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
