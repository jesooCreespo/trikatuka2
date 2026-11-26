import type { Routes } from '@angular/router';
import { WizardPage } from './wizard/wizard-page';

export const routes: Routes = [
  { path: '', component: WizardPage },
  { path: 'help', loadComponent: () => import('./pages/help').then((m) => m.Help) },
  { path: 'privacy', loadComponent: () => import('./pages/privacy').then((m) => m.Privacy) },
  // Spotify redirects the login popup here (see src/lib/spotify/auth.ts).
  {
    path: 'afterLogin',
    loadComponent: () => import('./pages/after-login').then((m) => m.AfterLogin),
  },
  // Old addresses of the privacy policy, possibly linked from elsewhere.
  { path: 'privacypolicy.html', redirectTo: 'privacy' },
  { path: 'privacypolicy', redirectTo: 'privacy' },
  { path: '**', redirectTo: '' },
];
