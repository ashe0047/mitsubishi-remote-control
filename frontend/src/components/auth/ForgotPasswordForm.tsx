"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, Loader2, Mail, Send } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData, type AuthFormProps } from '@/lib/validation/auth-schemas';
import { cn } from '@/lib/utils';

// Component-specific interfaces
interface ForgotPasswordFormComponentProps extends AuthFormProps<ForgotPasswordFormData> {
  onSuccess?: () => void;
  showBackToLogin?: boolean;
}

interface FormSuccessStateProps {
  email: string;
  onReset: () => void;
  onResend: () => Promise<void>;
  isResending: boolean;
}

interface FormFieldsProps {
  register: ReturnType<typeof useForm<ForgotPasswordFormData>>['register'];
  errors: ReturnType<typeof useForm<ForgotPasswordFormData>>['formState']['errors'];
  isLoading: boolean;
}

// Success state component
const FormSuccessState: React.FC<FormSuccessStateProps> = ({
  email,
  onReset,
  onResend,
  isResending,
}) => {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Check Your Email</h3>
        <p className="text-muted-foreground">
          We&apos;ve sent a password reset link to
        </p>
        <p className="font-medium text-foreground break-all">{email}</p>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Click the link in the email to reset your password. If you don&apos;t see it, check your spam folder.
        </p>
        
        <div className="flex flex-col space-y-2">
          <Button
            variant="outline"
            onClick={onResend}
            disabled={isResending}
            className="w-full"
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Resend Email
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            onClick={onReset}
            className="w-full"
          >
            Try Different Email
          </Button>
        </div>
      </div>
    </div>
  );
};

// Form fields component
const FormFields: React.FC<FormFieldsProps> = ({ register, errors, isLoading }) => {
  return (
    <div className="space-y-4">
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
        <p className="text-sm text-muted-foreground">
          Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
        </p>
      </div>
    </div>
  );
};

// Main ForgotPasswordForm component
export const ForgotPasswordForm: React.FC<ForgotPasswordFormComponentProps> = ({
  onSubmit,
  isLoading = false,
  error,
  className,
  onSuccess,
  showBackToLogin = true,
}) => {
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [isResending, setIsResending] = useState(false);

  // Initialize React Hook Form with Zod resolver
  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onChange',
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = form;
  const isFormLoading = isLoading || isSubmitting;
  const emailValue = watch('email');

  // Handle form submission
  const handleFormSubmit = async (data: ForgotPasswordFormData): Promise<void> => {
    try {
      await onSubmit(data);
      setSubmittedEmail(data.email);
      setIsSuccessState(true);
      onSuccess?.();
    } catch (error) {
      // Error handling is managed by parent component
      console.error('Password reset request failed:', error);
    }
  };

  // Handle resend email
  const handleResend = async (): Promise<void> => {
    if (!submittedEmail) return;
    
    setIsResending(true);
    try {
      await onSubmit({ email: submittedEmail });
    } catch (error) {
      console.error('Resend failed:', error);
    } finally {
      setIsResending(false);
    }
  };

  // Reset to form state
  const handleReset = (): void => {
    setIsSuccessState(false);
    setSubmittedEmail('');
    form.reset();
  };

  if (isSuccessState) {
    return (
      <Card className={cn("w-full max-w-md mx-auto", className)}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Email Sent</CardTitle>
        </CardHeader>
        
        <CardContent>
          <FormSuccessState
            email={submittedEmail}
            onReset={handleReset}
            onResend={handleResend}
            isResending={isResending}
          />

          {showBackToLogin && (
            <div className="mt-6 text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Forgot Password</CardTitle>
        <CardDescription className="text-center">
          Don&apos;t worry, we&apos;ll help you reset it
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Forgot Password Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
          <FormFields
            register={register}
            errors={errors}
            isLoading={isFormLoading}
          />

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isFormLoading || !emailValue}>
            {isFormLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending reset link...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Reset Link
              </>
            )}
          </Button>
        </form>

        {/* Back to Login */}
        {showBackToLogin && (
          <div className="text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              tabIndex={isFormLoading ? -1 : 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ForgotPasswordForm;