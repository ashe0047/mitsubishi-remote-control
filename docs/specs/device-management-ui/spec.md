# Device Management UI - Requirements Specification

**Feature**: Frontend Device Management Interface
**Status**: Draft
**Created**: 2025-10-05
**Author**: Development Team

---

## 1. Executive Summary

Implement a comprehensive frontend interface for managing IoT devices in a Next.js 15 + React 19 application. This UI will integrate with the existing backend Device REST API to provide administrators with full device lifecycle management, including device discovery, registration, configuration, and monitoring. The interface will complement the existing Room Management UI and provide seamless device-room integration.

---

## 2. Business Requirements

### 2.1 Problem Statement

**Current Challenges**:
1. **No UI for device management**: Backend Device API exists but no frontend interface
2. **Manual device registration**: Administrators must use API tools (Postman, curl) to register devices
3. **No visibility**: No way to see which devices are registered, enabled, or online
4. **Difficult discovery flow**: Discovered devices cannot be easily assigned to rooms
5. **No device metadata management**: Cannot edit manufacturer, model, or custom metadata through UI
6. **Poor user experience**: Room management exists but device management is disconnected

**Business Impact**:
- Time-consuming setup process for new devices (requires technical knowledge)
- Difficult to troubleshoot device issues without visibility into device status
- Cannot easily enable/disable devices for testing or maintenance
- Poor administrator experience compared to commercial smart home platforms
- Barrier to adoption for non-technical users

### 2.2 Objectives

**Primary Goals**:
1. **Device Visibility**: Provide clear, comprehensive view of all devices across all rooms
2. **Discovery & Registration**: Streamline the process of discovering and assigning devices to rooms
3. **Device Configuration**: Enable editing of device metadata without backend knowledge
4. **Status Monitoring**: Display real-time device status (enabled/disabled, online/offline)
5. **Lifecycle Management**: Support full CRUD operations for devices through intuitive UI
6. **Integration**: Seamless integration with existing Room Management UI

**Success Criteria**:
- Administrators can register a new device in <2 minutes without technical documentation
- Device status is visible at a glance with clear visual indicators
- Device discovery flow reduces manual configuration by 80%
- All Device API endpoints accessible through UI
- Mobile-responsive design works on tablets and phones
- Zero training required for administrators familiar with Room Management UI

---

## 3. Functional Requirements

### FR1: Device List View (Global)

**User Story**: As an administrator, I want to view all devices across all rooms in one place, so that I can quickly assess the state of my smart home.

#### Acceptance Criteria

**WHEN** administrator navigates to `/admin/devices` THEN system SHALL display a comprehensive list of all registered devices

**WHEN** device list loads THEN system SHALL show for each device:
- Device name/identifier
- Associated room name (with link to room)
- Device type (with visual icon)
- Manufacturer and model
- Enabled/disabled status badge
- Online/offline status indicator (if available)
- Quick action buttons (edit, enable/disable, delete)

**WHEN** device list is empty THEN system SHALL display an empty state with call-to-action to register or discover devices

**WHEN** device list contains >20 devices THEN system SHALL implement pagination or virtual scrolling

**IF** device is disabled THEN system SHALL display visual indication (grayed out or badge)

**WHEN** user clicks on device row THEN system SHALL navigate to device detail view OR open device edit dialog

### FR2: Device List View (Room-Specific)

**User Story**: As an administrator, I want to view all devices for a specific room, so that I can manage room-specific devices efficiently.

#### Acceptance Criteria

**WHEN** administrator navigates to `/admin/rooms/{roomId}/devices` THEN system SHALL display all devices registered to that room

**WHEN** room device list loads THEN system SHALL show room name in header with breadcrumb navigation

**WHEN** room has no devices THEN system SHALL display empty state with options to:
- Register a new device
- Discover devices
- Return to room list

**WHEN** user clicks "Add Device" button THEN system SHALL provide choice between:
- Manual device registration
- Device discovery flow

**WHILE** viewing room-specific device list THEN system SHALL provide quick link to return to room management

### FR3: Device Registration (Manual)

**User Story**: As an administrator, I want to manually register a device to a room, so that I can add devices that weren't auto-discovered.

#### Acceptance Criteria

**WHEN** user clicks "Register Device" button THEN system SHALL display device registration form dialog

**WHEN** registration form is displayed THEN system SHALL include fields:
- Room selection (dropdown with all rooms)
- Device type selection (dropdown: AIRCONDITIONER, THERMOSTAT, LIGHT, etc.)
- Device identifier (text input with validation)
- Manufacturer (optional text input)
- Model (optional text input)
- Initial enabled state (toggle, default: enabled)

