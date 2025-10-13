"use client";

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  Activity,
  Zap,
  DollarSign,
  Users,
  Home,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Loader2,
  Settings
} from 'lucide-react';
import { useFamilyMembers } from '@/stores/family-store';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';
import { FamilyMember } from '@/types/family';
import { 
  QuotaWizardData,
  QuotaTypeSelectionFormData,
  QuotaConfigFormData,
  FamilyMemberSelectionFormData,
  RoomSelectionFormData
} from '@/types/quota';
import { cn } from '@/lib/utils';

// Quota templates for quick setup
const QUOTA_TEMPLATES = [
  {
    id: 'school-day',
    name: 'School Day',
    description: '2 hours of AC usage for weekdays',
    type: 'TIME_BASED' as const,
    dailyLimitSeconds: 2 * 60 * 60, // 2 hours
    resetSchedule: 'DAILY' as const,
    warningThreshold: 75,
  },
  {
    id: 'weekend',
    name: 'Weekend',
    description: '4 hours of AC usage for weekends',
    type: 'TIME_BASED' as const,
    dailyLimitSeconds: 4 * 60 * 60, // 4 hours
    resetSchedule: 'DAILY' as const,
    warningThreshold: 75,
  },
  {
    id: 'summer-intensive',
    name: 'Summer Break',
    description: '6 hours of AC usage during hot summer days',
    type: 'TIME_BASED' as const,
    dailyLimitSeconds: 6 * 60 * 60, // 6 hours
    resetSchedule: 'DAILY' as const,
    warningThreshold: 80,
  },
  {
    id: 'energy-conscious',
    name: 'Energy Saver',
    description: 'Limited to 5 kWh per day',
    type: 'ENERGY_BASED' as const,
    dailyLimitKwh: 5.0,
    resetSchedule: 'DAILY' as const,
    warningThreshold: 75,
  }
];

// Validation schemas for each step
const quotaTypeSchema = z.object({
  type: z.enum(['TIME_BASED', 'USAGE_BASED', 'ENERGY_BASED', 'COST_BASED']),
  template: z.string().optional(),
});

const quotaConfigSchema = z.object({
  // Time-based quota
  dailyLimitSeconds: z.number().min(300).max(86400).optional(), // 5 minutes to 24 hours

  // Usage-based quota
  dailyLimitUsages: z.number().min(1).max(100).optional(),

  // Energy-based quota
  dailyLimitKwh: z.number().min(0.1).max(50.0).optional(),

  // Cost-based quota
  dailyLimitAmount: z.number().min(0.01).max(100.0).optional(),

  // Common settings
  resetSchedule: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  warningThreshold: z.number().min(50).max(95),

  // Optional scheduling
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  activeDays: z.array(z.number().min(0).max(6)).optional(),
});

const familyMemberSelectionSchema = z.object({
  selectedMembers: z.array(z.string()).min(1, 'Select at least one family member'),
});

const roomSelectionSchema = z.object({
  selectedRooms: z.array(z.string()).min(1, 'Select at least one room'),
  applyToAll: z.boolean(),
});

type QuotaTypeFormData = z.infer<typeof quotaTypeSchema>;
type QuotaConfigFormData = z.infer<typeof quotaConfigSchema>;
type FamilyMemberSelectionFormData = z.infer<typeof familyMemberSelectionSchema>;
type RoomSelectionFormData = z.infer<typeof roomSelectionSchema>;

interface QuotaWizardData {
  quotaType: QuotaTypeFormData;
  quotaConfig: QuotaConfigFormData;
  familyMembers: FamilyMemberSelectionFormData;
  roomSelection: RoomSelectionFormData;
}

const WIZARD_STEPS = [
  { id: 1, title: 'Quota Type', description: 'Choose quota type and template' },
  { id: 2, title: 'Configuration', description: 'Set limits and schedules' },
  { id: 3, title: 'Family Members', description: 'Select family members' },
  { id: 4, title: 'Room Assignment', description: 'Choose rooms for quota' },
  { id: 5, title: 'Review & Create', description: 'Review and create quota' },
];

