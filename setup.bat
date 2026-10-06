@echo off
REM Setup script for the Next.js Dashboard with SQLite authentication (Windows)

echo 🚀 Setting up Next.js Dashboard...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Setup database and seed with initial users
echo 🗄️ Setting up database...
call npm run db:reset

echo ✅ Setup complete!
echo.
echo 🎉 Dashboard is ready to use!
echo.
echo 👤 Default users created:
echo    Super Admin: superadmin / superadmin123
echo    Admin:       admin      / admin123
echo    Users:       trader1    / password123
echo                trader2    / password123
echo                analyst    / password123
echo.
echo 🌐 Start the development server with:
echo    npm run dev
echo.
echo 📖 Then open http://localhost:3000 in your browser
