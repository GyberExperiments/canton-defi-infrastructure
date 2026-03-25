#!/bin/bash

# Canton Validator Node Setup Script for DevNet
# Version: 1.0
# Author: Gyber
# Date: $(date +%Y-%m-%d)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CANTON_VERSION="0.5.8"
CANTON_HOME="$HOME/.canton/$CANTON_VERSION"
PROJECT_ROOT="/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc"
BLOCKCHAIN_DIR="$PROJECT_ROOT/blockchain"
DEVNET_DIR="$BLOCKCHAIN_DIR/devnet"

# API endpoints
DEVNET_API="https://sv.sv-1.dev.global.canton.network.sync.global"
ONBOARD_API="$DEVNET_API/api/sv/v0/devnet/onboard/validator/prepare"

echo -e "${BLUE}🚀 Canton Validator Node Setup for DevNet${NC}"
echo -e "${BLUE}==========================================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please adapt for your OS."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker Desktop for macOS."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

print_status "Docker is installed and running"

# Create Canton home directory
print_info "Creating Canton home directory: $CANTON_HOME"
mkdir -p "$CANTON_HOME"
cd "$CANTON_HOME"

# Download Canton node files if not exists
if [ ! -f "0.5.8_splice-node.tar.gz" ]; then
    print_info "Downloading Canton node files..."
    curl -L -o "0.5.8_splice-node.tar.gz" \
        "https://github.com/digital-asset/decentralized-canton-sync/releases/download/v0.5.8/0.5.8_splice-node.tar.gz"
    print_status "Download completed"
else
    print_status "Canton node files already exist"
fi

# Extract files if not extracted
if [ ! -d "splice-node" ]; then
    print_info "Extracting Canton node files..."
    tar xzf "0.5.8_splice-node.tar.gz"
    print_status "Extraction completed"
else
    print_status "Canton node files already extracted"
fi

# Navigate to validator directory
cd "splice-node/docker-compose/validator"

# Set environment variable
export IMAGE_TAG="$CANTON_VERSION"
print_status "Set IMAGE_TAG to $CANTON_VERSION"

# Get onboarding secret
print_info "Requesting DevNet onboarding secret..."
print_warning "This token is valid for 1 hour only!"

ONBOARDING_SECRET=$(curl -s -X POST "$ONBOARD_API" | jq -r '.onboarding_secret // empty')

if [ -z "$ONBOARDING_SECRET" ] || [ "$ONBOARDING_SECRET" = "null" ]; then
    print_error "Failed to get onboarding secret. Please check your connection and try again."
    exit 1
fi

print_status "Onboarding secret obtained: ${ONBOARDING_SECRET:0:10}..."

# Prompt for party hint (validator name)
echo -e "${YELLOW}Enter your validator name (party hint):${NC}"
read -p "Validator name: " PARTY_HINT

if [ -z "$PARTY_HINT" ]; then
    PARTY_HINT="gyber-validator-$(date +%s)"
    print_warning "Using default validator name: $PARTY_HINT"
fi

# Create start script with parameters
cat > start-validator.sh << EOF
#!/bin/bash
# Canton Validator Start Script
# Generated on $(date)

export IMAGE_TAG="$CANTON_VERSION"

echo "🚀 Starting Canton Validator Node..."
echo "Validator: $PARTY_HINT"
echo "Network: DevNet"
echo "API: $DEVNET_API"

./start.sh \\
    -s "$DEVNET_API" \\
    -o "$ONBOARDING_SECRET" \\
    -p "$PARTY_HINT" \\
    -m "0" \\
    -w

EOF

chmod +x start-validator.sh

# Create stop script
cat > stop-validator.sh << EOF
#!/bin/bash
# Canton Validator Stop Script

echo "🛑 Stopping Canton Validator Node..."

docker-compose down

echo "✅ Validator node stopped"
EOF

chmod +x stop-validator.sh

# Create status script
cat > status-validator.sh << EOF
#!/bin/bash
# Canton Validator Status Script

echo "📊 Canton Validator Node Status"
echo "================================"

