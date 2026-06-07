import { environment } from '../../environments/environment';

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Replaces local loopback/localhost URL with the configured backend base URL
  if (url.startsWith('http://127.0.0.1:8000') || url.startsWith('http://localhost:8000')) {
    const path = url.replace(/^http:\/\/(127\.0\.0\.1|localhost):8000/, '');
    return `${environment.apiBaseUrl}${path}`;
  }
  
  // If it's a relative path starting with /, prefix with environment.apiBaseUrl
  if (url.startsWith('/')) {
    return `${environment.apiBaseUrl}${url}`;
  }
  
  return url;
}
