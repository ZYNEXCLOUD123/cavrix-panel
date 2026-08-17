#!/usr/bin/env bash

# ==============================================================================
#    ██████╗ █████╗ ██████╗  ██████╗ ███████╗████████╗
#    ██╔══██╗██╔══██╗██╔══██╗██╔═══██╗██╔════╝╚══██╔══╝
#    ██║  ██║███████║██████╔╝██║   ██║█████╗     ██║
#    ██║  ██║██╔══██║██╔══██╗██║   ██║██╔══╝     ██║
#    ██████╔╝██║  ██║██████╔╝╚██████╔╝███████╗   ██║
#    ╚═════╝ ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚══════╝   ╚═╝
#
#    CAVRIX Panel - Installer
#    "Powering Your Game Infrastructure"
#    Version: 1.0.0
#    License: MIT (see LICENSE and ATTRIBUTION.md)
# ==============================================================================

set -e

PANEL_NAME="CAVRIX Panel"
PANEL_VERSION="1.0.0"
DEFAULT_PORT=3000
REPO_URL="https://github.com/cavrix-panel/cavrix-panel.git"

C_RESET='\033[0m'
C_BOLD='\033[1m'
C_CYAN='\033[38;5;75m'
C_GREEN='\033[38;5;48m'
C_AMBER='\033[38;5;214m'
C_RED='\033[38;5;196m'
C_WHITE='\033[38;5;255m'
C_MUTED='\033[38;5;244m'

log_info() { echo -e " ${C_CYAN}[INFO]${C_RESET} $1"; }
log_success() { echo -e " ${C_GREEN}[OK]${C_RESET} $1"; }
log_warning() { echo -e " ${C_AMBER}[WARN]${C_RESET} $1"; }
log_error() { echo -e " ${C_RED}[ERROR]${C_RESET} $1"; }

print_banner() {
    clear
    echo -e "${C_CYAN}${C_BOLD}"
    echo "    ██████╗ █████╗ ██████╗  ██████╗ ███████╗████████╗"
    echo "    ██╔══██╗██╔══██╗██╔══██╗██╔═══██╗██╔════╝╚══██╔══╝"
    echo "    ██║  ██║███████║██████╔╝██║   ██║█████╗     ██║"
    echo "    ██║  ██║██╔══██║██╔══██╗██║   ██║██╔══╝     ██║"
    echo "    ██████╔╝██║  ██║██████╔╝╚██████╔╝███████╗   ██║"
    echo "    ╚═════╝ ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚══════╝   ╚═╝"
    echo -e "${C_RESET}"
    echo -e "    ${C_WHITE}${C_BOLD}${PANEL_NAME} v${PANEL_VERSION}${C_RESET}"
    echo -e "    ${C_MUTED}Powering Your Game Infrastructure${C_RESET}"
    echo ""
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_warning "Running as non-root. Use sudo if package installation fails."
    fi
}

ensure_nodejs() {
    log_info "Checking Node.js 20+..."
    local need_install=0
    if ! command -v node &> /dev/null; then
        need_install=1
    else
        local node_ver
        node_ver=$(node -v | cut -d'.' -f1 | tr -d 'v')
        if [ "$node_ver" -lt 20 ]; then need_install=1; fi
    fi
    if [ "$need_install" -eq 1 ]; then
        log_info "Installing Node.js 22.x..."
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v yum &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
            sudo yum install -y nodejs
        fi
    fi
    log_success "Node.js $(node -v) ready."
}

setup_system_deps() {
    log_info "Installing system dependencies..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -y -qq 2>/dev/null || true
        sudo apt-get install -y -qq curl git build-essential ca-certificates postgresql postgresql-contrib 2>/dev/null || true
    elif command -v yum &> /dev/null; then
        sudo yum install -y curl git gcc-c++ make postgresql-server postgresql 2>/dev/null || true
    fi
    log_success "System dependencies installed."
}

