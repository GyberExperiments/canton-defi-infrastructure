#!/bin/bash

# Canton Validator Node Monitoring Script
# Comprehensive monitoring and alerting for Canton validator nodes
# Version: 1.0
# Author: Gyber

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
LOG_DIR="$PROJECT_ROOT/blockchain/logs"
ALERT_LOG="$LOG_DIR/alerts.log"
METRICS_LOG="$LOG_DIR/metrics.log"
HEALTH_LOG="$LOG_DIR/health.log"

# Monitoring settings
CHECK_INTERVAL=30
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=90
ALERT_THRESHOLD_LATENCY=5000

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

print_metric() {
    echo -e "${CYAN}📊 $1${NC}"
}

print_alert() {
    echo -e "${RED}🚨 $1${NC}"
}

# Function to create log directory
setup_logging() {
    mkdir -p "$LOG_DIR"
    
    # Create log files if they don't exist
    touch "$ALERT_LOG" "$METRICS_LOG" "$HEALTH_LOG"
    
    print_status "Logging setup completed"
}

# Function to log alert
log_alert() {
    local alert_type=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$alert_type] $message" >> "$ALERT_LOG"
    print_alert "$message"
}

# Function to log metrics
log_metrics() {
    local metrics=$1
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] $metrics" >> "$METRICS_LOG"
}

# Function to check Docker status
check_docker_status() {
    if ! docker info &> /dev/null; then
        log_alert "DOCKER" "Docker is not running"
        return 1
    fi
    return 0
}

# Function to check Canton container status
check_canton_container() {
    local container_name="canton-validator-devnet"
    
    if ! docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        log_alert "CONTAINER" "Canton validator container is not running"
        return 1
    fi
    
    # Check if container is healthy
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
    
    if [ "$health_status" != "healthy" ] && [ "$health_status" != "unknown" ]; then
        log_alert "HEALTH" "Canton validator container is unhealthy: $health_status"
        return 1
    fi
    
    return 0
}

# Function to check system resources
check_system_resources() {
    # CPU usage
    local cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
    if (( $(echo "$cpu_usage > $ALERT_THRESHOLD_CPU" | bc -l) )); then
        log_alert "CPU" "High CPU usage: ${cpu_usage}%"
    fi
    
    # Memory usage
    local memory_info=$(vm_stat | grep -E "(free|active|inactive|wired)")
    local free_pages=$(echo "$memory_info" | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
    local active_pages=$(echo "$memory_info" | grep "Pages active" | awk '{print $3}' | sed 's/\.//')
    local total_pages=$((free_pages + active_pages))
    local memory_usage=$(( (active_pages * 100) / total_pages ))
    
    if [ "$memory_usage" -gt "$ALERT_THRESHOLD_MEMORY" ]; then
        log_alert "MEMORY" "High memory usage: ${memory_usage}%"
    fi
    
    # Disk usage
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt "$ALERT_THRESHOLD_DISK" ]; then
        log_alert "DISK" "High disk usage: ${disk_usage}%"
    fi
    
    # Log metrics
    log_metrics "CPU:${cpu_usage}% MEMORY:${memory_usage}% DISK:${disk_usage}%"
}

