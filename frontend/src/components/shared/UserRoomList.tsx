"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Thermometer, Lightbulb, Gauge } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

interface Room {
  id: string;
  name: string;
  description?: string;
  deviceCount: number;
  activeDevices: number;
  temperature?: number;
  devices: {
    aircon: number;
    lighting: number;
    sensors: number;
  };
}

interface UserRoomListProps {
  title?: string;
  description?: string;
  className?: string;
}

const UserRoomList: React.FC<UserRoomListProps> = ({
  title,
  description,
  className,
}) => {
  const user = useAuthStore((state) => state.user);

  // Mock room data - should be replaced with actual data fetching
  const rooms: Room[] = [
    {
      id: 'living-room',
      name: 'Living Room',
      description: 'Main family area',
      deviceCount: 4,
      activeDevices: 2,
      temperature: 22,
      devices: {
        aircon: 1,
        lighting: 2,
        sensors: 1,
      },
    },
    {
      id: 'bedroom',
      name: 'Bedroom',
      description: 'Master bedroom',
      deviceCount: 3,
      activeDevices: 1,
      temperature: 21,
      devices: {
        aircon: 1,
        lighting: 1,
        sensors: 1,
      },
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      description: 'Cooking and dining area',
      deviceCount: 2,
      activeDevices: 0,
      temperature: 23,
      devices: {
        aircon: 0,
        lighting: 1,
        sensors: 1,
      },
    },
  ];

  const getDeviceIcon = (type: string, count: number) => {
    if (count === 0) return null;

    switch (type) {
      case 'aircon':
        return <Thermometer className="h-4 w-4" />;
      case 'lighting':
        return <Lightbulb className="h-4 w-4" />;
      case 'sensors':
        return <Gauge className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const defaultTitle = user?.role === 'child' ? 'My Rooms' : 'All Rooms';
  const defaultDescription = user?.role === 'child'
    ? 'Control devices in your assigned rooms'
    : 'Manage all smart home devices';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{title || defaultTitle}</h1>
        <p className="text-muted-foreground">
          {description || defaultDescription}
        </p>
      </div>

      {/* Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <Card key={room.id} className="transition-all hover:shadow-md group">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Home className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{room.name}</CardTitle>
                </div>
                {room.temperature && (
                  <Badge variant="outline" className="text-xs">
                    {room.temperature}°C
                  </Badge>
                )}
              </div>
              {room.description && (
                <p className="text-sm text-muted-foreground">{room.description}</p>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Device Summary */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Devices</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{room.deviceCount} total</Badge>
                  <Badge
                    variant={room.activeDevices > 0 ? "default" : "secondary"}
                    className={room.activeDevices > 0 ? "bg-green-500" : ""}
                  >
                    {room.activeDevices} active
                  </Badge>
                </div>
              </div>

              {/* Device Types */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-3">
                  {Object.entries(room.devices).map(([type, count]) => {
                    const icon = getDeviceIcon(type, count);
                    if (!icon) return null;

                    return (
                      <div key={type} className="flex items-center space-x-1 text-xs">
                        {icon}
                        <span>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enter Room Button */}
              <Button
                asChild
                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
              >
                <Link href={`/app/rooms/${room.id}`}>
                  Enter Room
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State for Users with No Rooms */}
      {rooms.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No rooms available</h3>
            <p className="text-muted-foreground text-center">
              {user?.role === 'child'
                ? 'Contact your parent to assign rooms to you.'
                : 'Create your first room to start managing devices.'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserRoomList;