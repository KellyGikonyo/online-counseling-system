const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');

// Create tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        role TEXT,
        name TEXT,
        email TEXT,
        active INTEGER DEFAULT 1
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student TEXT,
        counselor TEXT,
        date TEXT,
        time TEXT,
        reason TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromUser TEXT,
        toUser TEXT,
        rating INTEGER,
        comment TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        threadId INTEGER,
        fromUser TEXT,
        toUser TEXT,
        text TEXT,
        time TEXT,
        read INTEGER DEFAULT 0,
        attachments TEXT
    )`);
});

module.exports = db;