# Function to check Canton API endpoints
check_canton_endpoints() {
    local endpoints=(
        "http://localhost:8080/metrics"
        "http://localhost:8081/health"
        "http://localhost:8082/admin"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local start_time=$(date +%s%3N)
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
        local end_time=$(date +%s%3N)
        local latency=$((end_time - start_time))
        
        if [ "$response" != "200" ]; then
            log_alert "ENDPOINT" "Endpoint $endpoint returned status $response"
        elif [ "$latency" -gt "$ALERT_THRESHOLD_LATENCY" ]; then
            log_alert "LATENCY" "High latency for $endpoint: ${latency}ms"
        fi
        
        # Log endpoint metrics
        log_metrics "ENDPOINT:$endpoint STATUS:$response LATENCY:${latency}ms"
    done
}

# Function to check network connectivity
check_network_connectivity() {
    local endpoints=(
        "https://sv.sv-1.dev.global.canton.network.sync.global"
        "https://google.com"
        "https://github.com"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local start_time=$(date +%s%3N)
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" --max-time 10 2>/dev/null || echo "000")
        local end_time=$(date +%s%3N)
        local latency=$((end_time - start_time))
        
        if [ "$response" != "200" ]; then
            log_alert "NETWORK" "Network connectivity issue: $endpoint returned $response"
        fi
        
        # Log network metrics
        log_metrics "NETWORK:$endpoint STATUS:$response LATENCY:${latency}ms"
    done
}

# Function to check Canton logs for errors
check_canton_logs() {
    local container_name="canton-validator-devnet"
    local error_count=$(docker logs "$container_name" --since="5m" 2>&1 | grep -i "error\|exception\|failed" | wc -l)
    
    if [ "$error_count" -gt 0 ]; then
        log_alert "LOGS" "Found $error_count errors in Canton logs in the last 5 minutes"
        
        # Log recent errors
        local recent_errors=$(docker logs "$container_name" --since="5m" 2>&1 | grep -i "error\|exception\|failed" | tail -3)
        echo "Recent errors:" >> "$ALERT_LOG"
        echo "$recent_errors" >> "$ALERT_LOG"
    fi
}

# Function to generate system report
generate_system_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local report_file="$LOG_DIR/system-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
Canton Validator Node System Report
Generated: $timestamp
=====================================

SYSTEM INFORMATION:
$(uname -a)

DOCKER STATUS:
$(docker info 2>/dev/null | head -20)

CANTON CONTAINER STATUS:
$(docker ps --filter "name=canton-validator" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

SYSTEM RESOURCES:
$(top -l 1 | head -10)

MEMORY USAGE:
$(vm_stat)

DISK USAGE:
$(df -h)

NETWORK CONNECTIVITY:
$(ping -c 3 google.com 2>/dev/null | tail -1)

CANTON LOGS (last 50 lines):
$(docker logs canton-validator-devnet --tail=50 2>&1)

ALERTS (last 10):
$(tail -10 "$ALERT_LOG" 2>/dev/null || echo "No alerts")

EOF
    
    print_info "System report generated: $report_file"
}

# Function to show real-time monitoring
show_realtime_monitoring() {
    while true; do
        clear
        echo -e "${BLUE}🔍 Canton Validator Node Monitoring${NC}"
        echo -e "${BLUE}====================================${NC}"
        echo ""
        
        # System status
        echo -e "${CYAN}📊 System Status:${NC}"
        if check_docker_status; then
            print_status "Docker is running"
        else
            print_error "Docker is not running"
        fi
        
        if check_canton_container; then
            print_status "Canton container is running"
        else
            print_error "Canton container is not running"
        fi
        
        echo ""
        
        # Resource usage
        echo -e "${CYAN}💻 Resource Usage:${NC}"
        local cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
        local memory_info=$(vm_stat | grep -E "(free|active|inactive|wired)")
        local free_pages=$(echo "$memory_info" | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        local active_pages=$(echo "$memory_info" | grep "Pages active" | awk '{print $3}' | sed 's/\.//')
        local total_pages=$((free_pages + active_pages))
        local memory_usage=$(( (active_pages * 100) / total_pages ))
        local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
        
        print_metric "CPU: ${cpu_usage}%"
        print_metric "Memory: ${memory_usage}%"
        print_metric "Disk: ${disk_usage}%"
        
        echo ""
        
        # Container status
        echo -e "${CYAN}🐳 Container Status:${NC}"
        docker ps --filter "name=canton-validator" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        
        echo ""
        
        # Recent logs
        echo -e "${CYAN}📋 Recent Logs (last 10 lines):${NC}"
        docker logs canton-validator-devnet --tail=10 2>&1 | sed 's/^/  /'
        
        echo ""
        
        # Recent alerts
        echo -e "${CYAN}🚨 Recent Alerts:${NC}"
        if [ -f "$ALERT_LOG" ]; then
            tail -5 "$ALERT_LOG" 2>/dev/null | sed 's/^/  /' || echo "  No recent alerts"
        else
            echo "  No alerts log found"
        fi
        
        echo ""
        echo -e "${YELLOW}Press Ctrl+C to exit monitoring${NC}"
        echo -e "${BLUE}Next check in ${CHECK_INTERVAL} seconds...${NC}"
        
        sleep "$CHECK_INTERVAL"
    done
}

# Function to run health checks
run_health_checks() {
    print_info "Running comprehensive health checks..."
    
    # Check Docker
    if ! check_docker_status; then
        return 1
    fi
    
    # Check Canton container
    if ! check_canton_container; then
        return 1
    fi
    
    # Check system resources
    check_system_resources
    
    # Check API endpoints
    check_canton_endpoints
    
    # Check network connectivity
    check_network_connectivity
    
    # Check logs for errors
    check_canton_logs
    
    print_status "Health checks completed"
    return 0
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "COMMANDS:"
    echo "  monitor     Start real-time monitoring (default)"
    echo "  check       Run one-time health checks"
    echo "  report      Generate system report"
    echo "  logs        Show recent logs and alerts"
    echo "  setup       Setup logging directories"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo "  -i, --interval Set check interval in seconds (default: 30)"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 monitor                    # Start real-time monitoring"
    echo "  $0 check                      # Run health checks once"
    echo "  $0 report                     # Generate system report"
    echo "  $0 monitor --interval 60      # Monitor with 60-second intervals"
}

# Main function
main() {
    local command="monitor"
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
            -i|--interval)
                CHECK_INTERVAL="$2"
                shift 2
                ;;
            monitor|check|report|logs|setup)
                command="$1"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Setup logging
    setup_logging
    
    # Execute command
    case $command in
        "monitor")
            print_info "Starting real-time monitoring (interval: ${CHECK_INTERVAL}s)"
            show_realtime_monitoring
            ;;
        "check")
            run_health_checks
            ;;
        "report")
            generate_system_report
            ;;
        "logs")
            echo -e "${BLUE}📋 Recent Logs and Alerts${NC}"
            echo -e "${BLUE}==========================${NC}"
            echo ""
            echo -e "${CYAN}Recent Alerts:${NC}"
            tail -20 "$ALERT_LOG" 2>/dev/null || echo "No alerts found"
            echo ""
            echo -e "${CYAN}Recent Metrics:${NC}"
            tail -20 "$METRICS_LOG" 2>/dev/null || echo "No metrics found"
            echo ""
            echo -e "${CYAN}Canton Container Logs:${NC}"
            docker logs canton-validator-devnet --tail=50 2>&1 || echo "Container not found"
            ;;
        "setup")
            print_status "Logging setup completed"
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"






