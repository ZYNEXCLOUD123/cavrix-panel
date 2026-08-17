# CAVRIX Panel

**Powering Your Game Infrastructure**

CAVRIX Panel is a modern, secure, scalable game-server control panel built for Minecraft and designed to support additional game types.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Real-time Dashboard** - Live CPU, RAM, Disk, and Network monitoring
- **Server Management** - Create, start, stop, restart, kill, suspend servers
- **Docker Isolation** - Secure per-server containerized environments
- **Web Console** - Real-time terminal with WebSocket streaming
- **File Manager** - Browse, edit, upload, download server files
- **Code Editor** - Syntax-highlighted file editing in-browser
- **Backups** - Create, restore, download backups
- **Scheduler** - Automated server tasks (start, stop, backup)
- **Node System** - Multi-machine server distribution
- **RBAC** - Granular role-based access control
- **Admin Panel** - Users, roles, settings, audit logs
- **REST API** - Full API with authentication and rate limiting
- **Dark Mode** - Premium dark theme with configurable accents

## Requirements

- Node.js 20+
- PostgreSQL 14+
- Docker (optional, for container isolation)
- Redis (optional, for caching)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/cavrix-panel/cavrix-panel.git
cd cavrix-panel

# Run the installer
bash install.sh
```

## Manual Installation

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && npm run build && cd ..
cd backend && npm install && npm run build && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Run migrations and seed
cd backend && npm run migrate && npm run db:seed && cd ..

# 4. Start the panel
npm start
```

## Docker Deployment

```bash
docker-compose up -d
```

## Default Credentials

- **Email:** admin@cavrix.panel
- **Password:** admin123

> Change the default password immediately after first login.

## Configuration

All configuration is via environment variables (`.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Panel port | 3000 |
| NODE_ENV | Environment | development |
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 5432 |
| DB_NAME | Database name | cavrix |
| JWT_SECRET | JWT signing secret | (generated) |
| ENABLE_DOCKER | Docker support | true |

## API

REST API at `/api/v1/` with authentication via Bearer token.

### Endpoints

- `GET /api/health` - Health check
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register
- `GET /api/v1/servers` - List servers
- `POST /api/v1/servers` - Create server
- `POST /api/v1/servers/:id/start` - Start server
- `POST /api/v1/servers/:id/stop` - Stop server
- `GET /api/v1/nodes` - List nodes
- And more...

## Attribution

CAVRIX Panel is inspired by [JTG Panel](https://github.com/JishnuTheGamer/Jtg) by Jishnu, licensed under MIT. See [ATTRIBUTION.md](ATTRIBUTION.md) for details.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Support

- Issues: https://github.com/cavrix-panel/cavrix-panel/issues
- Documentation: See DOCUMENTATION.md
