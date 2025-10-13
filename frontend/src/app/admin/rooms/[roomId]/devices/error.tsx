"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';

/**
 * Error boundary for Room Device Management page
 */
export default function RoomDevicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    console.error('Room Device Management page error:', error);
  }, [error]);

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/rooms">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Rooms
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <CardTitle>Something went wrong</CardTitle>
            </div>
            <CardDescription>
              Failed to load room devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred while loading devices for this room.'}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground font-mono">
                Error ID: {error.digest}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 flex-1"
                onClick={reset}
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
              <Link href="/admin/rooms" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full">
                  Go Back
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
