"use client";

import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useAuth } from '@/components/providers/AuthProvider';
import { type RegisterFormData } from '@/lib/validation/auth-schemas';

// Loading component for Suspense boundary
const RegisterPageLoading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Main register page component
const RegisterPageContent = () => {
  const { register, isRegisterLoading, error, clearError } = useAuth();

  const handleRegister = async (data: RegisterFormData): Promise<void> => {
    // Clear any existing errors
    clearError();
    
    try {
      await register(data.name, data.email, data.password, data.familyName);
      // Successful registration will be handled by middleware redirect
    } catch (error) {
      // Error is already set in the auth store
      console.error('Registration failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 py-12">
      <div className="w-full max-w-md px-6">
        <RegisterForm
          onSubmit={handleRegister}
          isLoading={isRegisterLoading}
          error={error}
          showFamilyName={true}
        />
      </div>
    </div>
  );
};

// Main register page with Suspense boundary
export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageLoading />}>
      <RegisterPageContent />
    </Suspense>
  );
}