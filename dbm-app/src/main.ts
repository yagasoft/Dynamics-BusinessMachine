import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Adds a new app-root to the DOM
// If your selector prefix is different, make sure you adjust this.
const appRoot = document.createElement('app-root');
document.body.appendChild(appRoot);

// bootstrapApplication does quite a few things, but for us the
// the important piece of information is
// "it hooks up the app with the root element"
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
