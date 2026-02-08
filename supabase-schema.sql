-- ══════════════════════════════════════════════
-- TELECOM CRM v4 — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'agent',
  partner TEXT,
  active BOOLEAN DEFAULT true,
  paused BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requests
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  ln TEXT,
  fn TEXT,
  fat TEXT,
  bd TEXT,
  adt TEXT,
  ph TEXT,
  mob TEXT,
  email TEXT,
  afm TEXT,
  doy TEXT,
  tk TEXT,
  addr TEXT,
  city TEXT,
  partner TEXT,
  agent_id TEXT,
  agent_name TEXT,
  svc TEXT,
  prog TEXT,
  lt TEXT,
  nlp TEXT,
  price TEXT,
  status TEXT DEFAULT 'active',
  pend_r TEXT,
  can_r TEXT,
  courier TEXT,
  c_addr TEXT,
  c_city TEXT,
  c_tk TEXT,
  notes TEXT,
  sig TEXT,
  created TEXT,
  activation_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES requests(id) ON DELETE CASCADE,
  user_id TEXT,
  user_name TEXT,
  user_role TEXT,
  text TEXT NOT NULL,
  ts TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  afm TEXT NOT NULL,
  cname TEXT NOT NULL,
  reason TEXT NOT NULL,
  req_id TEXT,
  created_by TEXT,
  by_name TEXT,
  by_role TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket Messages
CREATE TABLE IF NOT EXISTS ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  user_id TEXT,
  user_name TEXT,
  user_role TEXT,
  text TEXT NOT NULL,
  ts TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AFM Database (Customer lookup)
CREATE TABLE IF NOT EXISTS afm_database (
  afm TEXT PRIMARY KEY,
  ln TEXT,
  fn TEXT,
  fat TEXT,
  bd TEXT,
  adt TEXT,
  ph TEXT,
  mob TEXT,
  email TEXT,
  doy TEXT,
  tk TEXT,
  addr TEXT,
  city TEXT
);

-- Custom Form Fields
CREATE TABLE IF NOT EXISTS custom_fields (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',
  max_chars INT DEFAULT 50,
  required BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true
);

-- Dropdown Lists
CREATE TABLE IF NOT EXISTS dropdown_lists (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  items JSONB DEFAULT '[]'
);

-- ══════════════════════════════════════════════
-- Default Data
-- ══════════════════════════════════════════════

-- Admin user (change password after first login!)
INSERT INTO users (id, username, password, name, email, role, can_create) VALUES
  ('U01', 'admin', 'admin123', 'System Admin', 'admin@crm.gr', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- Sample users
INSERT INTO users (id, username, password, name, email, role, partner, can_create) VALUES
  ('U02', 'director', 'dir123', 'Νίκος Director', 'dir@crm.gr', 'director', NULL, false),
  ('U03', 'spv1', 'spv123', 'Μαρία Supervisor', 'spv@crm.gr', 'supervisor', NULL, false),
  ('U04', 'bo1', 'bo123', 'Γιώργος BackOffice', 'bo@crm.gr', 'backoffice', NULL, false),
  ('U05', 'partner1', 'p123', 'Electrigon', 'p@electrigon.gr', 'partner', 'Electrigon', true),
  ('U06', 'agent1', 'a123', 'Πέτρος Agent', 'a1@crm.gr', 'agent', 'Electrigon', true),
  ('U07', 'agent2', 'a123', 'Ελένη Agent', 'a2@crm.gr', 'agent', 'Electrigon', true),
  ('U08', 'agent3', 'a123', 'Δημ. Agent', 'a3@crm.gr', 'agent', 'Partner Alpha', true)
ON CONFLICT (id) DO NOTHING;

-- Sample AFM database
INSERT INTO afm_database (afm, ln, fn, fat, bd, adt, ph, mob, email, doy, tk, addr, city) VALUES
  ('123456789', 'Παπαδόπουλος', 'Γιώργος', 'Κων/νος', '1985-03-15', 'ΑΚ123456', '2101234567', '6971234567', 'gp@email.gr', 'Α'' Αθηνών', '10564', 'Σταδίου 25', 'Αθήνα'),
  ('987654321', 'Κωνσταντίνου', 'Μαρία', 'Δημήτριος', '1990-07-22', 'ΑΒ654321', '2310567890', '6945678901', 'mk@email.gr', 'Β'' Θεσ/νίκης', '54624', 'Τσιμισκή 100', 'Θεσ/νίκη'),
  ('456789123', 'Αλεξίου', 'Δημήτρης', 'Αλέξανδρος', '1988-11-03', 'ΑΕ789123', '2610234567', '6932345678', 'da@email.gr', 'Α'' Πάτρας', '26221', 'Κορίνθου 50', 'Πάτρα')
ON CONFLICT (afm) DO NOTHING;

-- Default dropdown lists
INSERT INTO dropdown_lists (name, items) VALUES
  ('Vodafone Mobile', '["Red 1","Red 2","Red 3","Unlimited","CU","CU Max"]'),
  ('Cosmote Mobile', '["Unlimited 3GB","Unlimited 7GB","Unlimited 15GB","Unlimited MAX"]'),
  ('Nova Mobile', '["Mobile 3GB","Mobile 7GB","Mobile Unlimited"]'),
  ('Couriers', '["ACS","Speedex","ΕΛΤΑ Courier","DHL","Γενική Ταχ."]'),
  ('Υπηρεσίες', '["Νέα Σύνδεση","Φορητότητα","Ανανέωση","Win Back"]');

-- Enable Row Level Security (optional - for production)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
