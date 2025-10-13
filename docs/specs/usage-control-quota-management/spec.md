# Usage Control & Quota Management - MVP Requirements Specification

## 1. Executive Summary

### 1.1 Feature Overview
A simple quota management system that allows parents to set daily AC usage limits for family members. This MVP focuses on basic family controls with time-based quotas, simple warnings, and manual overrides.

### 1.2 Business Justification
- **Primary Market**: Families with children seeking AC usage control
- **Revenue Impact**: Premium family plans ($14.99/month vs $9.99 basic)
- **MVP Goal**: Validate market demand with minimal complexity

### 1.3 Success Criteria
- **Technical**: Basic quota validation with reasonable response times
- **Business**: 100+ families actively using quotas within 3 months
- **User**: 80%+ satisfaction with core quota functionality

---

## 2. Stakeholder Analysis

### 2.1 Primary Users (MVP Focus)

**Parents**
- **Pain Points**: Children overusing AC, high energy bills
- **Goals**: Simple daily limits for children's AC usage
- **Success Metrics**: Can set and enforce basic quotas

**Children/Teens**
- **Pain Points**: Getting locked out of AC unexpectedly
- **Goals**: Know their limits, request more time when needed
- **Success Metrics**: Clear feedback on remaining quota

---

## 3. Functional Requirements

### 3.1 Basic User Management

**FR-1: Simple User Roles**
- **Requirement**: Support two user types: Parent and Child
- **Roles**: Parent (can set quotas), Child (has quotas applied)
- **Capabilities**: Parents can add family members and assign quotas
- **Acceptance Criteria**: 
  - Parents can add/remove family members
  - Clear role distinction between parent and child users

**FR-2: Basic Authentication**
- **Requirement**: Simple email/password login
- **Methods**: Email/password only for MVP
- **Features**: Basic password requirements, email verification
- **Acceptance Criteria**:
  - Users can register and login reliably
  - Password reset functionality works

### 3.2 Simple Room Assignment

**FR-3: Basic Room Access**
- **Requirement**: Parents can assign children to specific rooms
- **Access Levels**: Full Control (parent), Limited Control (child with quotas)
- **Features**: Simple room assignment per user
- **Acceptance Criteria**:
  - Parents can assign/unassign children to rooms
  - Children can only control AC in assigned rooms
  - Assignment changes work immediately

### 3.3 Basic Quota System

**FR-4: Simple Daily Time Quotas**
- **Requirement**: Parents can set daily AC runtime limits for children
- **Quota Types**: Time-based only (daily runtime in hours)
- **Scope**: Per-user, per-room quotas
- **Features**: Daily reset, basic tracking
- **Acceptance Criteria**:
  - Parents can set daily hour limits (e.g., "4 hours per day")
  - System tracks usage and enforces limits
  - Quotas reset at midnight

**FR-5: Basic Warning System**
- **Requirement**: Simple warnings when approaching limits
- **Thresholds**: 75% and 100% of daily quota
- **Delivery**: In-app notifications only
- **Acceptance Criteria**:
  - Warning shown when 75% of quota used
  - AC blocks when 100% quota reached
  - Clear message explaining quota status

**FR-6: Manual Override**
- **Requirement**: Parents can manually extend quota
- **Features**: Parent can add more hours when needed
- **Acceptance Criteria**:
  - Parent can unlock AC when child requests
  - Simple "add 1 hour" or "unlock for today" options

### 3.4 Basic Usage Tracking

**FR-7: Simple Usage Monitoring**
- **Requirement**: Track daily AC runtime per user
- **Metrics**: Runtime duration only (in hours/minutes)
- **Storage**: Current day and last 7 days history
- **Acceptance Criteria**:
  - Accurate tracking of AC on/off times per user
  - Simple dashboard showing daily usage
  - Usage resets at midnight daily

**FR-8: Basic Dashboard**
- **Requirement**: Simple view of quota status and usage
- **Features**: Current day usage, remaining quota, basic history
- **Visualizations**: Simple progress bars and daily summaries
- **Acceptance Criteria**:
  - Parents can see all family members' usage
  - Children can see their own quota status
  - Shows last 7 days of usage history

---

## 4. Non-Functional Requirements (MVP)

### 4.1 Basic Performance
- **Response Time**: Reasonable response times for basic operations (<2 seconds)
- **Concurrent Users**: Support 50-100 concurrent family users
- **Uptime**: Standard web app availability (99% target)

