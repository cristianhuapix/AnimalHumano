import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  registerForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor() {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      first_name: [''],
      last_name: [''],
      phone: [''],
      city: [''],
      country: ['AR'],
      is_provider: [false]
    });
  }

  async onSubmit() {
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const { email, password, ...userData } = this.registerForm.value;

      // Combinar nombre completo
      const full_name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();

      await this.authService.register(email, password, {
        ...userData,
        full_name: full_name || email.split('@')[0]
      });

      this.router.navigate(['/home']);
    } catch (error: any) {
      this.errorMessage = error.message || 'Error al registrar usuario';
      console.error('Register error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
