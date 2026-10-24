PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS employees (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  job TEXT NOT NULL DEFAULT '',
  shift TEXT NOT NULL DEFAULT '',
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE TABLE IF NOT EXISTS overtime_entries (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  job TEXT NOT NULL DEFAULT '',
  shift TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  task TEXT NOT NULL,
  hours REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(code, date, start_time, end_time)
);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON overtime_entries(date);
CREATE INDEX IF NOT EXISTS idx_overtime_code_date ON overtime_entries(code, date);
CREATE INDEX IF NOT EXISTS idx_overtime_department_date ON overtime_entries(department, date);
