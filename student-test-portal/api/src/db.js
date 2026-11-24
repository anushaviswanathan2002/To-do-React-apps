import Database from 'better-sqlite3'

export function openDb(file = process.env.DB_FILE || 'portal.db') {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin','teacher','student')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT 'General',
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 600),
      pass_percent INTEGER NOT NULL DEFAULT 50 CHECK (pass_percent BETWEEN 0 AND 100),
      max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
      shuffle INTEGER NOT NULL DEFAULT 0,
      opens_at TEXT,
      closes_at TEXT,
      published INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('single','multiple','truefalse','short')),
      text TEXT NOT NULL,
      options TEXT NOT NULL DEFAULT '[]',
      correct TEXT NOT NULL DEFAULT '[]',
      points INTEGER NOT NULL DEFAULT 1 CHECK (points >= 1),
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      started_at TEXT NOT NULL,
      deadline TEXT NOT NULL,
      submitted_at TEXT,
      answers TEXT NOT NULL DEFAULT '{}',
      order_json TEXT NOT NULL DEFAULT '[]',
      score INTEGER,
      max_score INTEGER,
      passed INTEGER,
      flags INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS proctor_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_test ON attempts(test_id);
    CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id);
  `)
  return db
}
