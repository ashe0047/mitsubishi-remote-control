# Forgot Password Page - Implementation Plan

## Implementation Overview
Create a complete password reset flow including the `/forgot-password` page, form component, backend integration, and removal of terms/privacy references from registration.

## Phase 1: Remove Terms/Privacy References (Priority: HIGH)

### Task 1.1: Clean Up Registration Form
**Duration**: 10 minutes
**File**: `/src/components/auth/RegisterForm.tsx`

**Steps**:
1. Remove terms/privacy links from registration form
2. Update form layout to remove checkbox/agreement section
3. Test registration flow still works

**Code Changes**:
```typescript
// Remove these sections from RegisterForm.tsx:
// - Terms of Service link (around line 374)
// - Privacy Policy link (around line 378)
// - Agreement checkbox and associated validation
```

### Task 1.2: Update Registration Validation
**Duration**: 5 minutes

**Steps**:
1. Remove terms agreement from form validation schema
2. Update form submission logic
3. Test form validation works correctly

## Phase 2: Create Forgot Password Page (Priority: HIGH)

### Task 2.1: Create Page Structure
**Duration**: 15 minutes

**Files to Create**:
1. `/src/app/forgot-password/page.tsx`
2. `/src/components/auth/ForgotPasswordForm.tsx`

**Page Implementation**:
```typescript
// /src/app/forgot-password/page.tsx
import { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { BackButton } from '@/components/navigation/BackButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Reset Password | Mitsubishi AC Control',
  description: 'Reset your password to regain access to your account',
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <BackButton fallbackRoute="/auth/login" />
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-center">
              Reset Password
            </CardTitle>
            <CardDescription className="text-center">
              Enter your email address and we'll send you reset instructions
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Task 2.2: Create Form Component
**Duration**: 30 minutes

**Form Component Implementation**:
```typescript
// /src/components/auth/ForgotPasswordForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type FormData = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);

    try {
      // TODO: Implement actual API call
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reset email');
      }

      setIsSubmitted(true);
      toast({
        title: 'Reset email sent',
        description: 'Check your email for password reset instructions.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reset email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            If an account with that email exists, we've sent password reset instructions.
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => router.push('/auth/login')}
          className="w-full"
          variant="outline"
        >
          Return to Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email address"
          {...form.register('email')}
          disabled={isLoading}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending Reset Email...
          </>
        ) : (
          'Send Reset Email'
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => router.push('/auth/login')}
        disabled={isLoading}
      >
        Back to Login
      </Button>
    </form>
  );
}
```

### Task 2.3: Backend API Integration
**Duration**: 45 minutes

**API Route Creation**:
```typescript
// /src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = requestSchema.parse(body);

    // TODO: Implement actual password reset logic
    // 1. Validate email exists in database
    // 2. Generate secure reset token
    // 3. Store token with expiration
    // 4. Send email with reset link
    // 5. Return success response (don't reveal if email exists)

    // For now, simulate the process
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, reset instructions have been sent.',
    });
  } catch (error) {
    console.error('Password reset error:', error);

    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
```

## Phase 3: Fix Route Redirects (Priority: MEDIUM)

### Task 3.1: Create Redirect Pages
**Duration**: 10 minutes

**Files to Create**:
1. `/src/app/register/page.tsx` (redirect to `/auth/register`)
2. `/src/app/family/page.tsx` (redirect to `/dashboard/family`)

**Redirect Implementation**:
```typescript
// /src/app/register/page.tsx
import { redirect } from 'next/navigation';

export default function RegisterRedirect() {
  redirect('/auth/register');
}

// /src/app/family/page.tsx
import { redirect } from 'next/navigation';

export default function FamilyRedirect() {
  redirect('/dashboard/family');
}
```

### Task 3.2: Update Internal Links
**Duration**: 15 minutes

**Files to Update**:
- Check and update any internal references to `/register` or `/family`
- Update navigation components if necessary
- Test all navigation flows

## Phase 4: Testing and Validation (Priority: HIGH)

### Task 4.1: Component Testing
**Duration**: 20 minutes

**Test Cases**:
1. **Navigation Test**:
   - Click "Forgot Password" from login page
   - Verify page loads correctly
   - Test back button functionality

2. **Form Validation Test**:
   - Test empty email submission
   - Test invalid email format
   - Test valid email submission

3. **State Management Test**:
   - Verify loading states
   - Test success state display
   - Test error handling

### Task 4.2: Integration Testing
**Duration**: 15 minutes

**Test Scenarios**:
1. **End-to-end Flow**:
   - Login page → Forgot password → Form submission → Success
   - Verify no 404 errors
   - Test mobile responsiveness

2. **Registration Cleanup**:
   - Verify registration works without terms/privacy
   - Test form submission
   - Ensure no broken references

### Task 4.3: Build and Deployment Test
**Duration**: 10 minutes

**Commands**:
```bash
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/frontend

# Type checking
pnpm type-check

# Linting
pnpm lint

# Build verification
pnpm build

# Test development server
pnpm dev
```

## Phase 5: Documentation and Cleanup (Priority: LOW)

### Task 5.1: Update Documentation
**Duration**: 10 minutes

**Updates**:
1. Update README with new page information
2. Document password reset flow
3. Add troubleshooting guide

### Task 5.2: Code Review Preparation
**Duration**: 5 minutes

**Checklist**:
- [ ] All TypeScript errors resolved
- [ ] ESLint passes without warnings
- [ ] Components follow established patterns
- [ ] Accessibility requirements met
- [ ] Mobile responsiveness verified
- [ ] Error handling implemented
- [ ] Success states working
- [ ] Navigation flows complete

## Implementation Verification

### Success Criteria Checklist
- [ ] No 404 error when clicking "Forgot Password" from login
- [ ] Form displays correctly on all devices
- [ ] Email validation works properly
- [ ] Form submission shows appropriate loading states
- [ ] Success state displays with clear messaging
- [ ] Error states handle various failure scenarios
- [ ] Back navigation works correctly
- [ ] Terms/privacy references removed from registration
- [ ] Route redirects function properly
- [ ] All tests pass
- [ ] Build completes successfully

### Performance Metrics
- Page load time: < 2 seconds
- Form submission feedback: < 500ms
- Email validation feedback: < 300ms (debounced)
- Mobile responsiveness: Works on all screen sizes

## Risk Mitigation

### Potential Issues
1. **Backend Integration**: API endpoint may not exist yet
2. **Email Service**: Email sending functionality needs implementation
3. **Rate Limiting**: May need client-side rate limiting
4. **Security**: CSRF protection and input sanitization

### Mitigation Strategies
1. **Mock API**: Implement placeholder API that simulates the flow
2. **Progressive Enhancement**: Build UI first, enhance with backend later
3. **Error Boundaries**: Implement graceful error handling
4. **Security**: Follow existing auth patterns for security measures

## Post-Implementation Tasks

### Immediate Follow-ups
1. Implement actual email sending functionality
2. Add backend password reset token validation
3. Create password reset completion page
4. Implement proper rate limiting

### Future Enhancements
1. Add social login password reset options
2. Implement magic link authentication
3. Add SMS-based password reset
4. Enhanced security features (2FA recovery)

This implementation plan prioritizes the immediate need to fix broken navigation while establishing a foundation for a complete password reset system.