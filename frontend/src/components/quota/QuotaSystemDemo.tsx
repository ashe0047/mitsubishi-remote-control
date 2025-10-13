"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Pause, 
  RotateCcw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

// Import quota components
import QuotaStatusBadge from './QuotaStatusBadge';
import QuotaWarningModal from './QuotaWarningModal';
import QuotaUsageCard from './QuotaUsageCard';
import QuotaAwareAirConRemote from './QuotaAwareAirConRemote';

// Import quota store
import { useQuotaStore } from '@/stores/quota-store';

/**
 * Demo component to test quota system integration.
 * Simulates quota scenarios for development and testing.
 */
export const QuotaSystemDemo: React.FC = () => {
  const [demoUserId] = useState('demo-user-123');
  const [demoRoomId] = useState('living-room');
  const [showModal, setShowModal] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);

  const updateBalance = useQuotaStore(state => state.updateBalance);
  const addViolation = useQuotaStore(state => state.addViolation);
  const setConnected = useQuotaStore(state => state.setConnected);

  // Initialize demo data
  useEffect(() => {
    // Set up initial quota balance
    const initialBalance = {
      quotaId: 'demo-quota-1',
      userId: demoUserId,
      roomId: demoRoomId,
      totalSeconds: 7200, // 2 hours
      usedSeconds: 3600,   // 1 hour used
      remainingSeconds: 3600, // 1 hour remaining
      totalUsageCount: 10,
      usedUsageCount: 6,
      remainingUsageCount: 4,
      totalEnergyKwh: 5.0,
      usedEnergyKwh: 2.5,
      remainingEnergyKwh: 2.5,
      totalCostAmount: 15.00,
      usedCostAmount: 7.50,
      remainingCostAmount: 7.50,
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      isExceeded: false,
      hasOverride: false,
    };

    updateBalance(demoUserId, demoRoomId, initialBalance);
    setConnected(true);
  }, [updateBalance, setConnected, demoUserId, demoRoomId]);

  // Simulate quota scenarios
  const simulateWarning = () => {
    const warningBalance = {
      quotaId: 'demo-quota-1',
      userId: demoUserId,
      roomId: demoRoomId,
      totalSeconds: 7200,
      usedSeconds: 5760, // 80% used
      remainingSeconds: 1440,
      totalUsageCount: 10,
      usedUsageCount: 8,
      remainingUsageCount: 2,
      totalEnergyKwh: 5.0,
      usedEnergyKwh: 4.0,
      remainingEnergyKwh: 1.0,
      totalCostAmount: 15.00,
      usedCostAmount: 12.00,
      remainingCostAmount: 3.00,
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      isExceeded: false,
      hasOverride: false,
    };

    updateBalance(demoUserId, demoRoomId, warningBalance);
  };

  const simulateExceeded = () => {
    const exceededBalance = {
      quotaId: 'demo-quota-1',
      userId: demoUserId,
      roomId: demoRoomId,
      totalSeconds: 7200,
      usedSeconds: 7200, // 100% used
      remainingSeconds: 0,
      totalUsageCount: 10,
      usedUsageCount: 10,
      remainingUsageCount: 0,
      totalEnergyKwh: 5.0,
      usedEnergyKwh: 5.0,
      remainingEnergyKwh: 0,
      totalCostAmount: 15.00,
      usedCostAmount: 15.00,
      remainingCostAmount: 0,
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      isExceeded: true,
      hasOverride: false,
    };

    updateBalance(demoUserId, demoRoomId, exceededBalance);

    // Add violation
    addViolation({
      id: 'violation-' + Date.now(),
      userId: demoUserId,
      roomId: demoRoomId,
      type: 'EXCEEDED',
      message: 'Daily quota exceeded. AC usage has been limited.',
      timestamp: new Date().toISOString(),
    });
  };

  const simulateOverride = () => {
    const overrideBalance = {
      quotaId: 'demo-quota-1',
      userId: demoUserId,
      roomId: demoRoomId,
      totalSeconds: 7200,
      usedSeconds: 7200,
      remainingSeconds: 1800, // 30 min override
      totalUsageCount: 10,
      usedUsageCount: 10,
      remainingUsageCount: 2, // 2 more uses
      totalEnergyKwh: 5.0,
      usedEnergyKwh: 5.0,
      remainingEnergyKwh: 1.0, // 1 kWh override
      totalCostAmount: 15.00,
      usedCostAmount: 15.00,
      remainingCostAmount: 5.00, // $5 override
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      isExceeded: true,
      hasOverride: true,
    };

    updateBalance(demoUserId, demoRoomId, overrideBalance);
  };

  const resetToNormal = () => {
    const normalBalance = {
      quotaId: 'demo-quota-1',
      userId: demoUserId,
      roomId: demoRoomId,
      totalSeconds: 7200,
      usedSeconds: 1800, // 25% used
      remainingSeconds: 5400,
      totalUsageCount: 10,
      usedUsageCount: 2,
      remainingUsageCount: 8,
      totalEnergyKwh: 5.0,
      usedEnergyKwh: 1.0,
      remainingEnergyKwh: 4.0,
      totalCostAmount: 15.00,
      usedCostAmount: 3.00,
      remainingCostAmount: 12.00,
      warningThreshold: 75,
      lastUpdated: new Date().toISOString(),
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      isExceeded: false,
      hasOverride: false,
    };

    updateBalance(demoUserId, demoRoomId, normalBalance);
  };

  const startUsageSimulation = () => {
    setSimulationRunning(true);
    
    // Simulate progressive usage over 10 seconds
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      
      const simulatedUsage = Math.floor(3600 + (progress / 100) * 4800); // From 1h to ~2.3h
      const remaining = Math.max(0, 7200 - simulatedUsage);
      
      const progressBalance = {
        quotaId: 'demo-quota-1',
        userId: demoUserId,
        roomId: demoRoomId,
        totalSeconds: 7200,
        usedSeconds: simulatedUsage,
        remainingSeconds: remaining,
        totalUsageCount: 10,
        usedUsageCount: Math.floor((progress / 100) * 10),
        remainingUsageCount: Math.max(0, 10 - Math.floor((progress / 100) * 10)),
        totalEnergyKwh: 5.0,
        usedEnergyKwh: (progress / 100) * 5.0,
        remainingEnergyKwh: Math.max(0, 5.0 - (progress / 100) * 5.0),
        totalCostAmount: 15.00,
        usedCostAmount: (progress / 100) * 15.0,
        remainingCostAmount: Math.max(0, 15.0 - (progress / 100) * 15.0),
        warningThreshold: 75,
        lastUpdated: new Date().toISOString(),
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        isExceeded: progress >= 100,
        hasOverride: false,
      };

      updateBalance(demoUserId, demoRoomId, progressBalance);
      
      if (progress >= 100) {
        clearInterval(interval);
        setSimulationRunning(false);
        
        // Add violation at the end
        addViolation({
          id: 'simulation-violation-' + Date.now(),
          userId: demoUserId,
          roomId: demoRoomId,
          type: 'EXCEEDED',
          message: 'Simulated quota exceeded during usage simulation.',
          timestamp: new Date().toISOString(),
        });
      }
    }, 1000);
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Quota System Demo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetToNormal}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Normal Usage
              </Button>
              <Button variant="outline" onClick={simulateWarning}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Warning Level
              </Button>
              <Button variant="outline" onClick={simulateExceeded}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Exceeded
              </Button>
              <Button variant="outline" onClick={simulateOverride}>
                <RotateCcw className="h-4 w-4 mr-2" />
                With Override
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="default" 
                onClick={startUsageSimulation}
                disabled={simulationRunning}
              >
                {simulationRunning ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Simulate Usage
                  </>
                )}
              </Button>
              
              <Button variant="outline" onClick={() => setShowModal(true)}>
                Show Warning Modal
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current Status:</span>
              <QuotaStatusBadge userId={demoUserId} roomId={demoRoomId} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Component Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Quota Usage Card</h3>
          <QuotaUsageCard 
            userId={demoUserId} 
            roomId={demoRoomId}
            showTrends={true}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Quota-Aware AC Remote</h3>
          <QuotaAwareAirConRemote 
            userId={demoUserId}
            roomId={demoRoomId}
            showQuotaDetails={false}
            allowOverrideRequests={true}
          />
        </div>
      </div>

      {/* Demo Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demo Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div><strong>User ID:</strong> {demoUserId}</div>
            <div><strong>Room ID:</strong> {demoRoomId}</div>
            <div><strong>Purpose:</strong> Test quota system components and interactions</div>
            <div><strong>Features:</strong> Real-time updates, quota enforcement, override requests</div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Modal */}
      <QuotaWarningModal
        userId={demoUserId}
        roomId={demoRoomId}
        open={showModal}
        onClose={() => setShowModal(false)}
        allowOverrideRequest={true}
      />
    </div>
  );
};

export default QuotaSystemDemo;