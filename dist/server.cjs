var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/db.ts
var import_sql = __toESM(require("sql.js"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var dbInstance = null;
var DB_FILE = import_path.default.join(process.cwd(), "data", "app.sqlite");
async function getDb() {
  if (dbInstance) return dbInstance;
  const SQL = await (0, import_sql.default)();
  const dir = import_path.default.dirname(DB_FILE);
  if (!import_fs.default.existsSync(dir)) {
    import_fs.default.mkdirSync(dir, { recursive: true });
  }
  if (import_fs.default.existsSync(DB_FILE)) {
    try {
      const fileBuffer = import_fs.default.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn("Could not load existing db file, creating fresh:", e);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }
  initializeTables(dbInstance);
  saveDb(dbInstance);
  return dbInstance;
}
function saveDb(db) {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = import_path.default.dirname(DB_FILE);
    if (!import_fs.default.existsSync(dir)) {
      import_fs.default.mkdirSync(dir, { recursive: true });
    }
    import_fs.default.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error("Error saving database to file:", err);
  }
}
function initializeTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('doctor', 'patient')),
      specialization TEXT,
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      generic_name TEXT,
      category TEXT,
      dosage_form TEXT,
      default_dosage TEXT,
      side_effects TEXT,
      precautions TEXT
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      prescription_number TEXT UNIQUE NOT NULL,
      doctor_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      notes TEXT,
      valid_until TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY(doctor_id) REFERENCES users(id),
      FOREIGN KEY(patient_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS prescription_items (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration TEXT NOT NULL,
      timing TEXT NOT NULL,
      instructions TEXT,
      FOREIGN KEY(prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      prescription_item_id TEXT,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      reminder_time TEXT NOT NULL,
      slot TEXT NOT NULL,
      instructions TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS medicine_logs (
      id TEXT PRIMARY KEY,
      reminder_id TEXT,
      patient_id TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      taken_at TEXT,
      status TEXT NOT NULL, -- 'taken', 'missed', 'snoozed'
      notes TEXT,
      date TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS refill_schedules (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      prescription_id TEXT,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      current_quantity INTEGER NOT NULL DEFAULT 30,
      remaining_quantity INTEGER NOT NULL DEFAULT 10,
      refills_allowed INTEGER NOT NULL DEFAULT 2,
      refills_completed INTEGER NOT NULL DEFAULT 0,
      scheduled_refill_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'requested', 'approved', 'dispensed', 'rejected'
      pharmacy_name TEXT DEFAULT 'Apollo Health Pharmacy',
      doctor_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id),
      FOREIGN KEY(prescription_id) REFERENCES prescriptions(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'refill_due', 'low_stock', 'missed_dose', 'upcoming_dose', 'rx_expiry', 'refill_approved', 'refill_requested'
      severity TEXT NOT NULL, -- 'urgent', 'warning', 'info'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_entity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS caregivers (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      alternate_phone TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      notify_on_reminder INTEGER NOT NULL DEFAULT 1,
      notify_on_missed INTEGER NOT NULL DEFAULT 1,
      notify_on_low_stock INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      caregiver_id TEXT,
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      message TEXT NOT NULL,
      alert_type TEXT NOT NULL, -- 'dose_reminder', 'missed_dose', 'low_stock_warning', 'refill_alert', 'manual_test', 'doctor_note'
      status TEXT NOT NULL DEFAULT 'delivered', -- 'delivered', 'sent', 'failed'
      carrier_status TEXT DEFAULT 'Carrier ACK: SMS Delivered (HTTP 200 OK)',
      created_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id)
    );
  `);
  const userCheck = db.exec("SELECT COUNT(*) as count FROM users;");
  const count = userCheck[0]?.values[0]?.[0];
  if (!count || count === 0) {
    seedDatabase(db);
    seedRefillsAndAlerts(db);
    seedCaregiversAndSms(db);
  } else {
    const refillCheck = db.exec("SELECT COUNT(*) as count FROM refill_schedules;");
    const refillCount = refillCheck[0]?.values[0]?.[0];
    if (!refillCount || refillCount === 0) {
      seedRefillsAndAlerts(db);
    }
    const caregiverCheck = db.exec("SELECT COUNT(*) as count FROM caregivers;");
    const caregiverCount = caregiverCheck[0]?.values[0]?.[0];
    if (!caregiverCount || caregiverCount === 0) {
      seedCaregiversAndSms(db);
    }
  }
}
function seedCaregiversAndSms(db) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const earlierToday = new Date(Date.now() - 4 * 60 * 60 * 1e3).toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
  db.run(`
    INSERT INTO caregivers (id, patient_id, name, relationship, alternate_phone, is_active, notify_on_reminder, notify_on_missed, notify_on_low_stock, created_at, updated_at)
    VALUES
    ('cg-1', 'pat-1', 'Ramesh Balineni', 'Father / Family Caregiver', '+91 94401 88990', 1, 1, 1, 1, '${now}', '${now}'),
    ('cg-2', 'pat-2', 'Venkatesh G', 'Brother / Sibling', '+91 99887 66554', 1, 1, 1, 1, '${now}', '${now}'),
    ('cg-3', 'pat-3', 'Sharada V', 'Mother / Guardian', '+91 98223 11223', 1, 1, 1, 0, '${now}', '${now}');
  `);
  db.run(`
    INSERT INTO sms_logs (id, patient_id, caregiver_id, recipient_name, recipient_phone, message, alert_type, status, carrier_status, created_at)
    VALUES
    ('sms-1', 'pat-1', 'cg-1', 'Ramesh Balineni', '+91 94401 88990', '[RxCare ALERT] Dose Reminder: Likhitha B has scheduled dose of Amoxicillin 500mg at 08:30 today (After breakfast). Please ensure timely adherence.', 'dose_reminder', 'delivered', 'Carrier ACK: Airtel-SMS Gateway Delivered (HTTP 200 OK)', '${yesterday}'),
    ('sms-2', 'pat-1', 'cg-1', 'Ramesh Balineni', '+91 94401 88990', '[RxCare NOTICE] Supply Alert: Likhitha B has only 4 capsules of Amoxicillin 500mg remaining. Refill request sent to Dr. Rajesh.', 'low_stock_warning', 'delivered', 'Carrier ACK: Jio-Telecom Delivered (HTTP 200 OK)', '${earlierToday}');
  `);
}
function seedRefillsAndAlerts(db) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const today = /* @__PURE__ */ new Date();
  const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
  db.run(`
    INSERT INTO refill_schedules (id, patient_id, prescription_id, medicine_name, dosage, current_quantity, remaining_quantity, refills_allowed, refills_completed, scheduled_refill_date, status, pharmacy_name, doctor_id, notes, created_at, updated_at)
    VALUES
    ('ref-1', 'pat-1', 'rx-1001', 'Amoxicillin 500mg', '1 Capsule (500mg)', 20, 4, 2, 0, '${in3Days}', 'requested', 'Apollo Pharmacy - Main Branch', 'doc-1', 'Patient requested early refill due to 5-day antibiotic course completion schedule', '${now}', '${now}'),
    ('ref-2', 'pat-1', 'rx-1001', 'Pantoprazole 40mg', '1 Tablet (40mg)', 30, 8, 3, 1, '${in7Days}', 'scheduled', 'Apollo Pharmacy - Main Branch', 'doc-1', 'Scheduled auto-refill for gastric acid management', '${now}', '${now}'),
    ('ref-3', 'pat-2', NULL, 'Metformin 500mg', '1 Tablet (500mg)', 60, 15, 4, 1, '${in7Days}', 'approved', 'MedPlus Healthcare Pharmacy', 'doc-1', 'Routine diabetic maintenance refill authorized by Dr. Rajesh', '${now}', '${now}');
  `);
  db.run(`
    INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
    VALUES
    ('alt-1', 'pat-1', 'low_stock', 'urgent', 'Critical Low Stock Alert', 'Only 4 capsules of Amoxicillin 500mg remaining. Refill has been requested with Dr. Rajesh.', 'ref-1', 0, '${now}'),
    ('alt-2', 'pat-1', 'refill_due', 'warning', 'Scheduled Refill Approaching', 'Pantoprazole 40mg refill is scheduled for ${in7Days}. Confirm pickup pharmacy.', 'ref-2', 0, '${now}'),
    ('alt-3', 'pat-1', 'upcoming_dose', 'info', 'Next Dose Alert', 'Amoxicillin 500mg dose scheduled at 20:30. Take after dinner with water.', 'rem-3', 0, '${now}'),
    ('alt-4', 'doc-1', 'refill_requested', 'warning', 'New Refill Request Pending', 'Patient Likhitha B requested a refill authorization for Amoxicillin 500mg (4 doses remaining).', 'ref-1', 0, '${now}');
  `);
}
function seedDatabase(db) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.run(`
    INSERT INTO users (id, name, email, password, role, specialization, phone, created_at)
    VALUES 
    ('doc-1', 'Dr. Rajesh Sharma, MD', 'dr.rajesh@health.org', 'doctor123', 'doctor', 'General Physician & Diabetologist', '+91 98450 12345', '${now}'),
    ('doc-2', 'Dr. Priya Patel, MBBS, MD', 'dr.priya@cardio.org', 'doctor123', 'doctor', 'Cardiologist & Internal Medicine', '+91 98450 67890', '${now}');
  `);
  db.run(`
    INSERT INTO users (id, name, email, password, role, specialization, phone, created_at)
    VALUES 
    ('pat-1', 'Likhitha B', 'likhitha@gmail.com', 'patient123', 'patient', NULL, '+91 78159 26816', '${now}'),
    ('pat-2', 'Keerthana G', 'keerthana@gmail.com', 'patient123', 'patient', NULL, '+91 94401 22334', '${now}'),
    ('pat-3', 'Chinmayi Seshna V', 'chinmayi@gmail.com', 'patient123', 'patient', NULL, '+91 91234 55678', '${now}');
  `);
  db.run(`
    INSERT INTO medicines (id, name, generic_name, category, dosage_form, default_dosage, side_effects, precautions)
    VALUES
    ('med-1', 'Amoxicillin 500mg', 'Amoxicillin Trihydrate', 'Antibiotic', 'Capsule', '500mg', 'Mild nausea, rash', 'Complete full course even if feeling better. Take with or after food.'),
    ('med-2', 'Metformin 500mg', 'Metformin Hydrochloride', 'Antidiabetic', 'Tablet', '500mg', 'Stomach upset, metallic taste', 'Take with meals to reduce gastrointestinal irritation.'),
    ('med-3', 'Paracetamol 650mg', 'Acetaminophen', 'Analgesic & Antipyretic', 'Tablet', '650mg', 'Rare if taken as directed', 'Do not exceed 3000mg per day. Avoid with alcohol.'),
    ('med-4', 'Pantoprazole 40mg', 'Pantoprazole Sodium', 'Proton Pump Inhibitor (Antacid)', 'Tablet', '40mg', 'Headache, flatulence', 'Take 30 minutes before breakfast in the morning on empty stomach.'),
    ('med-5', 'Cetirizine 10mg', 'Cetirizine Dihydrochloride', 'Antihistamine', 'Tablet', '10mg', 'Mild drowsiness', 'Take at bedtime. Avoid driving if feeling sleepy.'),
    ('med-6', 'Atorvastatin 20mg', 'Atorvastatin Calcium', 'Lipid-lowering / Statin', 'Tablet', '20mg', 'Muscle aches, fatigue', 'Take at night after dinner for maximum cholesterol synthesis inhibition.'),
    ('med-7', 'Azithromycin 500mg', 'Azithromycin Dihydrate', 'Macrolide Antibiotic', 'Tablet', '500mg', 'Abdominal cramp, diarrhea', 'Take 1 hour before or 2 hours after meals with full glass of water.');
  `);
  const rxId = "rx-1001";
  const rxNum = "RX-2026-0891";
  const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
  db.run(`
    INSERT INTO prescriptions (id, prescription_number, doctor_id, patient_id, diagnosis, notes, valid_until, status, created_at)
    VALUES ('${rxId}', '${rxNum}', 'doc-1', 'pat-1', 'Acute Pharyngitis with Mild Gastritis', 'Stay hydrated, warm salt water gargle 3 times daily, avoid spicy oily food.', '${validUntil}', 'active', '${now}');
  `);
  db.run(`
    INSERT INTO prescription_items (id, prescription_id, medicine_name, dosage, frequency, duration, timing, instructions)
    VALUES
    ('item-1', '${rxId}', 'Amoxicillin 500mg', '1 Capsule (500mg)', 'Twice Daily (1-0-1)', '5 Days', 'After Meals', 'Take morning at 8:00 AM and night at 8:00 PM with water.'),
    ('item-2', '${rxId}', 'Pantoprazole 40mg', '1 Tablet (40mg)', 'Once Daily (1-0-0)', '7 Days', 'Before Breakfast', 'Take early morning on empty stomach with warm water.'),
    ('item-3', '${rxId}', 'Paracetamol 650mg', '1 Tablet (650mg)', 'As Needed (SOS) max 3 times', '3 Days', 'After Food', 'Take only if fever > 100\xB0F or severe throat pain.');
  `);
  db.run(`
    INSERT INTO reminders (id, patient_id, prescription_item_id, medicine_name, dosage, reminder_time, slot, instructions, is_active, created_at)
    VALUES
    ('rem-1', 'pat-1', 'item-2', 'Pantoprazole 40mg', '1 Tablet', '07:30', 'Morning', 'Take 30 mins before breakfast on empty stomach', 1, '${now}'),
    ('rem-2', 'pat-1', 'item-1', 'Amoxicillin 500mg', '1 Capsule', '08:30', 'Morning', 'Take after breakfast with water', 1, '${now}'),
    ('rem-3', 'pat-1', 'item-1', 'Amoxicillin 500mg', '1 Capsule', '20:30', 'Night', 'Take after dinner with water', 1, '${now}'),
    ('rem-4', 'pat-1', 'item-3', 'Paracetamol 650mg', '1 Tablet', '14:00', 'Afternoon', 'Take after lunch if fever persists', 1, '${now}');
  `);
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  db.run(`
    INSERT INTO medicine_logs (id, reminder_id, patient_id, medicine_name, dosage, scheduled_time, taken_at, status, notes, date)
    VALUES
    ('log-1', 'rem-1', 'pat-1', 'Pantoprazole 40mg', '1 Tablet', '07:30', '${todayStr}T07:32:00.000Z', 'taken', 'Taken on time before tea', '${todayStr}'),
    ('log-2', 'rem-2', 'pat-1', 'Amoxicillin 500mg', '1 Capsule', '08:30', '${todayStr}T08:35:00.000Z', 'taken', 'Taken after breakfast', '${todayStr}');
  `);
}
function querySql(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  const db = await getDb();
  console.log("SQL Database initialized successfully.");
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const users = querySql(
        db,
        "SELECT id, name, email, role, specialization, phone, created_at, password FROM users WHERE LOWER(email) = LOWER(?)",
        [email.trim()]
      );
      if (users.length === 0) {
        return res.status(401).json({
          error: "Invalid email or user not found. Use one of the demo credentials below or register a new account."
        });
      }
      const user = users[0];
      if (user.password !== password) {
        return res.status(401).json({
          error: "Incorrect password. Please verify your credentials."
        });
      }
      const { password: _, ...sanitizedUser } = user;
      return res.json({
        success: true,
        message: "Login successful",
        token: `token_${user.id}_${Date.now()}`,
        user: sanitizedUser
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.post("/api/auth/register", (req, res) => {
    try {
      const { name, email, password, role, specialization, phone } = req.body;
      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: "Name, email, password, and role are required" });
      }
      const existing = querySql(
        db,
        "SELECT id FROM users WHERE LOWER(email) = LOWER(?)",
        [email.trim()]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      const id = `${role === "doctor" ? "doc" : "pat"}-${Date.now()}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.run(
        `INSERT INTO users (id, name, email, password, role, specialization, phone, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name.trim(), email.trim().toLowerCase(), password, role, specialization || null, phone || null, now]
      );
      saveDb(db);
      return res.status(201).json({
        success: true,
        message: "Registration successful. You can now log in.",
        user: { id, name, email, role, specialization, phone, created_at: now }
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/auth/users", (req, res) => {
    try {
      const users = querySql(
        db,
        "SELECT id, name, email, role, specialization, phone, created_at FROM users ORDER BY role, name"
      );
      return res.json({ users });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/patients", (req, res) => {
    try {
      const patients = querySql(
        db,
        `SELECT u.id, u.name, u.email, u.phone, u.created_at,
          cg.name as caregiver_name,
          cg.relationship as caregiver_relationship,
          cg.alternate_phone as caregiver_alternate_phone,
          cg.notify_on_reminder,
          cg.notify_on_missed,
          cg.notify_on_low_stock,
          (SELECT COUNT(*) FROM prescriptions WHERE patient_id = u.id) as prescription_count,
          (SELECT COUNT(*) FROM reminders WHERE patient_id = u.id AND is_active = 1) as active_reminders_count
         FROM users u
         LEFT JOIN caregivers cg ON cg.patient_id = u.id AND cg.is_active = 1
         WHERE u.role = 'patient'
         ORDER BY u.name`
      );
      return res.json({ patients });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/medicines", (req, res) => {
    try {
      const query = (req.query.q || "").trim().toLowerCase();
      let medicines;
      if (query) {
        medicines = querySql(
          db,
          `SELECT * FROM medicines 
           WHERE LOWER(name) LIKE ? OR LOWER(generic_name) LIKE ? OR LOWER(category) LIKE ?
           ORDER BY name`,
          [`%${query}%`, `%${query}%`, `%${query}%`]
        );
      } else {
        medicines = querySql(db, "SELECT * FROM medicines ORDER BY name");
      }
      return res.json({ medicines });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/prescriptions", (req, res) => {
    try {
      const { doctor_id, patient_id, diagnosis, notes, valid_until, items } = req.body;
      if (!doctor_id || !patient_id || !diagnosis || !items || !items.length) {
        return res.status(400).json({ error: "Doctor, patient, diagnosis, and at least one medicine item are required" });
      }
      const rxId = `rx-${Date.now()}`;
      const rxNumber = `RX-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const expiry = valid_until || new Date(Date.now() + 14 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
      db.run(
        `INSERT INTO prescriptions (id, prescription_number, doctor_id, patient_id, diagnosis, notes, valid_until, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [rxId, rxNumber, doctor_id, patient_id, diagnosis, notes || "", expiry, now]
      );
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemId = `item-${Date.now()}-${i}`;
        db.run(
          `INSERT INTO prescription_items (id, prescription_id, medicine_name, dosage, frequency, duration, timing, instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            rxId,
            item.medicine_name,
            item.dosage || "1 dose",
            item.frequency || "Once Daily",
            item.duration || "5 Days",
            item.timing || "After Meals",
            item.instructions || ""
          ]
        );
        const freqLower = (item.frequency || "").toLowerCase();
        const slotsToCreate = [];
        if (freqLower.includes("twice") || freqLower.includes("1-0-1") || freqLower.includes("bid")) {
          slotsToCreate.push({ slot: "Morning", time: "08:30" });
          slotsToCreate.push({ slot: "Night", time: "20:30" });
        } else if (freqLower.includes("three") || freqLower.includes("1-1-1") || freqLower.includes("tid")) {
          slotsToCreate.push({ slot: "Morning", time: "08:30" });
          slotsToCreate.push({ slot: "Afternoon", time: "13:30" });
          slotsToCreate.push({ slot: "Night", time: "20:30" });
        } else if (freqLower.includes("night") || freqLower.includes("bedtime") || freqLower.includes("0-0-1")) {
          slotsToCreate.push({ slot: "Night", time: "21:00" });
        } else {
          slotsToCreate.push({ slot: "Morning", time: "08:30" });
        }
        for (const slotInfo of slotsToCreate) {
          const remId = `rem-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
          db.run(
            `INSERT INTO reminders (id, patient_id, prescription_item_id, medicine_name, dosage, reminder_time, slot, instructions, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [
              remId,
              patient_id,
              itemId,
              item.medicine_name,
              item.dosage || "1 dose",
              slotInfo.time,
              slotInfo.slot,
              `${item.timing || "As directed"} - ${item.instructions || ""}`.trim(),
              now
            ]
          );
        }
        const refillId = `ref-${Date.now()}-${i}`;
        const defaultQty = 20;
        const refillDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
        const refillsAllowed = item.refills_allowed !== void 0 ? Number(item.refills_allowed) : 2;
        db.run(
          `INSERT INTO refill_schedules (id, patient_id, prescription_id, medicine_name, dosage, current_quantity, remaining_quantity, refills_allowed, refills_completed, scheduled_refill_date, status, pharmacy_name, doctor_id, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'scheduled', 'Apollo Health Pharmacy', ?, ?, ?, ?)`,
          [
            refillId,
            patient_id,
            rxId,
            item.medicine_name,
            item.dosage || "1 dose",
            defaultQty,
            defaultQty,
            refillsAllowed,
            refillDate,
            doctor_id,
            `Course: ${item.duration || "5 Days"} (${item.frequency || "Daily"})`,
            now,
            now
          ]
        );
      }
      const alertId = `alt-rx-${Date.now()}`;
      db.run(
        `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
         VALUES (?, ?, 'info', 'info', 'New E-Prescription Issued', ?, ?, 0, ?)`,
        [
          alertId,
          patient_id,
          `Dr. issued prescription #${rxNumber} for ${diagnosis}. Daily reminders and refill schedules are active.`,
          rxId,
          now
        ]
      );
      saveDb(db);
      return res.status(201).json({
        success: true,
        message: "E-Prescription created, reminders and refill tracking scheduled successfully",
        prescription_id: rxId,
        prescription_number: rxNumber
      });
    } catch (err) {
      console.error("Create prescription error:", err);
      return res.status(500).json({ error: err.message || "Failed to create prescription" });
    }
  });
  app.get("/api/prescriptions", (req, res) => {
    try {
      const { patient_id, doctor_id } = req.query;
      let sql = `
        SELECT 
          p.*,
          doc.name as doctor_name,
          doc.specialization as doctor_specialization,
          doc.phone as doctor_phone,
          pat.name as patient_name,
          pat.phone as patient_phone,
          pat.email as patient_email
        FROM prescriptions p
        JOIN users doc ON p.doctor_id = doc.id
        JOIN users pat ON p.patient_id = pat.id
      `;
      const params = [];
      if (patient_id) {
        sql += " WHERE p.patient_id = ?";
        params.push(patient_id);
      } else if (doctor_id) {
        sql += " WHERE p.doctor_id = ?";
        params.push(doctor_id);
      }
      sql += " ORDER BY p.created_at DESC";
      const prescriptions = querySql(db, sql, params);
      for (const rx of prescriptions) {
        const items = querySql(
          db,
          "SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY id",
          [rx.id]
        );
        rx.items = items;
      }
      return res.json({ prescriptions });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/patient/:patientId/reminders", (req, res) => {
    try {
      const { patientId } = req.params;
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const reminders = querySql(
        db,
        `SELECT r.*, 
          l.status as today_status, 
          l.taken_at, 
          l.id as log_id
         FROM reminders r
         LEFT JOIN medicine_logs l ON r.id = l.reminder_id AND l.date = ?
         WHERE r.patient_id = ? AND r.is_active = 1
         ORDER BY r.reminder_time ASC`,
        [todayStr, patientId]
      );
      return res.json({ reminders, date: todayStr });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/patient/reminders/:id/action", (req, res) => {
    try {
      const { id: reminderId } = req.params;
      const { patient_id, status, notes } = req.body;
      if (!patient_id || !status) {
        return res.status(400).json({ error: "patient_id and status ('taken', 'snoozed', 'missed') are required" });
      }
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const rems = querySql(db, "SELECT * FROM reminders WHERE id = ?", [reminderId]);
      if (rems.length === 0) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      const reminder = rems[0];
      const existingLogs = querySql(
        db,
        "SELECT id FROM medicine_logs WHERE reminder_id = ? AND date = ?",
        [reminderId, todayStr]
      );
      if (existingLogs.length > 0) {
        db.run(
          `UPDATE medicine_logs 
           SET status = ?, taken_at = ?, notes = ? 
           WHERE id = ?`,
          [status, status === "taken" ? now : null, notes || "", existingLogs[0].id]
        );
      } else {
        const logId = `log-${Date.now()}`;
        db.run(
          `INSERT INTO medicine_logs (id, reminder_id, patient_id, medicine_name, dosage, scheduled_time, taken_at, status, notes, date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            logId,
            reminderId,
            patient_id,
            reminder.medicine_name,
            reminder.dosage,
            reminder.reminder_time,
            status === "taken" ? now : null,
            status,
            notes || "",
            todayStr
          ]
        );
      }
      saveDb(db);
      if (status === "taken") {
        try {
          const matchingRefills = querySql(
            db,
            "SELECT * FROM refill_schedules WHERE patient_id = ? AND LOWER(medicine_name) = LOWER(?) AND remaining_quantity > 0 LIMIT 1",
            [patient_id, reminder.medicine_name.trim()]
          );
          if (matchingRefills.length > 0) {
            const ref = matchingRefills[0];
            const newRemaining = Math.max(0, ref.remaining_quantity - 1);
            db.run(
              "UPDATE refill_schedules SET remaining_quantity = ?, updated_at = ? WHERE id = ?",
              [newRemaining, now, ref.id]
            );
            if (newRemaining <= 5) {
              const existingAlert = querySql(
                db,
                "SELECT id FROM alerts WHERE user_id = ? AND type = 'low_stock' AND related_entity_id = ? AND is_read = 0",
                [patient_id, ref.id]
              );
              if (existingAlert.length === 0) {
                const altId = `alt-low-${Date.now()}`;
                db.run(
                  `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
                   VALUES (?, ?, 'low_stock', 'urgent', 'Low Medication Supply Alert', ?, ?, 0, ?)`,
                  [
                    altId,
                    patient_id,
                    `Only ${newRemaining} doses of ${ref.medicine_name} remaining. Please schedule or request your refill.`,
                    ref.id,
                    now
                  ]
                );
                try {
                  const activeCaregivers = querySql(
                    db,
                    "SELECT * FROM caregivers WHERE patient_id = ? AND is_active = 1 AND notify_on_low_stock = 1",
                    [patient_id]
                  );
                  const patientUser = querySql(db, "SELECT name FROM users WHERE id = ?", [patient_id])[0];
                  const pName = patientUser ? patientUser.name : "Patient";
                  for (const cg of activeCaregivers) {
                    const smsMsg = `[RxCare SUPPLY ALERT] Notice to ${cg.name}: ${pName}'s supply of ${ref.medicine_name} is critically low (${newRemaining} doses left). Please assist in refilling.`;
                    const smsId = `sms-low-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
                    db.run(
                      `INSERT INTO sms_logs (id, patient_id, caregiver_id, recipient_name, recipient_phone, message, alert_type, status, carrier_status, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, 'low_stock_warning', 'delivered', 'Carrier ACK: Delivered to SMS Gateway (HTTP 200 OK)', ?)`,
                      [smsId, patient_id, cg.id, cg.name, cg.alternate_phone, smsMsg, now]
                    );
                  }
                } catch (smsCgErr) {
                  console.error("Caregiver low stock SMS error:", smsCgErr);
                }
              }
            }
            saveDb(db);
          }
        } catch (decrementErr) {
          console.error("Refill decrement error:", decrementErr);
        }
      } else if (status === "missed") {
        try {
          const altId = `alt-missed-${Date.now()}`;
          db.run(
            `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
             VALUES (?, ?, 'missed_dose', 'warning', 'Missed Dose Alert', ?, ?, 0, ?)`,
            [
              altId,
              patient_id,
              `You marked ${reminder.medicine_name} (${reminder.dosage}) as missed for ${reminder.reminder_time}. Stay on track for your next scheduled slot.`,
              reminderId,
              now
            ]
          );
          try {
            const activeCaregivers = querySql(
              db,
              "SELECT * FROM caregivers WHERE patient_id = ? AND is_active = 1 AND notify_on_missed = 1",
              [patient_id]
            );
            const patientUser = querySql(db, "SELECT name FROM users WHERE id = ?", [patient_id])[0];
            const pName = patientUser ? patientUser.name : "Patient";
            for (const cg of activeCaregivers) {
              const smsMsg = `[RxCare URGENT SMS] Alert to ${cg.name} (${cg.relationship}): ${pName} missed their scheduled dose of ${reminder.medicine_name} (${reminder.dosage}) at ${reminder.reminder_time}. Please check on their health immediately.`;
              const smsId = `sms-missed-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
              db.run(
                `INSERT INTO sms_logs (id, patient_id, caregiver_id, recipient_name, recipient_phone, message, alert_type, status, carrier_status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'missed_dose', 'delivered', 'Carrier ACK: Priority SMS Delivered (HTTP 200 OK)', ?)`,
                [smsId, patient_id, cg.id, cg.name, cg.alternate_phone, smsMsg, now]
              );
            }
          } catch (missedSmsErr) {
            console.error("Caregiver missed dose SMS dispatch error:", missedSmsErr);
          }
          saveDb(db);
        } catch (missedErr) {
          console.error("Missed alert error:", missedErr);
        }
      }
      return res.json({
        success: true,
        message: `Dose recorded as ${status}`,
        status,
        taken_at: status === "taken" ? now : null
      });
    } catch (err) {
      console.error("Reminder action error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/patient/custom-reminder", (req, res) => {
    try {
      const { patient_id, medicine_name, dosage, reminder_time, slot, instructions } = req.body;
      if (!patient_id || !medicine_name || !reminder_time) {
        return res.status(400).json({ error: "patient_id, medicine_name, and reminder_time are required" });
      }
      const id = `rem-custom-${Date.now()}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.run(
        `INSERT INTO reminders (id, patient_id, prescription_item_id, medicine_name, dosage, reminder_time, slot, instructions, is_active, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 1, ?)`,
        [id, patient_id, medicine_name, dosage || "1 unit", reminder_time, slot || "Morning", instructions || "", now]
      );
      saveDb(db);
      return res.status(201).json({ success: true, message: "Custom medicine reminder created", id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/patient/:patientId/adherence", (req, res) => {
    try {
      const { patientId } = req.params;
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const totalReminders = querySql(
        db,
        "SELECT COUNT(*) as count FROM reminders WHERE patient_id = ? AND is_active = 1",
        [patientId]
      )[0]?.count || 0;
      const takenToday = querySql(
        db,
        "SELECT COUNT(*) as count FROM medicine_logs WHERE patient_id = ? AND date = ? AND status = 'taken'",
        [patientId, todayStr]
      )[0]?.count || 0;
      const history = querySql(
        db,
        `SELECT date, 
          COUNT(*) as total_logged,
          SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken_count
         FROM medicine_logs 
         WHERE patient_id = ? 
         GROUP BY date 
         ORDER BY date DESC 
         LIMIT 7`,
        [patientId]
      );
      const percentage = totalReminders > 0 ? Math.round(takenToday / totalReminders * 100) : 100;
      return res.json({
        total_scheduled_today: totalReminders,
        taken_today: takenToday,
        adherence_percentage: Math.min(percentage, 100),
        history
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/refills", (req, res) => {
    try {
      const { patient_id, doctor_id, status } = req.query;
      let sql = `
        SELECT 
          r.*,
          pat.name as patient_name,
          pat.phone as patient_phone,
          doc.name as doctor_name,
          p.prescription_number
        FROM refill_schedules r
        JOIN users pat ON r.patient_id = pat.id
        LEFT JOIN users doc ON r.doctor_id = doc.id
        LEFT JOIN prescriptions p ON r.prescription_id = p.id
      `;
      const conditions = [];
      const params = [];
      if (patient_id) {
        conditions.push("r.patient_id = ?");
        params.push(patient_id);
      }
      if (doctor_id) {
        conditions.push("(r.doctor_id = ? OR r.doctor_id IS NULL)");
        params.push(doctor_id);
      }
      if (status) {
        conditions.push("r.status = ?");
        params.push(status);
      }
      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY r.scheduled_refill_date ASC";
      const refills = querySql(db, sql, params);
      return res.json({ refills });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/refills/schedule", (req, res) => {
    try {
      const {
        patient_id,
        prescription_id,
        medicine_name,
        dosage,
        current_quantity,
        remaining_quantity,
        refills_allowed,
        scheduled_refill_date,
        pharmacy_name,
        doctor_id,
        notes
      } = req.body;
      if (!patient_id || !medicine_name || !scheduled_refill_date) {
        return res.status(400).json({ error: "patient_id, medicine_name, and scheduled_refill_date are required" });
      }
      const id = `ref-${Date.now()}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const currentQty = current_quantity ? Number(current_quantity) : 30;
      const remainingQty = remaining_quantity !== void 0 ? Number(remaining_quantity) : currentQty;
      const allowed = refills_allowed !== void 0 ? Number(refills_allowed) : 2;
      db.run(
        `INSERT INTO refill_schedules (
          id, patient_id, prescription_id, medicine_name, dosage, 
          current_quantity, remaining_quantity, refills_allowed, refills_completed, 
          scheduled_refill_date, status, pharmacy_name, doctor_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'scheduled', ?, ?, ?, ?, ?)`,
        [
          id,
          patient_id,
          prescription_id || null,
          medicine_name,
          dosage || "1 unit",
          currentQty,
          remainingQty,
          allowed,
          scheduled_refill_date,
          pharmacy_name || "Apollo Health Pharmacy",
          doctor_id || null,
          notes || "",
          now,
          now
        ]
      );
      const daysDiff = Math.ceil((new Date(scheduled_refill_date).getTime() - Date.now()) / (1e3 * 60 * 60 * 24));
      if (daysDiff <= 3 && daysDiff >= 0) {
        db.run(
          `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
           VALUES (?, ?, 'refill_due', 'warning', 'Upcoming Refill Scheduled', ?, ?, 0, ?)`,
          [
            `alt-${Date.now()}`,
            patient_id,
            `Refill for ${medicine_name} is scheduled on ${scheduled_refill_date}. Check pharmacy stock.`,
            id,
            now
          ]
        );
      }
      saveDb(db);
      return res.status(201).json({
        success: true,
        message: "Refill timeline scheduled successfully",
        id
      });
    } catch (err) {
      console.error("Refill schedule error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/refills/:id/request", (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const refills = querySql(db, "SELECT * FROM refill_schedules WHERE id = ?", [id]);
      if (refills.length === 0) {
        return res.status(404).json({ error: "Refill schedule not found" });
      }
      const refill = refills[0];
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.run(
        `UPDATE refill_schedules 
         SET status = 'requested', notes = COALESCE(?, notes), updated_at = ? 
         WHERE id = ?`,
        [notes || null, now, id]
      );
      const patient = querySql(db, "SELECT name FROM users WHERE id = ?", [refill.patient_id])[0];
      const patientName = patient?.name || "Patient";
      const targetDoctorId = refill.doctor_id || "doc-1";
      const altId = `alt-req-${Date.now()}`;
      db.run(
        `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
         VALUES (?, ?, 'refill_requested', 'warning', 'Urgent Refill Authorization Request', ?, ?, 0, ?)`,
        [
          altId,
          targetDoctorId,
          `${patientName} has requested an urgent refill for ${refill.medicine_name} (${refill.remaining_quantity} doses remaining).`,
          id,
          now
        ]
      );
      db.run(
        `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
         VALUES (?, ?, 'refill_due', 'info', 'Refill Request Sent to Doctor', ?, ?, 0, ?)`,
        [
          `alt-pat-req-${Date.now()}`,
          refill.patient_id,
          `Your refill request for ${refill.medicine_name} has been transmitted to Dr. Rajesh. You will be notified upon approval.`,
          id,
          now
        ]
      );
      saveDb(db);
      return res.json({
        success: true,
        message: "Refill request submitted. Doctor and pharmacy have been alerted.",
        refill: { ...refill, status: "requested", updated_at: now }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/refills/:id/review", (req, res) => {
    try {
      const { id } = req.params;
      const { doctor_id, status, notes, pharmacy_name, additional_quantity } = req.body;
      if (!status || !["approved", "dispensed", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Valid status ('approved', 'dispensed', 'rejected') is required" });
      }
      const refills = querySql(db, "SELECT * FROM refill_schedules WHERE id = ?", [id]);
      if (refills.length === 0) {
        return res.status(404).json({ error: "Refill schedule not found" });
      }
      const refill = refills[0];
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (status === "approved" || status === "dispensed") {
        const addedQty = additional_quantity ? Number(additional_quantity) : refill.current_quantity;
        const newRemaining = refill.remaining_quantity + addedQty;
        const newCompleted = refill.refills_completed + 1;
        const nextRefillDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
        db.run(
          `UPDATE refill_schedules 
           SET status = ?, 
               remaining_quantity = ?, 
               refills_completed = ?, 
               scheduled_refill_date = ?,
               pharmacy_name = COALESCE(?, pharmacy_name),
               doctor_id = COALESCE(?, doctor_id),
               notes = COALESCE(?, notes),
               updated_at = ?
           WHERE id = ?`,
          [
            status,
            newRemaining,
            newCompleted,
            nextRefillDate,
            pharmacy_name || null,
            doctor_id || null,
            notes || null,
            now,
            id
          ]
        );
        const docInfo = doctor_id ? querySql(db, "SELECT name FROM users WHERE id = ?", [doctor_id])[0] : null;
        const docName = docInfo?.name || "Your Doctor";
        const alertTitle = status === "dispensed" ? "Refill Dispensed & Ready" : "Refill Authorized by Doctor";
        const alertMsg = `${docName} has approved your refill for ${refill.medicine_name} (+${addedQty} units). Available at ${pharmacy_name || refill.pharmacy_name || "Apollo Pharmacy"}. Next refill scheduled: ${nextRefillDate}.`;
        db.run(
          `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
           VALUES (?, ?, 'refill_approved', 'info', ?, ?, ?, 0, ?)`,
          [`alt-appr-${Date.now()}`, refill.patient_id, alertTitle, alertMsg, id, now]
        );
      } else {
        db.run(
          `UPDATE refill_schedules 
           SET status = 'rejected', notes = COALESCE(?, notes), updated_at = ? 
           WHERE id = ?`,
          [notes || "Refill request declined. Clinical consultation required.", now, id]
        );
        db.run(
          `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
           VALUES (?, ?, 'warning', 'warning', 'Refill Request Declined', ?, ?, 0, ?)`,
          [
            `alt-rej-${Date.now()}`,
            refill.patient_id,
            `Refill request for ${refill.medicine_name} was declined: ${notes || "Doctor requested an in-person follow-up examination."}`,
            id,
            now
          ]
        );
      }
      saveDb(db);
      return res.json({
        success: true,
        message: `Refill request has been ${status}`
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/refills/:id/update-quantity", (req, res) => {
    try {
      const { id } = req.params;
      const { remaining_quantity, scheduled_refill_date } = req.body;
      if (remaining_quantity === void 0) {
        return res.status(400).json({ error: "remaining_quantity is required" });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const qty = Math.max(0, Number(remaining_quantity));
      db.run(
        `UPDATE refill_schedules 
         SET remaining_quantity = ?, 
             scheduled_refill_date = COALESCE(?, scheduled_refill_date), 
             updated_at = ? 
         WHERE id = ?`,
        [qty, scheduled_refill_date || null, now, id]
      );
      if (qty <= 5) {
        const ref = querySql(db, "SELECT * FROM refill_schedules WHERE id = ?", [id])[0];
        if (ref) {
          db.run(
            `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
             VALUES (?, ?, 'low_stock', 'urgent', 'Critical Low Stock Warning', ?, ?, 0, ?)`,
            [
              `alt-qty-${Date.now()}`,
              ref.patient_id,
              `Stock level updated: Only ${qty} units remaining for ${ref.medicine_name}. Schedule refill immediately.`,
              id,
              now
            ]
          );
        }
      }
      saveDb(db);
      return res.json({ success: true, message: "Inventory updated", remaining_quantity: qty });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/refills/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.run("DELETE FROM refill_schedules WHERE id = ?", [id]);
      saveDb(db);
      return res.json({ success: true, message: "Refill schedule removed" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/alerts", (req, res) => {
    try {
      const { user_id } = req.query;
      if (!user_id) {
        return res.status(400).json({ error: "user_id query parameter is required" });
      }
      const alerts = querySql(
        db,
        "SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC",
        [user_id]
      );
      const unreadCount = alerts.filter((a) => a.is_read === 0).length;
      return res.json({ alerts, unread_count: unreadCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/alerts/:id/read", (req, res) => {
    try {
      const { id } = req.params;
      db.run("UPDATE alerts SET is_read = 1 WHERE id = ?", [id]);
      saveDb(db);
      return res.json({ success: true, message: "Alert marked as read" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/alerts/mark-all-read", (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
      }
      db.run("UPDATE alerts SET is_read = 1 WHERE user_id = ?", [user_id]);
      saveDb(db);
      return res.json({ success: true, message: "All alerts marked as read" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/alerts/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.run("DELETE FROM alerts WHERE id = ?", [id]);
      saveDb(db);
      return res.json({ success: true, message: "Alert dismissed" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/alerts/create", (req, res) => {
    try {
      const { user_id, type, severity, title, message, related_entity_id } = req.body;
      if (!user_id || !title || !message) {
        return res.status(400).json({ error: "user_id, title, and message are required" });
      }
      const id = `alt-${Date.now()}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.run(
        `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          id,
          user_id,
          type || "info",
          severity || "info",
          title,
          message,
          related_entity_id || null,
          now
        ]
      );
      saveDb(db);
      return res.status(201).json({ success: true, message: "Alert message dispatched", id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/alerts/check-active", (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id is required" });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const todayStr = now.split("T")[0];
      const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
      const userRes = querySql(db, "SELECT role FROM users WHERE id = ?", [user_id]);
      if (userRes.length === 0) return res.status(404).json({ error: "User not found" });
      const role = userRes[0].role;
      if (role === "patient") {
        const dueRefills = querySql(
          db,
          "SELECT * FROM refill_schedules WHERE patient_id = ? AND scheduled_refill_date <= ? AND status = 'scheduled'",
          [user_id, in3Days]
        );
        for (const ref of dueRefills) {
          const existing = querySql(
            db,
            "SELECT id FROM alerts WHERE user_id = ? AND type = 'refill_due' AND related_entity_id = ? AND is_read = 0",
            [user_id, ref.id]
          );
          if (existing.length === 0) {
            db.run(
              `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
               VALUES (?, ?, 'refill_due', 'warning', 'Refill Due in Upcoming Days', ?, ?, 0, ?)`,
              [
                `alt-chk-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
                user_id,
                `Scheduled refill for ${ref.medicine_name} is set for ${ref.scheduled_refill_date}. Click to confirm or request pickup.`,
                ref.id,
                now
              ]
            );
          }
        }
        const lowStockRefills = querySql(
          db,
          "SELECT * FROM refill_schedules WHERE patient_id = ? AND remaining_quantity <= 5 AND status != 'requested'",
          [user_id]
        );
        for (const ref of lowStockRefills) {
          const existing = querySql(
            db,
            "SELECT id FROM alerts WHERE user_id = ? AND type = 'low_stock' AND related_entity_id = ? AND is_read = 0",
            [user_id, ref.id]
          );
          if (existing.length === 0) {
            db.run(
              `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
               VALUES (?, ?, 'low_stock', 'urgent', 'Critical Low Stock Alert', ?, ?, 0, ?)`,
              [
                `alt-chk-low-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
                user_id,
                `You have only ${ref.remaining_quantity} doses left of ${ref.medicine_name}. Request your refill now to avoid missing doses.`,
                ref.id,
                now
              ]
            );
          }
        }
      } else if (role === "doctor") {
        const pendingRefills = querySql(
          db,
          "SELECT r.*, u.name as patient_name FROM refill_schedules r JOIN users u ON r.patient_id = u.id WHERE (r.doctor_id = ? OR r.doctor_id IS NULL) AND r.status = 'requested'",
          [user_id]
        );
        for (const ref of pendingRefills) {
          const existing = querySql(
            db,
            "SELECT id FROM alerts WHERE user_id = ? AND type = 'refill_requested' AND related_entity_id = ? AND is_read = 0",
            [user_id, ref.id]
          );
          if (existing.length === 0) {
            db.run(
              `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
               VALUES (?, ?, 'refill_requested', 'warning', 'Pending Patient Refill Request', ?, ?, 0, ?)`,
              [
                `alt-doc-req-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
                user_id,
                `${ref.patient_name} requested a refill for ${ref.medicine_name} (${ref.remaining_quantity} remaining). Action required.`,
                ref.id,
                now
              ]
            );
          }
        }
      }
      saveDb(db);
      const updatedAlerts = querySql(
        db,
        "SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC",
        [user_id]
      );
      const unreadCount = updatedAlerts.filter((a) => a.is_read === 0).length;
      return res.json({ success: true, alerts: updatedAlerts, unread_count: unreadCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/patient/:patientId/caregiver", (req, res) => {
    try {
      const { patientId } = req.params;
      const caregivers = querySql(
        db,
        "SELECT * FROM caregivers WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1",
        [patientId]
      );
      const caregiver = caregivers.length > 0 ? caregivers[0] : null;
      return res.json({ success: true, caregiver });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/patient/:patientId/caregiver", (req, res) => {
    try {
      const { patientId } = req.params;
      const {
        name,
        relationship,
        alternate_phone,
        notify_on_reminder = 1,
        notify_on_missed = 1,
        notify_on_low_stock = 1
      } = req.body;
      if (!name || !alternate_phone) {
        return res.status(400).json({ error: "Caregiver name and alternate phone number are required" });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existing = querySql(
        db,
        "SELECT id FROM caregivers WHERE patient_id = ? LIMIT 1",
        [patientId]
      );
      let caregiverId = "";
      if (existing.length > 0) {
        caregiverId = existing[0].id;
        db.run(
          `UPDATE caregivers 
           SET name = ?, relationship = ?, alternate_phone = ?, 
               notify_on_reminder = ?, notify_on_missed = ?, notify_on_low_stock = ?, 
               is_active = 1, updated_at = ? 
           WHERE id = ?`,
          [
            name.trim(),
            relationship?.trim() || "Family Member",
            alternate_phone.trim(),
            notify_on_reminder ? 1 : 0,
            notify_on_missed ? 1 : 0,
            notify_on_low_stock ? 1 : 0,
            now,
            caregiverId
          ]
        );
      } else {
        caregiverId = `cg-${Date.now()}`;
        db.run(
          `INSERT INTO caregivers (id, patient_id, name, relationship, alternate_phone, is_active, notify_on_reminder, notify_on_missed, notify_on_low_stock, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
          [
            caregiverId,
            patientId,
            name.trim(),
            relationship?.trim() || "Family Member",
            alternate_phone.trim(),
            notify_on_reminder ? 1 : 0,
            notify_on_missed ? 1 : 0,
            notify_on_low_stock ? 1 : 0,
            now,
            now
          ]
        );
      }
      const altId = `alt-cg-${Date.now()}`;
      db.run(
        `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
         VALUES (?, ?, 'upcoming_dose', 'info', 'Caregiver Alternate Number Verified', ?, ?, 0, ?)`,
        [
          altId,
          patientId,
          `Alternate SMS alerts configured for ${name} (${alternate_phone}). SMS will be dispatched for scheduled reminders, missed doses, and low medication supplies.`,
          caregiverId,
          now
        ]
      );
      saveDb(db);
      const savedCaregiver = querySql(db, "SELECT * FROM caregivers WHERE id = ?", [caregiverId])[0];
      return res.json({
        success: true,
        message: `Alternate phone number ${alternate_phone} saved for caregiver ${name}. SMS notifications enabled.`,
        caregiver: savedCaregiver
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/patient/:patientId/sms-logs", (req, res) => {
    try {
      const { patientId } = req.params;
      const logs = querySql(
        db,
        "SELECT * FROM sms_logs WHERE patient_id = ? ORDER BY created_at DESC",
        [patientId]
      );
      return res.json({ success: true, logs, total: logs.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/sms/send-caregiver-alert", (req, res) => {
    try {
      const {
        patient_id,
        alert_type = "dose_reminder",
        custom_message,
        medicine_name,
        dosage,
        scheduled_time,
        doctor_name
      } = req.body;
      if (!patient_id) {
        return res.status(400).json({ error: "patient_id is required" });
      }
      const caregivers = querySql(
        db,
        "SELECT * FROM caregivers WHERE patient_id = ? AND is_active = 1 LIMIT 1",
        [patient_id]
      );
      if (caregivers.length === 0) {
        return res.status(400).json({
          error: "No caregiver or alternate phone number configured. Please register an alternate contact first."
        });
      }
      const caregiver = caregivers[0];
      const patientUser = querySql(db, "SELECT name, phone FROM users WHERE id = ?", [patient_id])[0];
      const patientName = patientUser ? patientUser.name : "Your family member";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const timeStr = scheduled_time || (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      let formattedMessage = "";
      switch (alert_type) {
        case "missed_dose":
          formattedMessage = `[RxCare URGENT SMS] Alert to ${caregiver.name} (${caregiver.relationship}): ${patientName} has missed their scheduled dose of ${medicine_name || "prescribed medicine"} (${dosage || "prescribed dose"}) scheduled for ${timeStr}. Please check in on their wellbeing.`;
          break;
        case "low_stock_warning":
          formattedMessage = `[RxCare SUPPLY NOTICE] Alert to ${caregiver.name}: ${patientName}'s supply of ${medicine_name || "medication"} is running critically low. Please assist in coordinating an electronic prescription refill.`;
          break;
        case "refill_alert":
          formattedMessage = `[RxCare REFILL ALERT] Dear ${caregiver.name}: Scheduled refill date for ${patientName}'s ${medicine_name || "medication"} is due. Contact the doctor or pharmacy for dispensation.`;
          break;
        case "doctor_note":
          formattedMessage = `[RxCare CLINICAL UPDATE] Notice from ${doctor_name || "Attending Physician"} to ${caregiver.name}: ${custom_message || "A new prescription and clinical reminder regimen has been authorized for " + patientName + "."}`;
          break;
        case "dose_reminder":
        default:
          formattedMessage = custom_message || `[RxCare REMINDER] Scheduled Dose: ${patientName} has a scheduled dose of ${medicine_name || "medication"} (${dosage || "1 unit"}) at ${timeStr}. Please remind them to take it as prescribed.`;
          break;
      }
      const smsId = `sms-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
      const carrierStatus = "Carrier ACK: SMS Delivered via Gateway (HTTP 200 OK)";
      db.run(
        `INSERT INTO sms_logs (id, patient_id, caregiver_id, recipient_name, recipient_phone, message, alert_type, status, carrier_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'delivered', ?, ?)`,
        [
          smsId,
          patient_id,
          caregiver.id,
          caregiver.name,
          caregiver.alternate_phone,
          formattedMessage,
          alert_type,
          carrierStatus,
          now
        ]
      );
      const altId = `alt-sms-${Date.now()}`;
      db.run(
        `INSERT INTO alerts (id, user_id, type, severity, title, message, related_entity_id, is_read, created_at)
         VALUES (?, ?, 'upcoming_dose', 'info', 'SMS Dispatched to Caregiver', ?, ?, 0, ?)`,
        [
          altId,
          patient_id,
          `SMS alert sent to alternate number ${caregiver.alternate_phone} (${caregiver.name}): "${formattedMessage.substring(0, 90)}..."`,
          smsId,
          now
        ]
      );
      saveDb(db);
      return res.json({
        success: true,
        message: `SMS successfully delivered to alternate contact ${caregiver.name} (${caregiver.alternate_phone})`,
        sms: {
          id: smsId,
          recipient_name: caregiver.name,
          recipient_phone: caregiver.alternate_phone,
          relationship: caregiver.relationship,
          message: formattedMessage,
          alert_type,
          status: "delivered",
          carrier_status: carrierStatus,
          created_at: now
        }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/sql/execute", (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Valid SQL query string is required" });
    }
    const trimmed = query.trim();
    const startTime = Date.now();
    try {
      if (trimmed.toUpperCase().startsWith("SELECT") || trimmed.toUpperCase().startsWith("PRAGMA") || trimmed.toUpperCase().startsWith("EXPLAIN")) {
        const results = querySql(db, trimmed);
        const duration = Date.now() - startTime;
        return res.json({
          success: true,
          type: "SELECT",
          query: trimmed,
          rowCount: results.length,
          executionTimeMs: duration,
          data: results
        });
      } else {
        db.run(trimmed);
        saveDb(db);
        const duration = Date.now() - startTime;
        return res.json({
          success: true,
          type: "MUTATION",
          query: trimmed,
          executionTimeMs: duration,
          message: "SQL statement executed successfully and database persisted"
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message || "SQL execution error",
        query: trimmed
      });
    }
  });
  app.get("/api/sql/schema", (req, res) => {
    try {
      const tables = querySql(
        db,
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      return res.json({ tables });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`E-Prescription Server running at http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
