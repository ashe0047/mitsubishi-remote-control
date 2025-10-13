# Specification Documents

This directory contains spec-driven development documents for all features and tasks.

## Directory Structure

Each feature/task should have its own subdirectory following this pattern:

```
[feature-name]/
├── spec.md           # Requirements specification
├── design.md         # Technical design document
└── implementation.md # Implementation plan
```

## Development Process

1. **Create Feature Folder**: `mkdir docs/specs/[feature-name]`
2. **Generate spec.md**: Define requirements and acceptance criteria
3. **Generate design.md**: Create technical design based on spec (MUST use sequential thinking tool)
4. **Generate implementation.md**: Create implementation plan based on design
5. **Begin Development**: Follow implementation plan using Context7 and feedback tools

## Document Templates

Refer to the main CLAUDE.md file for detailed content standards for each document type.

## Example Workflow

For a feature called "temperature-scheduling":

```bash
# 1. Create feature directory
mkdir docs/specs/temperature-scheduling

# 2. Generate spec.md (requirements)
# Write business requirements, user stories, acceptance criteria

# 3. Generate design.md (MUST use sequential thinking tool)
# Use mcp__sequential-thinking__sequentialthinking for architecture planning
# Assess current architecture and recommend refactoring if needed

# 4. Generate implementation.md (execution plan)
# Include Context7 queries needed for latest docs
# Define feedback checkpoints

# 5. During Implementation:
# - Use mcp__context7__resolve-library-id for packages
# - Use mcp__context7__get-library-docs for latest documentation  
# - Use mcp__mcp-feedback-enhanced__interactive_feedback after each step
# - Wait for approval before proceeding to next step
```

## Required Tools by Phase

- **Design Phase**: `mcp__sequential-thinking__sequentialthinking` (mandatory)
- **Implementation Phase**: `mcp__context7__*` tools for latest docs (mandatory)
- **After Each Implementation Step**: `mcp__mcp-feedback-enhanced__interactive_feedback` (mandatory)