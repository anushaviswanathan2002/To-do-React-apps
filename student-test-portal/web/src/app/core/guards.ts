import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();
  return auth.user() ? true : router.createUrlTree(['/login']);
};

export const roleGuard = (...roles: Role[]): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();
  return auth.hasRole(...roles) ? true : router.createUrlTree(['/']);
};
