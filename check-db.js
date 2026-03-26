const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'backend', 'tournament.db');
console.log('DB file:', DB_FILE);
const db = new sqlite3.Database(DB_FILE);

db.all('SELECT * FROM users', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Users in database:');
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});