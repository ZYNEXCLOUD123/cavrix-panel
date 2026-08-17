#!/usr/bin/env bash
set -Eeuo pipefail

PANEL_NAME="CAVRIX Panel"
PANEL_VERSION="1.0.0"
REPO_URL="https://github.com/ZYNEXCLOUD123/cavrix-panel.git"
INSTALL_DIR="/opt/cavrix-panel"
DEFAULT_PORT="3000"

RESET='\033[0m'
BOLD='\033[1m'
CYAN='\033[38;5;75m'
GREEN='\033[38;5;48m'
AMBER='\033[38;5;214m'
RED='\033[38;5;196m'
WHITE='\033[38;5;255m'
MUTED='\033[38;5;244m'

info()    { echo -e " ${CYAN}[INFO]${RESET} $*"; }
success() { echo -e " ${GREEN}[OK]${RESET} $*"; }
warn()    { echo -e " ${AMBER}[WARN]${RESET} $*"; }
error()   { echo -e " ${RED}[ERROR]${RESET} $*"; }

trap 'error "Installation failed on line $LINENO. No success message will be shown."' ERR

banner() {
    clear 2>/dev/null || true
    echo -e "${CYAN}${BOLD}"
    echo "    ██████╗ █████╗ ██████╗  ██████╗ ███████╗████████╗"
    echo "    ██╔══██╗██╔══██╗██╔══██╗██╔═══██╗██╔════╝╚══██╔══╝"
    echo "    ██║  ██║███████║██████╔╝██║   ██║█████╗     ██║"
    echo "    ██║  ██║██╔══██║██╔══██╗██║   ██║██╔══╝     ██║"
    echo "    ██████╔╝██║  ██║██████╔╝╚██████╔╝███████╗   ██║"
    echo "    ╚═════╝ ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚══════╝   ╚═╝"
    echo -e "${RESET}"
    echo -e "    ${WHITE}${BOLD}${PANEL_NAME} v${PANEL_VERSION}${RESET}"
    echo -e "    ${MUTED}Powering Your Game Infrastructure${RESET}"
    echo
}

require_root() {
    if [[ "$EUID" -ne 0 ]]; then
        error "Please run the installer with sudo/root."
        exit 1
    fi
}

detect_user() {
    if [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != "root" ]]; then
        APP_USER="$SUDO_USER"
    else
        APP_USER="cavrix"
    fi
}

install_packages() {
    info "Installing system dependencies..."

    if command -v apt-get >/dev/null 2>&1; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -y
        apt-get install -y \
            curl \
            git \
            ca-certificates \
            build-essential \
            openssl \
            postgresql \
            postgresql-contrib

    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y \
            curl \
            git \
            ca-certificates \
            gcc-c++ \
            make \
            openssl \
            postgresql-server \
            postgresql

    elif command -v yum >/dev/null 2>&1; then
        yum install -y \
            curl \
            git \
            ca-certificates \
            gcc-c++ \
            make \
            openssl \
            postgresql-server \
            postgresql

    else
        error "Unsupported Linux distribution."
        exit 1
    fi

    success "System dependencies installed."
}

install_node() {
    if command -v node >/dev/null 2>&1; then
        NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

        if (( NODE_MAJOR >= 20 )); then
            success "Node.js $(node -v) already installed."
            return
        fi
    fi

    info "Installing Node.js 22..."

    if command -v apt-get >/dev/null 2>&1; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y nodejs
    elif command -v dnf >/dev/null 2>&1; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
        dnf install -y nodejs
    elif command -v yum >/dev/null 2>&1; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
        yum install -y nodejs
    fi

    node -v
    npm -v
    success "Node.js ready."
}

install_docker() {
    if command -v docker >/dev/null 2>&1; then
        success "Docker already installed."
        systemctl enable --now docker 2>/dev/null || true
        return
    fi

    info "Installing Docker..."

    curl -fsSL https://get.docker.com | sh

    systemctl enable --now docker

    success "Docker installed."
}

setup_postgres() {
    info "Starting PostgreSQL..."

    systemctl enable --now postgresql

    DB_USER="cavrix"
    DB_NAME="cavrix"

    DB_PASSWORD="$(openssl rand -hex 24)"

    info "Creating CAVRIX database..."

    sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_roles WHERE rolname = '${DB_USER}'
    ) THEN
        CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
    ELSE
        ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
    END IF;
END
\$\$;
SQL

    if ! sudo -u postgres psql -tAc \
        "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then

        sudo -u postgres createdb \
            -O "$DB_USER" \
            "$DB_NAME"
    fi

    sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
        "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

    success "PostgreSQL configured."
}

download_cavrix() {
    TEMP_DIR="$(mktemp -d)"

    info "Downloading CAVRIX from GitHub..."

    git clone --depth 1 "$REPO_URL" "$TEMP_DIR/cavrix-panel"

    rm -rf "$INSTALL_DIR"

    mkdir -p "$INSTALL_DIR"

    cp -a "$TEMP_DIR/cavrix-panel/." "$INSTALL_DIR/"

    rm -rf "$TEMP_DIR"

    success "CAVRIX source downloaded."
}

configure_environment() {
    info "Creating production environment..."

    JWT_SECRET="$(openssl rand -hex 64)"

    cat > "$INSTALL_DIR/.env" <<EOF
NODE_ENV=production
PORT=${PORT}
HOST=0.0.0.0

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

ENABLE_DOCKER=true
DOCKER_SOCKET=/var/run/docker.sock

PANEL_NAME=CAVRIX
PANEL_VERSION=${PANEL_VERSION}
EOF

    chmod 600 "$INSTALL_DIR/.env"

    success "Environment configured."
}

install_dependencies() {
    cd "$INSTALL_DIR"

    info "Installing root dependencies..."
    npm ci --no-audit --no-fund

    info "Installing frontend dependencies..."
    npm ci --prefix frontend --no-audit --no-fund

    info "Installing backend dependencies..."
    npm ci --prefix backend --no-audit --no-fund

    success "Dependencies installed."
}

build_application() {
    cd "$INSTALL_DIR"

    info "Building CAVRIX..."

    npm run build

    test -f "$INSTALL_DIR/backend/dist/index.js"

    success "CAVRIX build completed."
}

run_database_setup() {
    cd "$INSTALL_DIR"

    info "Running database migrations..."

    npm run migrate

    info "Creating default database seed..."

    npm run db:seed

    success "Database initialized."
}

create_service() {
    info "Creating CAVRIX system service..."

    if ! id "$APP_USER" >/dev/null 2>&1; then
        useradd --system \
            --create-home \
            --shell /usr/sbin/nologin \
            "$APP_USER"
    fi

    chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"

    cat > /etc/systemd/system/cavrix-panel.service <<EOF
[Unit]
Description=CAVRIX Panel
After=network.target postgresql.service docker.service
Wants=postgresql.service docker.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/node ${INSTALL_DIR}/backend/dist/index.js
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable cavrix-panel
    systemctl restart cavrix-panel

    sleep 3

    if ! systemctl is-active --quiet cavrix-panel; then
        systemctl status cavrix-panel --no-pager || true
        error "CAVRIX service failed to start."
        exit 1
    fi

    success "CAVRIX service is running."
}

get_ip() {
    SERVER_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
}

main() {
    banner
    require_root

    PORT="$DEFAULT_PORT"

    read -r -p "  Installation directory [${INSTALL_DIR}]: " INPUT_DIR
    INSTALL_DIR="${INPUT_DIR:-$INSTALL_DIR}"

    read -r -p "  Panel port [${PORT}]: " INPUT_PORT
    PORT="${INPUT_PORT:-$PORT}"

    if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
        error "Invalid port."
        exit 1
    fi

    detect_user
    install_packages
    install_node
    install_docker
    setup_postgres
    download_cavrix
    configure_environment
    install_dependencies
    build_application
    run_database_setup
    create_service
    get_ip

    echo
    echo -e "${GREEN}${BOLD}  CAVRIX Panel installed successfully!${RESET}"
    echo
    echo -e "  Panel URL: ${CYAN}http://${SERVER_IP}:${PORT}${RESET}"
    echo -e "  Install directory: ${INSTALL_DIR}"
    echo -e "  Service: ${CYAN}systemctl status cavrix-panel${RESET}"
    echo
    echo -e "${AMBER}  IMPORTANT: Do not use a hard-coded default password in production.${RESET}"
    echo
}

main "$@"
