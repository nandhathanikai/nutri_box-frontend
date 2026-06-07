import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private activeRequests = 0;
  private isLoading$ = new BehaviorSubject<boolean>(false);
  
  // Observable for components to listen to
  isLoading = this.isLoading$.asObservable();

  show() {
    this.activeRequests++;
    this.isLoading$.next(true);
  }

  hide() {
    this.activeRequests--;
    if (this.activeRequests <= 0) {
      this.activeRequests = 0;
      this.isLoading$.next(false);
    }
  }

  get isCurrentlyLoading(): boolean {
    return this.isLoading$.value;
  }
}
