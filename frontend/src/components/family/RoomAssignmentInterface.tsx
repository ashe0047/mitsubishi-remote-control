"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Home,
  User,
  Settings,
  Eye,
  Shield,
  Loader2,
  Save,
  AlertCircle,
  Users
} from 'lucide-react';
import { useFamilyStore, useFamilyMembers, useRoomAssignments, useFamilyError, useFamilyLoading } from '@/stores/family-store';
import { useAuthStore } from '@/stores/auth-store';
import { FamilyMember, hasPermission, FamilyPermission } from '@/types/family';
import { cn } from '@/lib/utils';

// Mock room data - in real app, this would come from API
const AVAILABLE_ROOMS = [
  { id: 'living-room', name: 'Living Room', location: 'Ground Floor' },
  { id: 'master-bedroom', name: 'Master Bedroom', location: 'First Floor' },
  { id: 'kids-room-1', name: "Kids Room 1", location: 'First Floor' },
  { id: 'kids-room-2', name: "Kids Room 2", location: 'First Floor' },
  { id: 'office', name: 'Home Office', location: 'Ground Floor' },
  { id: 'guest-room', name: 'Guest Room', location: 'First Floor' },
];

type AccessLevel = 'VIEW_ONLY' | 'CONTROL' | 'ADMIN';

interface RoomAssignmentInterfaceProps {
  className?: string;
  selectedMember?: FamilyMember | null;
}

/**
 * Room Assignment Interface Component
 * Provides visual interface for managing room access permissions
 */
export const RoomAssignmentInterface: React.FC<RoomAssignmentInterfaceProps> = ({
  className,
  selectedMember
}) => {
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(selectedMember || null);
  const [roomAssignments, setRoomAssignments] = useState<Record<string, { assigned: boolean; accessLevel: AccessLevel }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const user = useAuthStore((state) => state.user);
  const familyMembers = useFamilyMembers();
  const allRoomAssignments = useRoomAssignments();
  const loading = useFamilyLoading();
  const error = useFamilyError();

  const loadRoomAssignments = useFamilyStore((state) => state.loadRoomAssignments);
  const updateRoomAssignments = useFamilyStore((state) => state.updateRoomAssignments);
  const clearError = useFamilyStore((state) => state.clearError);

  const canAssignRooms = user && hasPermission(user.role, FamilyPermission.ASSIGN_ROOMS);

  // Load room assignments when member changes
  useEffect(() => {
    if (editingMember) {
      loadRoomAssignments(editingMember.id);

      // Initialize room assignments state
      const memberAssignments = allRoomAssignments[editingMember.id] || [];
      const assignmentMap: Record<string, { assigned: boolean; accessLevel: AccessLevel }> = {};

      AVAILABLE_ROOMS.forEach(room => {
        const assignment = memberAssignments.find(a => a.roomId === room.id);
        assignmentMap[room.id] = {
          assigned: !!assignment,
          accessLevel: assignment?.accessLevel || 'CONTROL',
        };
      });

      setRoomAssignments(assignmentMap);
      setHasChanges(false);
    }
  }, [editingMember, allRoomAssignments, loadRoomAssignments]);

  // Reset when selectedMember prop changes
  useEffect(() => {
    setEditingMember(selectedMember || null);
  }, [selectedMember]);

  if (!canAssignRooms) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            You don&apos;t have permission to manage room assignments
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleMemberSelect = (member: FamilyMember) => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to switch members?')) {
        return;
      }
    }
    setEditingMember(member);
  };

  const handleRoomToggle = (roomId: string, assigned: boolean) => {
    setRoomAssignments(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        assigned,
      }
    }));
    setHasChanges(true);
  };

  const handleAccessLevelChange = (roomId: string, accessLevel: AccessLevel) => {
    setRoomAssignments(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        accessLevel,
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!editingMember) return;

    setIsSaving(true);
    try {
      const assignedRoomIds = Object.entries(roomAssignments)
        .filter(([, assignment]) => assignment.assigned)
        .map(([roomId]) => roomId);

      await updateRoomAssignments(editingMember.id, {
        roomIds: assignedRoomIds,
        // Note: In a real implementation, you might handle access levels per room
      });

      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save room assignments:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getAccessLevelIcon = (level: AccessLevel) => {
    switch (level) {
      case 'VIEW_ONLY':
        return <Eye className="h-4 w-4" />;
      case 'CONTROL':
        return <Settings className="h-4 w-4" />;
      case 'ADMIN':
        return <Shield className="h-4 w-4" />;
    }
  };

  const getAccessLevelColor = (level: AccessLevel) => {
    switch (level) {
      case 'VIEW_ONLY':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'CONTROL':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ADMIN':
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

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

      {/* Member Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Family Member
          </CardTitle>
          <CardDescription>
            Choose a family member to manage their room access permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading.isLoadingMembers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading family members...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {familyMembers
                .filter((member: FamilyMember) => member.id !== user?.id) // Don't show current user
                .map((member: FamilyMember) => (
                  <Button
                    key={member.id}
                    variant={editingMember?.id === member.id ? "default" : "outline"}
                    className="justify-start h-auto p-3"
                    onClick={() => handleMemberSelect(member)}
                  >
                    <div className="flex flex-col items-start text-left">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{member.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {member.role}
                      </Badge>
                    </div>
                  </Button>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Assignments */}
      {editingMember && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Room Assignments for {editingMember.name}
                </CardTitle>
                <CardDescription>
                  Select which rooms {editingMember.name} can access and their permission level
                </CardDescription>
              </div>
              {hasChanges && (
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading.isLoadingAssignments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading room assignments...
              </div>
            ) : (
              <div className="space-y-4">
                {AVAILABLE_ROOMS.map((room, index) => (
                  <div key={room.id}>
                    {index > 0 && <Separator />}
                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-center space-x-4">
                        <Checkbox
                          id={`room-${room.id}`}
                          checked={roomAssignments[room.id]?.assigned || false}
                          onCheckedChange={(checked) =>
                            handleRoomToggle(room.id, checked as boolean)
                          }
                        />
                        <div className="flex flex-col">
                          <Label htmlFor={`room-${room.id}`} className="font-medium cursor-pointer">
                            {room.name}
                          </Label>
                          <span className="text-sm text-muted-foreground">
                            {room.location}
                          </span>
                        </div>
                      </div>

                      {roomAssignments[room.id]?.assigned && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">Access Level:</span>
                          <div className="flex space-x-1">
                            {(['VIEW_ONLY', 'CONTROL', 'ADMIN'] as AccessLevel[]).map((level) => (
                              <Button
                                key={level}
                                variant={roomAssignments[room.id]?.accessLevel === level ? "default" : "outline"}
                                size="sm"
                                className="h-8"
                                onClick={() => handleAccessLevelChange(room.id, level)}
                              >
                                {getAccessLevelIcon(level)}
                                <span className="ml-1 text-xs">
                                  {level.replace('_', ' ')}
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Access Level Legend */}
      {editingMember && (
        <Card>
          <CardHeader>
            <CardTitle>Access Level Guide</CardTitle>
            <CardDescription>
              Understanding different room access permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <Eye className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="font-medium">View Only</div>
                  <div className="text-sm text-muted-foreground">
                    Can see room status but cannot control AC
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <Settings className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">Control</div>
                  <div className="text-sm text-muted-foreground">
                    Can control AC within quota limits
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg">
                <Shield className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium">Admin</div>
                  <div className="text-sm text-muted-foreground">
                    Full control including quota overrides
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Assignments Summary */}
      {editingMember && (
        <Card>
          <CardHeader>
            <CardTitle>Assignment Summary</CardTitle>
            <CardDescription>
              Current room access status for {editingMember.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(roomAssignments)
                .filter(([, assignment]) => assignment.assigned)
                .map(([roomId, assignment]) => {
                  const room = AVAILABLE_ROOMS.find(r => r.id === roomId);
                  return (
                    <div key={roomId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{room?.name}</div>
                        <div className="text-sm text-muted-foreground">{room?.location}</div>
                      </div>
                      <Badge variant="outline" className={getAccessLevelColor(assignment.accessLevel)}>
                        {getAccessLevelIcon(assignment.accessLevel)}
                        <span className="ml-1">{assignment.accessLevel}</span>
                      </Badge>
                    </div>
                  );
                })}

              {Object.entries(roomAssignments).filter(([, assignment]) => assignment.assigned).length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No rooms assigned yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {hasChanges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Remember to save your room assignments.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default RoomAssignmentInterface;