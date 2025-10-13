package com.ashelabs.turing.validation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Holds validation result with error messages.
 *
 * Immutable after construction to ensure thread safety.
 */
public class ValidationResult {

    private final List<String> errors;

    /**
     * Create empty validation result (valid)
     */
    public ValidationResult() {
        this.errors = new ArrayList<>();
    }

    /**
     * Create validation result with errors
     */
    public ValidationResult(List<String> errors) {
        this.errors = new ArrayList<>(errors);
    }

    /**
     * Check if validation passed (no errors)
     */
    public boolean isValid() {
        return errors.isEmpty();
    }

    /**
     * Get all validation errors
     */
    public List<String> getErrors() {
        return Collections.unmodifiableList(errors);
    }

    /**
     * Add an error message
     */
    public void addError(String error) {
        errors.add(error);
    }

    /**
     * Get first error message (for simple error display)
     */
    public String getFirstError() {
        return errors.isEmpty() ? null : errors.get(0);
    }

    /**
     * Get all errors as single string (newline separated)
     */
    public String getAllErrorsAsString() {
        return String.join("\n", errors);
    }

    @Override
    public String toString() {
        return isValid() ? "Valid" : "Invalid: " + getAllErrorsAsString();
    }
}
