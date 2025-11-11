package com.ashelabs.turing.util;

/**
 * Utility class for generating room identifiers (slugs) from room names.
 *
 * Room identifiers are used as stable business keys for room references.
 * They are lowercase, alphanumeric, hyphen-separated strings.
 *
 * Examples:
 * - "Living Room" -> "living-room"
 * - "Master Bedroom" -> "master-bedroom"
 * - "Home Office #1" -> "home-office-1"
 */
public class RoomIdentifierGenerator {

    private RoomIdentifierGenerator() {
        // Utility class - prevent instantiation
    }

    /**
     * Generate room identifier from room name.
     *
     * Conversion rules:
     * 1. Convert to lowercase
     * 2. Remove special characters (keep alphanumeric and spaces/hyphens)
     * 3. Trim whitespace
     * 4. Replace spaces with hyphens
     * 5. Remove duplicate hyphens
     *
     * @param name The room name to convert
     * @return The generated room identifier
     * @throws IllegalArgumentException if name is null or blank
     */
    public static String generateFromName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Room name cannot be null or empty");
        }

        return name.toLowerCase()
            .replaceAll("[^a-z0-9\\s-]", "")  // Remove special chars except spaces and hyphens
            .trim()                             // Remove leading/trailing whitespace
            .replaceAll("\\s+", "-")            // Replace spaces with hyphens
            .replaceAll("-+", "-")              // Remove duplicate hyphens
            .replaceAll("^-|-$", "");           // Remove leading/trailing hyphens
    }
}
