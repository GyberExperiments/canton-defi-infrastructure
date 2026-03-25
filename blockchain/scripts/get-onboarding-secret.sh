#!/bin/bash

# Canton Onboarding Secret Generator
# This script gets onboarding secrets for different Canton networks
# Version: 1.0
# Author: Gyber

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CONFIG_DIR="$PROJECT_ROOT/blockchain/config"
SECRETS_FILE="$CONFIG_DIR/onboarding-secrets.env"

# API endpoints
DEVNET_API="https://sv.sv-1.dev.global.canton.network.sync.global"
TESTNET_API="https://sv.sv-1.test.global.canton.network.sync.global"
MAINNET_API="https://sv.sv-1.main.global.canton.network.sync.global"

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

# Function to show usage
show_usage() {
    echo "Usage: $0 [NETWORK] [OPTIONS]"
    echo ""
    echo "NETWORKS:"
    echo "  devnet    - Get DevNet onboarding secret (default)"
    echo "  testnet   - Get TestNet onboarding secret"
    echo "  mainnet   - Get MainNet onboarding secret"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo "  -s, --save     Save secret to config file"
    echo "  -f, --force    Force refresh even if secret exists"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 devnet                    # Get DevNet secret"
    echo "  $0 testnet --save            # Get TestNet secret and save to file"
    echo "  $0 mainnet --verbose --force # Get MainNet secret with verbose output"
}

# Function to get onboarding secret
get_onboarding_secret() {
    local network=$1
    local api_endpoint=""
    local api_path=""
    
    case $network in
        "devnet")
            api_endpoint="$DEVNET_API"
            api_path="/api/sv/v0/devnet/onboard/validator/prepare"
            ;;
        "testnet")
            api_endpoint="$TESTNET_API"
            api_path="/api/sv/v0/testnet/onboard/validator/prepare"
            ;;
        "mainnet")
            api_endpoint="$MAINNET_API"
            api_path="/api/sv/v0/mainnet/onboard/validator/prepare"
            ;;
        *)
            print_error "Unknown network: $network"
            return 1
            ;;
    esac
    
    local full_url="${api_endpoint}${api_path}"
    
    print_info "Requesting onboarding secret for $network..."
    print_info "API endpoint: $full_url"
    
    # Make API request
    local response
    if [ "$VERBOSE" = true ]; then
        response=$(curl -v -X POST "$full_url" 2>&1)
    else
        response=$(curl -s -X POST "$full_url")
    fi
    
    # Check if request was successful
    if [ $? -ne 0 ]; then
        print_error "Failed to connect to $network API"
        return 1
    fi
    
    # Extract onboarding secret from response
    local secret
    if command -v jq &> /dev/null; then
        secret=$(echo "$response" | jq -r '.onboarding_secret // empty')
    else
        # Fallback parsing without jq
        secret=$(echo "$response" | grep -o '"onboarding_secret":"[^"]*"' | cut -d'"' -f4)
    fi
    
    if [ -z "$secret" ] || [ "$secret" = "null" ]; then
        print_error "Failed to extract onboarding secret from response"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $response"
        fi
        return 1
    fi
    
    echo "$secret"
}

# Function to save secret to file
save_secret() {
    local network=$1
    local secret=$2
    
    # Create config directory if it doesn't exist
    mkdir -p "$CONFIG_DIR"
    
    # Create or update secrets file
    if [ -f "$SECRETS_FILE" ]; then
        # Update existing file
        if grep -q "^${network^^}_ONBOARDING_SECRET=" "$SECRETS_FILE"; then
            sed -i.bak "s/^${network^^}_ONBOARDING_SECRET=.*/${network^^}_ONBOARDING_SECRET=$secret/" "$SECRETS_FILE"
        else
            echo "${network^^}_ONBOARDING_SECRET=$secret" >> "$SECRETS_FILE"
        fi
    else
        # Create new file
        cat > "$SECRETS_FILE" << EOF
# Canton Onboarding Secrets
# Generated on $(date)
# WARNING: Keep this file secure and do not commit to version control

${network^^}_ONBOARDING_SECRET=$secret
EOF
    fi
    
    # Set secure permissions
    chmod 600 "$SECRETS_FILE"
    
    print_status "Secret saved to $SECRETS_FILE"
}

# Function to check if secret exists
secret_exists() {
    local network=$1
    
    if [ -f "$SECRETS_FILE" ]; then
        grep -q "^${network^^}_ONBOARDING_SECRET=" "$SECRETS_FILE"
    else
        return 1
    fi
}

# Function to get existing secret
get_existing_secret() {
    local network=$1
    
    if [ -f "$SECRETS_FILE" ]; then
        grep "^${network^^}_ONBOARDING_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2
    fi
}

# Main function
main() {
    local network="devnet"
    local save_to_file=false
    local force_refresh=false
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -s|--save)
                save_to_file=true
                shift
                ;;
            -f|--force)
                force_refresh=true
                shift
                ;;
            devnet|testnet|mainnet)
                network="$1"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Set global variables
    VERBOSE=$verbose
    
    echo -e "${BLUE}🔐 Canton Onboarding Secret Generator${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""
    
    # Check if secret already exists and not forcing refresh
    if [ "$force_refresh" = false ] && secret_exists "$network"; then
        local existing_secret
        existing_secret=$(get_existing_secret "$network")
        
        print_warning "Onboarding secret for $network already exists"
        echo "Existing secret: ${existing_secret:0:10}..."
        echo ""
        
        read -p "Do you want to refresh the secret? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Using existing secret"
            echo "$existing_secret"
            exit 0
        fi
    fi
    
    # Get new onboarding secret
    local secret
    secret=$(get_onboarding_secret "$network")
    
    if [ $? -eq 0 ] && [ -n "$secret" ]; then
        print_status "Onboarding secret obtained successfully"
        echo ""
        echo -e "${GREEN}Network: $network${NC}"
        echo -e "${GREEN}Secret: $secret${NC}"
        echo ""
        
        # Show secret validity info
        case $network in
            "devnet")
                print_warning "DevNet secret is valid for 1 hour only"
                ;;
            "testnet")
                print_warning "TestNet secret validity depends on network policy"
                ;;
            "mainnet")
                print_warning "MainNet secret validity depends on network policy"
                ;;
        esac
        
        # Save to file if requested
        if [ "$save_to_file" = true ]; then
            save_secret "$network" "$secret"
        fi
        
        # Show usage instructions
        echo ""
        echo -e "${BLUE}Usage Instructions:${NC}"
        echo "1. Use this secret in your validator configuration"
        echo "2. Start your validator within the validity period"
        echo "3. Monitor the logs for successful connection"
        echo ""
        
        if [ "$save_to_file" = false ]; then
            echo -e "${YELLOW}Tip: Use --save flag to store the secret for later use${NC}"
        fi
        
    else
        print_error "Failed to get onboarding secret for $network"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"






