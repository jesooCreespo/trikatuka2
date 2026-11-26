import { Component, type OnInit } from '@angular/core';
import { AUTH_MESSAGE_TYPE, completeLogin, type AuthMessage } from '@/lib/spotify/auth';

/**
 * Runs in the login popup after Spotify redirects to /afterLogin: exchanges the code for tokens
 * and hands them to the window that opened the popup.
 */
@Component({
  selector: 'app-after-login',
  template: `<p class="text-muted-foreground py-10 text-center" aria-busy="true">…</p>`,
})
export class AfterLogin implements OnInit {
  async ngOnInit() {
    const opener = window.opener as Window | null;
    let message: AuthMessage;
    try {
      const { slot, auth } = await completeLogin(window.location.href);
      message = { type: AUTH_MESSAGE_TYPE, slot, auth };
    } catch (error) {
      const slot = (error as { slot?: 'old' | 'new' }).slot ?? null;
      message = {
        type: AUTH_MESSAGE_TYPE,
        slot,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    if (!opener || opener.closed) {
      // Opened directly (not as a popup): nothing to hand the tokens to.
      window.location.replace('/');
      return;
    }
    // Same-origin only, so tokens never reach another site.
    opener.postMessage(message, window.location.origin);
    window.close();
  }
}