**WHEN** user submits registration form THEN system SHALL:
- Validate all required fields
- Call `POST /api/devices` endpoint
- Display success notification
- Refresh device list
- Close registration dialog

**IF** registration fails due to duplicate device THEN system SHALL display clear error message: "Device with this identifier already exists in this room"

**IF** registration fails due to validation error THEN system SHALL highlight invalid fields with error messages

**WHEN** user cancels registration THEN system SHALL close dialog without making API call

### FR4: Device Discovery & Assignment

**User Story**: As an administrator, I want to discover devices on the network and assign them to rooms, so that I can quickly set up new devices without manual configuration.

#### Acceptance Criteria

**WHEN** user clicks "Discover Devices" button THEN system SHALL display device discovery interface

**WHEN** discovery interface loads THEN system SHALL call `GET /api/devices/discovery/room/{roomId}` to fetch discovered devices

**WHEN** discovered devices are returned THEN system SHALL display list with:
- Device identifier
- Device type (inferred or detected)
- Discovery timestamp (if available)
- "Assign to Room" button
- "Ignore" button

**WHEN** user clicks "Assign to Room" on discovered device THEN system SHALL display room selection dialog with:
- Room dropdown (all available rooms)
- Device type confirmation/override
- Optional manufacturer and model fields
- "Register" button

**WHEN** user confirms device assignment THEN system SHALL:
- Call `POST /api/devices/discovery/register` endpoint
- Pass roomId, deviceIdentifier, deviceType, and metadata
- Display success notification
- Remove device from discovery list
- Add device to room's device list

**IF** no discovered devices found THEN system SHALL display message: "No new devices discovered. Make sure devices are powered on and connected to the network."

**WHEN** user clicks "Ignore" on discovered device THEN system SHALL remove device from discovery list (frontend only, no API call)

### FR5: Device Configuration & Editing

**User Story**: As an administrator, I want to edit device metadata, so that I can keep device information accurate and organized.

#### Acceptance Criteria

**WHEN** user clicks "Edit" button on device THEN system SHALL display device edit form dialog

**WHEN** edit form is displayed THEN system SHALL pre-populate current values for:
- Manufacturer (editable)
- Model (editable)
- Enabled state (toggle)
- Custom metadata (key-value editor OR JSON editor)

**WHEN** user updates manufacturer or model THEN system SHALL call `PATCH /api/devices/{deviceId}/metadata` endpoint

**WHEN** user toggles enabled state THEN system SHALL call `PATCH /api/devices/{deviceId}/enabled?enabled={true|false}` endpoint

**WHEN** metadata update succeeds THEN system SHALL:
- Display success notification
- Update device in list view
- Close edit dialog

**IF** update fails THEN system SHALL display error notification and keep dialog open for retry

**WHEN** user cancels edit THEN system SHALL close dialog and discard changes

### FR6: Device Enable/Disable

**User Story**: As an administrator, I want to quickly enable or disable devices, so that I can control which devices are active without deleting them.

#### Acceptance Criteria

**WHEN** device list displays devices THEN each device SHALL show enabled/disabled status badge

**WHEN** device is enabled THEN badge SHALL display "Enabled" with green color scheme

**WHEN** device is disabled THEN badge SHALL display "Disabled" with gray/muted color scheme

**WHEN** user clicks toggle button on device card THEN system SHALL:
- Call `PATCH /api/devices/{deviceId}/enabled` endpoint
- Toggle enabled state
- Update status badge immediately (optimistic update)
- Display confirmation notification

**IF** toggle request fails THEN system SHALL:
- Revert status badge to previous state
- Display error notification

**WHEN** device is disabled THEN device control commands SHALL be blocked (backend enforcement, UI should indicate)

### FR7: Device Deletion

**User Story**: As an administrator, I want to delete devices that are no longer in use, so that I can keep my device list clean and accurate.

#### Acceptance Criteria

**WHEN** user clicks "Delete" button on device THEN system SHALL display confirmation dialog with:
- Device name and room
- Warning message: "This will permanently remove the device from {Room Name}. This action cannot be undone."
- "Cancel" button
- "Delete Device" button (destructive styling)

**WHEN** user confirms deletion THEN system SHALL:
- Call `DELETE /api/devices/{deviceId}` endpoint
- Display success notification
- Remove device from list view
- Update room device count (if displayed)

**IF** deletion fails THEN system SHALL display error notification and keep device in list

**WHEN** user cancels deletion THEN system SHALL close confirmation dialog without API call

### FR8: Device Status Indicators

**User Story**: As an administrator, I want to see real-time device status, so that I can quickly identify issues with offline or disabled devices.

#### Acceptance Criteria

