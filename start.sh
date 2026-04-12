#!/usr/bin/env bash

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}→ $1${NC}"
}

# Check if Docker is installed
print_info "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker from https://www.docker.com/get-started"
    exit 1
fi
print_success "Docker is installed"

# Check if Docker is running
print_info "Checking if Docker daemon is running..."
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
print_success "Docker is running"

# Check docker-compose availability
print_info "Checking docker-compose availability..."
COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    print_success "Using 'docker compose' (v2 plugin)"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    print_success "Using 'docker-compose' (v1 standalone)"
else
    print_error "Neither 'docker compose' nor 'docker-compose' is available."
    print_error "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Generate .env if it doesn't exist
if [ ! -f .env ]; then
    print_warning ".env file not found. Generating..."

    # Check if Python 3 is available (check py first for Windows)
    PYTHON_CMD=""
    if command -v py &> /dev/null && py --version &> /dev/null; then
        PYTHON_CMD="py"
    elif command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null && python --version &> /dev/null; then
        PYTHON_CMD="python"
    else
        print_error "Python 3 is required to generate secrets but is not installed."
        exit 1
    fi

    # Generate Fernet key
    print_info "Generating Fernet key..."
    FERNET_KEY=$($PYTHON_CMD -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

    # Generate JWT secret
    print_info "Generating JWT secret..."
    JWT_SECRET=$($PYTHON_CMD -c "import secrets; print(secrets.token_hex(32))")

    # Generate another secret for Airflow webserver
    AIRFLOW_SECRET=$($PYTHON_CMD -c "import secrets; print(secrets.token_hex(32))")

    # Write .env file
    cat > .env << EOF
POSTGRES_USER=pp_user
POSTGRES_PASSWORD=pipelinepulse123
POSTGRES_DB=pipelinepulse
DATABASE_URL=postgresql+asyncpg://pp_user:pipelinepulse123@postgres:5432/pipelinepulse
AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://pp_user:pipelinepulse123@postgres:5432/pipelinepulse
AIRFLOW__CELERY__BROKER_URL=redis://redis:6379/0
AIRFLOW__CORE__FERNET_KEY=${FERNET_KEY}
AIRFLOW__WEBSERVER__SECRET_KEY=${AIRFLOW_SECRET}
AIRFLOW__CORE__EXECUTOR=CeleryExecutor
_AIRFLOW_WWW_USER_USERNAME=admin
_AIRFLOW_WWW_USER_PASSWORD=admin123
JWT_SECRET=${JWT_SECRET}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NEXT_PUBLIC_API_URL=http://localhost:8000
OPENWEATHER_API_KEY=
GITHUB_TOKEN=
GITHUB_REPO=
EOF

    print_success ".env file generated successfully"
else
    print_success ".env file already exists"
fi

# Build Docker images
print_info "Building Docker images..."
$COMPOSE_CMD build
print_success "Docker images built"

# Start postgres first
print_info "Starting postgres..."
$COMPOSE_CMD up -d postgres
print_success "Postgres started"

# Wait for postgres to be ready
print_info "Waiting for PostgreSQL to be ready..."
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if $COMPOSE_CMD exec -T postgres pg_isready -U pp_user &> /dev/null; then
        print_success "PostgreSQL is ready"
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
    if [ $ELAPSED -ge $TIMEOUT ]; then
        print_error "PostgreSQL failed to start within ${TIMEOUT} seconds"
        exit 1
    fi
done

# Run database migrations
print_info "Running database migrations..."
$COMPOSE_CMD run --rm backend alembic upgrade head
print_success "Migrations completed"

# Start all services
print_info "Starting all services..."
$COMPOSE_CMD up -d
print_success "All services started"

# Wait for backend health check
print_info "Waiting for backend API to be ready..."
TIMEOUT=90
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -f -s http://localhost:8000/health &> /dev/null; then
        print_success "Backend API is ready"
        break
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    if [ $ELAPSED -ge $TIMEOUT ]; then
        print_warning "Backend API did not respond within ${TIMEOUT} seconds, but continuing..."
        break
    fi
done

# Wait for frontend to be ready
print_info "Waiting for frontend to be ready..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -f -s http://localhost:3000 &> /dev/null; then
        print_success "Frontend is ready"
        break
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    if [ $ELAPSED -ge $TIMEOUT ]; then
        print_warning "Frontend did not respond within ${TIMEOUT} seconds, but continuing..."
        break
    fi
done

# Open browser
print_info "Opening dashboard in browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000 &> /dev/null || print_warning "Could not open browser automatically"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000 &> /dev/null || print_warning "Could not open browser automatically"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    start http://localhost:3000 &> /dev/null || print_warning "Could not open browser automatically"
fi

# Print success summary
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     PipelinePulse is running!            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Dashboard  → http://localhost:3000${NC}"
echo -e "${CYAN}API docs   → http://localhost:8000/docs${NC}"
echo -e "${CYAN}Airflow    → http://localhost:8080  (admin / admin123)${NC}"
echo ""
echo -e "${YELLOW}To stop:   make stop${NC}"
echo -e "${YELLOW}Logs:      make logs${NC}"
echo ""
