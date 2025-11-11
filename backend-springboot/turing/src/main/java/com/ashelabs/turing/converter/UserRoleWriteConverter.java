package com.ashelabs.turing.converter;

import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.WritingConverter;
import org.springframework.lang.NonNull;

import com.ashelabs.turing.entity.UserRole;

@WritingConverter
public class UserRoleWriteConverter implements Converter<UserRole, String> {

    @Override
    public String convert(@NonNull UserRole source) {
        return source.getValue();
    }

}