**WHEN** device list is displayed THEN each device SHALL show visual status indicators:
- **Enabled/Disabled**: Badge component with color coding
  - Enabled: Green badge with "Enabled" text
  - Disabled: Gray badge with "Disabled" text
- **Online/Offline** (if status available): Icon indicator
  - Online: Green wifi/connection icon
  - Offline: Red wifi-off icon
  - Unknown: Gray question mark icon

**WHEN** device type is AIRCONDITIONER THEN system SHALL display air conditioner icon

**WHEN** device type is THERMOSTAT THEN system SHALL display thermometer icon

**WHEN** device type is LIGHT THEN system SHALL display lightbulb icon

**WHEN** device has manufacturer and model THEN system SHALL display in secondary text below device identifier

**IF** device has no manufacturer/model THEN system SHALL display device identifier only

### FR9: Integration with Room Management

**User Story**: As an administrator, I want seamless navigation between room and device management, so that I can efficiently manage my smart home configuration.

#### Acceptance Criteria

**WHEN** user is on Room Management page (`/admin/rooms`) THEN each room card SHALL display:
- Device count badge (e.g., "3 devices")
- "Manage Devices" quick link button

**WHEN** user clicks "Manage Devices" on room card THEN system SHALL navigate to `/admin/rooms/{roomId}/devices`

**WHEN** user is on device management page THEN breadcrumb SHALL show:
- Admin > Rooms > {Room Name} > Devices

**WHEN** user clicks room name in breadcrumb THEN system SHALL navigate to room management page

**WHEN** viewing device list THEN each device SHALL display associated room name as clickable link

**WHEN** user clicks room name link on device THEN system SHALL navigate to room-specific device list

### FR10: Search and Filtering

**User Story**: As an administrator managing many devices, I want to search and filter devices, so that I can quickly find specific devices.

#### Acceptance Criteria

**WHEN** device list displays >10 devices THEN system SHALL show search input field

**WHEN** user types in search field THEN system SHALL filter devices by:
- Device identifier (partial match, case-insensitive)
- Manufacturer (partial match, case-insensitive)
- Model (partial match, case-insensitive)
- Room name (partial match, case-insensitive)

**WHEN** device list page includes filters THEN system SHALL provide filter dropdown for:
- Device type (all, AIRCONDITIONER, THERMOSTAT, LIGHT, etc.)
- Status (all, enabled, disabled)

**WHEN** filters are applied THEN system SHALL update device list in real-time

**WHEN** no devices match search/filter THEN system SHALL display: "No devices found matching '{search term}'"

### FR11: Mobile Responsiveness

**User Story**: As an administrator using a tablet or phone, I want the device management UI to work on mobile devices, so that I can manage devices on the go.

#### Acceptance Criteria

**WHEN** device management UI is viewed on mobile (< 768px) THEN system SHALL:
- Stack device cards vertically
- Use full-width card layout
- Collapse device metadata into expandable sections
- Use bottom sheet or full-screen modals for forms
- Ensure touch targets are minimum 44px

**WHEN** device list is viewed on tablet (768px - 1024px) THEN system SHALL:
- Use 2-column grid layout
- Maintain card-based design
- Use dialog modals for forms

**WHEN** device list is viewed on desktop (>1024px) THEN system SHALL:
- Use 3-column grid layout OR table layout
- Use centered dialog modals
- Show more metadata inline

**WHEN** user interacts with device cards on mobile THEN system SHALL provide haptic feedback (if supported)

---

## 4. Non-Functional Requirements

### NFR1: Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial page load | <2 seconds | Time to interactive |
| Device list render (100 devices) | <500ms | First contentful paint |
| Search/filter response | <100ms | Input debounce + filter |
| API request timeout | 30 seconds | Network request timeout |
| Optimistic UI update | Immediate | Toggle/enable before API response |

**Optimization Requirements**:
- Implement pagination or virtual scrolling for >50 devices
- Debounce search input (300ms delay)
- Cache device list data for 30 seconds (React Query or SWR)
- Optimistic updates for enable/disable actions
- Lazy load device detail modals

### NFR2: Usability

**Requirements**:
- All forms include clear validation messages
- Success/error notifications displayed for all actions
- Confirmation dialogs for destructive actions (delete)
- Loading states shown during API requests
- Empty states guide users to next action
- Breadcrumb navigation for context awareness
- Keyboard navigation support for accessibility
- Dark mode support (follows system theme)

### NFR3: Accessibility

**Requirements**:
- WCAG 2.1 Level AA compliance
- Keyboard navigation for all interactive elements
- Screen reader support with ARIA labels
- Focus indicators visible on all focusable elements
- Minimum color contrast ratio 4.5:1
- Touch targets minimum 44x44px
- Error messages programmatically associated with form fields
- Status indicators have text alternatives (not color-only)

