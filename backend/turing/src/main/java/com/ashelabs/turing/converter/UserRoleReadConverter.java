package com.ashelabs.turing.converter;

import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.lang.NonNull;

import com.ashelabs.turing.entity.UserRole;

@ReadingConverter
public class UserRoleReadConverter implements Converter<String, UserRole> {
    @Override
    public UserRole convert(@NonNull String source) {
        return UserRole.fromValue(source);
    }
}
