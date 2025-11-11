import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1762802270561 implements MigrationInterface {
    name = 'InitialMigration1762802270561'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "public"."family_invitations_role_enum" AS ENUM(
                'ADMIN',
                'PARENT',
                'ADULT',
                'TEEN',
                'CHILD',
                'GUEST'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."family_invitations_status_enum" AS ENUM(
                'PENDING',
                'ACCEPTED',
                'DECLINED',
                'EXPIRED',
                'CANCELLED'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "family_invitations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "household_id" uuid NOT NULL,
                "invited_by_user_id" uuid NOT NULL,
                "email" character varying(255) NOT NULL,
                "name" character varying(255),
                "role" "public"."family_invitations_role_enum" NOT NULL DEFAULT 'CHILD',
                "token" character varying(255) NOT NULL,
                "status" "public"."family_invitations_status_enum" NOT NULL DEFAULT 'PENDING',
                "message" text,
                "sent_at" TIMESTAMP,
                "expires_at" TIMESTAMP NOT NULL,
                "accepted_at" TIMESTAMP,
                "declined_at" TIMESTAMP,
                "accepted_user_id" uuid,
                "resend_count" integer NOT NULL DEFAULT '0',
                CONSTRAINT "UQ_19c0d6d51ae7a3a96f0a80c2963" UNIQUE ("token"),
                CONSTRAINT "PK_194a34606a15ead627d3d943353" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_family_invitations_expires_at" ON "family_invitations" ("expires_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_family_invitations_invited_by" ON "family_invitations" ("invited_by_user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_family_invitations_status" ON "family_invitations" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_family_invitations_token" ON "family_invitations" ("token")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_family_invitations_email" ON "family_invitations" ("email")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_family_invitations_household_id" ON "family_invitations" ("household_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_163a7bd561796aab4a99ad30a3" ON "family_invitations" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_f1628f48b14e306a7f13593bfb" ON "family_invitations" ("invited_by_user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_14f1fa4ba2b290460727f6d514" ON "family_invitations" ("household_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_9d17d2e152cb205b6c49a7e38a" ON "family_invitations" ("expires_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_bccd8e52ef6c77bf45aa0223fd" ON "family_invitations" ("email")
        `);
        await queryRunner.query(`
            CREATE TABLE "device_status_history" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "device_id" uuid NOT NULL,
                "usage_session_id" uuid,
                "power_state" boolean,
                "current_temperature" numeric(4, 1),
                "target_temperature" numeric(4, 1),
                "operation_mode" character varying(50),
                "fan_speed_setting" character varying(50),
                "status_code" character varying(50),
                "error_code" character varying(50),
                "energy_consumption" numeric(10, 4),
                CONSTRAINT "PK_f4c1c12f22bc0847e159df048be" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_session_timeline" ON "device_status_history" ("usage_session_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_mode_composite" ON "device_status_history" ("device_id", "operation_mode")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_power_composite" ON "device_status_history" ("device_id", "power_state")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_composite" ON "device_status_history" ("device_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_current_temperature" ON "device_status_history" ("current_temperature")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_error_code" ON "device_status_history" ("error_code")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_status_code" ON "device_status_history" ("status_code")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_operation_mode" ON "device_status_history" ("operation_mode")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_power_state" ON "device_status_history" ("power_state")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_usage_session_id" ON "device_status_history" ("usage_session_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_created_at" ON "device_status_history" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_device_status_history_device_id" ON "device_status_history" ("device_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_9b92cb6cad0ebe28403436fc0b" ON "device_status_history" ("usage_session_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_1707b2a9248194b83c60860dc5" ON "device_status_history" ("device_id", "operation_mode")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_edfc944f92b5e258df022ec766" ON "device_status_history" ("device_id", "power_state")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_17c64cbf9d5e81a4bc695628f5" ON "device_status_history" ("device_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_b3fefeafbc600cc69f2e5d2a08" ON "device_status_history" ("current_temperature")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_757db9b67d2ec8fce0a4d835fb" ON "device_status_history" ("error_code")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3f77c91f44625bc4d7bb1c330f" ON "device_status_history" ("status_code")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_298bbf4d5f23afbaf6a0ec07c8" ON "device_status_history" ("operation_mode")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3cabac42e48fc02efab378669c" ON "device_status_history" ("power_state")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_1fa8918c31b54e8633e426ed65" ON "device_status_history" ("usage_session_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_2cdc45caa06253177d12a908a6" ON "device_status_history" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_acfee515d08def526baa0752af" ON "device_status_history" ("device_id")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."access_control_target_type_enum" AS ENUM('ROOM', 'DEVICE')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."access_control_access_level_enum" AS ENUM(
                'FULL',
                'LIMITED',
                'VIEW_ONLY',
                'SCHEDULED',
                'EMERGENCY_ONLY',
                'MAINTENANCE',
                'NONE'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "access_control" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" uuid NOT NULL,
                "target_type" "public"."access_control_target_type_enum" NOT NULL,
                "target_id" uuid NOT NULL,
                "access_level" "public"."access_control_access_level_enum" NOT NULL DEFAULT 'LIMITED',
                "allowed_actions" jsonb,
                "restricted_actions" jsonb,
                "valid_from" TIMESTAMP WITH TIME ZONE,
                "valid_until" TIMESTAMP WITH TIME ZONE,
                "access_schedule" jsonb,
                "constraints" jsonb,
                "assignment_reason" character varying(255),
                "created_by" uuid,
                "modified_by" uuid,
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "deleted_by" uuid,
                "is_archived" boolean NOT NULL DEFAULT false,
                CONSTRAINT "UQ_3b922be3abd5ce2f3a0dc46c620" UNIQUE ("user_id", "target_type", "target_id"),
                CONSTRAINT "PK_b9de1f7fe64190ed206929a6d24" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_access_control_composite" ON "access_control" (
                "user_id",
                "target_type",
                "target_id",
                "access_level"
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_access_control_validity" ON "access_control" ("valid_from", "valid_until")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_access_control_access_level" ON "access_control" ("access_level")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_access_control_target" ON "access_control" ("target_type", "target_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_access_control_user_id" ON "access_control" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_e46f2ae65c2d5e0eadf7bf0977" ON "access_control" ("valid_from", "valid_until")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_5d32100fa3db18e7074df566bc" ON "access_control" ("access_level")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_1894eacd084ea6f8452f000d50" ON "access_control" ("target_type", "target_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_73e79f53c7af7895978c38c071" ON "access_control" ("user_id", "target_type")
        `);
        await queryRunner.query(`
            CREATE TABLE "devices" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "room_id" uuid,
                "device_type" character varying(50) NOT NULL,
                "device_identifier" character varying(255) NOT NULL,
                "manufacturer" character varying(100),
                "model" character varying(100),
                "enabled" boolean NOT NULL DEFAULT true,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "name" character varying(255) NOT NULL,
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "deleted_by" uuid,
                "is_archived" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_devices_enabled" ON "devices" ("enabled")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_devices_device_identifier" ON "devices" ("device_identifier")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_devices_device_type" ON "devices" ("device_type")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_devices_room_id" ON "devices" ("room_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_e79f50ba0a253a04bbf372184b" ON "devices" ("enabled")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_d45ca22d3b2100d05de5da3ce0" ON "devices" ("device_type")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_b1514758245c12daf43486dd1f" ON "devices" ("id")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_5db5c412241ce6416242b221ff" ON "devices" ("room_id", "device_type", "device_identifier")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quota_overrides_type_enum" AS ENUM('ADD_TIME', 'UNLOCK_DAY', 'EMERGENCY_OVERRIDE')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quota_overrides_status_enum" AS ENUM(
                'PENDING',
                'APPROVED',
                'REJECTED',
                'EXPIRED',
                'CANCELLED'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "quota_overrides" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "quota_id" uuid NOT NULL,
                "requested_by_user_id" uuid NOT NULL,
                "approved_by_user_id" uuid,
                "type" "public"."quota_overrides_type_enum" NOT NULL,
                "parameters" json NOT NULL,
                "reason" text NOT NULL,
                "status" "public"."quota_overrides_status_enum" NOT NULL DEFAULT 'PENDING',
                "requested_at" TIMESTAMP NOT NULL,
                "approved_at" TIMESTAMP,
                "expires_at" TIMESTAMP,
                "activated_at" TIMESTAMP,
                "is_active" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_4b4b10160a4788e6584ee76ab11" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_c0f28e7b9a4b3f22f05ce4efee" ON "quota_overrides" ("expires_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_004610136f5d02703a41c28fd8" ON "quota_overrides" ("type", "is_active")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_db7a3039dde18981d2a261f5a7" ON "quota_overrides" ("requested_by_user_id", "status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_5f3f064f5f687d64e06913cb64" ON "quota_overrides" ("quota_id", "status")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quotas_quota_type_enum" AS ENUM(
                'TIME_BASED',
                'USAGE_COUNT',
                'ENERGY_BASED',
                'COST_BASED'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quotas_scope_enum" AS ENUM('GLOBAL', 'ROOM', 'DEVICE')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quotas_period_enum" AS ENUM('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quotas_enforcement_action_enum" AS ENUM('WARN', 'RESTRICT', 'BLOCK')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quotas_status_enum" AS ENUM('ACTIVE', 'PAUSED', 'EXCEEDED', 'EXPIRED')
        `);
        await queryRunner.query(`
            CREATE TABLE "quotas" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "description" text,
                "quota_type" "public"."quotas_quota_type_enum" NOT NULL DEFAULT 'TIME_BASED',
                "scope" "public"."quotas_scope_enum" NOT NULL DEFAULT 'ROOM',
                "target_id" uuid,
                "allowed_amount" numeric(10, 2) NOT NULL,
                "used_amount" numeric(10, 2) NOT NULL DEFAULT '0',
                "period" "public"."quotas_period_enum" NOT NULL DEFAULT 'DAILY',
                "period_start" TIMESTAMP WITH TIME ZONE,
                "period_duration" interval,
                "reset_time" TIME NOT NULL DEFAULT '00:00:00',
                "enforcement_action" "public"."quotas_enforcement_action_enum" NOT NULL DEFAULT 'BLOCK',
                "status" "public"."quotas_status_enum" NOT NULL DEFAULT 'ACTIVE',
                "priority" integer NOT NULL DEFAULT '1',
                "allow_rollover" boolean NOT NULL DEFAULT false,
                "max_rollover_amount" numeric(10, 2),
                "warning_thresholds" jsonb NOT NULL,
                "notification_methods" jsonb NOT NULL,
                "grace_period_minutes" integer NOT NULL DEFAULT '0',
                "max_grace_uses" integer NOT NULL DEFAULT '1',
                "grace_cooldown_hours" integer NOT NULL DEFAULT '24',
                "allow_sharing" boolean NOT NULL DEFAULT false,
                "allow_borrowing" boolean NOT NULL DEFAULT false,
                "sharing_pool_id" uuid,
                "last_reset_at" TIMESTAMP WITH TIME ZONE,
                "created_by" uuid,
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "deleted_by" uuid,
                "is_archived" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_5f54877798333ca833245a100d1" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quotas_last_reset" ON "quotas" ("last_reset_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quotas_period" ON "quotas" ("period")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quotas_type_scope" ON "quotas" ("quota_type", "scope")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quotas_status" ON "quotas" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quotas_target_id" ON "quotas" ("target_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quotas_user_id" ON "quotas" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_57cdceedf3b2c0208ef5e8f9aa" ON "quotas" ("last_reset_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_c66699db85efbc916decb2ab8f" ON "quotas" ("period")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_2eb9d028d0b79ea5b11bdb3c54" ON "quotas" ("quota_type", "scope")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_28ea71d2079ef4e542b85effed" ON "quotas" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_7dba5ad3ff3bfd294cdd3ea8cd" ON "quotas" ("target_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_132aa9525c82c5f1c6cae0976c" ON "quotas" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quota_violations_violation_type_enum" AS ENUM(
                'TIME_EXCEEDED',
                'USAGE_EXCEEDED',
                'ENERGY_EXCEEDED',
                'COST_EXCEEDED',
                'SCHEDULE_VIOLATION',
                'ACCESS_VIOLATION'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."quota_violations_enforcement_action_enum" AS ENUM('WARN', 'RESTRICT', 'BLOCK')
        `);
        await queryRunner.query(`
            CREATE TABLE "quota_violations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" uuid NOT NULL,
                "quota_id" uuid NOT NULL,
                "room_id" character varying NOT NULL,
                "usage_session_id" uuid,
                "violation_type" "public"."quota_violations_violation_type_enum" NOT NULL,
                "violation_amount" numeric(10, 2) NOT NULL,
                "quota_limit" numeric(10, 2) NOT NULL,
                "enforcement_action" "public"."quota_violations_enforcement_action_enum" NOT NULL,
                "override_granted" boolean NOT NULL DEFAULT false,
                "override_by" uuid,
                "override_reason" text,
                "message" text,
                "metadata" jsonb,
                "override_duration_minutes" integer,
                "resolved" boolean NOT NULL DEFAULT false,
                "resolved_at" TIMESTAMP,
                "resolved_by" uuid,
                "resolution_notes" text,
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "deleted_by" uuid,
                "is_archived" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_b7f8ca2ab2bbdb64d67bf57601f" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quota_violations_composite" ON "quota_violations" ("user_id", "quota_id", "usage_session_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quota_violations_usage_session_id" ON "quota_violations" ("usage_session_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quota_violations_resolved" ON "quota_violations" ("resolved")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quota_violations_violation_type" ON "quota_violations" ("violation_type")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quota_violations_created_at" ON "quota_violations" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quota_violations_quota_id" ON "quota_violations" ("quota_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_quota_violations_user_id" ON "quota_violations" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_d94d55db946ee2cffc4314f365" ON "quota_violations" ("usage_session_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_f9856429e6cc960c459b6ef30e" ON "quota_violations" ("violation_type")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_e37f1a14ecf62599a26193c316" ON "quota_violations" ("resolved")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_58419ecdebc88f04407646cf5b" ON "quota_violations" ("room_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_dbdf36d3f5b1365fe50ae02771" ON "quota_violations" ("quota_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_798320307928398013a8b4b3e8" ON "quota_violations" ("user_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."usage_sessions_status_enum" AS ENUM('ACTIVE', 'COMPLETED', 'INTERRUPTED', 'OVERRIDE')
        `);
        await queryRunner.query(`
            CREATE TABLE "usage_sessions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "user_id" uuid NOT NULL,
                "room_id" uuid,
                "device_type" character varying NOT NULL DEFAULT 'ac',
                "device_id" uuid,
                "quota_id" uuid,
                "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "ended_at" TIMESTAMP WITH TIME ZONE,
                "duration_minutes" integer,
                "status" "public"."usage_sessions_status_enum" NOT NULL DEFAULT 'ACTIVE',
                "initial_settings" jsonb,
                "final_settings" jsonb,
                "temperature_set" numeric(4, 1),
                "mode" character varying(50),
                "fan_speed" character varying(50),
                "energy_consumed" numeric(10, 4) NOT NULL DEFAULT '0',
                "estimated_cost" numeric(10, 2) NOT NULL DEFAULT '0',
                "efficiency_rating" numeric(3, 2),
                "outdoor_temperature" numeric(4, 1),
                "weather_conditions" character varying(100),
                "quota_violations" jsonb,
                "override_reason" character varying(255),
                "override_by" uuid,
                "metadata" jsonb,
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "deleted_by" uuid,
                "is_archived" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_42692592ebe042eacacc1647dc7" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_device_tracking" ON "usage_sessions" ("user_id", "device_id", "started_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_quota_validation" ON "usage_sessions" ("user_id", "room_id", "started_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_date_range" ON "usage_sessions" ("started_at", "ended_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_status" ON "usage_sessions" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_ended_at" ON "usage_sessions" ("ended_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_started_at" ON "usage_sessions" ("started_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_device_id" ON "usage_sessions" ("device_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_room_id" ON "usage_sessions" ("room_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_usage_sessions_user_id" ON "usage_sessions" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_72b11eefdd8bc4894c667a3002" ON "usage_sessions" ("ended_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_67805e550efbfd0f41a7ca2d88" ON "usage_sessions" ("started_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_a555dad4ebae0e8eb19ee1f88a" ON "usage_sessions" ("device_type", "status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_bc078093337a8313ba922452c2" ON "usage_sessions" ("user_id", "room_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "rooms" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "household_id" uuid NOT NULL,
                "name" character varying(100) NOT NULL,
                "room_identifier" character varying(100) NOT NULL,
                "location" character varying(100),
                "description" character varying(500),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "deleted_by" uuid,
                "is_archived" boolean NOT NULL DEFAULT false,
                CONSTRAINT "UQ_ffd70bb6d9ea1ba3ecf65fc22b2" UNIQUE ("household_id", "name"),
                CONSTRAINT "UQ_77870f2d563e99e418b15109317" UNIQUE ("household_id", "room_identifier"),
                CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_rooms_room_identifier" ON "rooms" ("room_identifier")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_rooms_household_id" ON "rooms" ("household_id")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."households_subscription_plan_enum" AS ENUM('basic', 'premium', 'enterprise')
        `);
        await queryRunner.query(`
            CREATE TABLE "households" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "name" character varying(255) NOT NULL,
                "subscription_plan" "public"."households_subscription_plan_enum" DEFAULT 'basic',
                "billing_email" character varying(255),
                "address" jsonb,
                "timezone" character varying(100) DEFAULT 'UTC',
                "organization_id" uuid,
                "settings" jsonb,
                "created_by" uuid,
                CONSTRAINT "PK_2b1aef2640717132e9231aac756" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_households_created_at" ON "households" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_households_subscription_plan" ON "households" ("subscription_plan")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_households_organization" ON "households" ("organization_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "household_id" uuid NOT NULL,
                "email" character varying(255) NOT NULL,
                "password_hash" character varying(255) NOT NULL,
                "name" character varying(255) NOT NULL,
                "role" character varying(32) NOT NULL DEFAULT 'CHILD',
                "status" character varying(32) NOT NULL DEFAULT 'ACTIVE',
                "date_of_birth" date,
                "avatar_url" character varying(500),
                "phone" character varying(50),
                "preferences" jsonb,
                "emergency_contacts" jsonb,
                "employee_id" character varying(100),
                "department" character varying(100),
                "cost_center" character varying(100),
                "last_login_at" TIMESTAMP WITH TIME ZONE,
                "created_by" uuid,
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                "deleted_by" uuid,
                "is_archived" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_users_last_login" ON "users" ("last_login_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_users_created_at" ON "users" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_users_status" ON "users" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_users_role" ON "users" ("role")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_users_email" ON "users" ("email")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_users_household_id" ON "users" ("household_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "family_invitations"
            ADD CONSTRAINT "FK_14f1fa4ba2b290460727f6d5141" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "family_invitations"
            ADD CONSTRAINT "FK_f1628f48b14e306a7f13593bfb6" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "family_invitations"
            ADD CONSTRAINT "FK_e976dfdd4eb7b29c1ded9d6ad81" FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "device_status_history"
            ADD CONSTRAINT "FK_acfee515d08def526baa0752af9" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "device_status_history"
            ADD CONSTRAINT "FK_1fa8918c31b54e8633e426ed65b" FOREIGN KEY ("usage_session_id") REFERENCES "usage_sessions"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "access_control"
            ADD CONSTRAINT "FK_656b5f9c9aa839d4cddee9c9042" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "access_control"
            ADD CONSTRAINT "FK_c24a186fab3be49c7e75da3a92c" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "access_control"
            ADD CONSTRAINT "FK_2e936cf23122c20fb2ca10094e8" FOREIGN KEY ("modified_by") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "devices"
            ADD CONSTRAINT "FK_adb4e2357f011b8ba0adf1c3e7b" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_overrides"
            ADD CONSTRAINT "FK_d9b1bbec1d227c7672da495f5b6" FOREIGN KEY ("quota_id") REFERENCES "quotas"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_overrides"
            ADD CONSTRAINT "FK_d8099be81d33eafc50a7e4c2779" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_overrides"
            ADD CONSTRAINT "FK_13566d6d7ba35d7963f41c190a6" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quotas"
            ADD CONSTRAINT "FK_132aa9525c82c5f1c6cae0976c8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quotas"
            ADD CONSTRAINT "FK_cb529d96a36fe783e12cc72fdca" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quotas"
            ADD CONSTRAINT "FK_7dba5ad3ff3bfd294cdd3ea8cdf" FOREIGN KEY ("target_id") REFERENCES "rooms"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations"
            ADD CONSTRAINT "FK_dfc508994ba503b9841ebe41151" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations"
            ADD CONSTRAINT "FK_dbdf36d3f5b1365fe50ae027712" FOREIGN KEY ("quota_id") REFERENCES "quotas"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations"
            ADD CONSTRAINT "FK_d94d55db946ee2cffc4314f365b" FOREIGN KEY ("usage_session_id") REFERENCES "usage_sessions"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations"
            ADD CONSTRAINT "FK_553b37ad8c70cabdd21195f47da" FOREIGN KEY ("override_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations"
            ADD CONSTRAINT "FK_096c25db50c47a86ecb39008ea2" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "usage_sessions"
            ADD CONSTRAINT "FK_a78f2103f8769e883cc883d015d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "usage_sessions"
            ADD CONSTRAINT "FK_507083438b73eaab00b4b271dda" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "usage_sessions"
            ADD CONSTRAINT "FK_b9f4d72b84709bfcf32f340cfae" FOREIGN KEY ("override_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "usage_sessions"
            ADD CONSTRAINT "FK_410bda43be6f09a86f494aa130d" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms"
            ADD CONSTRAINT "FK_4913caf18810cfbf088f2df5f51" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_a5a4e0571994849d6d4b8681089" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_a5a4e0571994849d6d4b8681089"
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms" DROP CONSTRAINT "FK_4913caf18810cfbf088f2df5f51"
        `);
        await queryRunner.query(`
            ALTER TABLE "usage_sessions" DROP CONSTRAINT "FK_410bda43be6f09a86f494aa130d"
        `);
        await queryRunner.query(`
            ALTER TABLE "usage_sessions" DROP CONSTRAINT "FK_b9f4d72b84709bfcf32f340cfae"
        `);
        await queryRunner.query(`
            ALTER TABLE "usage_sessions" DROP CONSTRAINT "FK_507083438b73eaab00b4b271dda"
        `);
        await queryRunner.query(`
            ALTER TABLE "usage_sessions" DROP CONSTRAINT "FK_a78f2103f8769e883cc883d015d"
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations" DROP CONSTRAINT "FK_096c25db50c47a86ecb39008ea2"
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations" DROP CONSTRAINT "FK_553b37ad8c70cabdd21195f47da"
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations" DROP CONSTRAINT "FK_d94d55db946ee2cffc4314f365b"
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations" DROP CONSTRAINT "FK_dbdf36d3f5b1365fe50ae027712"
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_violations" DROP CONSTRAINT "FK_dfc508994ba503b9841ebe41151"
        `);
        await queryRunner.query(`
            ALTER TABLE "quotas" DROP CONSTRAINT "FK_7dba5ad3ff3bfd294cdd3ea8cdf"
        `);
        await queryRunner.query(`
            ALTER TABLE "quotas" DROP CONSTRAINT "FK_cb529d96a36fe783e12cc72fdca"
        `);
        await queryRunner.query(`
            ALTER TABLE "quotas" DROP CONSTRAINT "FK_132aa9525c82c5f1c6cae0976c8"
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_overrides" DROP CONSTRAINT "FK_13566d6d7ba35d7963f41c190a6"
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_overrides" DROP CONSTRAINT "FK_d8099be81d33eafc50a7e4c2779"
        `);
        await queryRunner.query(`
            ALTER TABLE "quota_overrides" DROP CONSTRAINT "FK_d9b1bbec1d227c7672da495f5b6"
        `);
        await queryRunner.query(`
            ALTER TABLE "devices" DROP CONSTRAINT "FK_adb4e2357f011b8ba0adf1c3e7b"
        `);
        await queryRunner.query(`
            ALTER TABLE "access_control" DROP CONSTRAINT "FK_2e936cf23122c20fb2ca10094e8"
        `);
        await queryRunner.query(`
            ALTER TABLE "access_control" DROP CONSTRAINT "FK_c24a186fab3be49c7e75da3a92c"
        `);
        await queryRunner.query(`
            ALTER TABLE "access_control" DROP CONSTRAINT "FK_656b5f9c9aa839d4cddee9c9042"
        `);
        await queryRunner.query(`
            ALTER TABLE "device_status_history" DROP CONSTRAINT "FK_1fa8918c31b54e8633e426ed65b"
        `);
        await queryRunner.query(`
            ALTER TABLE "device_status_history" DROP CONSTRAINT "FK_acfee515d08def526baa0752af9"
        `);
        await queryRunner.query(`
            ALTER TABLE "family_invitations" DROP CONSTRAINT "FK_e976dfdd4eb7b29c1ded9d6ad81"
        `);
        await queryRunner.query(`
            ALTER TABLE "family_invitations" DROP CONSTRAINT "FK_f1628f48b14e306a7f13593bfb6"
        `);
        await queryRunner.query(`
            ALTER TABLE "family_invitations" DROP CONSTRAINT "FK_14f1fa4ba2b290460727f6d5141"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_users_household_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_users_email"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_users_role"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_users_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_users_created_at"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_users_last_login"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"
        `);
        await queryRunner.query(`
            DROP TABLE "users"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_households_organization"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_households_subscription_plan"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_households_created_at"
        `);
        await queryRunner.query(`
            DROP TABLE "households"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."households_subscription_plan_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_rooms_household_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_rooms_room_identifier"
        `);
        await queryRunner.query(`
            DROP TABLE "rooms"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_bc078093337a8313ba922452c2"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_a555dad4ebae0e8eb19ee1f88a"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_67805e550efbfd0f41a7ca2d88"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_72b11eefdd8bc4894c667a3002"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_user_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_room_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_device_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_started_at"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_ended_at"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_date_range"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_quota_validation"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_usage_sessions_device_tracking"
        `);
        await queryRunner.query(`
            DROP TABLE "usage_sessions"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."usage_sessions_status_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_798320307928398013a8b4b3e8"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_dbdf36d3f5b1365fe50ae02771"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_58419ecdebc88f04407646cf5b"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_e37f1a14ecf62599a26193c316"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_f9856429e6cc960c459b6ef30e"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_d94d55db946ee2cffc4314f365"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quota_violations_user_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quota_violations_quota_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quota_violations_created_at"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quota_violations_violation_type"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quota_violations_resolved"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quota_violations_usage_session_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quota_violations_composite"
        `);
        await queryRunner.query(`
            DROP TABLE "quota_violations"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quota_violations_enforcement_action_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quota_violations_violation_type_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_132aa9525c82c5f1c6cae0976c"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_7dba5ad3ff3bfd294cdd3ea8cd"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_28ea71d2079ef4e542b85effed"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_2eb9d028d0b79ea5b11bdb3c54"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_c66699db85efbc916decb2ab8f"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_57cdceedf3b2c0208ef5e8f9aa"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quotas_user_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quotas_target_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quotas_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quotas_type_scope"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quotas_period"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_quotas_last_reset"
        `);
        await queryRunner.query(`
            DROP TABLE "quotas"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quotas_status_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quotas_enforcement_action_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quotas_period_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quotas_scope_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quotas_quota_type_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_5f3f064f5f687d64e06913cb64"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_db7a3039dde18981d2a261f5a7"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_004610136f5d02703a41c28fd8"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_c0f28e7b9a4b3f22f05ce4efee"
        `);
        await queryRunner.query(`
            DROP TABLE "quota_overrides"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quota_overrides_status_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."quota_overrides_type_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_5db5c412241ce6416242b221ff"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_b1514758245c12daf43486dd1f"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_d45ca22d3b2100d05de5da3ce0"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_e79f50ba0a253a04bbf372184b"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_devices_room_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_devices_device_type"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_devices_device_identifier"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_devices_enabled"
        `);
        await queryRunner.query(`
            DROP TABLE "devices"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_73e79f53c7af7895978c38c071"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_1894eacd084ea6f8452f000d50"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_5d32100fa3db18e7074df566bc"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_e46f2ae65c2d5e0eadf7bf0977"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_access_control_user_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_access_control_target"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_access_control_access_level"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_access_control_validity"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_access_control_composite"
        `);
        await queryRunner.query(`
            DROP TABLE "access_control"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."access_control_access_level_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."access_control_target_type_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_acfee515d08def526baa0752af"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_2cdc45caa06253177d12a908a6"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_1fa8918c31b54e8633e426ed65"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_3cabac42e48fc02efab378669c"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_298bbf4d5f23afbaf6a0ec07c8"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_3f77c91f44625bc4d7bb1c330f"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_757db9b67d2ec8fce0a4d835fb"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_b3fefeafbc600cc69f2e5d2a08"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_17c64cbf9d5e81a4bc695628f5"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_edfc944f92b5e258df022ec766"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_1707b2a9248194b83c60860dc5"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_9b92cb6cad0ebe28403436fc0b"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_device_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_created_at"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_usage_session_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_power_state"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_operation_mode"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_status_code"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_error_code"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_current_temperature"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_composite"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_power_composite"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_mode_composite"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_device_status_history_session_timeline"
        `);
        await queryRunner.query(`
            DROP TABLE "device_status_history"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_bccd8e52ef6c77bf45aa0223fd"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_9d17d2e152cb205b6c49a7e38a"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_14f1fa4ba2b290460727f6d514"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_f1628f48b14e306a7f13593bfb"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_163a7bd561796aab4a99ad30a3"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_family_invitations_household_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_family_invitations_email"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_family_invitations_token"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_family_invitations_status"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_family_invitations_invited_by"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_family_invitations_expires_at"
        `);
        await queryRunner.query(`
            DROP TABLE "family_invitations"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."family_invitations_status_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."family_invitations_role_enum"
        `);
    }

}
