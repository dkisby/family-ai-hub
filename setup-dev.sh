#!/bin/bash

set -e

echo "🚀 Family Hub - Local Development Setup"
echo "========================================"
echo ""
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
echo -e "${BLUE}Checking Node.js...${NC}"
NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js"
    exit 1
fi
echo ""
echo -e "${BLUE}Setting up Frontend...${NC}"
cd build/frontend

if [ ! -f package-lock.json ]; then
    echo "Installing dependencies..."
    npm install
fi

if [ ! -f .env.local ]; then
    echo "Creating .env.local from template..."
    cp .env.example .env.local
    echo -e "${YELLOW}⚠️  Please update .env.local with your Entra credentials:${NC}"
    echo "   VITE_ENTRA_TENANT_ID=your-tenant-id"
    echo "   VITE_ENTRA_CLIENT_ID=your-app-id"
fi

echo "✓ Frontend ready"
cd ../backend
echo ""
echo -e "${BLUE}Setting up Backend...${NC}"

if [ ! -f package-lock.json ]; then
    echo "Installing dependencies..."
    npm install
fi

if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please update .env with your Foundry credentials:${NC}"
    echo "   FOUNDRY_ENDPOINT=https://ai-family-hub.openai.azure.com"
    echo "   FOUNDRY_API_KEY=your-api-key"
fi

echo "✓ Backend ready"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo ""
echo "1️⃣  Configure environment variables:"
echo "   - Edit build/frontend/.env.local"
echo "   - Edit build/backend/.env"
echo ""
echo "2️⃣  Start the backend (in one terminal):"
echo "   cd build/backend && npm run dev"
echo ""
echo "3️⃣  Start the frontend (in another terminal):"
echo "   cd build/frontend && npm run dev"
echo ""
echo "4️⃣  Open browser:"
echo "   http://localhost:3000"
echo ""
echo "5️⃣  Sign in with your Entra credentials"
echo ""
echo "📚 Documentation: see build/README.md"
echo ""