### NFR4: Security

**Requirements**:
- All API requests include JWT authentication token
- Device management restricted to PARENT role (admin)
- Input validation on all form fields
- XSS prevention (React automatic escaping)
- CSRF protection via token-based auth
- No sensitive device data exposed in URL parameters
- Secure WebSocket connections (WSS in production)

### NFR5: Maintainability

**Requirements**:
- TypeScript strict mode enabled
- Zod schemas for API response validation
- Reusable component architecture (ShadcnUI)
- Zustand store for device state management
- Consistent error handling patterns
- JSDoc comments for complex components
- Unit tests for business logic (>70% coverage)
- Integration tests for critical flows

---

## 5. Technical Requirements

### 5.1 Technology Stack

**Frontend Framework**:
- Next.js 15 (App Router)
- React 19
- TypeScript (strict mode)

**State Management**:
- Zustand v5 (device state)
- React Context (auth context)
- React Query or SWR (server state caching, optional)

**UI Components**:
- ShadcnUI components (built on Radix UI)
- Tailwind CSS for styling
- Lucide React for icons

**Form Handling**:
- React Hook Form (validation)
- Zod schemas (validation + type inference)

**API Integration**:
- Fetch API or Axios
- Zod for response validation

### 5.2 Page Routes

**Device Management Routes**:
```
/admin/devices               - All devices (global view)
/admin/rooms/{roomId}/devices - Room-specific devices
```

**Room Management Integration**:
```
/admin/rooms                 - Room list (existing, enhanced with device count)
/admin/rooms/{roomId}        - Room detail (potential future enhancement)
```

### 5.3 API Integration

**Device API Endpoints** (Backend already implemented):

```typescript
// List devices by room
GET /api/devices/room/{roomId}
Response: DeviceDto[]

// Get enabled devices only
GET /api/devices/room/{roomId}/enabled
Response: DeviceDto[]

// Get device by identifier
GET /api/devices/{deviceIdentifier}
Response: DeviceDto

// Register new device
POST /api/devices
Request: RegisterDeviceRequest
Response: DeviceDto

// Update device metadata
PATCH /api/devices/{deviceId}/metadata
Request: { manufacturer?: string, model?: string, metadata?: object }
Response: DeviceDto

// Enable/disable device
PATCH /api/devices/{deviceId}/enabled?enabled={boolean}
Response: DeviceDto

// Delete device
DELETE /api/devices/{deviceId}
Response: 204 No Content

// Discovery endpoints
GET /api/devices/discovery/room/{roomId}
Response: DeviceDto[]

POST /api/devices/discovery/register?roomId={uuid}&deviceIdentifier={string}&deviceType={string}
Request: { metadata?: object }
Response: DeviceDto
```

### 5.4 Data Models (Frontend)

**TypeScript Interfaces**:
```typescript
// Matches backend DeviceDto
interface Device {
  id: string;
  roomId: string;
  deviceType: DeviceType;
  deviceIdentifier: string;
  manufacturer?: string;
  model?: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

enum DeviceType {
  AIRCONDITIONER = 'AIRCONDITIONER',
  THERMOSTAT = 'THERMOSTAT',
  LIGHT = 'LIGHT',
  SECURITY_CAMERA = 'SECURITY_CAMERA',
  DOOR_LOCK = 'DOOR_LOCK',
  SMART_PLUG = 'SMART_PLUG',
}

interface RegisterDeviceRequest {
  roomId: string;
  deviceType: string;
  deviceIdentifier: string;
  manufacturer?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateDeviceMetadataRequest {
  manufacturer?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}
```

