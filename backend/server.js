const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 5011;
const MAX_PLAYERS = 50;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'SWADHIN MANDAL';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SM@2006';
const adminSessions = new Map();

const GROUP_LINK = process.env.GROUP_LINK || 'https://chat.whatsapp.com/KrQtBtM3oxwE0znHffPVFc?mode=gi_t';

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'tournament',
  port: Number(process.env.DB_PORT) || 3306,
});

db.connect((err) => {
  if (err) {
    console.error("DB ERROR:", err);
    console.log("Please ensure MySQL is running and root user has access to 'tournament' database");
  } else {
    console.log("MySQL Connected Successfully");
    
    // Ensure table exists
    db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        uid VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        transactionId VARCHAR(255) NOT NULL,
        screenshot VARCHAR(255) NOT NULL,
        slotNumber INT DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        notification TEXT
      )
    `, (err) => {
      if (err) {
        console.error("Failed to create table:", err);
      } else {
        console.log("Table 'users' ready");
      }
    });
  }
});

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function buildWhatsAppLink(phone, slotNumber) {
  const safePhone = normalizePhone(phone);
  const message = `Payment Verified. Slot Number ${slotNumber}. Group Link: ${GROUP_LINK}`;
  return `https://wa.me/91${safePhone}?text=${encodeURIComponent(message)}`;
}

function createAdminToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Admin login required.',
    });
  }

  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({
      success: false,
      message: 'Session expired. Please login again.',
    });
  }

  next();
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage: storage });

function getCompletedCount(callback) {
  db.query(
    'SELECT COUNT(*) AS completedUsers FROM users WHERE status = ?',
    ['Completed'],
    (err, results) => {
      if (err) callback(err);
      else callback(null, Number(results[0]?.completedUsers || 0));
    }
  );
}

function getDashboardCounts(callback) {
  db.query(`
    SELECT
      COUNT(*) AS totalUsers,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completedUsers,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pendingUsers,
      SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejectedUsers
    FROM users
  `, [], (err, results) => {
    if (err) callback(err);
    else {
      const stats = results[0] || {};
      callback(null, {
        totalUsers: Number(stats.totalUsers || 0),
        completedUsers: Number(stats.completedUsers || 0),
        pendingUsers: Number(stats.pendingUsers || 0),
        rejectedUsers: Number(stats.rejectedUsers || 0),
      });
    }
  });
}

function getScreenshotPath(file) {
  return `/uploads/${file.filename}`;
}

function removeUploadedFile(file) {
  if (!file?.path) {
    return;
  }

  fs.unlink(file.path, () => {});
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Free Fire Tournament Registration API is running.',
  });
});

app.post("/register", upload.single("screenshot"), (req, res) => {

  console.log("BODY:", req.body);
  console.log("FILE:", req.file);

  const { name, uid, phone, transactionId } = req.body;
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Screenshot is required.' });
  }
  const screenshot = req.file.filename;

  const sql = `
    INSERT INTO users (name, uid, phone, transactionId, screenshot, status)
    VALUES (?, ?, ?, ?, ?, 'Pending')
  `;

  db.query(sql, [name, uid, phone, transactionId, screenshot], (err, result) => {
    if (err) {
      console.error("DB ERROR:", err);
      return res.status(500).json({ success: false });
    }

    console.log("INSERT SUCCESS");
    res.json({ success: true, image: screenshot });
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      message: 'Invalid admin credentials.',
    });
  }

  const token = createAdminToken();
  adminSessions.set(token, {
    username,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    token,
    message: 'Admin login successful.',
  });
});