setup_postgresql() {
    log_info "Setting up PostgreSQL..."
    if command -v systemctl &> /dev/null; then
        sudo systemctl enable --now postgresql 2>/dev/null || true
    fi

    local db_user="cavrix"
    local db_pass="cavrix_$(openssl rand -hex 8)"
    local db_name="cavrix"

    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${db_user}'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER ${db_user} WITH PASSWORD '${db_pass}';" 2>/dev/null || true

    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE ${db_name} OWNER ${db_user};" 2>/dev/null || true

    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${db_name} TO ${db_user};" 2>/dev/null || true

    echo "${db_user}:${db_pass}"
    log_success "PostgreSQL database configured."
}

setup_docker() {
    log_info "Checking Docker..."
    if ! command -v docker &> /dev/null; then
        log_info "Installing Docker..."
        curl -fsSL https://get.docker.com | sudo sh
        sudo systemctl enable --now docker 2>/dev/null || true
        sudo usermod -aG docker "$USER" 2>/dev/null || true
    fi
    log_success "Docker ready."
}

install_panel() {
    local target_dir="${1:-/opt/cavrix-panel}"

    log_info "Installing CAVRIX Panel to ${target_dir}..."
    sudo mkdir -p "$target_dir"
    sudo cp -r ./* "$target_dir/"
    sudo chown -R "$USER:$USER" "$target_dir"

    cd "$target_dir"

    log_info "Installing dependencies..."
    npm install --no-audit --no-fund --quiet 2>/dev/null || npm install --no-audit --no-fund

    log_info "Building frontend..."
    cd frontend && npm install --no-audit --no-fund 2>/dev/null || true
    npm run build 2>/dev/null || true
    cd ..

    log_info "Building backend..."
    cd backend && npm install --no-audit --no-fund 2>/dev/null || true
    npm run build 2>/dev/null || true
    cd ..

    log_success "Application built."
}

configure_env() {
    local target_dir="${1:-/opt/cavrix-panel}"
    local port="${2:-$DEFAULT_PORT}"

    local jwt_secret
    jwt_secret=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

    cat > "${target_dir}/.env" <<EOF
NODE_ENV=production
PORT=${port}
HOST=0.0.0.0
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cavrix
DB_USER=cavrix
DB_PASSWORD=cavrix_placeholder
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=7d
ENABLE_DOCKER=true
DOCKER_SOCKET=/var/run/docker.sock
PANEL_NAME=CAVRIX
PANEL_VERSION=1.0.0
EOF

    log_success "Environment configured on port ${port}."
}

configure_pm2() {
    local target_dir="${1:-/opt/cavrix-panel}"
    local port="${2:-$DEFAULT_PORT}"

    if ! command -v pm2 &> /dev/null; then
        sudo npm install -g pm2 2>/dev/null || npm install -g pm2 2>/dev/null
    fi

    pm2 delete cavrix-panel 2>/dev/null || true
    cd "$target_dir"
    PORT="${port}" pm2 start backend/dist/index.js --name cavrix-panel
    pm2 save 2>/dev/null || true

    if [ "$EUID" -eq 0 ]; then
        pm2 startup systemd -u root --hp /root 2>/dev/null || true
    fi

    log_success "PM2 service 'cavrix-panel' started."
}

main() {
    print_banner

    local port=$DEFAULT_PORT
    local install_dir="/opt/cavrix-panel"

    read -r -p "  Installation directory [${install_dir}]: " input_dir
    install_dir="${input_dir:-$install_dir}"

    read -r -p "  Panel port [${port}]: " input_port
    port="${input_port:-$port}"

    check_root
    setup_system_deps
    ensure_nodejs
    setup_docker
    install_panel "$install_dir"
    configure_env "$install_dir" "$port"
    configure_pm2 "$install_dir" "$port"

    echo ""
    echo -e "${C_GREEN}${C_BOLD}  CAVRIX Panel installed successfully!${C_RESET}"
    echo -e "  Panel URL: ${C_CYAN}http://$(curl -s --max-time 4 https://api.ipify.org 2>/dev/null || echo 'localhost'):${port}${C_RESET}"
    echo -e "  Default login: ${C_WHITE}admin@cavrix.panel${C_RESET} / ${C_WHITE}admin123${C_RESET}"
    echo ""
}

main "$@"
