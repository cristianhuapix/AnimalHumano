import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { User } from '../models';
import { Observable, BehaviorSubject, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

// Singleton Supabase client
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(environment.supabaseUrl, environment.supabaseKey);
  }
  return supabaseInstance;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private supabase: SupabaseClient;

  currentUser = signal<User | null>(null);
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private initPromise: Promise<void>;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.supabase = getSupabaseClient();
    this.initPromise = this.initializeAuth();
  }

  async waitForInitialization(): Promise<void> {
    await this.initPromise;
  }

  private async initializeAuth() {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    console.log('AuthService.initializeAuth - Initial session:', session);

    // If session is invalid or expired, clear localStorage
    if (error || (session && !session.user)) {
      console.warn('AuthService.initializeAuth - Invalid/expired session detected, clearing localStorage');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
    }

    if (session?.user) {
      await this.loadUserProfile(session.user.id);
    }

    this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthService.onAuthStateChange - Event:', event, 'Session:', session);

      // Handle session expiration or sign out
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        this.cachedToken = null;
        this.tokenExpiry = 0;
      }

      if (session?.user) {
        await this.loadUserProfile(session.user.id);
      } else {
        this.currentUser.set(null);
        this.currentUserSubject.next(null);
      }
    });
  }

  private async loadUserProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      this.currentUser.set(data as User);
      this.currentUserSubject.next(data as User);
    }
  }

  /**
   * Register new user
   */
  async register(email: string, password: string, userData: Partial<User>) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });

    if (error) throw error;

    // Create profile
    if (data.user) {
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: email,
          is_provider: userData.is_provider || false,
          ...userData
        });

      if (profileError) throw profileError;

      // Load the new profile
      await this.loadUserProfile(data.user.id);
    }

    return data;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    console.log('AuthService.signIn - Login successful, session:', data.session);
    console.log('AuthService.signIn - Access token:', data.session?.access_token ? `${data.session.access_token.substring(0, 20)}...` : 'NO TOKEN');
    return data;
  }

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;

    // Clear cached token
    this.cachedToken = null;
    this.tokenExpiry = 0;

    // Clear user state
    this.currentUser.set(null);
    this.currentUserSubject.next(null);

    // Clear all Supabase data from localStorage to prevent caching issues
    // This ensures a clean logout even if the user was changed manually in Supabase
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });

    this.router.navigate(['/auth/login']);
  }

  /**
   * Get current session
   */
  async getSession() {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }

  /**
   * Get access token (with caching to avoid lock contention)
   */
  async getAccessToken(): Promise<string | null> {
    const now = Date.now() / 1000; // Current time in seconds

    // Return cached token if still valid (with 60 second buffer)
    if (this.cachedToken && this.tokenExpiry > now + 60) {
      console.log('AuthService.getAccessToken - Using cached token');
      return this.cachedToken;
    }

    console.log('AuthService.getAccessToken - Fetching new session');
    const session = await this.getSession();
    console.log('AuthService.getAccessToken - Session:', session);
    console.log('AuthService.getAccessToken - Access Token:', session?.access_token ? `${session.access_token.substring(0, 20)}...` : 'NO TOKEN');

    // Cache the token and its expiry
    if (session?.access_token && session?.expires_at) {
      this.cachedToken = session.access_token;
      this.tokenExpiry = session.expires_at;
    }

    return session?.access_token || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  /**
   * Check if user is authenticated (async version with session check)
   */
  async isAuthenticatedAsync(): Promise<boolean> {
    await this.waitForInitialization();
    const session = await this.getSession();
    return !!session?.user;
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.currentUser()?.is_admin || false;
  }

  /**
   * Check if user is provider
   */
  isProvider(): boolean {
    return this.currentUser()?.is_provider || false;
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<User>) {
    const user = this.currentUser();
    if (!user) throw new Error('No user logged in');

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    this.currentUser.set(data as User);
    this.currentUserSubject.next(data as User);
    return data;
  }

  /**
   * Reset password
   */
  async resetPassword(email: string) {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    const { error } = await this.supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  }
}