**Zod Schemas**:
```typescript
const deviceSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  deviceType: z.nativeEnum(DeviceType),
  deviceIdentifier: z.string(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  enabled: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const registerDeviceSchema = z.object({
  roomId: z.string().uuid(),
  deviceType: z.string(),
  deviceIdentifier: z.string().min(1).max(255),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

### 5.5 Component Architecture

**Page Components**:
```
/app/admin/devices/page.tsx              - Global device list page
/app/admin/rooms/[roomId]/devices/page.tsx - Room-specific device list
```

**Feature Components**:
```
/components/device/DeviceList.tsx            - Reusable device list component
/components/device/DeviceCard.tsx            - Individual device card
/components/device/DeviceStatusBadge.tsx     - Status badge component
/components/device/RegisterDeviceDialog.tsx  - Manual registration form
/components/device/DiscoverDevicesDialog.tsx - Device discovery interface
/components/device/EditDeviceDialog.tsx      - Device edit form
/components/device/DeleteDeviceDialog.tsx    - Delete confirmation dialog
/components/device/DeviceTypeIcon.tsx        - Device type icon renderer
/components/device/DeviceSearchFilter.tsx    - Search and filter controls
```

**Zustand Store**:
```
/stores/device-store.ts                   - Device state management
```

**API Services**:
```
/lib/api/device-api.ts                    - Device API client functions
/lib/api/device-discovery-api.ts          - Discovery API client functions
```

**Hooks**:
```
/hooks/use-devices.ts                     - Device fetching and mutations
/hooks/use-device-discovery.ts            - Discovery flow hooks
```

---

## 6. UI/UX Design Requirements

### 6.1 Design Principles

1. **Consistency**: Follow existing Room Management UI patterns and styling
2. **Clarity**: Clear visual hierarchy and status indicators
3. **Efficiency**: Minimal clicks to complete common tasks
4. **Feedback**: Immediate feedback for all user actions
5. **Forgiveness**: Confirmation for destructive actions, undo where possible

### 6.2 Visual Design Specifications

**Color Scheme** (ShadcnUI semantic colors):
- **Primary**: Blue (brand color)
- **Success/Enabled**: Green (`text-green-600 dark:text-green-400`)
- **Warning/Degraded**: Yellow (`text-yellow-600 dark:text-yellow-400`)
- **Error/Disabled**: Gray/Red (`text-red-600 dark:text-red-400`)
- **Background**: `bg-background`, `bg-muted`
- **Text**: `text-foreground`, `text-muted-foreground`

**Typography**:
- Page title: `text-3xl font-bold`
- Section headers: `text-lg font-semibold`
- Body text: `text-sm sm:text-base`
- Metadata: `text-sm text-muted-foreground`

**Spacing**:
- Page padding: `p-4 sm:p-6`
- Card padding: `p-4`
- Section gaps: `gap-4 sm:gap-6`
- Element gaps: `gap-2`

**Device Card Layout**:
```
┌─────────────────────────────────────────┐
│ [Icon] Device Name/Identifier           │
│        Room: Living Room                │
│        Manufacturer Model               │
│                                         │
│ [Enabled Badge] [Online Icon]           │
│                                         │
│ [Edit] [Toggle] [Delete]                │
└─────────────────────────────────────────┘
```

### 6.3 Interaction Patterns

**Primary Actions** (Button variants):
- Register Device: `variant="default"` (primary button)
- Discover Devices: `variant="outline"` (secondary button)
- Save/Confirm: `variant="default"`
- Cancel: `variant="ghost"`
- Delete: `variant="destructive"`

**Secondary Actions** (Icon buttons):
- Edit: Pencil icon, `variant="ghost" size="sm"`
- Delete: Trash icon, `variant="ghost" size="sm"`
- Toggle Enable: Switch component

**Form Dialogs**:
- Max width: `max-w-md` (small forms) or `max-w-2xl` (complex forms)
- Centered on desktop, bottom sheet on mobile
- Close button in top-right
- Action buttons in footer (Cancel left, Primary right)

---

## 7. Constraints

### 7.1 Technical Constraints

1. **Frontend Framework**: Must use Next.js 15 with App Router (no Pages Router)
2. **Backend API**: Cannot modify existing backend endpoints (use as-is)
3. **Authentication**: Must use existing JWT authentication system
4. **Styling**: Must use ShadcnUI components and Tailwind CSS
5. **State Management**: Zustand v5 patterns (avoid infinite loops with proper selectors)
6. **Browser Support**: Modern browsers only (Chrome 90+, Firefox 88+, Safari 14+)

### 7.2 Business Constraints

1. **Scope**: Device management UI only (no device control UI in this feature)
2. **Permissions**: Admin/parent role required for all device management operations
3. **Timeline**: 2-week implementation window
4. **Team**: Frontend developer implements, backend API already complete
5. **Budget**: No additional infrastructure costs

### 7.3 Integration Constraints

1. **Room Management**: Must integrate with existing `/admin/rooms` UI
2. **Backward Compatibility**: Must not break existing room management features
3. **API Compatibility**: Must work with existing backend Device API (v1)
4. **No Breaking Changes**: Cannot modify existing API contracts

---

## 8. Assumptions

1. Backend Device API is fully functional and tested
2. JWT authentication is working and provides user role information
3. Room Management UI exists and is accessible at `/admin/rooms`
4. Device discovery service (MQTT-based) is operational
5. Administrators have PARENT role with appropriate permissions
6. Device identifiers are unique across the system
7. Real-time device online/offline status may not be available initially (optional feature)
8. Device metadata is flexible (JSONB) and can store arbitrary key-value pairs

---

## 9. Dependencies

### 9.1 Internal Dependencies

**Backend Services**:
- Device REST API (`/api/devices`)
- Device Discovery API (`/api/devices/discovery`)
- Room Management API (`/api/room-management`)
- JWT Authentication system

**Frontend Components**:
- Existing Room Management UI (`/admin/rooms`)
- ShadcnUI component library (Button, Card, Badge, Dialog, etc.)
- Tailwind CSS configuration
- Auth context and hooks

### 9.2 External Dependencies

**NPM Packages** (already in project or to be added):
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `zustand` - State management
- `lucide-react` - Icons
- `date-fns` or `dayjs` - Date formatting (optional)
- `@tanstack/react-query` - Server state caching (optional)

**Backend APIs**:
- Device management endpoints (Spring Boot backend)
- MQTT broker (for device discovery)

---

## 10. Success Metrics

### 10.1 Functional Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Device management UI coverage | 0% | 100% | All API endpoints accessible via UI |
| Device registration success rate | N/A | >95% | Successful registrations / attempts |
| Discovery-to-registration flow | No UI | <2 min | Time from discovery to assignment |
| Mobile usability | N/A | Works | Responsive design on all screen sizes |

### 10.2 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| TypeScript coverage | 100% | No `any` types |
| Component test coverage | >70% | Unit tests for business logic |
| Accessibility score | AA | WCAG 2.1 Level AA |
| Page load performance | >90 | Lighthouse performance score |
| Zero console errors | Yes | Browser console in production |

### 10.3 User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to register device | <2 min | User workflow timing |
| Admin satisfaction | >90% | User feedback survey |
| Support tickets (device setup) | Reduce 80% | Ticket count comparison |
| Task completion rate | >95% | Successful device registrations |

---

## 11. Acceptance Criteria

### 11.1 Device List Page Acceptance Criteria

- [ ] Global device list page accessible at `/admin/devices`
- [ ] Room-specific device list page accessible at `/admin/rooms/{roomId}/devices`
- [ ] Device cards display all required information (name, type, room, status)
- [ ] Visual status indicators for enabled/disabled state
- [ ] Visual status indicators for online/offline state (if available)
- [ ] Device type icons displayed correctly
- [ ] Empty state shown when no devices exist
- [ ] Pagination or virtual scrolling for >50 devices
- [ ] Responsive design works on mobile, tablet, and desktop

### 11.2 Device Registration Acceptance Criteria

- [ ] "Register Device" button opens registration dialog
- [ ] Registration form includes all required fields
- [ ] Room selection dropdown populated with all available rooms
- [ ] Device type dropdown includes all supported types
- [ ] Form validation prevents invalid submissions
- [ ] Success notification shown after successful registration
- [ ] Error notification shown with clear message on failure
- [ ] Device list refreshed after successful registration
- [ ] Registration dialog closes after success

### 11.3 Device Discovery Acceptance Criteria

- [ ] "Discover Devices" button opens discovery interface
- [ ] Discovery interface fetches discovered devices from API
- [ ] Discovered devices displayed in list format
- [ ] "Assign to Room" button available for each discovered device
- [ ] Room selection dialog shown when assigning device
- [ ] Device successfully registered after assignment confirmation
- [ ] Discovered device removed from list after assignment
- [ ] Empty state shown when no devices discovered
- [ ] Error handling for discovery API failures

### 11.4 Device Editing Acceptance Criteria

- [ ] "Edit" button opens device edit dialog
- [ ] Edit form pre-populated with current device values
- [ ] Manufacturer and model fields editable
- [ ] Enabled toggle functional
- [ ] Metadata editor functional (if implemented)
- [ ] Changes saved via API on form submission
- [ ] Success notification shown after successful update
- [ ] Device list updated with new values
- [ ] Edit dialog closes after success
- [ ] Form validation prevents invalid updates

### 11.5 Device Enable/Disable Acceptance Criteria

- [ ] Enable/disable toggle present on device card
- [ ] Toggle calls correct API endpoint
- [ ] Optimistic UI update (toggle changes immediately)
- [ ] Status badge updates to reflect new state
- [ ] Success notification shown after toggle
- [ ] Error notification shown on failure with revert
- [ ] Disabled devices visually distinct (grayed out or badge)

### 11.6 Device Deletion Acceptance Criteria

- [ ] "Delete" button opens confirmation dialog
- [ ] Confirmation dialog shows device and room name
- [ ] Warning message displayed clearly
- [ ] "Cancel" button closes dialog without action
- [ ] "Delete Device" button calls DELETE API endpoint
- [ ] Success notification shown after deletion
- [ ] Device removed from list immediately
- [ ] Error notification shown on failure
- [ ] Deleted device not accessible after deletion

### 11.7 Room Management Integration Acceptance Criteria

- [ ] Room Management page shows device count per room
- [ ] "Manage Devices" link present on room cards
- [ ] "Manage Devices" navigates to room-specific device list
- [ ] Breadcrumb navigation functional on device pages
- [ ] Room name clickable and navigates to room management
- [ ] Device list shows room name with link to room

### 11.8 Search and Filter Acceptance Criteria

- [ ] Search input field displayed when >10 devices
- [ ] Search filters by device identifier, manufacturer, model, room
- [ ] Filter dropdown for device type functional
- [ ] Filter dropdown for enabled/disabled status functional
- [ ] Filters apply in real-time
- [ ] Empty state shown when no results match
- [ ] Clear search/filter functionality

### 11.9 Mobile Responsiveness Acceptance Criteria

- [ ] Device list responsive on mobile (<768px)
- [ ] Touch targets minimum 44x44px
- [ ] Forms use bottom sheet or full-screen on mobile
- [ ] Cards stack vertically on mobile
- [ ] 2-column layout on tablet (768-1024px)
- [ ] 3-column layout on desktop (>1024px)
- [ ] Haptic feedback on mobile interactions (if supported)

### 11.10 Accessibility Acceptance Criteria

- [ ] WCAG 2.1 Level AA compliance
- [ ] Keyboard navigation functional for all interactions
- [ ] ARIA labels present on all interactive elements
- [ ] Focus indicators visible
- [ ] Color contrast ratio meets 4.5:1 minimum
- [ ] Screen reader support verified
- [ ] Error messages programmatically associated with fields
- [ ] Status indicators have text alternatives

---

## 12. Out of Scope

The following items are **explicitly out of scope** for this specification:

1. ❌ Device control UI (temperature, mode, fan speed controls) - handled by existing AC control UI
2. ❌ Real-time device telemetry dashboard (temperature graphs, energy usage)
3. ❌ Device grouping or scenes (e.g., "Turn off all lights")
4. ❌ Automation rules or scheduling UI
5. ❌ Device firmware update management
6. ❌ Historical device activity logs or audit trail UI
7. ❌ Multi-household device management (single household only)
8. ❌ Device sharing with other users
9. ❌ Advanced MQTT topic configuration UI
10. ❌ Protocol selection UI (MQTT, HTTP, WebSocket)
11. ❌ Device health monitoring or diagnostics UI
12. ❌ Bulk device operations (bulk enable/disable, bulk delete)
13. ❌ Device import/export functionality
14. ❌ Advanced metadata editor (JSON tree editor) - simple key-value only

---

## 13. Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Specification** | 1 day | This document (requirements only) |
| **Design** | 1 day | Design document with architecture and components |
| **Component Development** | 3 days | Build reusable device components |
| **Page Implementation** | 2 days | Global and room-specific device list pages |
| **Forms & Dialogs** | 2 days | Registration, edit, delete, discovery dialogs |
| **Integration** | 1 day | Integrate with Room Management UI |
| **Testing** | 2 days | Unit tests, integration tests, accessibility |
| **Polish & Documentation** | 1 day | Error handling, loading states, README |
| **Total** | **13 days** | ~2.5 weeks |

---

## 14. Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Backend API changes during development | Low | High | Coordinate with backend team, version API |
| Zustand v5 infinite loop bugs | Medium | Medium | Use proper selectors, thorough testing |
| Discovery API performance issues | Medium | Medium | Implement loading states, pagination |
| Complex device metadata editing | Medium | Low | Start with simple key-value, enhance later |
| Mobile UX complexity | Medium | Medium | Mobile-first design, user testing |
| Accessibility compliance gaps | Low | High | Use ShadcnUI accessible components, audit |
| API timeout on slow networks | Medium | Medium | Implement proper loading states, retry logic |
| Device identifier conflicts | Low | High | Frontend validation, clear error messages |

---

## 15. Stakeholder Sign-off

| Stakeholder | Role | Approval | Date |
|-------------|------|----------|------|
| Development Team | Implementer | ✅ Approved | 2025-10-05 |
| User | Product Owner | Pending | - |
| UX Designer | Design Lead | Pending | - |

---

## 16. Appendix

### 16.1 Example User Workflows

#### Workflow 1: Manual Device Registration

1. Admin navigates to `/admin/rooms`
2. Clicks "Manage Devices" on "Living Room" card
3. Clicks "Register Device" button
4. Fills form:
   - Room: Living Room (pre-selected)
   - Device Type: AIRCONDITIONER
   - Device Identifier: `ac_living_room_main`
   - Manufacturer: Mitsubishi
   - Model: MSZ-AP35VG
5. Clicks "Register Device"
6. System calls `POST /api/devices`
7. Success notification shown: "Device registered successfully"
8. Device appears in Living Room device list
9. Admin can now control AC via existing AC control UI

#### Workflow 2: Device Discovery & Assignment

1. Admin navigates to `/admin/devices`
2. Clicks "Discover Devices" button
3. System calls `GET /api/devices/discovery/room/{roomId}` (or global discovery)
4. Discovered devices shown:
   - `ac_bedroom_001` (AIRCONDITIONER)
   - `thermostat_hallway_001` (THERMOSTAT)
5. Admin clicks "Assign to Room" on `ac_bedroom_001`
6. Room selection dialog appears
7. Selects "Master Bedroom" from dropdown
8. Confirms device type (AIRCONDITIONER)
9. Clicks "Register"
10. System calls `POST /api/devices/discovery/register`
11. Success notification: "Device assigned to Master Bedroom"
12. Device removed from discovery list
13. Device appears in Master Bedroom device list

#### Workflow 3: Device Enable/Disable

1. Admin navigates to `/admin/devices`
2. Sees device "ac_living_room_main" with "Enabled" badge
3. Clicks toggle switch to disable device
4. Toggle switches to "Disabled" (optimistic update)
5. System calls `PATCH /api/devices/{deviceId}/enabled?enabled=false`
6. Badge updates to "Disabled" (gray)
7. Success notification: "Device disabled"
8. AC control commands now blocked by backend
9. Later, admin re-enables device with same toggle

#### Workflow 4: Device Deletion

1. Admin navigates to `/admin/rooms/bedroom-uuid/devices`
2. Sees old thermostat no longer in use
3. Clicks "Delete" button on thermostat device card
4. Confirmation dialog appears:
   - "Delete device 'thermostat_bedroom_old'?"
   - "This will permanently remove the device from Master Bedroom."
5. Admin clicks "Delete Device"
6. System calls `DELETE /api/devices/{deviceId}`
7. Success notification: "Device deleted"
8. Device removed from list
9. Bedroom now shows only remaining devices

### 16.2 Component Hierarchy

```
DeviceListPage
├── Breadcrumb (if room-specific)
├── PageHeader
│   ├── Title
│   └── Actions
│       ├── RegisterDeviceDialog (trigger button)
│       └── DiscoverDevicesDialog (trigger button)
├── DeviceSearchFilter
│   ├── SearchInput
│   └── FilterDropdowns
│       ├── DeviceTypeFilter
│       └── StatusFilter
└── DeviceList
    ├── DeviceCard (repeated)
    │   ├── DeviceTypeIcon
    │   ├── DeviceInfo
    │   │   ├── DeviceIdentifier
    │   │   ├── RoomLink
    │   │   └── ManufacturerModel
    │   ├── DeviceStatusBadge
    │   ├── OnlineStatusIndicator
    │   └── DeviceActions
    │       ├── EditDeviceDialog (trigger button)
    │       ├── EnableToggle
    │       └── DeleteDeviceDialog (trigger button)
    └── EmptyState (if no devices)
