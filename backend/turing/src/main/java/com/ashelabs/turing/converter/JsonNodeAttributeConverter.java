package com.ashelabs.turing.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;
import org.springframework.stereotype.Component;

/**
 * Custom converter for JsonNode to handle JSONB fields in PostgreSQL
 * Converts between JsonNode objects and String representations for database storage
 */
@Component
public class JsonNodeAttributeConverter {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Writing converter: JsonNode -> String (for database storage)
     */
    @WritingConverter
    public static class JsonNodeWritingConverter implements Converter<JsonNode, String> {
        @Override
        public String convert(JsonNode source) {
            if (source == null) {
                return null;
            }
            try {
                return objectMapper.writeValueAsString(source);
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Failed to convert JsonNode to String", e);
            }
        }
    }

    /**
     * Reading converter: String -> JsonNode (from database)
     */
    @ReadingConverter
    public static class JsonNodeReadingConverter implements Converter<String, JsonNode> {
        @Override
        public JsonNode convert(String source) {
            if (source == null || source.trim().isEmpty()) {
                return null;
            }
            try {
                return objectMapper.readTree(source);
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Failed to convert String to JsonNode", e);
            }
        }
    }
}
