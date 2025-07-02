const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const http = require('http');
const socketio = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const server = http.createServer(app);
const io = socketio(server);
const SALT_ROUNDS = 10;
const JWT_SECRET = 'your_secret_key'; // Use a strong secret in production

app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- In-memory data ---
let users = [
    { username: "admin", password: "admin123", role: "admin", name: "Admin", email: "admin@site.com", active: true },
];
let messages = []; // {threadId, from, to, text, time, read, attachments}
let threads = [];  // {id, name, users: [student, counselor]}

// Hash admin password if not already hashed in DB
(async () => {
    const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
    db.run(
      `INSERT OR IGNORE INTO users (username, password, role, name, email, active) VALUES ('admin', ?, 'admin', 'Admin', 'admin@site.com', 1)`,
      [adminPassword]
    );
})();

// --- Registration ---
app.post('/register', async (req, res) => {
    const { username, password, role, name, email } = req.body;
    if (!username || !password || !role || !name || !email) {
        return res.json({ success: false, message: "All fields are required." });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    db.run(
        `INSERT INTO users (username, password, role, name, email, active) VALUES (?, ?, ?, ?, ?, 1)`,
        [username, hashedPassword, role, name, email],
        function(err) {
            if (err) return res.json({ success: false, message: "Username or email already exists." });
            res.json({ success: true });
        }
    );
});

// --- Login ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(
        `SELECT * FROM users WHERE username = ? AND active = 1`,
        [username],
        async (err, user) => {
            if (err || !user) return res.json({ success: false, message: "Invalid credentials." });
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.json({ success: false, message: "Invalid credentials." });
            // Remove password before sending user info
            delete user.password;
            // Create JWT
            const token = jwt.sign(
                { username: user.username, role: user.role, name: user.name },
                JWT_SECRET,
                { expiresIn: '2h' }
            );
            res.json({ success: true, token, ...user });
        }
    );
});

// --- Counselors & Students List ---
app.get('/counselors', (req, res) => {
    db.all(
        `SELECT * FROM users WHERE role = 'counselor' AND active = 1`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error" });
            res.json(rows);
        }
    );
});
app.get('/students', authenticateToken, (req, res) => {
    // Only allow if admin
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    db.all(
        "SELECT * FROM users WHERE role = 'student' AND active = 1",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error" });
            res.json(rows);
        }
    );
});

// --- Assigned Students by Counselor ---
app.get('/assigned-students/:counselor', (req, res) => {
    const counselor = req.params.counselor;
    db.all(
        `SELECT * FROM users WHERE role = 'student' AND username IN (
            SELECT student FROM sessions WHERE counselor = ?
        )`,
        [counselor],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error." });
            res.json(rows);
        }
    );
});

// --- Counselor Profile ---
app.get('/counselor-profile', (req, res) => {
    const { username } = req.query;
    const counselor = users.find(u => u.username === username && u.role === "counselor");
    if (!counselor) return res.status(404).json({ message: "Counselor not found" });
    res.json(counselor);
});
app.post('/counselor-profile', (req, res) => {
    const { username, name, email, bio } = req.body;
    const counselor = users.find(u => u.username === username && u.role === "counselor");
    if (!counselor) return res.status(404).json({ message: "Counselor not found" });
    counselor.name = name;
    counselor.email = email;
    counselor.bio = bio;
    res.json({ success: true });
});
app.post('/counselor-leave', (req, res) => {
    const { username } = req.body;
    const counselor = users.find(u => u.username === username && u.role === "counselor");
    if (!counselor) return res.status(404).json({ message: "Counselor not found" });
    counselor.active = false;
    res.json({ success: true });
});

// --- Remove (deactivate) users (admin) ---
app.post('/remove-counselor', (req, res) => {
    const { username } = req.body;
    const counselor = users.find(u => u.username === username && u.role === "counselor");
    if (!counselor) return res.status(404).json({ message: "Counselor not found" });
    counselor.active = false;
    res.json({ success: true });
});
app.post('/remove-student', (req, res) => {
    const { username } = req.body;
    const student = users.find(u => u.username === username && u.role === "student");
    if (!student) return res.status(404).json({ message: "Student not found" });
    student.active = false;
    res.json({ success: true });
});

// --- Session Booking ---
app.post('/book-session', (req, res) => {
    const { student, counselor, date, time, reason } = req.body;
    if (!student || !counselor || !date || !time) {
        return res.json({ success: false, message: "All fields except reason are required." });
    }
    db.run(
        `INSERT INTO sessions (student, counselor, date, time, reason) VALUES (?, ?, ?, ?, ?)`,
        [student, counselor, date, time, reason],
        function(err) {
            if (err) return res.json({ success: false, message: "Database error." });
            res.json({ success: true });
        }
    );
});
app.get('/sessions', (req, res) => {
    const { student, counselor } = req.query;
    let query = "SELECT * FROM sessions WHERE 1=1";
    let params = [];
    if (student) {
        query += " AND student = ?";
        params.push(student);
    }
    if (counselor) {
        query += " AND counselor = ?";
        params.push(counselor);
    }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json(rows);
    });
});

