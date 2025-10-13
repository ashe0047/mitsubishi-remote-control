"use client";

import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/components/providers/AuthProvider';
import { type LoginFormData } from '@/lib/validation/auth-schemas';

// Loading component for Suspense boundary
const LoginPageLoading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Main login page component
const LoginPageContent = () => {
  const { login, isLoginLoading, error, clearError } = useAuth();

  const handleLogin = async (data: LoginFormData): Promise<void> => {
    // Clear any existing errors
    clearError();
    
    try {
      await login(data.email, data.password, data.rememberMe);
      // Successful login will be handled by middleware redirect
    } catch (error) {
      // Error is already set in the auth store
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-md px-6">
        <LoginForm
          onSubmit={handleLogin}
          isLoading={isLoginLoading}
          error={error}
          showRememberMe={true}
          showForgotPassword={true}
        />
      </div>
    </div>
  );
};

// Main login page with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}