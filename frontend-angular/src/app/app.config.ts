import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { skipsViewTransition } from './view-transitions';
import { errorInterceptor } from './core/api/error.interceptor';
import { authInterceptor } from './core/auth/http/auth.interceptor';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions({
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (skipsViewTransition(from, to)) transition.skipTransition();
        },
      }),
    ),
    // errorInterceptor va primero: ve el error ya tratado por authInterceptor (sesión cerrada) y lo normaliza.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    // Aplica el tema guardado antes de mostrar cualquier pantalla (también el login).
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
  ],
};
