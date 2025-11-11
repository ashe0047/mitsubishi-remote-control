package com.ashelabs.turing.dto.room;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for creating a new room.
 * Follows DRY principle by centralizing validation constraints.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateRoomRequest {

    /**
     * Room name (required, 2-100 characters).
     * Must be unique within the household.
     */
    @NotBlank(message = "Room name is required")
    @Size(min = 2, max = 100, message = "Room name must be between 2 and 100 characters")
    private String name;

    /**
     * Room location (optional, max 100 characters).
     * Examples: "Ground Floor", "First Floor", "Basement"
     */
    @Size(max = 100, message = "Location must not exceed 100 characters")
    private String location;

    /**
     * Room description (optional, max 500 characters).
     */
    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;
}
