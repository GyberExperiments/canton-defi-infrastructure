#!/bin/bash

# Canton Validator Alert Notifications
# Sends alerts via various channels (email, Telegram, Slack, etc.)
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
ALERT_LOG="$PROJECT_ROOT/blockchain/logs/alerts.log"

# Notification settings
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_SMTP_SERVER="${EMAIL_SMTP_SERVER:-}"
EMAIL_FROM="${EMAIL_FROM:-}"
EMAIL_TO="${EMAIL_TO:-}"

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

# Function to send Telegram notification
send_telegram_alert() {
    local alert_type=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
        print_warning "Telegram credentials not configured"
        return 1
    fi
    
    local emoji=""
    case $alert_type in
        "CRITICAL") emoji="🚨" ;;
        "WARNING") emoji="⚠️" ;;
        "INFO") emoji="ℹ️" ;;
        *) emoji="📢" ;;
    esac
    
    local telegram_message="*Canton Validator Alert* ${emoji}

*Type:* ${alert_type}
*Time:* ${timestamp}
*Message:* ${message}

*Node:* gyber-validator
*Network:* DevNet"

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d text="$telegram_message" \
        -d parse_mode="Markdown" \
        -d disable_web_page_preview=true > /dev/null
    
    if [ $? -eq 0 ]; then
        print_status "Telegram alert sent"
    else
        print_error "Failed to send Telegram alert"
        return 1
    fi
}

# Function to send Slack notification
send_slack_alert() {
    local alert_type=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [ -z "$SLACK_WEBHOOK_URL" ]; then
        print_warning "Slack webhook not configured"
        return 1
    fi
    
    local color=""
    case $alert_type in
        "CRITICAL") color="danger" ;;
        "WARNING") color="warning" ;;
        "INFO") color="good" ;;
        *) color="#36a64f" ;;
    esac
    
    local slack_payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "${color}",
            "title": "Canton Validator Alert",
            "fields": [
                {
                    "title": "Type",
                    "value": "${alert_type}",
                    "short": true
                },
                {
                    "title": "Time",
                    "value": "${timestamp}",
                    "short": true
                },
                {
                    "title": "Message",
                    "value": "${message}",
                    "short": false
                },
                {
                    "title": "Node",
                    "value": "gyber-validator",
                    "short": true
                },
                {
                    "title": "Network",
                    "value": "DevNet",
                    "short": true
                }
            ],
            "footer": "Canton Validator Monitor",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
    
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-type: application/json' \
        -d "$slack_payload" > /dev/null
    
    if [ $? -eq 0 ]; then
        print_status "Slack alert sent"
    else
        print_error "Failed to send Slack alert"
        return 1
    fi
}

# Function to send email notification
send_email_alert() {
    local alert_type=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [ -z "$EMAIL_SMTP_SERVER" ] || [ -z "$EMAIL_FROM" ] || [ -z "$EMAIL_TO" ]; then
        print_warning "Email settings not configured"
        return 1
    fi
    
    local subject="Canton Validator Alert - ${alert_type}"
    local body="Canton Validator Alert

Type: ${alert_type}
Time: ${timestamp}
Message: ${message}

Node: gyber-validator
Network: DevNet

This is an automated alert from the Canton Validator monitoring system.

Best regards,
Canton Validator Monitor"

    # Using mail command (requires mailutils on Linux or mail on macOS)
    echo "$body" | mail -s "$subject" "$EMAIL_TO" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_status "Email alert sent"
    else
        print_error "Failed to send email alert"
        return 1
    fi
}

# Function to send system notification (macOS)
send_system_notification() {
    local alert_type=$1
    local message=$2
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        osascript -e "display notification \"${message}\" with title \"Canton Validator Alert\" subtitle \"${alert_type}\""
        print_status "System notification sent"
    else
        print_warning "System notifications only supported on macOS"
    fi
}

# Function to send all notifications
send_alert() {
    local alert_type=$1
    local message=$2
    
    print_info "Sending alert: $alert_type - $message"
    
    # Send to all configured channels
    send_telegram_alert "$alert_type" "$message"
    send_slack_alert "$alert_type" "$message"
    send_email_alert "$alert_type" "$message"
    send_system_notification "$alert_type" "$message"
    
    # Log the alert
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$alert_type] $message" >> "$ALERT_LOG"
}

