#!/bin/bash

set -e  # Exit script if any command fails

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print a decorative header
print_header() {
  echo -e "${BLUE}==================================================${NC}"
  echo -e "${BLUE}|${NC}     ${YELLOW}Mitsubishi Remote Control App Launcher${NC}     ${BLUE}|${NC}"
  echo -e "${BLUE}==================================================${NC}"
}

# Function to print a decorative footer
print_footer() {
  echo -e "${BLUE}----------------------------------------${NC}"
  echo -e "${GREEN}✓ Done!${NC}"
  echo -e "${BLUE}----------------------------------------${NC}"
}

# Ensure docker compose is installed
if ! command -v docker compose &> /dev/null; then
  echo -e "${RED}✗ Error: 'docker compose' not found. Install Docker or use 'docker-compose'.${NC}"
  exit 1
fi

# Clear the terminal if in an interactive shell
[ -t 1 ] && clear

# Display the header
print_header
echo ""

# Step 1: Stop any existing containers
echo -e "${YELLOW}🚧 Stopping any existing containers...${NC}"
if docker compose down; then
  echo -e "${GREEN}✓ Existing containers stopped${NC}"
else
  echo -e "${RED}✗ Warning: No running containers or failed to stop${NC}"
fi
echo ""

# Step 2: Build and start the container
echo -e "${YELLOW}🏗️  Building and starting the container...${NC}"
if docker compose up --build -d; then
  echo -e "${GREEN}✓ Container built and started successfully${NC}"
else
  echo -e "${RED}✗ Error: Failed to build or start container${NC}"
  exit 1
fi
echo ""

# Step 3: Display container status
echo -e "${YELLOW}📡 Checking container status...${NC}"
docker ps -a --format "table {{.Names}} | {{.Status}} | {{.Ports}}"
echo ""

# Step 4: Show access URL with a fun message
echo -e "${YELLOW}🌐 Mitsubishi Aircon Remote Control is ready!${NC}"
echo -e "${GREEN}   Access it at: ${BLUE}http://localhost:3000${NC}"

# Display the footer
print_footer