# Check if containers are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Validator node is running"
    docker-compose ps
else
    echo "❌ Validator node is not running"
fi

# Show logs
echo ""
echo "📋 Recent logs:"
docker-compose logs --tail=20
EOF

chmod +x status-validator.sh

# Create monitoring script
cat > monitor-validator.sh << EOF
#!/bin/bash
# Canton Validator Monitoring Script

echo "🔍 Canton Validator Node Monitoring"
echo "==================================="

while true; do
    clear
    echo "📊 Canton Validator Status - $(date)"
    echo "====================================="
    
    # Container status
    echo "🐳 Container Status:"
    docker-compose ps
    
    echo ""
    echo "📈 Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    
    echo ""
    echo "📋 Recent Logs (last 10 lines):"
    docker-compose logs --tail=10
    
    echo ""
    echo "Press Ctrl+C to exit monitoring"
    sleep 5
done
EOF

chmod +x monitor-validator.sh

# Copy scripts to project directory
print_info "Copying scripts to project directory..."
cp start-validator.sh "$DEVNET_DIR/"
cp stop-validator.sh "$DEVNET_DIR/"
cp status-validator.sh "$DEVNET_DIR/"
cp monitor-validator.sh "$DEVNET_DIR/"

# Create configuration file
cat > "$DEVNET_DIR/canton-config.env" << EOF
# Canton Validator Configuration
# Generated on $(date)

# Network Configuration
CANTON_NETWORK=devnet
CANTON_VERSION=$CANTON_VERSION
CANTON_API=$DEVNET_API

# Validator Configuration
VALIDATOR_NAME=$PARTY_HINT
VALIDATOR_MODE=0
VALIDATOR_WALLET=true

# Docker Configuration
IMAGE_TAG=$CANTON_VERSION
COMPOSE_PROJECT_NAME=canton-validator-devnet

# Security
ONBOARDING_SECRET=$ONBOARDING_SECRET
EOF

# Create README
cat > "$DEVNET_DIR/README.md" << EOF
# Canton Validator Node - DevNet

## Quick Start

1. **Start the validator:**
   \`\`\`bash
   ./start-validator.sh
   \`\`\`

2. **Check status:**
   \`\`\`bash
   ./status-validator.sh
   \`\`\`

3. **Monitor in real-time:**
   \`\`\`bash
   ./monitor-validator.sh
   \`\`\`

4. **Stop the validator:**
   \`\`\`bash
   ./stop-validator.sh
   \`\`\`

## Configuration

- **Validator Name:** $PARTY_HINT
- **Network:** DevNet
- **API Endpoint:** $DEVNET_API
- **Canton Version:** $CANTON_VERSION

## Important Notes

- The onboarding secret is valid for 1 hour only
- Make sure your IP is whitelisted by your SV sponsor
- Monitor the logs for any connection issues
- Keep your validator running to maintain network participation

## Troubleshooting

- Check Docker is running: \`docker info\`
- View detailed logs: \`docker-compose logs -f\`
- Restart if needed: \`./stop-validator.sh && ./start-validator.sh\`

## Next Steps

1. Share your fixed IP with your SV sponsor for whitelisting
2. Monitor the validator for 24-48 hours
3. Request TestNet access when ready
4. Eventually migrate to MainNet when allocation is available
EOF

print_status "Setup completed successfully!"
echo ""
echo -e "${GREEN}🎉 Canton Validator Node is ready for DevNet!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Share your fixed IP with your SV sponsor for whitelisting"
echo "2. Start the validator: cd $DEVNET_DIR && ./start-validator.sh"
echo "3. Monitor the logs: ./monitor-validator.sh"
echo ""
echo -e "${BLUE}Validator Configuration:${NC}"
echo "- Name: $PARTY_HINT"
echo "- Network: DevNet"
echo "- API: $DEVNET_API"
echo "- Onboarding Secret: ${ONBOARDING_SECRET:0:10}... (valid for 1 hour)"
echo ""
echo -e "${RED}⚠️  Important: Start the validator within 1 hour or request a new secret!${NC}"






