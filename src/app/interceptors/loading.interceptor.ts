import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Show the loader when a request starts
  loadingService.show();

  return next(req).pipe(
    // Ensure we hide the loader whether the request succeeds or fails
    finalize(() => {
      loadingService.hide();
    })
  );
};
