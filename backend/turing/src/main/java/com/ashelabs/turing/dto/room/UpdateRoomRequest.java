package com.ashelabs.turing.dto.room;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for updating an existing room.
 * All fields are optional - only provided fields will be updated.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRoomRequest {

    /**
     * Updated room name (optional, 2-100 characters).
     * If provided, must be unique within the household.
     */
    @Size(min = 2, max = 100, message = "Room name must be between 2 and 100 characters")
    private String name;

    /**
     * Updated room location (optional, max 100 characters).
     */
    @Size(max = 100, message = "Location must not exceed 100 characters")
    private String location;

    /**
     * Updated room description (optional, max 500 characters).
     */
    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;
}
