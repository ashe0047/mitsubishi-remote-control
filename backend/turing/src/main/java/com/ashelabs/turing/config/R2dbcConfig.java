package com.ashelabs.turing.config;

import com.ashelabs.turing.entity.AccessLevel;
import com.ashelabs.turing.entity.UserRole;
import com.ashelabs.turing.entity.UserStatus;
import io.r2dbc.postgresql.PostgresqlConnectionConfiguration;
import io.r2dbc.postgresql.PostgresqlConnectionFactory;
import io.r2dbc.postgresql.codec.EnumCodec;
import io.r2dbc.spi.ConnectionFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.r2dbc.config.AbstractR2dbcConfiguration;
import org.springframework.data.r2dbc.convert.R2dbcCustomConversions;
import org.springframework.data.r2dbc.dialect.PostgresDialect;
import org.springframework.lang.NonNull;

import java.util.ArrayList;
import java.util.List;

/**
 * R2DBC configuration for PostgreSQL with proper enum handling.
 * Uses EnumCodec for PostgreSQL enum types and custom converters for other
 * types.
 */
@Configuration
public class R2dbcConfig extends AbstractR2dbcConfiguration {

    @Value("${spring.r2dbc.url}")
    private String url;

    @Value("${spring.r2dbc.username}")
    private String username;

    @Value("${spring.r2dbc.password}")
    private String password;

    @Bean
    @Primary
    public ConnectionFactory connectionFactory() {
        // Extract connection details from URL
        String cleanUrl = url.replace("r2dbc:postgresql://", "");
        String[] parts = cleanUrl.split("/");
        String hostPort = parts[0];
        String database = parts[1];

        String[] hostPortParts = hostPort.split(":");
        String host = hostPortParts[0];
        int port = hostPortParts.length > 1 ? Integer.parseInt(hostPortParts[1]) : 5432;

        return new PostgresqlConnectionFactory(
                PostgresqlConnectionConfiguration.builder()
                        .host(host)
                        .port(port)
                        .database(database)
                        .username(username)
                        .password(password)
                        .codecRegistrar(EnumCodec.builder()
                                .withEnum("user_role", UserRole.class)
                                .withEnum("user_status", UserStatus.class)
                                .withEnum("access_level", AccessLevel.class)
                                .build())
                        .build());
    }

    @Override
    @Bean
    @NonNull
    public R2dbcCustomConversions r2dbcCustomConversions() {
        List<Converter<?, ?>> converters = new ArrayList<>();

        // EnumWriteSupport converters for proper enum handling with PostgreSQL
        converters.add(new UserRoleWriteConverter());
        converters.add(new UserStatusWriteConverter());
        
        return R2dbcCustomConversions.of(PostgresDialect.INSTANCE, converters);
    }

    // EnumWriteSupport converters - these work with the EnumCodec to properly write enum values
    @org.springframework.data.convert.WritingConverter
    public static class UserRoleWriteConverter extends org.springframework.data.r2dbc.convert.EnumWriteSupport<UserRole> {
    }

    @org.springframework.data.convert.WritingConverter
    public static class UserStatusWriteConverter extends org.springframework.data.r2dbc.convert.EnumWriteSupport<UserStatus> {
    }
}
