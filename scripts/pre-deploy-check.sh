#!/bin/bash
# Pre-deployment checklist for Credibility Analyzer
# Run this before deploying to Render

set -e

echo "🔍 Running pre-deployment checks..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null || echo "not installed")
if [[ "$NODE_VERSION" == "not installed" ]]; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"
fi

# Check Python version
echo "🐍 Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>/dev/null || echo "not installed")
if [[ "$PYTHON_VERSION" == "not installed" ]]; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ $PYTHON_VERSION${NC}"
fi

echo ""
echo "🏗️  Building Frontend..."
cd credibility-analyzer
if npm ci && npm run build; then
    echo -e "${GREEN}✓ Frontend build successful${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
cd ..

echo ""
echo "🏗️  Building Backend..."
cd backend
if npm ci && npm run build; then
    echo -e "${GREEN}✓ Backend build successful${NC}"
else
    echo -e "${RED}❌ Backend build failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
cd ..

echo ""
echo "🏗️  Checking ML Service dependencies..."
cd ml-service
if pip install -r requirements.txt --dry-run > /dev/null 2>&1; then
    echo -e "${GREEN}✓ ML Service dependencies OK${NC}"
else
    echo -e "${YELLOW}⚠ Could not verify ML dependencies (pip dry-run failed)${NC}"
fi
cd ..

echo ""
echo "📋 Checking required files..."

FILES_TO_CHECK=(
    "render.yaml"
    "backend/package.json"
    "backend/tsconfig.json"
    "credibility-analyzer/package.json"
    "credibility-analyzer/vite.config.ts"
    "ml-service/requirements.txt"
    "ml-service/app/main.py"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}❌ Missing: $file${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "=========================================="
if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}✅ All checks passed! Ready to deploy.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Push code to GitHub/GitLab"
    echo "2. Go to https://dashboard.render.com"
    echo "3. Create a new Blueprint and connect your repo"
    echo "4. Set up MongoDB Atlas (free tier available)"
    echo "5. Configure environment variables"
    echo ""
    echo "See docs/RENDER_DEPLOYMENT.md for detailed instructions."
else
    echo -e "${RED}❌ $ERRORS check(s) failed. Please fix before deploying.${NC}"
    exit 1
fi
