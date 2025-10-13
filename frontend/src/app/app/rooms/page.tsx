import React from 'react';
import { Metadata } from 'next';
import RoomsPageClient from './RoomsPageClient';

export const metadata: Metadata = {
  title: 'Rooms | Mitsubishi AC Control',
  description: 'Access and control your air conditioning units',
};

/**
 * Rooms Page - Role-based room listing
 * Shows "All Rooms" for parents, "My Rooms" for children
 * Primary destination for child users and room access for all users
 */
export default function RoomsPage() {
  return <RoomsPageClient />;
}