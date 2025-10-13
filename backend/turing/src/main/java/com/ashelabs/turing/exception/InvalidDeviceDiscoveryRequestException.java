package com.ashelabs.turing.exception;

/**
 * Exception raised when a discovery registration request is missing required information.
 */
public class InvalidDeviceDiscoveryRequestException extends RuntimeException {

    public InvalidDeviceDiscoveryRequestException(String message) {
        super(message);
    }
}
