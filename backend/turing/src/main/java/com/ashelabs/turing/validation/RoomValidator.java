package com.ashelabs.turing.validation;

import com.ashelabs.turing.dto.room.CreateRoomRequest;
import com.ashelabs.turing.dto.room.UpdateRoomRequest;

import java.util.ArrayList;
import java.util.List;

/**
 * Validator for room-related data.
 *
 * Provides static validation methods following DRY principle.
 * All validation rules are centralized here for consistency and reusability.
 */
public class RoomValidator {

    // Validation constants
    public static final int MIN_NAME_LENGTH = 2;
    public static final int MAX_NAME_LENGTH = 100;
    public static final int MAX_LOCATION_LENGTH = 100;
    public static final int MAX_DESCRIPTION_LENGTH = 500;
    private static final String ROOM_IDENTIFIER_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

    private RoomValidator() {
        // Utility class - prevent instantiation
    }

    /**
     * Validate room name.
     *
     * Rules:
     * - Cannot be null or blank
     * - Minimum length: 2 characters
     * - Maximum length: 100 characters
     */
    public static ValidationResult validateName(String name) {
        List<String> errors = new ArrayList<>();

        if (name == null || name.isBlank()) {
            errors.add("Room name cannot be empty");
            return new ValidationResult(errors);
        }

        String trimmed = name.trim();
        if (trimmed.length() < MIN_NAME_LENGTH) {
            errors.add("Room name must be at least " + MIN_NAME_LENGTH + " characters");
        }
        if (trimmed.length() > MAX_NAME_LENGTH) {
            errors.add("Room name cannot exceed " + MAX_NAME_LENGTH + " characters");
        }

        return new ValidationResult(errors);
    }

    /**
     * Validate room identifier (slug).
     *
     * Rules:
     * - Cannot be null or blank
     * - Must match pattern: lowercase alphanumeric with hyphens
     * - Pattern: ^[a-z0-9]+(-[a-z0-9]+)*$
     */
    public static ValidationResult validateRoomIdentifier(String identifier) {
        List<String> errors = new ArrayList<>();

        if (identifier == null || identifier.isBlank()) {
            errors.add("Room identifier cannot be empty");
            return new ValidationResult(errors);
        }

        if (!identifier.matches(ROOM_IDENTIFIER_PATTERN)) {
            errors.add("Room identifier must contain only lowercase letters, numbers, and hyphens");
        }

        return new ValidationResult(errors);
    }

    /**
     * Validate location.
     *
     * Rules:
     * - Optional (can be null)
     * - Maximum length: 100 characters
     */
    public static ValidationResult validateLocation(String location) {
        List<String> errors = new ArrayList<>();

        if (location != null && location.length() > MAX_LOCATION_LENGTH) {
            errors.add("Location cannot exceed " + MAX_LOCATION_LENGTH + " characters");
        }

        return new ValidationResult(errors);
    }

    /**
     * Validate description.
     *
     * Rules:
     * - Optional (can be null)
     * - Maximum length: 500 characters
     */
    public static ValidationResult validateDescription(String description) {
        List<String> errors = new ArrayList<>();

        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            errors.add("Description cannot exceed " + MAX_DESCRIPTION_LENGTH + " characters");
        }

        return new ValidationResult(errors);
    }

    /**
     * Validate all fields for room creation.
     *
     * Convenience method that validates all required and optional fields.
     */
    public static ValidationResult validateForCreate(String name, String location, String description) {
        List<String> allErrors = new ArrayList<>();

        ValidationResult nameResult = validateName(name);
        ValidationResult locationResult = validateLocation(location);
        ValidationResult descriptionResult = validateDescription(description);

        allErrors.addAll(nameResult.getErrors());
        allErrors.addAll(locationResult.getErrors());
        allErrors.addAll(descriptionResult.getErrors());

        return new ValidationResult(allErrors);
    }

    /**
     * Validate CreateRoomRequest for room creation.
     *
     * @param request The creation request
     * @return ValidationResult with any errors found
     */
    public static ValidationResult validateForCreate(CreateRoomRequest request) {
        if (request == null) {
            return new ValidationResult(List.of("Create room request cannot be null"));
        }

        return validateForCreate(request.getName(), request.getLocation(), request.getDescription());
    }

    /**
     * Validate UpdateRoomRequest for room update.
     * All fields are optional for updates.
     *
     * @param request The update request
     * @return ValidationResult with any errors found
     */
    public static ValidationResult validateForUpdate(UpdateRoomRequest request) {
        if (request == null) {
            return new ValidationResult(List.of("Update room request cannot be null"));
        }

        List<String> allErrors = new ArrayList<>();

        // Validate name if provided
        if (request.getName() != null) {
            ValidationResult nameResult = validateName(request.getName());
            allErrors.addAll(nameResult.getErrors());
        }

        // Validate location if provided
        if (request.getLocation() != null) {
            ValidationResult locationResult = validateLocation(request.getLocation());
            allErrors.addAll(locationResult.getErrors());
        }

        // Validate description if provided
        if (request.getDescription() != null) {
            ValidationResult descriptionResult = validateDescription(request.getDescription());
            allErrors.addAll(descriptionResult.getErrors());
        }

        return new ValidationResult(allErrors);
    }
}
