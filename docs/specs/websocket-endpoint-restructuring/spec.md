# WebSocket Endpoint Restructuring - Requirements Specification

**Feature**: WebSocket Endpoint Path Restructuring
**Status**: Draft
**Created**: 2025-10-05
**Author**: Development Team

---

## 1. Executive Summary

Restructure WebSocket endpoint paths from generic `/ws` to feature-specific `/ws/airconditioner` to improve clarity, maintainability, and support future extensibility. This change aligns URL structure with the existing package organization and handler architecture.

---

## 2. Business Requirements

### 2.1 Problem Statement

**Current Issues**:
1. `/ws` endpoint name is too generic and doesn't convey its purpose (air conditioner control)
2. URL structure doesn't match package structure (`websocket/airconditioner/` vs `/ws`)
3. No clear pattern for adding new device types (lights, thermostats, security)
4. Inconsistent hierarchy: `/ws` is generic while `/ws/quota` is specific

**Impact**:
- New developers struggle to understand endpoint purposes
- Difficult to maintain URL-to-code mappings
- No clear extensibility pattern for future IoT devices

### 2.2 Objectives

**Primary Goals**:
1. **Clarity**: Make endpoint URLs self-documenting and descriptive
2. **Consistency**: Establish clear 1:1:1 mapping between URL → Handler → Package
3. **Maintainability**: Simplify code navigation and debugging
4. **Extensibility**: Enable easy addition of new device endpoints

**Success Criteria**:
- All endpoint URLs clearly indicate their purpose
- URL structure matches package and handler naming conventions
- Adding new device types follows established pattern
- No breaking changes to existing functionality

---

## 3. Functional Requirements

### FR1: Update Air Conditioner Endpoint

**Current**: `/ws?roomId=X&familyMemberId=Y&token=Z`
**New**: `/ws/airconditioner?roomId=X&familyMemberId=Y&token=Z`

**Requirements**:
- Change URL path from `/ws` to `/ws/airconditioner`
- Maintain all existing query parameters (roomId, familyMemberId, token)
- No changes to WebSocket message protocol
- No changes to handler business logic

### FR2: Maintain Quota Endpoint

**Current**: `/ws/quota?quotaId=X&roomId=Y&familyMemberId=Z&token=W`
**New**: `/ws/quota?quotaId=X&roomId=Y&familyMemberId=Z&token=W` (unchanged)

**Requirements**:
- Keep existing `/ws/quota` path
- No functional changes required

### FR3: Update Frontend WebSocket Connections

**Requirements**:
- Update frontend to connect to `/ws/airconditioner` instead of `/ws`
- Ensure all WebSocket connection logic uses new endpoint
- Verify all query parameters are correctly passed
- Test connection establishment and message flow

### FR4: Establish Endpoint Naming Convention

**Requirements**:
- Document standard pattern: `/ws/{feature}?{context-params}`
- Feature name in path (e.g., `airconditioner`, `quota`, `lights`)
- Context parameters in query string (e.g., `roomId`, `token`)
- Update project documentation with new convention

---

## 4. Non-Functional Requirements

### NFR1: Zero Downtime

**Requirements**:
- No service interruption during deployment
- Development environment only (no production impact)

### NFR2: Backwards Compatibility

**Requirements**:
- NOT REQUIRED - codebase is in development phase
- No need for deprecated endpoint aliases
- Direct cutover to new endpoint paths

### NFR3: Documentation

**Requirements**:
- Update CLAUDE.md with new endpoint structure
- Document URL naming conventions
- Update API documentation
- Add comments in WebSocketConfig explaining URL structure

### NFR4: Testing

**Requirements**:
- Verify WebSocket connection establishment
- Test message send/receive on new endpoints
- Validate query parameters are correctly parsed
- Ensure JWT authentication still works

---

## 5. Constraints

### 5.1 Technical Constraints

1. **Framework**: Must work with Spring WebFlux WebSocket support
2. **Handler Architecture**: No changes to BaseWebSocketHandler or command patterns
3. **Authentication**: JWT authentication must remain functional
4. **Message Protocol**: No changes to message types or schemas

### 5.2 Project Constraints

1. **Scope**: Backend endpoint paths + frontend connection URLs only
2. **Timeline**: Single development iteration
3. **Environment**: Development environment only
4. **Risk**: Very low - URL changes only, no logic changes

---

## 6. Assumptions

1. Frontend code can be updated simultaneously with backend
2. No external clients are using the WebSocket API
3. Development environment database and configuration can be reset if needed
4. Testing can be performed manually (no automated WebSocket tests exist)

---

## 7. Dependencies

### 7.1 Internal Dependencies

**Backend**:
- [WebSocketConfig.java](../../backend/turing/src/main/java/com/ashelabs/turing/config/WebSocketConfig.java) - URL mappings

