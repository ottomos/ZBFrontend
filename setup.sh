#!/bin/bash
# Setup script for the Next.js Dashboard with SQLite authentication

echo "🚀 Setting up Next.js Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup database and seed with initial users
echo "🗄️ Setting up database..."
npm run db:reset

echo "✅ Setup complete!"
echo ""
echo "🎉 Dashboard is ready to use!"
echo ""
echo "👤 Default users created:"
echo "   Super Admin: superadmin / superadmin123"
echo "   Admin:       admin      / admin123"
echo "   Users:       trader1    / password123"
echo "               trader2    / password123"
echo "               analyst    / password123"
echo ""
echo "🌐 Start the development server with:"
echo "   npm run dev"
echo ""
echo "📖 Then open http://localhost:3000 in your browser"
