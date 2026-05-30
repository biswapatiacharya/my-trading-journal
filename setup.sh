#!/bin/bash
# Trading Journal — one-time dev setup helper
set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo ""
echo "🚀 Trading Journal Setup"
echo "========================"

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Run: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
  echo "   Then: source ~/.nvm/nvm.sh && nvm install 20"
  exit 1
fi
echo "✓ Node $(node --version) ready"

# Check .env.local
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "⚠️  Created .env.local — fill in your keys before continuing"
  exit 1
fi

MISSING=""
grep -q "^NEXT_PUBLIC_SUPABASE_URL=https://" .env.local || MISSING="$MISSING NEXT_PUBLIC_SUPABASE_URL"
grep -q "^NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_" .env.local  || MISSING="$MISSING NEXT_PUBLIC_SUPABASE_ANON_KEY"

if [ -n "$MISSING" ]; then
  echo "⚠️  Missing env vars in .env.local:$MISSING"
  echo "   Fill them in and re-run this script."
  exit 1
fi
echo "✓ .env.local configured"

# Install deps
if [ ! -d node_modules ]; then
  echo "📦 Installing packages..."
  npm install
fi
echo "✓ Dependencies installed"

echo ""
echo "✅ Setup complete. Start the dev server with:"
echo "   source ~/.nvm/nvm.sh && npm run dev"
echo ""
echo "Then open http://localhost:3000"
