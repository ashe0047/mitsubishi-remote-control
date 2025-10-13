"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, Mail, Lock, User, Users } from 'lucide-react';
import { registerSchema, type RegisterFormData, type AuthFormProps } from '@/lib/validation/auth-schemas';
import { cn } from '@/lib/utils';

// Component-specific interfaces following TypeScript best practices
interface RegisterFormComponentProps extends AuthFormProps<RegisterFormData> {
  showFamilyName?: boolean;
  redirectPath?: string;
}

interface RegisterFormFieldsProps {
  register: ReturnType<typeof useForm<RegisterFormData>>['register'];
  errors: ReturnType<typeof useForm<RegisterFormData>>['formState']['errors'];
  isLoading: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  showFamilyName: boolean;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
}

// Password strength indicator interface
interface PasswordStrengthProps {
  password: string;
  className?: string;
}

// Password strength helper function
const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  if (password.length === 0) return { score: 0, label: '', color: '' };

  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z\d]/.test(password)) score += 1;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-destructive' };
  if (score <= 4) return { score, label: 'Fair', color: 'bg-yellow-500' };
  if (score <= 5) return { score, label: 'Good', color: 'bg-blue-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
};

// Password strength indicator component
const PasswordStrengthIndicator: React.FC<PasswordStrengthProps> = ({ password, className }) => {
  const { score, label, color } = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Password strength:</span>
        <span className={cn(
          "font-medium",
          score <= 2 ? "text-destructive" : score <= 4 ? "text-yellow-600" : "text-green-600"
        )}>
          {label}
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", color)}
          style={{ width: `${(score / 6) * 100}%` }}
        />
      </div>
    </div>
  );
};

// Form fields component
const RegisterFormFields: React.FC<RegisterFormFieldsProps> = ({
  register,
  errors,
  isLoading,
  showPassword,
  showConfirmPassword,
  showFamilyName,
  onTogglePassword,
  onToggleConfirmPassword,
}) => {
  const [passwordValue, setPasswordValue] = useState('');

  return (
    <div className="space-y-4">
      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Full Name
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="name"
            type="text"
            placeholder="Enter your full name"
            autoComplete="name"
            disabled={isLoading}
            className={cn(
              "pl-10",
              errors.name && "border-destructive focus-visible:ring-destructive"
            )}
            {...register('name')}
          />
        </div>
        {errors.name && (
          <p className="text-sm text-destructive" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

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
            placeholder="Enter your email address"
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

      {/* Family Name Field (Optional) */}
      {showFamilyName && (
        <div className="space-y-2">
          <Label htmlFor="familyName" className="text-sm font-medium">
            Family Name <span className="text-muted-foreground">(Optional)</span>
          </Label>
          <div className="relative">
            <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="familyName"
              type="text"
              placeholder="Enter your family name"
              disabled={isLoading}
              className={cn(
                "pl-10",
                errors.familyName && "border-destructive focus-visible:ring-destructive"
              )}
              {...register('familyName')}
            />
          </div>
          {errors.familyName && (
            <p className="text-sm text-destructive" role="alert">
              {errors.familyName.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Create a family account to manage multiple users
          </p>
        </div>
      )}

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
            placeholder="Create a strong password"
            autoComplete="new-password"
            disabled={isLoading}
            className={cn(
              "pl-10 pr-10",
              errors.password && "border-destructive focus-visible:ring-destructive"
            )}
            {...register('password', {
              onChange: (e) => setPasswordValue(e.target.value)
            })}
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
        <PasswordStrengthIndicator password={passwordValue} />
        {errors.password && (
          <p className="text-sm text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            autoComplete="new-password"
            disabled={isLoading}
            className={cn(
              "pl-10 pr-10",
              errors.confirmPassword && "border-destructive focus-visible:ring-destructive"
            )}
            {...register('confirmPassword')}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={onToggleConfirmPassword}
            disabled={isLoading}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-destructive" role="alert">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>
    </div>
  );
};

// Main RegisterForm component
export const RegisterForm: React.FC<RegisterFormComponentProps> = ({
  onSubmit,
  isLoading = false,
  error,
  className,
  showFamilyName = true,
  redirectPath = '/app',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  // Initialize React Hook Form with Zod resolver
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      familyName: '',
    },
    mode: 'onChange',
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  const isFormLoading = isLoading || isSubmitting;

  // Handle form submission with proper error handling
  const handleFormSubmit = async (data: RegisterFormData): Promise<void> => {
    try {
      await onSubmit(data);
      // Redirect on successful registration
      router.push(redirectPath);
    } catch (error) {
      // Error handling is managed by parent component
      console.error('Registration failed:', error);
    }
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(prev => !prev);
  };

  const toggleConfirmPasswordVisibility = (): void => {
    setShowConfirmPassword(prev => !prev);
  };

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Sign up to get started with AC quota management
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
          <RegisterFormFields
            register={register}
            errors={errors}
            isLoading={isFormLoading}
            showPassword={showPassword}
            showConfirmPassword={showConfirmPassword}
            showFamilyName={showFamilyName}
            onTogglePassword={togglePasswordVisibility}
            onToggleConfirmPassword={toggleConfirmPasswordVisibility}
          />

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isFormLoading}>
            {isFormLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>


        {/* Sign In Link */}
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-primary hover:underline font-medium"
            tabIndex={isFormLoading ? -1 : 0}
          >
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegisterForm;