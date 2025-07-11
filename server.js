require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware for guest users
app.use(session({
  secret: process.env.SESSION_SECRET || 'notepad-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// PostgreSQL pool setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/notepad_db',
  // Add connection retry logic
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Helper: generate JWT
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

// Middleware: authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Helper functions for guest users
function initializeGuestSession(req) {
  if (!req.session.notes) {
    req.session.notes = [];
    req.session.noteIdCounter = 1;
  }
}

function generateGuestNoteId(req) {
  const id = req.session.noteIdCounter || 1;
  req.session.noteIdCounter = id + 1;
  return `guest_${id}`;
}

// Helper function to check if user is authenticated
function isAuthenticated(req) {
  const token = req.cookies.token;
  if (!token) return false;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
}

// Main route - accessible to both guest and authenticated users
app.get('/', async (req, res) => {
  try {
    let notes = [];
    let selectedNote = null;
    let selectedNoteId = null;
    let user = null;
    
    if (isAuthenticated(req)) {
      // User is logged in, get notes from database
      const token = req.cookies.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = decoded;
      
      const notesResult = await pool.query('SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC', [user.id]);
      notes = notesResult.rows;
    } else {
      // Guest user, get notes from session
      initializeGuestSession(req);
      notes = req.session.notes || [];
    }
    
    // Handle note selection
    if (req.query.note) {
      selectedNote = notes.find(n => n.id == req.query.note) || null;
      selectedNoteId = req.query.note;
    } else if (notes.length > 0) {
      selectedNote = notes[0];
      selectedNoteId = notes[0].id;
    }
    
    res.render('notepad', {
      notes,
      selectedNote,
      selectedNoteId,
      title: 'Notepad',
      showAuthSidebar: true,
      user: user,
      isLogin: null,
      error: null
    });
  } catch (err) {
    console.error('Error loading notes:', err);
    res.status(500).send('Failed to load notes');
  }
});

// Register
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashed]
    );
    const user = result.rows[0];
    const token = generateToken(user);
    res.json({ user, token });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken(user);
    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get all notes - works for both authenticated and guest users
app.get('/api/notes', async (req, res) => {
  try {
    if (isAuthenticated(req)) {
      // Authenticated user
      const token = req.cookies.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        'SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
        [decoded.id]
      );
      res.json(result.rows);
    } else {
      // Guest user
      initializeGuestSession(req);
      res.json(req.session.notes || []);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create a new note - works for both authenticated and guest users
app.post('/api/notes', async (req, res) => {
  const { title, content } = req.body;
  try {
    if (isAuthenticated(req)) {
      // Authenticated user
      const token = req.cookies.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
        [decoded.id, title, content]
      );
      res.status(201).json(result.rows[0]);
    } else {
      // Guest user
      initializeGuestSession(req);
      const newNote = {
        id: generateGuestNoteId(req),
        title: title || 'Untitled',
        content: content || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      req.session.notes.unshift(newNote);
      res.status(201).json(newNote);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update a note - works for both authenticated and guest users
app.put('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    if (isAuthenticated(req)) {
      // Authenticated user
      const token = req.cookies.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        'UPDATE notes SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
        [title, content, id, decoded.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
      res.json(result.rows[0]);
    } else {
      // Guest user
      initializeGuestSession(req);
      const noteIndex = req.session.notes.findIndex(note => note.id === id);
      if (noteIndex === -1) return res.status(404).json({ error: 'Note not found' });
      
      req.session.notes[noteIndex] = {
        ...req.session.notes[noteIndex],
        title: title || 'Untitled',
        content: content || '',
        updated_at: new Date().toISOString()
      };
      res.json(req.session.notes[noteIndex]);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete a note - works for both authenticated and guest users
app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isAuthenticated(req)) {
      // Authenticated user
      const token = req.cookies.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, decoded.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
      res.json({ success: true });
    } else {
      // Guest user
      initializeGuestSession(req);
      const noteIndex = req.session.notes.findIndex(note => note.id === id);
      if (noteIndex === -1) return res.status(404).json({ error: 'Note not found' });
      
      req.session.notes.splice(noteIndex, 1);
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Get user status (authenticated or guest) and session info
app.get('/api/user-status', (req, res) => {
  try {
    const authenticated = isAuthenticated(req);
    if (authenticated) {
      const token = req.cookies.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      res.json({
        authenticated: true,
        user: { id: decoded.id, email: decoded.email },
        guestNotes: 0
      });
    } else {
      initializeGuestSession(req);
      res.json({
        authenticated: false,
        user: null,
        guestNotes: req.session.notes ? req.session.notes.length : 0
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user status' });
  }
});

// Render login page
app.get('/login', (req, res) => {
  res.render('auth', { 
    isLogin: true, 
    error: null, 
    title: 'Login',
    showAuthSidebar: true 
  });
});

// Render signup page
app.get('/register', (req, res) => {
  res.render('auth', { 
    isLogin: false, 
    error: null, 
    title: 'Sign Up',
    showAuthSidebar: true 
  });
});

// Function to migrate guest notes to user account
async function migrateGuestNotesToUser(req, userId) {
  try {
    if (!req.session.notes || req.session.notes.length === 0) {
      return { migrated: 0, errors: [] };
    }
    
    let migrated = 0;
    const errors = [];
    
    for (const note of req.session.notes) {
      try {
        // Check for duplicates based on title and content
        const existingNote = await pool.query(
          'SELECT id FROM notes WHERE user_id = $1 AND title = $2 AND content = $3',
          [userId, note.title, note.content]
        );
        
        if (existingNote.rows.length === 0) {
          // No duplicate found, migrate the note
          await pool.query(
            'INSERT INTO notes (user_id, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
            [userId, note.title, note.content, note.created_at || new Date(), note.updated_at || new Date()]
          );
          migrated++;
        }
      } catch (err) {
        console.error('Error migrating note:', err);
        errors.push(err.message);
      }
    }
    
    // Clear session notes after migration
    req.session.notes = [];
    req.session.noteIdCounter = 1;
    
    return { migrated, errors };
  } catch (err) {
    console.error('Error in migration process:', err);
    return { migrated: 0, errors: [err.message] };
  }
}

// Handle login POST (EJS form)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.render('auth', { 
      isLogin: true, 
      error: 'Invalid credentials', 
      title: 'Login',
      showAuthSidebar: true 
    });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.render('auth', { 
      isLogin: true, 
      error: 'Invalid credentials', 
      title: 'Login',
      showAuthSidebar: true 
    });
    
    // Migrate guest notes to user account
    const migrationResult = await migrateGuestNotesToUser(req, user.id);
    console.log(`Migrated ${migrationResult.migrated} notes for user ${user.email}`);
    
    // Set session or JWT cookie (for demo, use a simple cookie)
    res.cookie('token', generateToken(user), { httpOnly: true });
    res.redirect('/');
  } catch (err) {
    res.render('auth', { 
      isLogin: true, 
      error: 'Login failed', 
      title: 'Login',
      showAuthSidebar: true 
    });
  }
});

// Handle signup POST (EJS form)
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashed]
    );
    const user = result.rows[0];
    
    // Migrate guest notes to new user account
    const migrationResult = await migrateGuestNotesToUser(req, user.id);
    console.log(`Migrated ${migrationResult.migrated} notes for new user ${user.email}`);
    
    res.cookie('token', generateToken(user), { httpOnly: true });
    res.redirect('/');
  } catch (err) {
    let error = 'Registration failed';
    if (err.code === '23505') error = 'Email already exists';
    res.render('auth', { 
      isLogin: false, 
      error, 
      title: 'Sign Up',
      showAuthSidebar: true 
    });
  }
});

// Middleware for EJS routes: check JWT in cookie
function requireAuthEJS(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.redirect('/login');
    req.user = user;
    next();
  });
}

// Redirect old notepad route to main route
app.get('/notepad', (req, res) => {
  const noteParam = req.query.note ? `?note=${req.query.note}` : '';
  res.redirect(`/${noteParam}`);
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = { app, pool }; 