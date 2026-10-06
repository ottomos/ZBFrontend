# 📊 Next.js Trading Dashboard with User Management

A secure, offline-capable trading dashboard with SQLite-based user authentication and role-based access control.

## 🚀 Quick Start

### For New Users (One-Time Setup)

1. **Prerequisites**: Install [Node.js](https://nodejs.org/) (version 16 or higher)

2. **Clone or download** this project

3. **Run the setup script**:
   
   **Windows:**
   ```bash
   setup.bat
   ```
   
   **macOS/Linux:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** and go to `http://localhost:3000`

That's it! 🎉

### For Returning Users

Just run:
```bash
npm run dev
```

## 👤 Default Users

The system comes pre-configured with these users:

| Role | Username | Password | Access Level |
|------|----------|----------|-------------|
| Super Admin | `superadmin` | `superadmin123` | Full access + user management |
| Admin | `admin` | `admin123` | Full access + user management |
| User | `trader1` | `password123` | Dashboard access only |
| User | `trader2` | `password123` | Dashboard access only |
| User | `analyst` | `password123` | Dashboard access only |

## 🔐 Security Features

- ✅ **Secure password hashing** with bcrypt
- ✅ **JWT-based authentication** with secure sessions
- ✅ **Role-based access control** (User, Admin, Super Admin)
- ✅ **SQLite database** - no external database required
- ✅ **Offline capable** - works without internet after setup

## 📁 Project Structure

```
├── prisma/                 # Database schema and migrations
├── src/app/
│   ├── api/                # Authentication API routes
│   ├── login/              # Login page
│   └── components/         # Dashboard components
├── lib/                    # Database and auth utilities
├── dev.db                  # SQLite database (auto-created)
└── README.md              # This file
```

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:seed` | Reset database with default users |
| `npm run db:reset` | Full database reset + seed |

## 🔧 Customization

### Adding New Users
1. Log in as `superadmin` or `admin`
2. Navigate to "User List" in the dashboard
3. Add new users through the interface

### Changing Default Passwords
Edit `prisma/seed.ts` and run `npm run db:seed`

### Database Location
The SQLite database is stored as `dev.db` in the project root. This file contains all user data and can be backed up easily.

## 📦 Distribution

This project is designed to be easily shared:

1. **ZIP Distribution**: Download as ZIP from GitHub - just extract and run setup
2. **Offline Operation**: Works completely offline after initial setup
3. **No External Dependencies**: Uses SQLite, no need for PostgreSQL/MySQL
4. **Portable**: Database file can be copied between machines

## 🆘 Troubleshooting

**"Node.js not found"**: Install Node.js from [nodejs.org](https://nodejs.org/)

**"Permission denied on setup.sh"**: Run `chmod +x setup.sh` first

**"Database locked"**: Stop any running `npm run dev` processes

**Reset everything**: Delete `dev.db` and `prisma/migrations/`, then run setup again

## 🤝 Contributing

1. Make your changes
2. Test with `npm run dev`
3. Update this README if needed
4. Share your improvements!

---

**Need help?** Check the troubleshooting section above or ask your team lead!
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