# Function to test notifications
test_notifications() {
    print_info "Testing notification channels..."
    
    # Test each channel
    send_telegram_alert "INFO" "This is a test notification from Canton Validator Monitor"
    send_slack_alert "INFO" "This is a test notification from Canton Validator Monitor"
    send_email_alert "INFO" "This is a test notification from Canton Validator Monitor"
    send_system_notification "INFO" "This is a test notification from Canton Validator Monitor"
    
    print_status "Notification test completed"
}

# Function to setup notification configuration
setup_notifications() {
    local config_file="$CONFIG_DIR/notification-config.env"
    
    print_info "Setting up notification configuration..."
    
    # Create config file if it doesn't exist
    if [ ! -f "$config_file" ]; then
        cat > "$config_file" << EOF
# Canton Validator Notification Configuration
# Generated on $(date)

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Email Configuration
EMAIL_SMTP_SERVER=smtp.gmail.com:587
EMAIL_FROM=your_email@gmail.com
EMAIL_TO=admin@yourdomain.com

# Notification Settings
ENABLE_TELEGRAM=true
ENABLE_SLACK=true
ENABLE_EMAIL=true
ENABLE_SYSTEM_NOTIFICATIONS=true

# Alert Thresholds
CRITICAL_ALERTS=true
WARNING_ALERTS=true
INFO_ALERTS=false
EOF
        chmod 600 "$config_file"
        print_status "Configuration file created: $config_file"
    else
        print_info "Configuration file already exists: $config_file"
    fi
    
    # Load configuration
    if [ -f "$config_file" ]; then
        source "$config_file"
        print_status "Configuration loaded"
    fi
    
    print_info "Please edit $config_file to configure your notification channels"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "COMMANDS:"
    echo "  send TYPE MESSAGE    Send alert notification"
    echo "  test                 Test all notification channels"
    echo "  setup                Setup notification configuration"
    echo "  monitor              Monitor alerts and send notifications"
    echo ""
    echo "ALERT TYPES:"
    echo "  CRITICAL             Critical alerts (immediate attention required)"
    echo "  WARNING              Warning alerts (attention recommended)"
    echo "  INFO                 Informational alerts"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help           Show this help message"
    echo "  -c, --config FILE    Use custom config file"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 send CRITICAL \"Validator node is down\""
    echo "  $0 send WARNING \"High CPU usage detected\""
    echo "  $0 test"
    echo "  $0 setup"
}

# Function to monitor alerts and send notifications
monitor_alerts() {
    local last_alert_time=""
    
    print_info "Starting alert monitoring..."
    
    while true; do
        if [ -f "$ALERT_LOG" ]; then
            # Get the latest alert
            local latest_alert=$(tail -1 "$ALERT_LOG" 2>/dev/null)
            
            if [ -n "$latest_alert" ] && [ "$latest_alert" != "$last_alert_time" ]; then
                # Parse alert
                local alert_type=$(echo "$latest_alert" | sed -n 's/.*\[\([^]]*\)\].*/\1/p')
                local message=$(echo "$latest_alert" | sed -n 's/.*\] \(.*\)/\1/p')
                
                if [ -n "$alert_type" ] && [ -n "$message" ]; then
                    send_alert "$alert_type" "$message"
                    last_alert_time="$latest_alert"
                fi
            fi
        fi
        
        sleep 10
    done
}

# Main function
main() {
    local command=""
    local config_file=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -c|--config)
                config_file="$2"
                shift 2
                ;;
            send|test|setup|monitor)
                command="$1"
                shift
                break
                ;;
            *)
                if [ -z "$command" ]; then
                    command="send"
                fi
                break
                ;;
        esac
    done
    
    # Load configuration
    if [ -n "$config_file" ] && [ -f "$config_file" ]; then
        source "$config_file"
    elif [ -f "$CONFIG_DIR/notification-config.env" ]; then
        source "$CONFIG_DIR/notification-config.env"
    fi
    
    # Execute command
    case $command in
        "send")
            if [ $# -lt 2 ]; then
                print_error "Usage: $0 send TYPE MESSAGE"
                exit 1
            fi
            local alert_type="$1"
            shift
            local message="$*"
            send_alert "$alert_type" "$message"
            ;;
        "test")
            test_notifications
            ;;
        "setup")
            setup_notifications
            ;;
        "monitor")
            monitor_alerts
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"






