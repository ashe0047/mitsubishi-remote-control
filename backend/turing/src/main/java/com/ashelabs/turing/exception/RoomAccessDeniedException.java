package com.ashelabs.turing.exception;

import lombok.Getter;

import java.util.Map;
import java.util.UUID;

/**
 * Exception thrown when a user attempts to access a room they don't have permission for.
 * 
 * This exception carries authorization-specific information to help generate
 * comprehensive error responses.
 */
@Getter
public class RoomAccessDeniedException extends RuntimeException {

    private final UUID userId;
    private final UUID roomId;
    private final String requiredPermission;
    private final String userRole;
    private final Map<String, Object> authDetails;

    public RoomAccessDeniedException(String message, UUID userId, UUID roomId) {
        super(message);
        this.userId = userId;
        this.roomId = roomId;
        this.requiredPermission = null;
        this.userRole = null;
        this.authDetails = null;
    }

    public RoomAccessDeniedException(String message, UUID userId, UUID roomId, 
                                   String requiredPermission, String userRole) {
        super(message);
        this.userId = userId;
        this.roomId = roomId;
        this.requiredPermission = requiredPermission;
        this.userRole = userRole;
        this.authDetails = null;
    }

    public RoomAccessDeniedException(String message, UUID userId, UUID roomId, 
                                   Map<String, Object> authDetails) {
        super(message);
        this.userId = userId;
        this.roomId = roomId;
        this.requiredPermission = (String) (authDetails != null ? authDetails.get("requiredPermission") : null);
        this.userRole = (String) (authDetails != null ? authDetails.get("userRole") : null);
        this.authDetails = authDetails;
    }

    /**
     * Creates a room access denied exception for insufficient role.
     * 
     * @param userId User ID
     * @param roomId Room ID
     * @param userRole Current user role
     * @param requiredRole Required role for the operation
     * @return RoomAccessDeniedException with role details
     */
    public static RoomAccessDeniedException insufficientRole(UUID userId, UUID roomId, 
                                                           String userRole, String requiredRole) {
        String message = String.format("User %s with role %s cannot access room %s (requires %s)", 
                                      userId, userRole, roomId, requiredRole);
        Map<String, Object> details = Map.of(
            "errorType", "INSUFFICIENT_ROLE",
            "userRole", userRole,
            "requiredRole", requiredRole,
            "roomId", roomId.toString()
        );
        return new RoomAccessDeniedException(message, userId, roomId, details);
    }

    /**
     * Creates a room access denied exception for room not found in user's household.
     * 
     * @param userId User ID
     * @param roomId Room ID
     * @param householdId User's household ID
     * @return RoomAccessDeniedException with household details
     */
    public static RoomAccessDeniedException roomNotInHousehold(UUID userId, UUID roomId, UUID householdId) {
        String message = String.format("Room %s is not accessible to user %s in household %s", 
                                      roomId, userId, householdId);
        Map<String, Object> details = Map.of(
            "errorType", "ROOM_NOT_IN_HOUSEHOLD",
            "householdId", householdId.toString(),
            "roomId", roomId.toString()
        );
        return new RoomAccessDeniedException(message, userId, roomId, details);
    }

    /**
     * Creates a room access denied exception for room assignment restrictions.
     * 
     * @param userId User ID
     * @param roomId Room ID
     * @param assignedRooms List of rooms the user is assigned to
     * @return RoomAccessDeniedException with assignment details
     */
    public static RoomAccessDeniedException roomNotAssigned(UUID userId, UUID roomId, java.util.List<UUID> assignedRooms) {
        String message = String.format("User %s is not assigned to room %s", userId, roomId);
        Map<String, Object> details = Map.of(
            "errorType", "ROOM_NOT_ASSIGNED",
            "assignedRooms", assignedRooms.stream().map(UUID::toString).toList(),
            "roomId", roomId.toString()
        );
        return new RoomAccessDeniedException(message, userId, roomId, details);
    }

    /**
     * Gets authorization details for error response generation.
     * 
     * @return Map of authorization-specific details
     */
    public Map<String, Object> getAuthDetails() {
        if (authDetails != null) {
            return authDetails;
        }
        
        // Build basic auth details
        Map<String, Object> details = new java.util.HashMap<>();
        details.put("userId", userId.toString());
        details.put("roomId", roomId.toString());
        if (userRole != null) {
            details.put("userRole", userRole);
        }
        if (requiredPermission != null) {
            details.put("requiredPermission", requiredPermission);
        }
        
        return details;
    }

    /**
     * Gets the error type for this authorization failure.
     * 
     * @return Error type string
     */
    public String getErrorType() {
        if (authDetails != null) {
            Object errorType = authDetails.get("errorType");
            if (errorType instanceof String) {
                return (String) errorType;
            }
        }
        return "ACCESS_DENIED";
    }

    /**
     * Checks if this is a role-based access denial.
     * 
     * @return true if the denial is due to insufficient role
     */
    public boolean isRoleBasedDenial() {
        return "INSUFFICIENT_ROLE".equals(getErrorType());
    }

    /**
     * Checks if this is a household-based access denial.
     * 
     * @return true if the denial is due to room not being in user's household
     */
    public boolean isHouseholdBasedDenial() {
        return "ROOM_NOT_IN_HOUSEHOLD".equals(getErrorType());
    }

    /**
     * Checks if this is an assignment-based access denial.
     * 
     * @return true if the denial is due to room assignment restrictions
     */
    public boolean isAssignmentBasedDenial() {
        return "ROOM_NOT_ASSIGNED".equals(getErrorType());
    }
}