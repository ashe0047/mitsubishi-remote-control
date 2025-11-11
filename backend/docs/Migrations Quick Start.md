# TypeORM Migrations

This directory contains TypeORM migration files for managing database schema changes.

## Usage

### Generate a new migration based on entity changes:

```bash
# Generate migration with specific name
pnpm db:migrate:generate -- src/migrations/YourMigrationName

# Example: Create initial tables
pnpm db:migrate:generate -- src/migrations/CreateInitialTables
```

### Run pending migrations:

```bash
pnpm db:migrate
```

### Create a blank migration file:

```bash
pnpm db:migrate:create -- src/migrations/CustomMigrationName
```

### Revert the last migration:

```bash
pnpm db:migrate:revert
```

### Show migration status:

```bash
pnpm db:migrate:show
```

## Migration File Structure

Each migration file should export a class implementing `MigrationInterface`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class YourMigrationName1234567890 implements MigrationInterface {
  name = 'YourMigrationName1234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Write your migration code here
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          // ... more columns
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Write your rollback code here
    await queryRunner.dropTable('users');
  }
}
```

## Best Practices

1. **Descriptive Names**: Use clear, descriptive names that explain what the migration does
2. **Atomic Changes**: Each migration should represent a single logical change
3. **Reversible**: Always implement the `down` method for rollback capability
4. **Test Migrations**: Test migrations on development data before running in production
5. **Backup**: Always backup production databases before running migrations

## Environment Configuration

Migrations use the configuration from `src/database/data-source.ts`, which reads environment variables:

- `database.host` - Database host (default: localhost)
- `database.port` - Database port (default: 5432)
- `database.username` - Database username
- `database.password` - Database password
- `database.name` - Database name
- `NODE_ENV` - Environment (development/production)