// --- Feedback ---
app.post('/feedback', (req, res) => {
    const { fromUser, toUser, rating, comment } = req.body;
    if (!fromUser || !toUser || !rating || !comment) {
        return res.status(400).json({ success: false, message: "All fields required." });
    }
    db.run(
        `INSERT INTO feedback (fromUser, toUser, rating, comment) VALUES (?, ?, ?, ?)`,
        [fromUser, toUser, rating, comment],
        function(err) {
            if (err) return res.status(500).json({ success: false, message: "Database error." });
            res.json({ success: true });
        }
    );
});
app.get('/feedback', (req, res) => {
    db.all(
        `SELECT * FROM feedback`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error." });
            res.json(rows);
        }
    );
});

// --- Chat/Inbox (basic, in-memory) ---
app.get('/threads', (req, res) => {
    const username = req.query.user;
    res.json(threads.filter(t => t.users.includes(username)));
});
app.get('/messages/:threadId', (req, res) => {
    const threadId = Number(req.params.threadId);
    res.json(messages.filter(m => m.threadId === threadId));
});
app.post('/messages', (req, res) => {
    const { threadId, from, to, text, time, attachments } = req.body;
    messages.push({ threadId, from, to, text, time, read: false, attachments });
    res.json({ success: true });
});
app.post('/messages/read', (req, res) => {
    const { threadId, user } = req.body;
    messages.forEach(m => {
        if (m.threadId === threadId && m.to === user) m.read = true;
    });
    res.json({ success: true });
});
app.post('/send-message', (req, res) => {
    const { fromUser, toUser, text } = req.body;
    if (!fromUser || !toUser || !text) {
        return res.status(400).json({ success: false, message: "Missing fields." });
    }
    const time = new Date().toISOString();
    db.run(
        `INSERT INTO messages (fromUser, toUser, text, time) VALUES (?, ?, ?, ?)`,
        [fromUser, toUser, text, time],
        function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: "Database error." });
            }
            res.json({ success: true });
        }
    );
});
app.get('/inbox/:username', (req, res) => {
    const username = req.params.username;
    db.all(
        `SELECT * FROM messages WHERE toUser = ? ORDER BY time DESC`,
        [username],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error." });
            res.json(rows);
        }
    );
});
app.get('/messages/:username', (req, res) => {
    const username = req.params.username;
    db.all(
        `SELECT * FROM messages WHERE fromUser = ? OR toUser = ? ORDER BY time DESC`,
        [username, username],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error." });
            res.json(rows);
        }
    );
});

// --- Contact Support ---
app.post('/contact-support', (req, res) => {
    const { type, email, message, user } = req.body;
    if (!type || !email || !message) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }
    const time = new Date().toISOString();
    db.run(
        `CREATE TABLE IF NOT EXISTS support_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            email TEXT,
            message TEXT,
            user TEXT,
            time TEXT
        )`
    );
    db.run(
        `INSERT INTO support_requests (type, email, message, user, time) VALUES (?, ?, ?, ?, ?)`,
        [type, email, message, user, time],
        function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: "Database error." });
            }
            res.json({ success: true });
        }
    );
});
app.get('/support-requests', (req, res) => {
    db.all(
        `SELECT * FROM support_requests ORDER BY time DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error." });
            res.json(rows);
        }
    );
});

// --- Fallback: redirect / to index.html ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- Socket.IO ---
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('sendMessage', (msg) => {
        // Save to DB
        const { fromUser, toUser, text } = msg;
        const time = new Date().toISOString();
        db.run(
            `INSERT INTO messages (fromUser, toUser, text, time) VALUES (?, ?, ?, ?)`,
            [fromUser, toUser, text, time],
            function(err) {
                if (err) {
                    console.error('Socket.IO DB error:', err);
                    socket.emit('errorMessage', { message: "Database error." });
                    return;
                }
                // Broadcast to recipient (and others)
                socket.broadcast.emit('newMessage', {
                    ...msg,
                    time
                });
            }
        );
    });

    socket.on('typing', (data) => {
        socket.broadcast.emit('showTyping', data);
    });

    socket.on('stopTyping', (data) => {
        socket.broadcast.emit('hideTyping', data);
    });

    socket.on('markRead', (data) => {
        socket.broadcast.emit('messagesRead', data);
    });

    socket.on('join', (data) => {
        // Optionally handle room joining for private chats
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// --- Token Authentication Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "No token provided." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token." });
        req.user = user;
        next();
    });
}

// --- Start server ---
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

function loadStudents() {
    fetch(`http://localhost:3000/assigned-students/${counselor}`)
        .then(res => res.json())
        .then(students => {
            const list = document.getElementById('studentsList');
            if (!students.length) {
                list.innerHTML = "<li>No students assigned yet.</li>";
                return;
            }
            list.innerHTML = students.map(s =>
                `<li>${s.name || s.username} (${s.username})</li>`
            ).join('');
        }); // <--- Make sure this parenthesis is here!
}

// Sessions logic
function loadCounselorSessions() {
    fetch(`http://localhost:3000/sessions?counselor=${encodeURIComponent(counselor)}`)
        .then(res => res.json())
        .then(data => {
            const sessionsList = document.getElementById('counselorSessionsList');
            if (!data.length) {
                sessionsList.innerHTML = "<li>No sessions found.</li>";
                return;
            }
            sessionsList.innerHTML = data.map(s =>
                `<li>${s.date} - ${s.time}: ${s.topic || s.reason || ''} with ${s.student}</li>`
            ).join('');
        });
}