```

### 16.3 API Error Handling Examples

**Device Registration Failure - Duplicate**:
```typescript
// API Response: 409 Conflict
{
  "error": "Device with identifier 'ac_bedroom_main' already exists in room 'Master Bedroom'"
}

// UI Display:
// Error toast notification (red)
// "Failed to register device: Device with identifier 'ac_bedroom_main' already exists in room 'Master Bedroom'"
// Form stays open for user to correct
```

**Network Timeout**:
```typescript
// API Response: Timeout after 30s
// UI Display:
// Error toast notification
// "Request timed out. Please check your connection and try again."
// Retry button in notification
```

**Validation Error**:
```typescript
// API Response: 400 Bad Request
{
  "deviceIdentifier": "Device identifier must be between 1 and 255 characters"
}

// UI Display:
// Field-level error message below input
// "Device identifier must be between 1 and 255 characters"
// Submit button disabled until fixed
```

### 16.4 References

- [Device-Room Integration Specification](../device-room-integration/spec.md)
- [Room Management Specification](../room-management/spec.md) (if exists)
- [CLAUDE.md Project Guidelines](/mnt/drive/codebases/apps/mitsubishi-remote-control/CLAUDE.md)
- [ShadcnUI Documentation](https://ui.shadcn.com/)
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Zustand v5 Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-05
**Next Review**: After stakeholder approval and before design document creation
