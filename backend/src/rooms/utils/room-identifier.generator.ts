/**
 * Utility class for generating room identifiers (slugs) from room names.
 * Matches Spring Boot RoomIdentifierGenerator exactly.
 *
 * Room identifiers are used as stable business keys for room references.
 * They are lowercase, alphanumeric, hyphen-separated strings.
 *
 * Examples:
 * - "Living Room" -> "living-room"
 * - "Master Bedroom" -> "master-bedroom"
 * - "Home Office #1" -> "home-office-1"
 */
export class RoomIdentifierGenerator {
  /**
   * Generate room identifier from room name.
   *
   * Conversion rules (matches Spring Boot exactly):
   * 1. Convert to lowercase
   * 2. Remove special characters (keep alphanumeric and spaces/hyphens)
   * 3. Trim whitespace
   * 4. Replace spaces with hyphens
   * 5. Remove duplicate hyphens
   *
   * @param name The room name to convert
   * @return The generated room identifier
   * @throws Error if name is null or empty
   */
  static generateFromName(name: string): string {
    if (!name || name.trim().length === 0) {
      throw new Error('Room name cannot be null or empty');
    }

    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
      .trim() // Remove leading/trailing whitespace
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove duplicate hyphens
      .replace(/^-|-$|/g, ''); // Remove leading/trailing hyphens
  }
}
