import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  const skipLoader = req.headers.has('X-Skip-Loader');
  const isChatbotQuery = req.url.includes('/api/chatbot/query');
  const shouldShowLoader = !skipLoader && !isChatbotQuery;

  // Show the loader when a request starts
  if (shouldShowLoader) {
    loadingService.show();
  }

  // Clone request to remove the custom header so it doesn't get sent to server
  const cleanedReq = skipLoader
    ? req.clone({ headers: req.headers.delete('X-Skip-Loader') })
    : req;

  return next(cleanedReq).pipe(
    // Ensure we hide the loader whether the request succeeds or fails
    finalize(() => {
      if (shouldShowLoader) {
        loadingService.hide();
      }
    })
  );
};