interface QuotaSetupWizardProps {
  onComplete?: (quotaData: QuotaWizardData) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export const QuotaSetupWizard: React.FC<QuotaSetupWizardProps> = ({
  onComplete,
  onCancel,
  className,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<Partial<QuotaWizardData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const familyMembers = useFamilyMembers();
  
  // Get rooms from API
  const rooms = useRoomStore((state) => state.rooms);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);

  // Fetch rooms on component mount
  React.useEffect(() => {
    if (rooms.length === 0) {
      fetchRooms();
    }
  }, [fetchRooms, rooms.length]);

  // Transform API room data to match expected format
  const availableRooms = rooms.map(room => ({
    id: room.roomIdentifier,
    name: room.name,
    location: room.location || 'Unknown',
  }));

  // Progress calculation
  const progress = (currentStep / WIZARD_STEPS.length) * 100;

  // Navigation handlers
  const goToNextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length));
  }, []);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  // Step completion handler
  const handleStepComplete = useCallback((stepData: Partial<QuotaWizardData>) => {
    setWizardData(prev => ({ ...prev, ...stepData }));
    setError(null);

    if (currentStep < WIZARD_STEPS.length) {
      goToNextStep();
    }
  }, [currentStep, goToNextStep]);

  // Final submission
  const handleFinalSubmit = async (finalData: Partial<QuotaWizardData>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const completeData: QuotaWizardData = {
        ...wizardData,
        ...finalData,
      } as QuotaWizardData;

      await onComplete?.(completeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quota');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <QuotaTypeStep
            onNext={handleStepComplete}
            initialData={wizardData.quotaType}
          />
        );
      case 2:
        return (
          <QuotaConfigStep
            quotaType={wizardData.quotaType?.type}
            template={wizardData.quotaType?.template}
            onNext={handleStepComplete}
            onPrevious={goToPreviousStep}
            initialData={wizardData.quotaConfig}
          />
        );
      case 3:
        return (
          <FamilyMemberSelectionStep
            familyMembers={familyMembers.filter(m => m.id !== user?.id)} // Exclude current user
            onNext={handleStepComplete}
            onPrevious={goToPreviousStep}
            initialData={wizardData.familyMembers}
          />
        );
      case 4:
        return (
          <RoomSelectionStep
            onNext={handleStepComplete}
            onPrevious={goToPreviousStep}
            initialData={wizardData.roomSelection}
            availableRooms={availableRooms}
          />
        );
      case 5:
        return (
          <ReviewStep
            wizardData={wizardData}
            familyMembers={familyMembers}
            onSubmit={handleFinalSubmit}
            onPrevious={goToPreviousStep}
            isSubmitting={isSubmitting}
            availableRooms={availableRooms}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn("w-full max-w-4xl mx-auto space-y-6", className)}>
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Quota Setup Wizard</CardTitle>
              <CardDescription>
                Step {currentStep} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep - 1].description}
              </CardDescription>
            </div>
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {WIZARD_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center space-x-1",
                    index < currentStep - 1 && "text-green-600",
                    index === currentStep - 1 && "text-primary font-medium"
                  )}
                >
                  {index < currentStep - 1 ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Step Content */}
      {renderCurrentStep()}
    </div>
  );
};

