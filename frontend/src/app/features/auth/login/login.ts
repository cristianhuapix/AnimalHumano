import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ModeService } from '../../../core/services/mode.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private modeService = inject(ModeService);
  private router = inject(Router);

  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      login_as_provider: [false]
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const { email, password, login_as_provider } = this.loginForm.value;
      await this.authService.signIn(email, password);

      // Wait for session to be fully established by checking for token
      let retries = 0;
      while (retries < 10) {
        const token = await this.authService.getAccessToken();
        if (token) {
          console.log('Login complete - Token available');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      // Verificar que el usuario sea proveedor si intenta loguearse como tal
      const currentUser = this.authService.currentUser();
      if (login_as_provider && !currentUser?.is_provider) {
        // Si no es proveedor, cerrar sesión y mostrar error
        await this.authService.signOut();
        this.errorMessage = 'No tienes permisos de proveedor. Por favor, regístrate como proveedor primero.';
        return;
      }

      // Establecer el modo según la selección
      this.modeService.setMode(login_as_provider ? 'provider' : 'user');

      this.router.navigate(['/home']);
    } catch (error: any) {
      this.errorMessage = error.message || 'Error al iniciar sesión';
      console.error('Login error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
