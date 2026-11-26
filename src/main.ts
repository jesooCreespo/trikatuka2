import { bootstrapApplication } from '@angular/platform-browser';
import { installDefaultTrustedTypesPolicy } from './lib/trusted-types';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Before anything can reach a Trusted Types sink (the timer worker).
installDefaultTrustedTypesPolicy();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
