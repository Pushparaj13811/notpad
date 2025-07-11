# 📝 Memo Notepad

A beautiful, feature-rich notepad application with automatic note migration and seamless user experience. Write notes as a guest or create an account to save them permanently.

![Notepad Screenshot](screenshot.png)

## ✨ Features

### 🔓 **Guest-Friendly Experience**
- **No Registration Required**: Start taking notes immediately
- **Session Storage**: Notes persist during your session
- **Automatic Migration**: Notes transfer to your account when you sign up

### 💾 **Advanced Auto-Save**
- **Real-time Saving**: Auto-saves every second while typing
- **Smart Detection**: Only saves when content actually changes
- **Offline Support**: Saves changes when you come back online
- **Multiple Triggers**: Saves on blur, paste, cut, and window focus loss

### 🎨 **Beautiful UI**
- **Paper-like Design**: Realistic notepad with lines and red margin
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Wood-themed Background**: Warm, inviting aesthetic
- **Clean Typography**: Easy-to-read Georgia serif font

### ⚡ **Enhanced UX**
- **Keyboard Shortcuts**: Ctrl/Cmd+S to save, Ctrl/Cmd+N for new note
- **Visual Feedback**: Save indicators show status in real-time
- **Live Updates**: Note titles update in sidebar as you type
- **Session Management**: Handles authentication and guest states seamlessly

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd notpad
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://localhost/notepad_db
   
   # Application Configuration
   PORT=3000
   NODE_ENV=development
   
   # Security (change these in production!)
   JWT_SECRET=your-super-secret-jwt-key
   SESSION_SECRET=your-session-secret
   ```

4. **Setup the database**
   ```bash
   npm run db:setup
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 🗄️ Database Management

### Setup Commands

```bash
# Create database and tables
npm run db:setup

# Run migrations
npm run db:migrate

# Create a new migration
npm run db:migrate:create

# Reset database (recreate + migrate)
npm run db:reset
```

### Manual Database Setup

If you prefer to set up the database manually:

```sql
-- Create database
CREATE DATABASE notepad_db;

-- Connect to the database and run
\i db.sql
```

## 📱 Usage

### For Guest Users
1. Visit the application
2. Start typing immediately in the notepad
3. Your notes are auto-saved to your session
4. Sign up anytime to keep your notes permanently

### For Registered Users
1. Sign up or login using the right sidebar
2. All your guest notes are automatically transferred
3. Notes are permanently saved to your account
4. Access your notes from any device

### Auto-Save Features
- **Typing**: Auto-saves 1 second after you stop typing
- **Field Blur**: Saves when you click outside title/content areas
- **Copy/Paste**: Immediate save on paste or cut operations
- **Window Blur**: Saves when switching tabs or applications
- **Offline**: Queues changes and saves when connection restored

## 🛠️ Development

### Project Structure
```
notpad/
├── server.js              # Main application server
├── db.sql                 # Database schema
├── package.json           # Dependencies and scripts
├── public/                # Static files
│   ├── css/theme.css      # Styling and responsive design
│   └── js/main.js         # Client-side functionality
├── views/                 # EJS templates
│   ├── layout.ejs         # Main layout with auth sidebar
│   ├── notepad.ejs        # Notepad interface
│   └── auth.ejs           # Authentication pages
├── scripts/               # Database management scripts
│   ├── setup-db.js        # Database creation and setup
│   └── migrate-db.js      # Migration management
└── migrations/            # Database migration files
```

### Available Scripts

```bash
npm start           # Start production server
npm run dev         # Start development server with nodemon
npm run db:setup    # Setup database and run schema
npm run db:migrate  # Run pending migrations
npm run db:reset    # Reset and recreate database
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost/notepad_db` |
| `PORT` | Application port | `3000` |
| `JWT_SECRET` | Secret for JWT tokens | Required |
| `SESSION_SECRET` | Secret for sessions | Required |
| `NODE_ENV` | Environment mode | `development` |

## 🔧 API Endpoints

### Notes API
- `GET /api/notes` - Get all notes (guest or authenticated)
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update existing note
- `DELETE /api/notes/:id` - Delete note

### Authentication API
- `POST /login` - User login
- `POST /register` - User registration
- `GET /logout` - User logout
- `GET /api/user-status` - Get current user status

### Pages
- `GET /` - Main notepad interface
- `GET /login` - Login page
- `GET /register` - Registration page

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Session Management**: Secure session handling for guest users
- **CSRF Protection**: Built-in protection against CSRF attacks
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries
- **Password Hashing**: Bcrypt for secure password storage

## 🚀 Deployment

### Environment Setup
1. Set production environment variables
2. Use HTTPS in production
3. Configure proper database connections
4. Set secure session/JWT secrets

### Production Commands
```bash
# Install production dependencies
npm install --production

# Run database setup
npm run db:setup

# Start application
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
# macOS:
brew services start postgresql

# Ubuntu:
sudo service postgresql start

# Windows:
# Start PostgreSQL service from Services
```

### Common Issues
- **Database doesn't exist**: Run `npm run db:setup`
- **Permission denied**: Check PostgreSQL user permissions
- **Port already in use**: Change PORT in .env file
- **Session not working**: Check SESSION_SECRET in .env

### Getting Help
- Check the console for error messages
- Ensure all environment variables are set
- Verify PostgreSQL is running and accessible
- Run database setup if tables are missing

---

Built with ❤️ using Node.js, Express, PostgreSQL, and vanilla JavaScript. 