**Frontend**:
- MQTT client configuration files
- WebSocket connection initialization code
- Environment configuration

### 7.2 External Dependencies

None - this is an internal refactoring with no external API dependencies.

---

## 8. Success Metrics

### 8.1 Code Quality Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| URL Clarity Score | 3/10 | 9/10 | Developer survey/review |
| URL-Code Mapping Clarity | 5/10 | 10/10 | 1:1:1 mapping achieved |
| Documentation Completeness | 7/10 | 10/10 | All endpoints documented |

### 8.2 Functional Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| WebSocket Connection Success | 100% | Manual testing |
| Message Flow Success | 100% | Send/receive test |
| Query Parameter Parsing | 100% | Verify all params |
| JWT Authentication | 100% | Auth flow test |

---

## 9. Acceptance Criteria

### 9.1 Backend Acceptance Criteria

- [ ] WebSocketConfig maps `/ws/airconditioner` to AirConditionerWebSocketHandler
- [ ] WebSocketConfig maps `/ws/quota` to QuotaWebSocketHandler (unchanged)
- [ ] Both endpoints wrapped with WebSocketJwtAuthHandler
- [ ] No changes to handler business logic
- [ ] All code compiles successfully
- [ ] URL mappings documented with clear comments

### 9.2 Frontend Acceptance Criteria

- [ ] Frontend connects to `/ws/airconditioner` instead of `/ws`
- [ ] All query parameters correctly passed (roomId, familyMemberId, token)
- [ ] WebSocket connection established successfully
- [ ] Messages sent and received correctly
- [ ] No console errors related to WebSocket connection

### 9.3 Documentation Acceptance Criteria

- [ ] CLAUDE.md updated with new endpoint structure
- [ ] URL naming convention documented
- [ ] WebSocketConfig has clear comments
- [ ] Example URLs provided in documentation

---

## 10. Out of Scope

The following items are **explicitly out of scope** for this specification:

1. ❌ API versioning (no `/v1/` prefix)
2. ❌ Backwards compatibility or deprecated endpoint support
3. ❌ Changes to WebSocket message protocol
4. ❌ Changes to handler business logic or command implementations
5. ❌ New features or functionality
6. ❌ Performance optimization
7. ❌ Automated testing infrastructure

---

## 11. Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Specification | 0.5 days | This document |
| Design | 0.5 days | Technical design |
| Implementation | 1 day | Backend + Frontend changes |
| Testing | 0.5 days | Manual verification |
| Documentation | 0.5 days | Update docs |
| **Total** | **3 days** | End-to-end completion |

---

## 12. Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Frontend URL update missed | Low | High | Systematic search for all WebSocket connection code |
| Query parameter parsing breaks | Low | High | Verify parameter extraction in handlers |
| JWT authentication fails | Low | High | Test authentication flow explicitly |
| Documentation incomplete | Medium | Low | Checklist-based documentation review |

---

## 13. Stakeholder Sign-off

| Stakeholder | Role | Approval | Date |
|-------------|------|----------|------|
| Development Team | Implementer | ✅ Approved | 2025-10-05 |
| User | Product Owner | Pending | - |

---

## 14. Appendix

### 14.1 Current vs New Endpoint Structure

**Current Structure**:
```
/ws                  → AirConditionerWebSocketHandler
/ws/quota            → QuotaWebSocketHandler
```

**New Structure**:
```
/ws/airconditioner   → AirConditionerWebSocketHandler
/ws/quota            → QuotaWebSocketHandler
```

**Future Extensions**:
```
/ws/airconditioner   → AirConditionerWebSocketHandler
/ws/quota            → QuotaWebSocketHandler
/ws/lights           → LightsWebSocketHandler (future)
/ws/thermostat       → ThermostatWebSocketHandler (future)
/ws/security         → SecurityWebSocketHandler (future)
```

### 14.2 URL Naming Convention

**Pattern**: `/ws/{feature}?{context-params}`

**Components**:
- **Base**: `/ws` - WebSocket endpoint prefix
- **Feature**: `/{feature}` - Device or capability type (airconditioner, quota, lights)
- **Context**: `?{params}` - Instance-specific parameters (roomId, token, etc.)

**Examples**:
```
/ws/airconditioner?roomId=bedroom&familyMemberId=user123&token=jwt
/ws/quota?quotaId=daily-limit&roomId=bedroom&familyMemberId=user123&token=jwt
/ws/lights?roomId=living-room&familyMemberId=user456&token=jwt (future)
```

### 14.3 References

- [WebSocket Unification Spec](../websocket-unification/spec.md)
- [WebSocket Unification Verification Report](../websocket-unification/verification-report.md)
- [CLAUDE.md Project Guidelines](../../../CLAUDE.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-05
**Next Review**: After implementation completion
