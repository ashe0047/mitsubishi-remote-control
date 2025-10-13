# WebSocket Endpoint Restructuring - Implementation Plan

**Feature**: WebSocket Endpoint Path Restructuring
**Status**: Ready for Implementation
**Created**: 2025-10-05
**Author**: Development Team

---

## 1. Implementation Overview

### 1.1 Objective

Implement WebSocket endpoint path changes from `/ws` to `/ws/airconditioner` across backend and frontend codebases with zero functional regression.

### 1.2 Scope

**In Scope**:
- ✅ Update backend URL mapping in WebSocketConfig
- ✅ Update frontend WebSocket connection URLs
- ✅ Update code documentation and comments
- ✅ Update project documentation (CLAUDE.md)
- ✅ Manual testing and verification

**Out of Scope**:
- ❌ API versioning
- ❌ Backwards compatibility
- ❌ Automated test creation
- ❌ Handler business logic changes

### 1.3 Implementation Strategy

**Approach**: Direct cutover with systematic validation

**Phases**:
1. **Phase 1**: Update backend WebSocketConfig
2. **Phase 2**: Locate and update frontend WebSocket URLs
3. **Phase 3**: Update documentation
4. **Phase 4**: Testing and verification

**Total Estimated Time**: 2-3 hours

---

## 2. Phase 1: Backend URL Mapping Update

### 2.1 File Changes

**File**: `/backend/turing/src/main/java/com/ashelabs/turing/config/WebSocketConfig.java`

**Current Code** (lines 17-49):
```java
/**
 * WebSocket configuration for unified handler architecture.
 *
 * <p>Maps WebSocket endpoints to handlers with JWT authentication:
 * <ul>
 *   <li>/ws - Air conditioner control (AirConditionerWebSocketHandler)</li>
 *   <li>/ws/quota - Quota management (QuotaWebSocketHandler)</li>
 * </ul>
 *
 * <p>All handlers extend BaseWebSocketHandler and use Command Pattern.
 */
@Configuration
public class WebSocketConfig {

    @Bean
    public HandlerMapping webSocketHandlerMapping(
            AirConditionerWebSocketHandler airConditionerHandler,
            QuotaWebSocketHandler quotaWebSocketHandler,
            JwtService jwtService) {

        // Wrap handlers with JWT authentication
        WebSocketHandler securedAirConditionerHandler = new WebSocketJwtAuthHandler(airConditionerHandler, jwtService);
        WebSocketHandler securedQuotaWebSocketHandler = new WebSocketJwtAuthHandler(quotaWebSocketHandler, jwtService);

        Map<String, WebSocketHandler> map = new HashMap<>();
        map.put("/ws", securedAirConditionerHandler);          // Air conditioner endpoint
        map.put("/ws/quota", securedQuotaWebSocketHandler);    // Quota endpoint

        SimpleUrlHandlerMapping handlerMapping = new SimpleUrlHandlerMapping();
        handlerMapping.setUrlMap(map);
        handlerMapping.setOrder(1);
        return handlerMapping;
    }

    @Bean
    public WebSocketHandlerAdapter handlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}
```

**New Code**:
```java
/**
 * WebSocket configuration for unified handler architecture.
 *
 * <p>URL Pattern: /ws/{feature}?{context-params}
 *
 * <p>Maps WebSocket endpoints to handlers with JWT authentication:
 * <ul>
 *   <li>/ws/airconditioner - Air conditioner control (AirConditionerWebSocketHandler)</li>
 *   <li>/ws/quota - Quota management (QuotaWebSocketHandler)</li>
 * </ul>
 *
 * <p>Query Parameters:
 * <ul>
 *   <li>roomId - Room identifier</li>
 *   <li>familyMemberId - User/family member identifier</li>
 *   <li>quotaId - Quota identifier (for /ws/quota only)</li>
 *   <li>token - JWT authentication token</li>
 * </ul>
 *
 * <p>All handlers extend BaseWebSocketHandler and use Command Pattern.
 *
 * @see AirConditionerWebSocketHandler
 * @see QuotaWebSocketHandler
 * @see BaseWebSocketHandler
 */
@Configuration
public class WebSocketConfig {

    @Bean
    public HandlerMapping webSocketHandlerMapping(
            AirConditionerWebSocketHandler airConditionerHandler,
            QuotaWebSocketHandler quotaWebSocketHandler,
            JwtService jwtService) {

        // Wrap handlers with JWT authentication decorator
        WebSocketHandler securedAirConditionerHandler = new WebSocketJwtAuthHandler(airConditionerHandler, jwtService);
        WebSocketHandler securedQuotaWebSocketHandler = new WebSocketJwtAuthHandler(quotaWebSocketHandler, jwtService);

        // URL Pattern: /ws/{feature}
        Map<String, WebSocketHandler> map = new HashMap<>();
        map.put("/ws/airconditioner", securedAirConditionerHandler);  // Air conditioner control
        map.put("/ws/quota", securedQuotaWebSocketHandler);           // Quota management

        SimpleUrlHandlerMapping handlerMapping = new SimpleUrlHandlerMapping();
        handlerMapping.setUrlMap(map);
        handlerMapping.setOrder(1);
        return handlerMapping;
    }

    @Bean
    public WebSocketHandlerAdapter handlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}
```

**Changes Summary**:
1. Line 5: Add URL pattern documentation
2. Line 9: Update endpoint from `/ws` to `/ws/airconditioner`
3. Lines 13-18: Add query parameter documentation
4. Lines 21-24: Add @see references to related classes
5. Line 37: Update comment "Wrap handlers with JWT authentication decorator"
6. Line 41: Add comment "URL Pattern: /ws/{feature}"
7. Line 43: Change `/ws` to `/ws/airconditioner`

### 2.2 Implementation Steps

**Step 1**: Open WebSocketConfig.java
```bash
# Navigate to file
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/backend/turing
```

**Step 2**: Update JavaDoc (lines 17-26)
- Add URL pattern documentation
- Update endpoint list
- Add query parameter documentation
- Add @see references

**Step 3**: Update URL mapping (line 42)
- Change: `map.put("/ws", securedAirConditionerHandler);`
- To: `map.put("/ws/airconditioner", securedAirConditionerHandler);`

**Step 4**: Verify compilation
```bash
./mvnw compile
```

### 2.3 Validation Checklist

- [ ] JavaDoc updated with URL pattern
- [ ] URL mapping changed to `/ws/airconditioner`
- [ ] Comments updated for clarity
- [ ] Code compiles successfully
- [ ] No other references to old `/ws` URL in backend code

---

## 3. Phase 2: Frontend URL Update

### 3.1 Locate Frontend WebSocket Code

**Search Strategy**:
```bash
# Search for WebSocket connection URLs in frontend
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/frontend
grep -r "ws:" src/
grep -r "WebSocket" src/
grep -r "/ws" src/
```

**Expected Locations**:
- WebSocket client initialization
- MQTT client configuration
- Environment configuration files
- WebSocket connection hooks/utilities

### 3.2 Update Frontend URLs

**Pattern to Find**:
```typescript
// Old pattern
const wsUrl = `${protocol}://${host}:${port}/ws?roomId=${roomId}&...`;
// or
const endpoint = '/ws';
// or
NEXT_PUBLIC_WS_ENDPOINT=/ws
```

**Pattern to Replace With**:
```typescript
// New pattern
const wsUrl = `${protocol}://${host}:${port}/ws/airconditioner?roomId=${roomId}&...`;
// or
const endpoint = '/ws/airconditioner';
// or
NEXT_PUBLIC_WS_ENDPOINT=/ws/airconditioner
```

### 3.3 Implementation Steps

**Step 1**: Search for all WebSocket-related code
```bash
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/frontend
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec grep -l "ws:" {} \;
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "WebSocket" {} \;
```

**Step 2**: Review each file and update URLs

**Step 3**: Check environment files
```bash
# Check for WebSocket endpoint configuration
cat .env
cat .env.local
cat .env.development
```

**Step 4**: Verify no hardcoded URLs remain
```bash
grep -r '"/ws"' src/
grep -r "'/ws'" src/
```

### 3.4 Validation Checklist

- [ ] All WebSocket connection URLs updated
- [ ] Environment variables updated (if any)
- [ ] No hardcoded old URLs remaining
- [ ] Query parameters still correctly appended
- [ ] TypeScript compilation successful

---

## 4. Phase 3: Documentation Update

### 4.1 Update CLAUDE.md

**File**: `/CLAUDE.md`

**Section to Update**: WebSocket Configuration

**Current Content** (approximate location):
```markdown
### MQTT Topics and Message Structure

**Base Topic Pattern**: `mitsubishi2mqtt/{room_id}`

**Topic Types**:
- `/mode/set` - AC mode (off, heat, cool, etc.)
...
```

**Add New Section After MQTT Topics**:
```markdown
### WebSocket Endpoints

**URL Pattern**: `/ws/{feature}?{context-params}`

**Available Endpoints**:

#### Air Conditioner Control
- **URL**: `/ws/airconditioner`
- **Handler**: `AirConditionerWebSocketHandler`
- **Package**: `websocket/airconditioner/`
- **Query Parameters**:
  - `roomId` (required) - Room identifier for AC control
  - `familyMemberId` (required) - User/family member identifier
  - `token` (required) - JWT authentication token

**Example**:
```
ws://localhost:8080/ws/airconditioner?roomId=bedroom&familyMemberId=user123&token=eyJhbGc...
```

**Message Types**: AirConditionerInboundMessage, AirConditionerOutboundMessage
**Commands**: 6 commands (SetTemperature, SetMode, SetFanSpeed, SetPower, SetSwing, GetStatus)

#### Quota Management
- **URL**: `/ws/quota`
- **Handler**: `QuotaWebSocketHandler`
- **Package**: `websocket/quota/`
- **Query Parameters**:
  - `quotaId` (required) - Quota identifier
  - `roomId` (required) - Room identifier
  - `familyMemberId` (required) - User/family member identifier
  - `token` (required) - JWT authentication token

**Example**:
```
ws://localhost:8080/ws/quota?quotaId=daily-limit&roomId=bedroom&familyMemberId=user123&token=eyJhbGc...
```

**Message Types**: QuotaInboundMessage, QuotaOutboundMessage
**Commands**: 5 commands (Subscribe, Unsubscribe, OverrideRequest, OverrideApproval, HealthCheck)

### WebSocket URL Naming Convention

**Pattern**: `/ws/{feature}?{context-params}`

**Components**:
- **Base**: `/ws` - WebSocket endpoint namespace
- **Feature**: `/{feature}` - Device or capability type (airconditioner, quota, lights)
- **Context**: `?{params}` - Instance-specific parameters (roomId, token, etc.)

**1:1:1 Mapping**:
```
URL Path              Handler Class                    Package
───────────────────── ──────────────────────────────── ─────────────────────────────
/ws/airconditioner → AirConditionerWebSocketHandler → websocket/airconditioner/
/ws/quota          → QuotaWebSocketHandler          → websocket/quota/
/ws/lights         → LightsWebSocketHandler         → websocket/lights/ (future)
```

**Adding New Endpoints**:
1. Create handler extending `BaseWebSocketHandler`
2. Add URL mapping in `WebSocketConfig.java`
3. Create package structure: `websocket/{feature}/`
4. Follow existing command and message patterns
```

### 4.2 Update README (if exists)

**File**: `/backend/turing/README.md` or project root README

**Section**: API Documentation or WebSocket section

**Content to Add**:
```markdown
## WebSocket API

### Endpoints

#### Air Conditioner Control
```
ws://localhost:8080/ws/airconditioner?roomId={roomId}&familyMemberId={familyMemberId}&token={jwt}
```

#### Quota Management
```
ws://localhost:8080/ws/quota?quotaId={quotaId}&roomId={roomId}&familyMemberId={familyMemberId}&token={jwt}
```

See [CLAUDE.md](../CLAUDE.md#websocket-endpoints) for detailed documentation.
```

### 4.3 Implementation Steps

**Step 1**: Update CLAUDE.md
```bash
# Open CLAUDE.md and add WebSocket endpoints section
nano /mnt/drive/codebases/apps/mitsubishi-remote-control/CLAUDE.md
```

**Step 2**: Update README if exists
```bash
# Check if README exists
ls -la /mnt/drive/codebases/apps/mitsubishi-remote-control/backend/turing/README.md
# Update if present
```

**Step 3**: Update this specification document references

### 4.4 Validation Checklist

- [ ] CLAUDE.md updated with WebSocket endpoints section
- [ ] URL pattern and naming convention documented
- [ ] Query parameters documented
- [ ] 1:1:1 mapping table added
- [ ] Extension pattern documented
- [ ] README updated (if exists)

---

## 5. Phase 4: Testing and Verification

### 5.1 Backend Compilation Test

**Test 1**: Compile backend code
```bash
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/backend/turing
./mvnw clean compile
```

**Expected Result**: ✅ BUILD SUCCESS

### 5.2 Backend Runtime Test

**Test 2**: Start backend server
```bash
./mvnw spring-boot:run
```

**Expected Result**: Server starts without errors, WebSocket endpoints registered

**Verification**:
```bash
# Check logs for endpoint registration
grep "WebSocket" logs/spring.log
```

### 5.3 Frontend Compilation Test

**Test 3**: Compile frontend code
```bash
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/frontend
pnpm install  # If needed
pnpm build
```

**Expected Result**: ✅ Build successful, no TypeScript errors

### 5.4 Frontend Runtime Test

**Test 4**: Start frontend dev server
```bash
pnpm dev
```

**Expected Result**: Server starts, no WebSocket connection errors in console

### 5.5 Integration Testing

**Test 5**: WebSocket Connection Test

**Steps**:
1. Open browser to `http://localhost:3000` (or configured port)
2. Open browser DevTools → Network tab → WS (WebSocket)
3. Navigate to a room with air conditioner
4. Verify WebSocket connection established

**Expected Result**:
```
Connection URL: ws://localhost:8080/ws/airconditioner?roomId=...&familyMemberId=...&token=...
Status: 101 Switching Protocols
State: Connected
```

**Test 6**: Message Flow Test

**Steps**:
1. Change AC temperature using UI controls
2. Monitor WebSocket messages in DevTools
3. Verify messages sent and received

**Expected Messages**:
```json
// Outbound (client → server)
{
  "type": "SET_TEMPERATURE",
  "temperature": 24
}

// Inbound (server → client)
{
  "type": "STATUS_UPDATE",
  "data": { ... }
}
```

**Test 7**: Authentication Test

**Steps**:
1. Clear localStorage/cookies (logout)
2. Try to connect to WebSocket
3. Verify connection rejected without valid JWT

**Expected Result**: Connection upgrade fails with 401/403 status

**Test 8**: Multiple Room Test

**Steps**:
1. Open multiple rooms in different browser tabs
2. Verify each has separate WebSocket connection
3. Check each connection uses correct roomId in URL

**Expected Result**: Multiple concurrent connections, each with correct roomId

### 5.6 Negative Testing

**Test 9**: Invalid Endpoint

**Steps**:
```bash
# Try to connect to old endpoint
wscat -c "ws://localhost:8080/ws?roomId=test&token=test"
```

**Expected Result**: ❌ 404 Not Found or connection rejected

**Test 10**: Missing Query Parameters

**Steps**:
```bash
# Connect without required params
wscat -c "ws://localhost:8080/ws/airconditioner"
```

**Expected Result**: Connection may establish but handler should validate and reject

### 5.7 Validation Checklist

- [ ] Backend compiles successfully
- [ ] Backend server starts without errors
- [ ] Frontend compiles successfully
- [ ] Frontend dev server starts without errors
- [ ] WebSocket connection established to `/ws/airconditioner`
- [ ] Query parameters correctly parsed (roomId, familyMemberId, token)
- [ ] JWT authentication works
- [ ] Messages sent and received correctly
- [ ] AC controls function properly (temperature, mode, fan, power)
- [ ] Real-time updates displayed in UI
- [ ] Multiple rooms can connect simultaneously
- [ ] Old `/ws` endpoint returns 404
- [ ] No console errors related to WebSocket

---

## 6. Rollback Procedure

### 6.1 If Issues Are Discovered

**Backend Rollback**:
```bash
# Revert WebSocketConfig.java
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/backend/turing
git diff src/main/java/com/ashelabs/turing/config/WebSocketConfig.java
git checkout src/main/java/com/ashelabs/turing/config/WebSocketConfig.java
./mvnw spring-boot:run
```

**Frontend Rollback**:
```bash
# Revert WebSocket URL changes
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/frontend
git diff src/
git checkout src/  # Or specific files
pnpm dev
```

**Effort**: ~5 minutes

### 6.2 Rollback Validation

- [ ] Backend reverted to old `/ws` endpoint
- [ ] Frontend reverted to old connection URL
- [ ] WebSocket connection works with old URLs
- [ ] No functionality lost

---

## 7. Post-Implementation Tasks

### 7.1 Code Review

**Review Checklist**:
- [ ] URL changes are correct and complete
- [ ] No hardcoded old URLs remain
- [ ] Documentation is comprehensive
- [ ] Code follows project conventions
- [ ] Comments are clear and helpful

### 7.2 Knowledge Transfer

**Documentation Deliverables**:
- [ ] Updated CLAUDE.md with WebSocket endpoints
- [ ] This implementation document
- [ ] URL naming convention guide
- [ ] Testing results summary

### 7.3 Monitoring

**Post-Deployment Checks**:
- [ ] Monitor server logs for WebSocket errors
- [ ] Check browser console for connection issues
- [ ] Verify user-reported issues (if any)
- [ ] Monitor WebSocket connection metrics

---

## 8. Success Criteria

### 8.1 Functional Success Criteria

- ✅ Backend WebSocketConfig updated to use `/ws/airconditioner`
- ✅ Frontend WebSocket connections use new URL
- ✅ WebSocket connection established successfully
- ✅ JWT authentication functions correctly
- ✅ Messages sent and received without errors
- ✅ AC controls work (temperature, mode, fan, power, swing)
- ✅ Real-time updates displayed correctly
- ✅ Multiple rooms can connect simultaneously
- ✅ Query parameters parsed correctly

### 8.2 Quality Success Criteria

- ✅ Code compiles without errors (backend and frontend)
- ✅ No runtime errors or warnings
- ✅ No console errors related to WebSocket
- ✅ Documentation is complete and accurate
- ✅ URL naming convention is established
- ✅ 1:1:1 mapping achieved (URL → Handler → Package)

### 8.3 Business Success Criteria

- ✅ No functional regression
- ✅ Improved code clarity and maintainability
- ✅ Clear extension pattern for future devices
- ✅ Self-documenting URL structure
- ✅ Easy onboarding for new developers

---

## 9. Implementation Timeline

| Phase | Task | Duration | Dependencies |
|-------|------|----------|--------------|
| **Phase 1** | Update WebSocketConfig | 15 min | None |
| | Verify backend compilation | 5 min | Phase 1.1 |
| **Phase 2** | Locate frontend WebSocket code | 15 min | None |
| | Update frontend URLs | 30 min | Phase 2.1 |
| | Verify frontend compilation | 5 min | Phase 2.2 |
| **Phase 3** | Update CLAUDE.md | 20 min | Phase 1, 2 complete |
| | Update README (if exists) | 10 min | Phase 3.1 |
| **Phase 4** | Backend runtime testing | 15 min | Phase 1, 3 complete |
| | Frontend runtime testing | 15 min | Phase 2, 3 complete |
| | Integration testing | 30 min | All phases complete |
| **Total** | | **2.5 hours** | |

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Missed frontend URL reference | Low | High | Systematic grep search, manual code review |
| Query parameter parsing breaks | Very Low | High | Verify parameter extraction in handlers |
| JWT auth fails | Very Low | High | Test authentication flow explicitly |
| Multiple connections interfere | Very Low | Medium | Test with multiple browser tabs |
| Documentation incomplete | Low | Low | Use checklist-based review |

---

## 11. Completion Checklist

### 11.1 Implementation Checklist

**Phase 1: Backend**
- [ ] WebSocketConfig.java line 43 updated: `/ws` → `/ws/airconditioner`
- [ ] JavaDoc updated with URL pattern and query params
- [ ] Comments added for clarity
- [ ] Backend compiles successfully (`./mvnw compile`)
- [ ] No other `/ws` references in backend code

**Phase 2: Frontend**
- [ ] All WebSocket connection code located
- [ ] All URLs updated to `/ws/airconditioner`
- [ ] Environment variables checked and updated (if any)
- [ ] No hardcoded old URLs remaining
- [ ] Frontend compiles successfully (`pnpm build`)

**Phase 3: Documentation**
- [ ] CLAUDE.md updated with WebSocket endpoints section
- [ ] URL pattern documented
- [ ] Query parameters documented
- [ ] 1:1:1 mapping table added
- [ ] Extension pattern documented
- [ ] README updated (if exists)

**Phase 4: Testing**
- [ ] Backend server starts successfully
- [ ] Frontend dev server starts successfully
- [ ] WebSocket connection established to `/ws/airconditioner`
- [ ] Query parameters correctly parsed
- [ ] JWT authentication works
- [ ] Messages sent and received correctly
- [ ] AC controls function properly
- [ ] Real-time updates work
- [ ] Multiple rooms can connect simultaneously
- [ ] Old `/ws` endpoint returns 404
- [ ] No console errors

### 11.2 Quality Checklist

- [ ] Code follows project style guidelines
- [ ] No TypeScript/Java compiler warnings
- [ ] No runtime errors or warnings
- [ ] All documentation is accurate
- [ ] All tests pass
- [ ] Rollback procedure documented and tested

### 11.3 Deployment Checklist

- [ ] Changes committed to version control
- [ ] Commit message follows convention
- [ ] Pull request created (if using PR workflow)
- [ ] Code reviewed and approved
- [ ] Deployed to development environment
- [ ] Smoke testing completed
- [ ] Stakeholders notified

---

## 12. Appendix

### 12.1 File Modification Summary

**Backend Files Modified**: 1
- `/backend/turing/src/main/java/com/ashelabs/turing/config/WebSocketConfig.java`
  - Line 5: Add URL pattern doc
  - Line 9: Update endpoint from `/ws` to `/ws/airconditioner`
  - Lines 13-18: Add query param docs
  - Lines 21-24: Add @see references
  - Line 37: Update comment
  - Line 41: Add URL pattern comment
  - Line 43: Change URL mapping

**Frontend Files Modified**: TBD (to be determined during Phase 2)
- WebSocket connection initialization files
- Environment configuration files (if any)

**Documentation Files Modified**: 2-3
- `/CLAUDE.md` - Add WebSocket endpoints section
- `/backend/turing/README.md` - Update API docs (if exists)
- `/docs/specs/websocket-endpoint-restructuring/implementation.md` - This document

### 12.2 Command Reference

**Backend Commands**:
```bash
# Navigate to backend
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/backend/turing

# Compile
./mvnw clean compile

# Run server
./mvnw spring-boot:run

# Search for references
grep -r "/ws" src/
```

**Frontend Commands**:
```bash
# Navigate to frontend
cd /mnt/drive/codebases/apps/mitsubishi-remote-control/frontend

# Install dependencies
pnpm install

# Build
pnpm build

# Run dev server
pnpm dev

# Search for WebSocket references
grep -r "ws:" src/
grep -r "WebSocket" src/
grep -r '"/ws"' src/
```

**Testing Commands**:
```bash
# Test WebSocket connection with wscat
npm install -g wscat
wscat -c "ws://localhost:8080/ws/airconditioner?roomId=test&familyMemberId=test&token=test"
```

### 12.3 URL Examples

**Air Conditioner WebSocket**:
```
Development:  ws://localhost:8080/ws/airconditioner?roomId=bedroom&familyMemberId=user123&token=eyJhbGc...
Production:   wss://api.example.com/ws/airconditioner?roomId=bedroom&familyMemberId=user123&token=eyJhbGc...
```

**Quota WebSocket**:
```
Development:  ws://localhost:8080/ws/quota?quotaId=daily&roomId=bedroom&familyMemberId=user123&token=eyJhbGc...
Production:   wss://api.example.com/ws/quota?quotaId=daily&roomId=bedroom&familyMemberId=user123&token=eyJhbGc...
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-05
**Status**: Ready for Implementation
