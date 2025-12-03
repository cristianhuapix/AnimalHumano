import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Generic GET request
   */
  get<T>(endpoint: string, params?: any): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, { params: httpParams });
  }

  /**
   * Generic POST request
   */
  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, body);
  }

  /**
   * Generic PUT request
   */
  put<T>(endpoint: string, body: any): Observable<T> {
    const fullUrl = `${this.apiUrl}/${endpoint}`;
    console.log('[ApiService.put] Making PUT request to:', fullUrl, 'with body:', body);
    const observable = this.http.put<T>(fullUrl, body);
    console.log('[ApiService.put] Observable created');
    return observable;
  }

  /**
   * Generic PATCH request
   */
  patch<T>(endpoint: string, body: any): Observable<T> {
    return this.http.patch<T>(`${this.apiUrl}/${endpoint}`, body);
  }

  /**
   * Generic DELETE request
   */
  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}/${endpoint}`);
  }
}