app.get('/api/users', requireAdminAuth, (req, res) => {
  const sql = `
    SELECT id, name, uid, phone, transactionId, screenshot, slotNumber, status, notification
    FROM users
    ORDER BY id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('DB ERROR:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch users.',
      });
    }

    res.status(200).json({
      success: true,
      users: results,
    });
  });
});

app.post('/api/approve/:id', requireAdminAuth, (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id.',
    });
  }

  db.query('SELECT id, status, slotNumber FROM users WHERE id = ?', [userId], (findErr, foundRows) => {
    if (findErr) {
      console.error('DB ERROR:', findErr);
      return res.status(500).json({ success: false, message: 'Database error.' });
    }

    if (!foundRows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const existingUser = foundRows[0];
    if (existingUser.status === 'Approved' && existingUser.slotNumber) {
      return res.status(200).json({
        success: true,
        message: 'User already approved.',
        slotNumber: existingUser.slotNumber,
        notification: `Payment Verified ✅ | Slot Assigned: ${existingUser.slotNumber}`,
      });
    }

    db.query(
      "SELECT COALESCE(MAX(slotNumber), 0) AS maxSlot FROM users WHERE status = 'Approved'",
      (slotErr, slotRows) => {
        if (slotErr) {
          console.error('DB ERROR:', slotErr);
          return res.status(500).json({ success: false, message: 'Database error.' });
        }

        const slotNumber = Number(slotRows[0]?.maxSlot || 0) + 1;
        const notification = `Payment Verified ✅ | Slot Assigned: ${slotNumber}`;

        db.query(
          'UPDATE users SET status = ?, slotNumber = ?, notification = ? WHERE id = ?',
          ['Approved', slotNumber, notification, userId],
          (updateErr) => {
            if (updateErr) {
              console.error('DB ERROR:', updateErr);
              return res.status(500).json({ success: false, message: 'Database error.' });
            }

            return res.status(200).json({
              success: true,
              message: 'User approved successfully.',
              slotNumber,
              notification,
            });
          }
        );
      }
    );
  });
});

app.post('/api/reject/:id', requireAdminAuth, (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id.',
    });
  }

  const notification = 'Payment Failed ❌';
  db.query(
    'UPDATE users SET status = ?, slotNumber = NULL, notification = ? WHERE id = ?',
    ['Rejected', notification, userId],
    (err, result) => {
      if (err) {
        console.error('DB ERROR:', err);
        return res.status(500).json({ success: false, message: 'Database error.' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      res.status(200).json({
        success: true,
        message: 'User rejected successfully.',
        notification,
      });
    }
  );
});

app.put('/verify/:id', (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id.',
    });
  }

  // First check if user exists
  db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('DB ERROR:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = results[0];
    if (user.status === 'Completed') {
      return res.status(200).json({
        success: true,
        message: 'User is already verified.',
        slotNumber: user.slotNumber,
        whatsappLink: buildWhatsAppLink(user.phone, user.slotNumber || 1),
      });
    }

    // Get completed count
    getCompletedCount((err, completedCount) => {
      if (err) {
        console.error('DB ERROR:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (completedCount >= MAX_PLAYERS) {
        return res.status(409).json({
          success: false,
          message: 'Tournament Full',
        });
      }

      const slotNumber = completedCount + 1;
      const notification = 'Admin Verified Your Payment ✅';

      db.query(
        'UPDATE users SET status = ?, slotNumber = ?, notification = ? WHERE id = ?',
        ['Completed', slotNumber, notification, userId],
        (err, result) => {
          if (err) {
            console.error('DB ERROR:', err);
            return res.status(500).json({ message: 'Database error' });
          }

          res.status(200).json({
            success: true,
            message: 'User verified successfully.',
            userId,
            slotNumber,
            notification,
            whatsappLink: buildWhatsAppLink(user.phone, slotNumber),
          });
        }
      );
    });
  });
});

app.put('/reject/:id', (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id.',
    });
  }

  db.query(
    'UPDATE users SET status = ?, notification = ? WHERE id = ?',
    ['Rejected', 'Payment Rejected ❌', userId],
    (err, result) => {
      if (err) {
        console.error('DB ERROR:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      res.status(200).json({
        success: true,
        message: 'User rejected successfully.',
        userId,
        notification: 'Payment Rejected ❌',
      });
    }
  );
});

app.get('/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error('DB ERROR:', err);
      return res.json([]);
    }

    res.json(results);
  });
});

app.get('/dashboard', (req, res) => {
  getDashboardCounts((err, stats) => {
    if (err) {
      console.error('DB ERROR:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(200).json({
      success: true,
      ...stats,
      remainingSlots: Math.max(MAX_PLAYERS - stats.completedUsers, 0),
    });
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'Screenshot file size must be 2MB or less.',
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err) {
    console.error('Server error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
    });
  }

  next();
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
