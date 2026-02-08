# 📡 Telecom CRM v4.0

CRM σύστημα για Ελληνικούς παρόχους κινητής τηλεφωνίας (Vodafone, Cosmote, Nova).

## ✨ Features

- **6 Ρόλοι**: Admin, Director, Supervisor, BackOffice, Partner, Agent
- **Admin Panel**: Πλήρης διαχείριση χωρίς κώδικα
- **3 Πάροχοι**: Vodafone, Cosmote, Nova
- **Αιτήσεις**: Δημιουργία, επεξεργασία, status tracking
- **Tickets**: Επικοινωνία μεταξύ sales & back office
- **Comments**: Σχόλια με timestamps ανά αίτηση
- **Exports**: PDF, A5 Courier, Excel/CSV
- **Supabase**: Database backend (προαιρετικό)

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/telecom-crm.git
cd telecom-crm
npm install
```

### 2. Run Locally
```bash
npm run dev
```
Ανοίγει στο http://localhost:5173

### 3. Demo Logins
| Username | Password | Ρόλος |
|----------|----------|-------|
| admin | admin123 | Admin |
| director | dir123 | Director |
| spv1 | spv123 | Supervisor |
| bo1 | bo123 | BackOffice |
| partner1 | p123 | Partner |
| agent1 | a123 | Agent |

## ☁️ Deploy στο Netlify

### Μέθοδος 1: Αυτόματο (GitHub)
1. Push τον κώδικα στο GitHub
2. Πήγαινε στο [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Επέλεξε το repo
4. Settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Deploy**

### Μέθοδος 2: Manual
```bash
npm run build
# Upload the 'dist' folder to Netlify
```

## 🗃️ Supabase Setup (Προαιρετικό)

Χωρίς Supabase, το CRM λειτουργεί με demo data στη μνήμη.
Με Supabase, τα δεδομένα αποθηκεύονται μόνιμα.

### Βήμα 1: Δημιουργία Project
1. Πήγαινε στο [supabase.com](https://supabase.com)
2. **New Project** → Επέλεξε region (EU - Frankfurt)
3. Σημείωσε το **password**

### Βήμα 2: Database Schema
1. Πήγαινε **SQL Editor** στο dashboard
2. Κάνε copy-paste ολόκληρο το αρχείο `supabase-schema.sql`
3. Click **Run**

### Βήμα 3: Πάρε τα credentials
1. **Settings** → **API**
2. Αντέγραψε:
   - **Project URL** (π.χ. `https://abc123.supabase.co`)
   - **anon public key**

### Βήμα 4: Σύνδεση
Δημιούργησε αρχείο `.env.local`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_KEY=your_anon_key_here
```

### Βήμα 5: Netlify Environment Variables
Στο Netlify dashboard:
1. **Site settings** → **Environment variables**
2. Πρόσθεσε:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_KEY` = your anon key
3. **Redeploy**

## 📁 Project Structure
```
telecom-crm/
├── index.html          # Entry HTML
├── package.json        # Dependencies
├── vite.config.js      # Vite config
├── netlify.toml        # Netlify config
├── .env.example        # Environment template
├── .gitignore          # Git ignore rules
├── supabase-schema.sql # Database schema
├── README.md           # This file
└── src/
    ├── main.jsx        # React entry point
    └── App.jsx         # Main CRM application
```

## 👑 Admin Panel

Ο Admin έχει πρόσβαση σε:
- **Χρήστες & Partners**: Δημιουργία, παύση, διαγραφή, δικαιώματα καταχώρησης
- **Πεδία Φόρμας**: Προσθήκη/αφαίρεση, τύπος, validation, max χαρακτήρες
- **Dropdown Lists**: Αλλαγή προγραμμάτων, couriers, υπηρεσιών
- **Πελάτες ΑΦΜ**: Βάση δεδομένων, προσθήκη/διαγραφή
- **Αιτήσεις**: Αλλαγή status, διαγραφή
- **Σύστημα**: Παύση συστήματος/χρηστών
- **Supabase**: Οδηγίες σύνδεσης

## 📝 License

Private - All rights reserved
