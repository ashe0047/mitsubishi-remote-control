"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';
import { loginSchema, type LoginFormData, type AuthFormProps } from '@/lib/validation/auth-schemas';
import { cn } from '@/lib/utils';

// Component-specific interfaces following TypeScript best practices
interface LoginFormComponentProps extends AuthFormProps<LoginFormData> {
  showRememberMe?: boolean;
  showForgotPassword?: boolean;
  redirectPath?: string;
}

interface LoginFormFieldsProps {
  register: ReturnType<typeof useForm<LoginFormData>>['register'];
  errors: ReturnType<typeof useForm<LoginFormData>>['formState']['errors'];
  isLoading: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
}

interface LoginFormActionsProps {
  isLoading: boolean;
  showRememberMe: boolean;
  showForgotPassword: boolean;
  register: ReturnType<typeof useForm<LoginFormData>>['register'];
}

// Separate component for form fields to maintain single responsibility
const LoginFormFields: React.FC<LoginFormFieldsProps> = ({
  register,
  errors,
  isLoading,
  showPassword,
  onTogglePassword,
}) => {
  return (
    <div className="space-y-4">
      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          Email Address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            disabled={isLoading}
            className={cn(
              "pl-10",
              errors.email && "border-destructive focus-visible:ring-destructive"
            )}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isLoading}
            className={cn(
              "pl-10 pr-10",
              errors.password && "border-destructive focus-visible:ring-destructive"
            )}
            {...register('password')}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={onTogglePassword}
            disabled={isLoading}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>
    </div>
  );
};

// Separate component for form actions
const LoginFormActions: React.FC<LoginFormActionsProps> = ({
  isLoading,
  showRememberMe,
  showForgotPassword,
  register,
}) => {
  return (
    <div className="space-y-4">
      {/* Remember Me and Forgot Password */}
      {(showRememberMe || showForgotPassword) && (
        <div className="flex items-center justify-between">
          {showRememberMe && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                disabled={isLoading}
                {...register('rememberMe')}
              />
              <Label
                htmlFor="rememberMe"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remember me
              </Label>
            </div>
          )}
          {showForgotPassword && (
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
              tabIndex={isLoading ? -1 : 0}
            >
              Forgot password?
            </Link>
          )}
        </div>
      )}

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign in'
        )}
      </Button>
    </div>
  );
};

// Main LoginForm component
export const LoginForm: React.FC<LoginFormComponentProps> = ({
  onSubmit,
  isLoading = false,
  error,
  className,
  showRememberMe = true,
  showForgotPassword = true,
  redirectPath,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get redirect path from URL params or props
  const finalRedirectPath = redirectPath || searchParams.get('redirect') || '/app';

  // Initialize React Hook Form with Zod resolver
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onChange',
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  const isFormLoading = isLoading || isSubmitting;

  // Handle form submission with proper error handling
  const handleFormSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      await onSubmit(data);
      // Redirect on successful login
      router.push(finalRedirectPath);
    } catch (error) {
      // Error handling is managed by parent component
      console.error('Login failed:', error);
    }
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(prev => !prev);
  };

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
        <CardDescription className="text-center">
          Sign in to your account to continue
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
          <LoginFormFields
            register={register}
            errors={errors}
            isLoading={isFormLoading}
            showPassword={showPassword}
            onTogglePassword={togglePasswordVisibility}
          />

          <LoginFormActions
            isLoading={isFormLoading}
            showRememberMe={showRememberMe}
            showForgotPassword={showForgotPassword}
            register={register}
          />
        </form>

        {/* Sign Up Link */}
        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="text-primary hover:underline font-medium"
            tabIndex={isFormLoading ? -1 : 0}
          >
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoginForm;