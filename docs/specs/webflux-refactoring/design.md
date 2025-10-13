# WebFlux Refactoring - Technical Design Document

## Architecture Overview

This document outlines the technical design for migrating the Mitsubishi Air Conditioner Remote Control backend from Spring Boot MVC + RSocket to Spring Boot WebFlux with WebSocket, completely replacing RSocket functionality while preserving all existing capabilities and improving performance characteristics.

## Current vs. Target Architecture

### Current Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │────│   Spring MVC     │────│  AirConService  │
│   (React)       │    │   REST API       │    │  (Blocking)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                         │
┌─────────────────┐    ┌──────────────────┐              │
│   RSocket       │────│   RSocket        │              │
│   Clients       │    │   Controllers    │              │
│   (Reactive)    │    │   (Reactive)     │              │
└─────────────────┘    └──────────────────┘              │
                                │                         │
                        ┌──────────────────┐    ┌─────────────────┐
                        │   MQTT Service   │────│   MQTT Broker   │
                        │   (Callbacks)    │    │   (External)    │
                        └──────────────────┘    └─────────────────┘
```

### Target Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │────│   WebFlux        │────│  Reactive       │
│   (React)       │    │   REST API       │    │  Service        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                         │
┌─────────────────┐    ┌──────────────────┐              │
│   WebSocket     │────│   WebFlux        │              │
│   Clients       │    │   WebSocket      │              │
│   (replaces     │    │   (Full Protocol │              │
│    RSocket)     │    │    Support)      │              │
└─────────────────┘    └──────────────────┘              │
                                │                         │
                        ┌──────────────────┐    ┌─────────────────┐
                        │   Reactive       │────│   MQTT Broker   │
                        │   MQTT Service   │    │   (External)    │
                        └──────────────────┘    └─────────────────┘
```

## Component Design

### 1. Reactive MQTT Service

**Current Implementation Issues:**
- Blocking Eclipse Paho client with callbacks
- Spring Application Events for inter-service communication
- Synchronous operations in message processing

**Reactive Design:**
```java
@Service
public class ReactiveMqttService {
    
    private final MqttService mqttService; // Existing service
    private final Flux<MqttStateUpdate> stateUpdates;
    private final Flux<MqttSettingsUpdate> settingsUpdates;
    private final Flux<MqttConnectionEvent> connectionEvents;
    
    // Bridge existing callbacks to reactive streams
    private final FluxSink<MqttStateUpdate> stateSink;
    private final FluxSink<MqttSettingsUpdate> settingsSink;
    private final FluxSink<MqttConnectionEvent> connectionSink;
    
    @PostConstruct
    public void initialize() {
        // Create reactive streams from existing MQTT callbacks
        this.stateUpdates = Flux.<MqttStateUpdate>create(sink -> {
            this.stateSink = sink;
            sink.onDispose(() -> cleanup());
        }).share(); // Hot stream for multiple subscribers
        
        // Subscribe to existing Spring events and bridge to reactive streams
        eventPublisher.publishEvent(/* ... */);
    }
    
    public Mono<Void> publishCommand(String roomId, String command, Object value) {
        return Mono.fromRunnable(() -> 
            mqttService.publishCommand(roomId, command, value))
            .subscribeOn(Schedulers.boundedElastic());
    }
    
    public Flux<MqttStateUpdate> getStateUpdates() {
        return stateUpdates;
    }
}
```

**Key Design Decisions:**
- Adapter pattern to bridge existing MQTT service to reactive streams
- Use `Flux.create()` with `FluxSink` for callback-to-reactive conversion
- Hot streams with `.share()` for multiple subscribers
- Preserve existing MQTT connection logic and configuration
- Use `Schedulers.boundedElastic()` for blocking operations

### 2. Reactive Service Layer

**Service Architecture:**
```java
@Service
public class ReactiveAirConService {
    
    private final ReactiveMqttService mqttService;
    
    // Preserve existing in-memory storage (thread-safe)
    private final ConcurrentMap<String, AirConState> roomStates = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, AirConSettings> roomSettings = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, LocalDateTime> lastUpdated = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> roomNames = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void initialize() {
        // Subscribe to reactive MQTT streams instead of @EventListener
        mqttService.getStateUpdates()
            .subscribe(this::handleStateUpdate);
            
        mqttService.getSettingsUpdates()
            .subscribe(this::handleSettingsUpdate);
    }
    
    // Reactive API methods
    public Mono<List<RoomInfo>> getRooms() {
        return Mono.fromCallable(this::buildRoomsList)
            .subscribeOn(Schedulers.boundedElastic());
    }
    
    public Mono<AirConState> getRoomState(String roomId) {
        return Mono.fromCallable(() -> roomStates.get(roomId))
            .filter(Objects::nonNull);
    }
    
    public Mono<Void> setPower(String roomId, String power) {
        return validateRoomId(roomId)
            .then(mqttService.publishCommand(roomId, "power", power));
    }
    
    // Streaming methods for WebSocket (replacing RSocket streams)
    public Flux<AirConState> getStateStream(String roomId) {
        return Flux.interval(Duration.ofSeconds(2))
            .map(i -> roomStates.get(roomId))
            .filter(Objects::nonNull)
            .distinctUntilChanged();
    }
    
    public Flux<AirConSettings> getSettingsStream(String roomId) {
        return Flux.interval(Duration.ofSeconds(2))
            .map(i -> roomSettings.get(roomId))
            .filter(Objects::nonNull)
            .distinctUntilChanged();
    }
    
    private Mono<Void> validateRoomId(String roomId) {
        return Mono.fromCallable(() -> {
            if (roomId == null || !roomNames.containsKey(roomId)) {
                throw new IllegalArgumentException("Invalid room ID: " + roomId);
            }
            return roomId;
        }).then();
    }
}
```

**Key Design Decisions:**
- Keep `ConcurrentHashMap` for in-memory storage (already thread-safe)
- Replace Spring `@EventListener` with reactive stream subscriptions
- Return `Mono<T>` for single values, `Flux<T>` for streams
- Add streaming methods to support WebSocket subscriptions (replacing RSocket)
- Use `Schedulers.boundedElastic()` for potentially blocking operations
- Reactive validation with proper error propagation

### 3. WebFlux REST API

**Router Configuration:**
```java
@Configuration
public class AirConRouterConfig {
    
    @Bean
    public RouterFunction<ServerResponse> airConRoutes(AirConHandler handler) {
        return RouterFunctions.route()
            .GET("/api/rooms", handler::getRooms)
            .GET("/api/rooms/{roomId}/state", handler::getRoomState)  
            .GET("/api/rooms/{roomId}/settings", handler::getRoomSettings)
            .POST("/api/rooms/{roomId}/power", handler::setPower)
            .POST("/api/rooms/{roomId}/temperature", handler::setTemperature)
            .POST("/api/rooms/{roomId}/mode", handler::setMode)
            .POST("/api/rooms/{roomId}/fan", handler::setFan)
            .POST("/api/rooms/{roomId}/vane", handler::setVane)
            .POST("/api/rooms/{roomId}/widevane", handler::setWideVane)
            .PUT("/api/rooms/{roomId}/settings", handler::updateSettings)
            .GET("/api/rooms/mqtt/status", handler::getMqttStatus)
            .filter(corsFilter())
            .filter(validationFilter())
            .filter(errorHandlingFilter())
            .build();
    }
    
    @Bean
    public HandlerFilterFunction<ServerResponse, ServerResponse> corsFilter() {
        return (request, next) -> {
            return next.handle(request)
                .flatMap(response -> ServerResponse.from(response)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                    .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                    .build());
        };
    }
}
```

**Handler Implementation:**
```java
@Component
public class AirConHandler {
    
    private final ReactiveAirConService airConService;
    private final Validator validator;
    
    public Mono<ServerResponse> getRooms(ServerRequest request) {
        return airConService.getRooms()
            .flatMap(rooms -> ServerResponse.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(rooms))
            .onErrorResume(this::handleError);
    }
    
    public Mono<ServerResponse> setPower(ServerRequest request) {
        String roomId = request.pathVariable("roomId");
        return request.bodyToMono(String.class)
            .flatMap(power -> airConService.setPower(roomId, power))
            .then(ServerResponse.ok().bodyValue("Power command sent"))
            .onErrorResume(this::handleError);
    }
    
    private Mono<ServerResponse> handleError(Throwable error) {
        if (error instanceof IllegalArgumentException) {
            return ServerResponse.badRequest().bodyValue("Error: " + error.getMessage());
        }
        return ServerResponse.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .bodyValue("Internal server error");
    }
}
```

### 4. WebSocket Implementation (Replacing RSocket)

**WebSocket Configuration:**
```java
@Configuration
public class WebSocketConfig {
    
    @Bean
    public HandlerMapping webSocketHandlerMapping(ReactiveWebSocketHandler handler) {
        Map<String, WebSocketHandler> map = Map.of("/ws", handler);
        SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
        mapping.setUrlMap(map);
        mapping.setOrder(1);
        return mapping;
    }
    
    @Bean
    public ReactiveWebSocketHandler reactiveWebSocketHandler(
            ReactiveAirConService airConService,
            ObjectMapper objectMapper) {
        return new ReactiveWebSocketHandler(airConService, objectMapper);
    }
}
```

**WebSocket Handler (Complete RSocket Replacement):**
```java
@Component
public class ReactiveWebSocketHandler implements WebSocketHandler {
    
    private final ReactiveAirConService airConService;
    private final ObjectMapper objectMapper;
    private final Map<String, FluxSink<String>> sessionSinks = new ConcurrentHashMap<>();
    
    @Override
    public Mono<Void> handle(WebSocketSession session) {
        
        // Handle incoming messages from client
        Flux<Void> input = session.receive()
            .map(WebSocketMessage::getPayloadAsText)
            .flatMap(this::parseMessage)
            .flatMap(msg -> processMessage(msg, session))
            .doOnError(error -> log.error("WebSocket message error", error))
            .onErrorResume(error -> Mono.empty())
            .then();
            
        // Handle outgoing messages to client
        Flux<String> output = Flux.<String>create(sink -> {
            sessionSinks.put(session.getId(), sink);
            sink.onDispose(() -> sessionSinks.remove(session.getId()));
        }).share();
            
        return session.send(output.map(session::textMessage)).and(input);
    }
    
    private Mono<WebSocketMessage> parseMessage(String json) {
        return Mono.fromCallable(() -> objectMapper.readValue(json, WebSocketMessage.class))
            .onErrorResume(JsonProcessingException.class, 
                error -> Mono.error(new IllegalArgumentException("Invalid JSON: " + error.getMessage())));
    }
    
    private Mono<Void> processMessage(WebSocketMessage message, WebSocketSession session) {
        return switch (message.getType()) {
            // Replace RSocket: rooms.list
            case "request" -> handleRequest(message, session);
            
            // Replace RSocket: rooms.state.stream, rooms.settings.stream
            case "subscribe" -> handleSubscription(message, session);
            case "unsubscribe" -> handleUnsubscription(message, session);
            
            // Replace RSocket: rooms.power, rooms.temperature, etc.
            case "command" -> handleCommand(message, session);
            
            default -> Mono.error(new IllegalArgumentException("Unknown message type: " + message.getType()));
        };
    }
    
    // Replace RSocket: room.{roomId}.state, room.{roomId}.settings, mqtt.status
    private Mono<Void> handleRequest(WebSocketMessage message, WebSocketSession session) {
        return switch (message.getRequest()) {
            case "rooms.list" -> airConService.getRooms()
                .map(rooms -> createResponse(message.getId(), "rooms.list", rooms))
                .flatMap(response -> sendToSession(session, response));
                
            case "room.state" -> airConService.getRoomState(message.getRoomId())
                .map(state -> createResponse(message.getId(), "room.state", state))
                .flatMap(response -> sendToSession(session, response));
                
            case "room.settings" -> airConService.getRoomSettings(message.getRoomId())
                .map(settings -> createResponse(message.getId(), "room.settings", settings))
                .flatMap(response -> sendToSession(session, response));
                
            case "mqtt.status" -> Mono.just(airConService.isMqttConnected())
                .map(status -> createResponse(message.getId(), "mqtt.status", status))
                .flatMap(response -> sendToSession(session, response));
                
            default -> Mono.error(new IllegalArgumentException("Unknown request: " + message.getRequest()));
        };
    }
    
    // Replace RSocket: rooms.state.stream, rooms.settings.stream
    private Mono<Void> handleSubscription(WebSocketMessage message, WebSocketSession session) {
        return switch (message.getSubscription()) {
            case "room.state.stream" -> {
                Disposable subscription = airConService.getStateStream(message.getRoomId())
                    .map(state -> createStreamMessage("room.state.stream", message.getRoomId(), state))
                    .subscribe(msg -> sendToSession(session, msg).subscribe());
                
                // Store subscription for cleanup
                session.getAttributes().put("stateSubscription", subscription);
                yield Mono.empty();
            }
            
            case "room.settings.stream" -> {
                Disposable subscription = airConService.getSettingsStream(message.getRoomId())
                    .map(settings -> createStreamMessage("room.settings.stream", message.getRoomId(), settings))
                    .subscribe(msg -> sendToSession(session, msg).subscribe());
                
                session.getAttributes().put("settingsSubscription", subscription);
                yield Mono.empty();
            }
            
            default -> Mono.error(new IllegalArgumentException("Unknown subscription: " + message.getSubscription()));
        };
    }
    
    // Replace RSocket: rooms.power, rooms.temperature, rooms.mode, etc.
    private Mono<Void> handleCommand(WebSocketMessage message, WebSocketSession session) {
        return switch (message.getCommand()) {
            case "power" -> airConService.setPower(message.getRoomId(), message.getValue())
                .then(sendCommandAck(session, message.getId(), "power"));
                
            case "temperature" -> airConService.setTemperature(message.getRoomId(), 
                    Integer.parseInt(message.getValue()))
                .then(sendCommandAck(session, message.getId(), "temperature"));
                
            case "mode" -> airConService.setMode(message.getRoomId(), message.getValue())
                .then(sendCommandAck(session, message.getId(), "mode"));
                
            case "fan" -> airConService.setFan(message.getRoomId(), message.getValue())
                .then(sendCommandAck(session, message.getId(), "fan"));
                
            case "vane" -> airConService.setVane(message.getRoomId(), message.getValue())
                .then(sendCommandAck(session, message.getId(), "vane"));
                
            case "wideVane" -> airConService.setWideVane(message.getRoomId(), message.getValue())
                .then(sendCommandAck(session, message.getId(), "wideVane"));
                
            case "settings" -> {
                AirConSettings settings = objectMapper.readValue(message.getValue(), AirConSettings.class);
                yield airConService.updateSettings(message.getRoomId(), settings)
                    .then(sendCommandAck(session, message.getId(), "settings"));
            }
            
            default -> Mono.error(new IllegalArgumentException("Unknown command: " + message.getCommand()));
        };
    }
    
    private Mono<Void> sendToSession(WebSocketSession session, String message) {
        FluxSink<String> sink = sessionSinks.get(session.getId());
        if (sink != null) {
            sink.next(message);
        }
        return Mono.empty();
    }
}
```

**Message Protocol (Replacing RSocket Messages):**
```java
// Unified WebSocket message format replacing all RSocket message types
public class WebSocketMessage {
    private String id;           // Request correlation ID
    private String type;         // "request", "subscribe", "unsubscribe", "command"
    private String request;      // For request type: "rooms.list", "room.state", etc.
    private String subscription; // For subscribe type: "room.state.stream", etc.  
    private String command;      // For command type: "power", "temperature", etc.
    private String roomId;       // Target room ID
    private String value;        // Command value or request parameter
    // getters/setters
}

// Response format
public class WebSocketResponse {
    private String id;           // Correlation ID from request
    private String type;         // "response", "stream", "ack", "error"
    private String source;       // Original request/subscription name
    private Object data;         // Response payload
    private String error;        // Error message if applicable
    // getters/setters
}
```

## RSocket Migration Mapping

### RSocket to WebSocket Protocol Mapping

| Current RSocket | WebSocket Replacement | Message Type |
|----------------|----------------------|--------------|
| `rooms.list` | `{"type":"request","request":"rooms.list"}` | Request/Response |
| `room.{roomId}.state` | `{"type":"request","request":"room.state","roomId":"..."}` | Request/Response |
| `room.{roomId}.settings` | `{"type":"request","request":"room.settings","roomId":"..."}` | Request/Response |
| `rooms.state.stream` | `{"type":"subscribe","subscription":"room.state.stream","roomId":"..."}` | Subscription |
| `rooms.settings.stream` | `{"type":"subscribe","subscription":"room.settings.stream","roomId":"..."}` | Subscription |
| `rooms.power` | `{"type":"command","command":"power","roomId":"...","value":"on"}` | Command |
| `rooms.temperature` | `{"type":"command","command":"temperature","roomId":"...","value":"22"}` | Command |
| `rooms.mode` | `{"type":"command","command":"mode","roomId":"...","value":"cool"}` | Command |
| `rooms.fan` | `{"type":"command","command":"fan","roomId":"...","value":"auto"}` | Command |
| `rooms.vane` | `{"type":"command","command":"vane","roomId":"...","value":"auto"}` | Command |
| `rooms.wideVane` | `{"type":"command","command":"wideVane","roomId":"...","value":"auto"}` | Command |
| `rooms.settings` | `{"type":"command","command":"settings","roomId":"...","value":"{...}"}` | Command |
| `mqtt.status` | `{"type":"request","request":"mqtt.status"}` | Request/Response |

## Data Flow Architecture

### State Update Flow
```
MQTT Broker → ReactiveMqttService → ReactiveAirConService → WebSocket Clients
                     ↓                        ↓                    ↓
              Flux<StateUpdate>        ConcurrentHashMap    Subscription Streams
```

### Command Flow  
```
WebSocket Client → WebSocket Handler → ReactiveAirConService → ReactiveMqttService → MQTT Broker
        ↓                ↓                      ↓                        ↓
   JSON Command    Message Parsing      Business Logic           Command Publishing
```

### Request/Response Flow
```
WebSocket Client → WebSocket Handler → ReactiveAirConService → WebSocket Client
        ↓                ↓                      ↓                    ↓
   JSON Request    Message Parsing        Data Retrieval        JSON Response
```

## Performance Characteristics

### Resource Utilization
- **Single Event Loop**: All I/O operations share Netty event loop (WebFlux + WebSocket)
- **No RSocket Overhead**: Eliminates RSocket protocol overhead and dependencies
- **Simplified Architecture**: Single WebSocket protocol for all real-time communication
- **Better Memory Efficiency**: WebSocket has lower memory footprint than RSocket

### Scalability Improvements
- **Unified Protocol**: Single WebSocket connection handles all real-time operations
- **Connection Efficiency**: WebSocket connection reuse vs RSocket session management
- **Protocol Simplicity**: JSON over WebSocket is simpler than RSocket's binary protocol
- **Client Compatibility**: Better browser and client support for WebSocket vs RSocket

## Migration Strategy

### Dependency Changes
```xml
<!-- REMOVE RSocket dependencies -->
<!-- 
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-rsocket</artifactId>
</dependency>
-->

<!-- ADD WebFlux dependency -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

### Configuration Changes
```properties
# REMOVE RSocket configuration
# spring.rsocket.server.port=7000
# spring.rsocket.server.transport=websocket
# spring.rsocket.server.mapping-path=/rsocket

# ADD WebFlux configuration (inherits from WebFlux autoconfiguration)
# WebSocket endpoint will be available at /ws
```

### Implementation Phases
1. **Phase 1**: Implement ReactiveMqttService with existing service adapter
2. **Phase 2**: Create ReactiveAirConService with reactive method signatures  
3. **Phase 3**: Implement WebFlux REST handlers and router configuration
4. **Phase 4**: Implement comprehensive WebSocket handler replacing all RSocket functionality
5. **Phase 5**: Remove all RSocket controllers, configurations, and dependencies
6. **Phase 6**: Update tests to use WebSocket instead of RSocket
7. **Phase 7**: Remove old MVC controllers

### Risk Mitigation
- **Protocol Testing**: Comprehensive testing of WebSocket message patterns
- **Performance Validation**: Ensure WebSocket performance matches or exceeds RSocket
- **Client Migration**: Update any RSocket clients to use WebSocket protocol
- **Monitoring**: Enhanced logging during migration for issue detection

This design completely eliminates RSocket while providing equivalent functionality through WebFlux WebSocket, resulting in a simpler and more maintainable architecture.