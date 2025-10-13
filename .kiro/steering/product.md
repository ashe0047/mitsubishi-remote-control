# Product Overview

## Turing Smart Home Management System

A comprehensive smart home air conditioning control system that enables remote management of Mitsubishi air conditioners through a modern web interface and mobile PWA.

## Core Features

- **Air Conditioning Control**: Remote control of Mitsubishi AC units via MQTT protocol
- **Family Management**: Multi-user households with role-based access control
- **Quota Management**: Usage tracking and enforcement with configurable limits
- **Room Management**: Individual room assignments and control permissions
- **Real-time Updates**: WebSocket-based live status updates and notifications
- **Progressive Web App**: Mobile-optimized interface with offline capabilities

## Key Business Logic

- **Quota System**: Tracks AC usage time/energy with configurable limits per user/household
- **Family Hierarchy**: Parent/child roles with different permission levels
- **Room Assignments**: Users can be assigned to specific rooms with individual quotas
- **Usage Enforcement**: Automatic AC shutdown when quotas are exceeded (with grace periods)
- **Real-time Monitoring**: Live usage tracking and quota status updates

## Target Users

- Families wanting to manage AC usage and costs
- Parents controlling children's AC usage
- Households with multiple rooms and users
- Energy-conscious users tracking consumption