// Step Components
const QuotaTypeStep: React.FC<{
  onNext: (data: { quotaType: QuotaTypeFormData }) => void;
  initialData?: QuotaTypeFormData;
}> = ({ onNext, initialData }) => {
  const form = useForm<QuotaTypeFormData>({
    resolver: zodResolver(quotaTypeSchema),
    defaultValues: initialData || { type: 'TIME_BASED' },
  });

  const selectedType = form.watch('type');
  const selectedTemplate = form.watch('template');

  const handleTemplateSelect = (templateId: string) => {
    form.setValue('template', templateId);
    const template = QUOTA_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      form.setValue('type', template.type);
    }
  };

  const onSubmit = (data: QuotaTypeFormData) => {
    onNext({ quotaType: data });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Choose Quota Type</span>
        </CardTitle>
        <CardDescription>
          Select the type of quota and optionally use a pre-configured template
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Quick Templates */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick Setup Templates</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {QUOTA_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template.id)}
                  className={cn(
                    "p-4 border rounded-lg text-left transition-all hover:bg-muted/30",
                    selectedTemplate === template.id && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">
                      {template.type === 'TIME_BASED' && <Clock className="h-4 w-4 text-blue-600" />}
                      {template.type === 'ENERGY_BASED' && <Zap className="h-4 w-4 text-yellow-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {template.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Manual Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Or Choose Quota Type Manually</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { value: 'TIME_BASED', icon: Clock, label: 'Time Based', desc: 'Limit by daily/weekly hours' },
                { value: 'USAGE_BASED', icon: Activity, label: 'Usage Based', desc: 'Limit by number of uses' },
                { value: 'ENERGY_BASED', icon: Zap, label: 'Energy Based', desc: 'Limit by kWh consumption' },
                { value: 'COST_BASED', icon: DollarSign, label: 'Cost Based', desc: 'Limit by dollar amount' },
              ].map(({ value, icon: Icon, label, desc }) => (
                <label
                  key={value}
                  className={cn(
                    "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all hover:bg-muted/30",
                    selectedType === value && !selectedTemplate && "border-primary bg-primary/5"
                  )}
                >
                  <input
                    type="radio"
                    {...form.register('type')}
                    value={value}
                    className="sr-only"
                    onChange={() => form.setValue('template', undefined)}
                  />
                  <Icon className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit">
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// QuotaConfigStep - Configure quota limits and settings
const QuotaConfigStep: React.FC<{
  quotaType?: 'TIME_BASED' | 'USAGE_BASED' | 'ENERGY_BASED' | 'COST_BASED';
  template?: string;
  onNext: (data: { quotaConfig: QuotaConfigFormData }) => void;
  onPrevious: () => void;
  initialData?: QuotaConfigFormData;
}> = ({ quotaType, template, onNext, onPrevious, initialData }) => {
  const form = useForm<QuotaConfigFormData>({
    resolver: zodResolver(quotaConfigSchema),
    defaultValues: initialData || getDefaultConfigForType(quotaType, template),
  });

  const onSubmit = (data: QuotaConfigFormData) => {
    onNext({ quotaConfig: data });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Configure Quota Settings</span>
        </CardTitle>
        <CardDescription>
          Set the limits and schedule for your {quotaType?.toLowerCase().replace('_', ' ')} quota
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Quota Type Specific Settings */}
          {quotaType === 'TIME_BASED' && (
            <div className="space-y-4">
              <Label>Daily Time Limit</Label>
              <div className="flex items-center space-x-4">
                <Input
                  type="number"
                  placeholder="Hours"
                  min="0"
                  max="24"
                  {...form.register('dailyLimitSeconds', {
                    setValueAs: (value) => parseInt(value) * 3600
                  })}
                  defaultValue={Math.floor((form.watch('dailyLimitSeconds') || 0) / 3600)}
                />
                <span className="text-sm text-muted-foreground">hours per day</span>
              </div>
            </div>
          )}

          {quotaType === 'USAGE_BASED' && (
            <div className="space-y-4">
              <Label>Daily Usage Limit</Label>
              <div className="flex items-center space-x-4">
                <Input
                  type="number"
                  placeholder="Number of uses"
                  min="1"
                  max="100"
                  {...form.register('dailyLimitUsages', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">uses per day</span>
              </div>
            </div>
          )}

          {quotaType === 'ENERGY_BASED' && (
            <div className="space-y-4">
              <Label>Daily Energy Limit</Label>
              <div className="flex items-center space-x-4">
                <Input
                  type="number"
                  placeholder="kWh"
                  min="0.1"
                  max="50"
                  step="0.1"
                  {...form.register('dailyLimitKwh', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">kWh per day</span>
              </div>
            </div>
          )}

          {quotaType === 'COST_BASED' && (
            <div className="space-y-4">
              <Label>Daily Cost Limit</Label>
              <div className="flex items-center space-x-4">
                <Input
                  type="number"
                  placeholder="Amount"
                  min="0.01"
                  max="100"
                  step="0.01"
                  {...form.register('dailyLimitAmount', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">$ per day</span>
              </div>
            </div>
          )}

          <Separator />

          {/* Common Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reset Schedule</Label>
              <Select
                value={form.watch('resetSchedule')}
                onValueChange={(value) => form.setValue('resetSchedule', value as 'DAILY' | 'WEEKLY' | 'MONTHLY')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reset schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Warning Threshold ({form.watch('warningThreshold')}%)</Label>
              <Input
                type="number"
                min="50"
                max="95"
                {...form.register('warningThreshold', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Optional Time Restrictions */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="timeRestrictions"
                checked={!!form.watch('startTime') || !!form.watch('endTime')}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    form.setValue('startTime', undefined);
                    form.setValue('endTime', undefined);
                    form.setValue('activeDays', undefined);
                  } else {
                    form.setValue('startTime', '09:00');
                    form.setValue('endTime', '21:00');
                    form.setValue('activeDays', [1, 2, 3, 4, 5]); // Mon-Fri
                  }
                }}
              />
              <Label htmlFor="timeRestrictions">Set time restrictions</Label>
            </div>

            {(form.watch('startTime') || form.watch('endTime')) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    {...form.register('startTime')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    {...form.register('endTime')}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Active Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <label key={day} className="flex items-center space-x-1">
                        <Checkbox
                          checked={(form.watch('activeDays') || []).includes(index)}
                          onCheckedChange={(checked) => {
                            const current = form.watch('activeDays') || [];
                            if (checked) {
                              form.setValue('activeDays', [...current, index]);
                            } else {
                              form.setValue('activeDays', current.filter(d => d !== index));
                            }
                          }}
                        />
                        <span className="text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onPrevious}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button type="submit">
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// FamilyMemberSelectionStep - Select family members for quota
const FamilyMemberSelectionStep: React.FC<{
  familyMembers: FamilyMember[];
  onNext: (data: { familyMembers: FamilyMemberSelectionFormData }) => void;
  onPrevious: () => void;
  initialData?: FamilyMemberSelectionFormData;
}> = ({ familyMembers, onNext, onPrevious, initialData }) => {
  const form = useForm<FamilyMemberSelectionFormData>({
    resolver: zodResolver(familyMemberSelectionSchema),
    defaultValues: initialData || { selectedMembers: [] },
  });

  const selectedMembers = form.watch('selectedMembers');

  const toggleMember = (memberId: string) => {
    const current = form.getValues('selectedMembers');
    if (current.includes(memberId)) {
      form.setValue('selectedMembers', current.filter(id => id !== memberId));
    } else {
      form.setValue('selectedMembers', [...current, memberId]);
    }
  };

  const onSubmit = (data: FamilyMemberSelectionFormData) => {
    onNext({ familyMembers: data });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Select Family Members</span>
        </CardTitle>
        <CardDescription>
          Choose which family members this quota will apply to
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-3">
            {familyMembers.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No family members found. You need to add family members first before creating quotas.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-lg text-left transition-all hover:bg-muted/30",
                      selectedMembers.includes(member.id) && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-medium text-primary">
                          {member.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{member.displayName}</div>
                        <div className="text-sm text-muted-foreground">
                          {member.role} • Age: {member.age}
                        </div>
                      </div>
                    </div>
                    {selectedMembers.includes(member.id) && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {form.formState.errors.selectedMembers && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {form.formState.errors.selectedMembers.message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onPrevious}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              type="submit"
              disabled={familyMembers.length === 0 || selectedMembers.length === 0}
            >
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// RoomSelectionStep - Select rooms for quota application
const RoomSelectionStep: React.FC<{
  onNext: (data: { roomSelection: RoomSelectionFormData }) => void;
  onPrevious: () => void;
  initialData?: RoomSelectionFormData;
  availableRooms: Array<{ id: string; name: string; location: string }>;
}> = ({ onNext, onPrevious, initialData, availableRooms }) => {
  const form = useForm<RoomSelectionFormData>({
    resolver: zodResolver(roomSelectionSchema),
    defaultValues: initialData || { selectedRooms: [], applyToAll: false },
  });

  const selectedRooms = form.watch('selectedRooms');
  const applyToAll = form.watch('applyToAll');

  const toggleRoom = (roomId: string) => {
    const current = form.getValues('selectedRooms');
    if (current.includes(roomId)) {
      form.setValue('selectedRooms', current.filter(id => id !== roomId));
    } else {
      form.setValue('selectedRooms', [...current, roomId]);
    }
  };

  const handleApplyToAllChange = (checked: boolean) => {
    form.setValue('applyToAll', checked);
    if (checked) {
      form.setValue('selectedRooms', availableRooms.map(room => room.id));
    } else {
      form.setValue('selectedRooms', []);
    }
  };

  const onSubmit = (data: RoomSelectionFormData) => {
    onNext({ roomSelection: data });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Home className="h-5 w-5" />
          <span>Select Rooms</span>
        </CardTitle>
        <CardDescription>
          Choose which rooms this quota will apply to
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Apply to All Rooms Option */}
          <div className="flex items-center space-x-2 p-4 border rounded-lg">
            <Checkbox
              id="applyToAll"
              checked={applyToAll}
              onCheckedChange={handleApplyToAllChange}
            />
            <Label htmlFor="applyToAll" className="font-medium">
              Apply to all rooms
            </Label>
          </div>

          {/* Individual Room Selection */}
          {!applyToAll && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Rooms</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => toggleRoom(room.id)}
                    className={cn(
                      "flex items-center space-x-3 p-4 border rounded-lg text-left transition-all hover:bg-muted/30",
                      selectedRooms.includes(room.id) && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <Home className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium text-sm">{room.name}</div>
                        <div className="text-xs text-muted-foreground">{room.location}</div>
                      </div>
                    </div>
                    {selectedRooms.includes(room.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.formState.errors.selectedRooms && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {form.formState.errors.selectedRooms.message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onPrevious}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              type="submit"
              disabled={!applyToAll && selectedRooms.length === 0}
            >
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// ReviewStep - Final review and creation
const ReviewStep: React.FC<{
  wizardData: Partial<QuotaWizardData>;
  familyMembers: FamilyMember[];
  onSubmit: (data: Partial<QuotaWizardData>) => Promise<void>;
  onPrevious: () => void;
  isSubmitting: boolean;
  availableRooms: Array<{ id: string; name: string; location: string }>;
}> = ({ wizardData, familyMembers, onSubmit, onPrevious, isSubmitting, availableRooms }) => {
  const handleSubmit = async () => {
    await onSubmit({});
  };

  const getQuotaTypeDisplay = () => {
    const type = wizardData.quotaType?.type;
    switch (type) {
      case 'TIME_BASED': return 'Time Based';
      case 'USAGE_BASED': return 'Usage Based';
      case 'ENERGY_BASED': return 'Energy Based';
      case 'COST_BASED': return 'Cost Based';
      default: return 'Unknown';
    }
  };

  const getLimitDisplay = () => {
    const config = wizardData.quotaConfig;
    const type = wizardData.quotaType?.type;

    if (!config) return 'Not configured';

    switch (type) {
      case 'TIME_BASED':
        const hours = Math.floor((config.dailyLimitSeconds || 0) / 3600);
        return `${hours} hour${hours !== 1 ? 's' : ''} per day`;
      case 'USAGE_BASED':
        return `${config.dailyLimitUsages} use${config.dailyLimitUsages !== 1 ? 's' : ''} per day`;
      case 'ENERGY_BASED':
        return `${config.dailyLimitKwh} kWh per day`;
      case 'COST_BASED':
        return `$${config.dailyLimitAmount} per day`;
      default:
        return 'Not configured';
    }
  };

  const getSelectedMembers = () => {
    const selectedIds = wizardData.familyMembers?.selectedMembers || [];
    return familyMembers.filter(member => selectedIds.includes(member.id));
  };

  const getSelectedRooms = () => {
    const roomSelection = wizardData.roomSelection;
    if (!roomSelection) return [];

    if (roomSelection.applyToAll) {
      return availableRooms;
    }

    return availableRooms.filter(room => roomSelection.selectedRooms.includes(room.id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Check className="h-5 w-5" />
          <span>Review & Create Quota</span>
        </CardTitle>
        <CardDescription>
          Review your quota settings before creating
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quota Summary */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Quota Type</div>
                <div className="text-lg font-semibold">{getQuotaTypeDisplay()}</div>
                {wizardData.quotaType?.template && (
                  <Badge variant="secondary" className="text-xs">
                    {QUOTA_TEMPLATES.find(t => t.id === wizardData.quotaType?.template)?.name}
                  </Badge>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Limit</div>
                <div className="text-lg font-semibold">{getLimitDisplay()}</div>
                <div className="text-xs text-muted-foreground">
                  Resets: {wizardData.quotaConfig?.resetSchedule?.toLowerCase() || 'daily'}
                </div>
              </div>
            </Card>
          </div>

          {/* Family Members */}
          <div>
            <div className="text-sm font-medium mb-2">Family Members ({getSelectedMembers().length})</div>
            <div className="flex flex-wrap gap-2">
              {getSelectedMembers().map(member => (
                <Badge key={member.id} variant="outline" className="flex items-center space-x-1">
                  <span>{member.displayName}</span>
                  <span className="text-xs text-muted-foreground">({member.role})</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Rooms */}
          <div>
            <div className="text-sm font-medium mb-2">
              Rooms ({getSelectedRooms().length})
              {wizardData.roomSelection?.applyToAll && (
                <Badge variant="secondary" className="ml-2 text-xs">All Rooms</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {getSelectedRooms().map(room => (
                <Badge key={room.id} variant="outline">
                  {room.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          {wizardData.quotaConfig && (
            <div>
              <div className="text-sm font-medium mb-2">Settings</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Warning at {wizardData.quotaConfig.warningThreshold}% usage</div>
                {wizardData.quotaConfig.startTime && wizardData.quotaConfig.endTime && (
                  <div>
                    Active hours: {wizardData.quotaConfig.startTime} - {wizardData.quotaConfig.endTime}
                  </div>
                )}
                {wizardData.quotaConfig.activeDays && wizardData.quotaConfig.activeDays.length < 7 && (
                  <div>
                    Active days: {wizardData.quotaConfig.activeDays.map(day =>
                      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]
                    ).join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onPrevious} disabled={isSubmitting}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Quota...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Create Quota
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function for template defaults
function getDefaultConfigForType(
  quotaType?: 'TIME_BASED' | 'USAGE_BASED' | 'ENERGY_BASED' | 'COST_BASED',
  templateId?: string
): Partial<QuotaConfigFormData> {
  if (templateId) {
    const template = QUOTA_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      return {
        dailyLimitSeconds: template.type === 'TIME_BASED' ? template.dailyLimitSeconds : undefined,
        dailyLimitKwh: template.type === 'ENERGY_BASED' ? template.dailyLimitKwh : undefined,
        resetSchedule: template.resetSchedule,
        warningThreshold: template.warningThreshold,
      };
    }
  }

  // Default values based on quota type
  switch (quotaType) {
    case 'TIME_BASED':
      return {
        dailyLimitSeconds: 2 * 60 * 60, // 2 hours
        resetSchedule: 'DAILY',
        warningThreshold: 75,
      };
    case 'USAGE_BASED':
      return {
        dailyLimitUsages: 5,
        resetSchedule: 'DAILY',
        warningThreshold: 75,
      };
    case 'ENERGY_BASED':
      return {
        dailyLimitKwh: 3.0,
        resetSchedule: 'DAILY',
        warningThreshold: 75,
      };
    case 'COST_BASED':
      return {
        dailyLimitAmount: 10.0,
        resetSchedule: 'DAILY',
        warningThreshold: 75,
      };
    default:
      return {
        resetSchedule: 'DAILY',
        warningThreshold: 75,
      };
  }
}

export default QuotaSetupWizard;