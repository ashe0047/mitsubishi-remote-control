"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  UserPlus, 
  AlertCircle, 
  Loader2, 
  Edit, 
  Trash2,
  Send,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useFamilyStore, useFamilyMembers, useFamilyInvitations, useFamilyError } from '@/stores/family-store';
import { useAuthStore } from '@/stores/auth-store';
import { FamilyMember, FamilyInvitation, AddFamilyMemberRequest, hasPermission, FamilyPermission } from '@/types/family';
import { cn } from '@/lib/utils';

// Form validation schemas
const addMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['parent', 'child'], {
    required_error: 'Please select a role',
  }),
  shouldSendInvitation: z.boolean().default(true),
});

const sendInvitationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['parent', 'child'], {
    required_error: 'Please select a role',
  }),
  message: z.string().optional(),
});

type AddMemberFormData = z.infer<typeof addMemberSchema>;
type SendInvitationFormData = z.infer<typeof sendInvitationSchema>;

interface FamilyMemberManagementProps {
  className?: string;
}

/**
 * Family Member Management Component
 * Handles adding new members, sending invitations, and managing existing members
 */
export const FamilyMemberManagement: React.FC<FamilyMemberManagementProps> = ({ className }) => {
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isSendInviteOpen, setIsSendInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  const user = useAuthStore((state) => state.user);
  const familyMembers = useFamilyMembers();
  const familyInvitations = useFamilyInvitations();
  const error = useFamilyError();

  const addFamilyMember = useFamilyStore((state) => state.addFamilyMember);
  const updateFamilyMember = useFamilyStore((state) => state.updateFamilyMember);
  const removeFamilyMember = useFamilyStore((state) => state.removeFamilyMember);
  const sendInvitation = useFamilyStore((state) => state.sendInvitation);
  const resendInvitation = useFamilyStore((state) => state.resendInvitation);
  const cancelInvitation = useFamilyStore((state) => state.cancelInvitation);
  const clearError = useFamilyStore((state) => state.clearError);

  const canManageFamily = user && hasPermission(user.role, FamilyPermission.MANAGE_FAMILY);

  if (!canManageFamily) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            You don&apos;t have permission to manage family members
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Family Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Family Member</DialogTitle>
              <DialogDescription>
                Add a new family member to your household
              </DialogDescription>
            </DialogHeader>
            <AddFamilyMemberForm 
              onSuccess={() => setIsAddMemberOpen(false)}
              onSubmit={addFamilyMember}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isSendInviteOpen} onOpenChange={setIsSendInviteOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Send className="mr-2 h-4 w-4" />
              Send Invitation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Family Invitation</DialogTitle>
              <DialogDescription>
                Invite someone to join your family
              </DialogDescription>
            </DialogHeader>
            <SendInvitationForm 
              onSuccess={() => setIsSendInviteOpen(false)}
              onSubmit={sendInvitation}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Family Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Family Members ({familyMembers.length})</CardTitle>
          <CardDescription>
            Manage existing family members and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {familyMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No family members found
            </div>
          ) : (
            <div className="space-y-4">
              {familyMembers.map((member: FamilyMember, index: number) => (
                <div key={member.id}>
                  {index > 0 && <Separator />}
                  <FamilyMemberCard 
                    member={member}
                    currentUser={user!}
                    onEdit={() => setEditingMember(member)}
                    onRemove={() => removeFamilyMember(member.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {familyInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations ({familyInvitations.length})</CardTitle>
            <CardDescription>
              Manage sent invitations and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {familyInvitations.map((invitation: FamilyInvitation, index: number) => (
                <div key={invitation.id}>
                  {index > 0 && <Separator />}
                  <InvitationCard 
                    invitation={invitation}
                    onResend={() => resendInvitation(invitation.id)}
                    onCancel={() => cancelInvitation(invitation.id)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Member Dialog */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Family Member</DialogTitle>
              <DialogDescription>
                Update {editingMember.name}&apos;s information and role
              </DialogDescription>
            </DialogHeader>
            <EditFamilyMemberForm 
              member={editingMember}
              onSuccess={() => setEditingMember(null)}
              onSubmit={(updates) => updateFamilyMember(editingMember.id, updates)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

/**
 * Add Family Member Form Component
 */
interface AddFamilyMemberFormProps {
  onSuccess: () => void;
  onSubmit: (data: AddFamilyMemberRequest) => Promise<FamilyMember>;
}

const AddFamilyMemberForm: React.FC<AddFamilyMemberFormProps> = ({ onSuccess, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddMemberFormData>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: '',
      fullName: '',
      role: 'child',
      shouldSendInvitation: true,
    },
  });

  const handleSubmit = async (data: AddMemberFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Failed to add family member:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter email address"
          {...form.register('email')}
          disabled={isSubmitting}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          placeholder="Enter full name"
          {...form.register('fullName')}
          disabled={isSubmitting}
        />
        {form.formState.errors.fullName && (
          <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="CHILD"
              {...form.register('role')}
              disabled={isSubmitting}
            />
            <span>Child</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="PARENT"
              {...form.register('role')}
              disabled={isSubmitting}
            />
            <span>Parent</span>
          </label>
        </div>
        {form.formState.errors.role && (
          <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="shouldSendInvitation"
          {...form.register('shouldSendInvitation')}
          disabled={isSubmitting}
        />
        <Label htmlFor="shouldSendInvitation">Send invitation email</Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onSuccess} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            'Add Member'
          )}
        </Button>
      </div>
    </form>
  );
};

/**
 * Send Invitation Form Component
 */
interface SendInvitationFormProps {
  onSuccess: () => void;
  onSubmit: (data: SendInvitationFormData) => Promise<FamilyInvitation>;
}

const SendInvitationForm: React.FC<SendInvitationFormProps> = ({ onSuccess, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SendInvitationFormData>({
    resolver: zodResolver(sendInvitationSchema),
    defaultValues: {
      email: '',
      role: 'child',
      message: '',
    },
  });

  const handleSubmit = async (data: SendInvitationFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Failed to send invitation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter email address"
          {...form.register('email')}
          disabled={isSubmitting}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="CHILD"
              {...form.register('role')}
              disabled={isSubmitting}
            />
            <span>Child</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="PARENT"
              {...form.register('role')}
              disabled={isSubmitting}
            />
            <span>Parent</span>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Personal Message (Optional)</Label>
        <Input
          id="message"
          placeholder="Add a personal message to the invitation"
          {...form.register('message')}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onSuccess} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Invitation'
          )}
        </Button>
      </div>
    </form>
  );
};

/**
 * Family Member Card Component
 */
interface FamilyMemberCardProps {
  member: FamilyMember;
  currentUser: { id: string; role: 'parent' | 'child' | 'admin' | 'adult' | 'teen' | 'guest' };
  onEdit: () => void;
  onRemove: () => void;
}

const FamilyMemberCard: React.FC<FamilyMemberCardProps> = ({ 
  member, 
  currentUser, 
  onEdit, 
  onRemove 
}) => {
  const isCurrentUser = member.id === currentUser.id;

  const getRoleColor = (role: string) => {
    return role === 'parent' 
      ? 'bg-blue-100 text-blue-800 border-blue-200' 
      : 'bg-green-100 text-green-800 border-green-200';
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center space-x-4">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <span className="font-medium">{member.name}</span>
            {isCurrentUser && (
              <span className="text-xs text-muted-foreground">(You)</span>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{member.email}</span>
          <span className="text-xs text-muted-foreground">
            Joined {new Date(member.createdAt).toLocaleDateString()}
          </span>
        </div>
        <Badge variant="outline" className={getRoleColor(member.role)}>
          {member.role}
        </Badge>
      </div>
      
      {!isCurrentUser && (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Invitation Card Component
 */
interface InvitationCardProps {
  invitation: FamilyInvitation;
  onResend: () => void;
  onCancel: () => void;
}

const InvitationCard: React.FC<InvitationCardProps> = ({ 
  invitation, 
  onResend, 
  onCancel 
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'DECLINED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'ACCEPTED':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'DECLINED':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center space-x-4">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            {getStatusIcon(invitation.status)}
            <span className="font-medium">{invitation.email}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>Role: {invitation.role}</span>
            <span>•</span>
            <span>Invited {new Date(invitation.invitedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <Badge variant="outline" className={getStatusColor(invitation.status)}>
          {invitation.status}
        </Badge>
      </div>
      
      {invitation.status === 'PENDING' && (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={onResend}>
            <Send className="h-4 w-4" />
            Resend
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Edit Family Member Form Component
 */
interface EditFamilyMemberFormProps {
  member: FamilyMember;
  onSuccess: () => void;
  onSubmit: (updates: Partial<FamilyMember>) => Promise<FamilyMember>;
}

const EditFamilyMemberForm: React.FC<EditFamilyMemberFormProps> = ({ 
  member, 
  onSuccess, 
  onSubmit 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ name, role });
      onSuccess();
    } catch (error) {
      console.error('Failed to update family member:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="child"
              checked={role === 'child'}
              onChange={(e) => setRole(e.target.value as 'parent' | 'child')}
              disabled={isSubmitting}
            />
            <span>Child</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              value="parent"
              checked={role === 'parent'}
              onChange={(e) => setRole(e.target.value as 'parent' | 'child')}
              disabled={isSubmitting}
            />
            <span>Parent</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onSuccess} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            'Update Member'
          )}
        </Button>
      </div>
    </form>
  );
};

export default FamilyMemberManagement;