### 4.2 Basic Security
- **Authentication**: Secure login with encrypted passwords
- **Data Protection**: Basic HTTPS for data transmission
- **Session Management**: Standard session timeouts

### 4.3 Basic Usability
- **Mobile Friendly**: Works on mobile devices
- **Simple Setup**: Parents can set up quotas within 15 minutes
- **Clear Interface**: Easy to understand quota status and controls

### 4.4 Basic Integration
- **MQTT Integration**: Works with existing AC control system
- **No External Dependencies**: Self-contained system for MVP

---

## 5. Core User Stories (MVP)

**US-1: Parent Setting Daily AC Limits**
- **As a** parent
- **I want to** set daily AC usage limits for my child
- **So that** I can control energy costs
- **Acceptance Criteria**:
  - Parent can set hours per day (e.g., "4 hours per day")
  - System enforces the limit automatically
  - Child gets warning when approaching limit
  - AC blocks when limit reached

**US-2: Child Viewing Their Usage**
- **As a** child with AC limits
- **I want to** see how much AC time I have left today
- **So that** I can plan my usage
- **Acceptance Criteria**:
  - Clear display of remaining quota
  - Simple progress bar or similar visual
  - Warning when getting close to limit

**US-3: Parent Override for Emergency**
- **As a** parent
- **I want to** unlock the AC when my child really needs it
- **So that** safety and comfort are maintained
- **Acceptance Criteria**:
  - Simple "unlock" or "add time" button for parent
  - Immediate effect when parent grants override
  - Child can use AC normally after override

---

## 6. MVP Constraints & Assumptions

### 6.1 Technical Constraints
- Must work with existing MQTT and WebSocket system
- Cannot break current AC control functionality
- Simple database requirements (can use existing infrastructure)

### 6.2 Business Constraints
- MVP budget: $20,000 - $30,000
- Launch target: 6 months
- Focus on family market only (no commercial features)

### 6.3 Assumptions
- Parents want simple daily quota controls
- Children will understand and accept usage limits
- Basic time tracking is sufficient for MVP validation

---

## 7. Key MVP Risks

**Risk 1: User Adoption** (High Impact)
- **Description**: Parents may find even simple quotas too complicated
- **Mitigation**: Very simple UI, clear onboarding, optional feature

**Risk 2: Technical Integration** (Medium Impact) 
- **Description**: Adding quota checks to MQTT flow may be complex
- **Mitigation**: Start with simple implementation, thorough testing

**Risk 3: Kids Circumventing System** (Low Impact)
- **Description**: Children might find ways around quotas
- **Mitigation**: Accept this for MVP, focus on willing compliance

---

## 8. MVP Success Metrics

### 8.1 Basic Technical Metrics
- **System Works**: Quotas enforced correctly 95% of the time
- **Performance**: System responds within 2 seconds
- **Reliability**: No major system crashes

### 8.2 Business Metrics
- **User Adoption**: 50+ families actively using quotas within 3 months
- **Conversion**: 10% of free users upgrade to quota features
- **Retention**: Users with quotas stay active 20% longer

### 8.3 User Experience
- **Setup Success**: 70% of parents can set up quotas without help
- **User Satisfaction**: 4.0+ rating for quota features
- **Feature Usage**: Parents check quota status at least weekly

---

## 9. MVP Dependencies

### 9.1 Technical Dependencies
- Basic user authentication (extend existing system)
- Database for storing user quotas and usage (can use existing)
- Integration point with MQTT message flow

### 9.2 Business Dependencies  
- Updated terms of service mentioning quota features
- Simple pricing plan for quota premium feature
- Basic customer support documentation

---

## 10. MVP Scope Summary

**What's Included:**
- Parent/child user roles
- Daily time-based quotas per user per room
- Basic usage tracking and warnings
- Simple dashboard showing quota status
- Manual parent override capability

**What's NOT Included (Future Versions):**
- Complex scheduling or time restrictions
- Energy/cost-based quotas
- Commercial/enterprise features
- Advanced analytics and reporting
- Third-party integrations
- Automated billing

**Core Value Proposition:**
"Parents can set simple daily AC time limits for their children, see usage, and override when needed."

---

*This simplified MVP specification focuses on the essential family quota management features needed to validate market demand and user adoption.*