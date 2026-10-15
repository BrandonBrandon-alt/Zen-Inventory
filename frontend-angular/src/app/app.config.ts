import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { errorInterceptor } from './core/api/error.interceptor';
import { authInterceptor } from './core/auth/http/auth.interceptor';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // errorInterceptor va primero: ve el error ya tratado por authInterceptor (sesión cerrada) y lo normaliza.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    // Aplica el tema guardado antes de mostrar cualquier pantalla (también el login).
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
  ],
};
