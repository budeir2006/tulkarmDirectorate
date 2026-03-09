import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new Database('schools.db');

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  DROP TABLE IF EXISTS submissions;
  CREATE TABLE submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL UNIQUE,
    report_date TEXT NOT NULL,
    attendance_type TEXT NOT NULL,
    executed_classes INTEGER DEFAULT 0,
    executed_classes_online INTEGER DEFAULT 0,
    executed_classes_offline INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,
    absent_students_offline INTEGER DEFAULT 0,
    absent_students_online INTEGER DEFAULT 0,
    total_teachers INTEGER DEFAULT 0,
    core_teachers INTEGER DEFAULT 0,
    absent_teachers INTEGER DEFAULT 0,
    challenges_offline TEXT,
    challenges_online TEXT,
    challenges_blended TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
  );
`);

// Insert some initial data if empty
const count = db.prepare('SELECT COUNT(*) as c FROM schools').get() as { c: number };
if (count.c === 0) {
  const insertSchool = db.prepare('INSERT INTO schools (name) VALUES (?)');
  insertSchool.run('مدرسة عمر بن الخطاب');
  insertSchool.run('مدرسة عتيل الأساسية');
  insertSchool.run('مدرسة ياسر عرفات');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Get all schools with submission status
  app.get('/api/schools', (req, res) => {
    const schools = db.prepare(`
      SELECT s.id, s.name, 
             CASE WHEN sub.id IS NOT NULL THEN 1 ELSE 0 END as has_submitted
      FROM schools s
      LEFT JOIN submissions sub ON s.id = sub.school_id
      ORDER BY s.name ASC
    `).all();
    res.json(schools);
  });

  // Get a specific school
  app.get('/api/schools/:id', (req, res) => {
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    if (!school) return res.status(404).json({ error: 'School not found' });
    
    const submission = db.prepare('SELECT * FROM submissions WHERE school_id = ?').get(req.params.id);
    res.json({ school, submission });
  });

  // Submit form for a school
  app.post('/api/schools/:id/submit', (req, res) => {
    const schoolId = req.params.id;
    const {
      report_date,
      attendance_type,
      executed_classes,
      executed_classes_online,
      executed_classes_offline,
      total_students,
      absent_students_offline,
      absent_students_online,
      total_teachers,
      core_teachers,
      absent_teachers,
      challenges_offline,
      challenges_online,
      challenges_blended
    } = req.body;

    try {
      db.prepare(`
        INSERT INTO submissions (
          school_id, report_date, attendance_type, executed_classes, executed_classes_online, executed_classes_offline,
          total_students, absent_students_offline, absent_students_online,
          total_teachers, core_teachers, absent_teachers,
          challenges_offline, challenges_online, challenges_blended
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(school_id) DO UPDATE SET
          report_date=excluded.report_date,
          attendance_type=excluded.attendance_type,
          executed_classes=excluded.executed_classes,
          executed_classes_online=excluded.executed_classes_online,
          executed_classes_offline=excluded.executed_classes_offline,
          total_students=excluded.total_students,
          absent_students_offline=excluded.absent_students_offline,
          absent_students_online=excluded.absent_students_online,
          total_teachers=excluded.total_teachers,
          core_teachers=excluded.core_teachers,
          absent_teachers=excluded.absent_teachers,
          challenges_offline=excluded.challenges_offline,
          challenges_online=excluded.challenges_online,
          challenges_blended=excluded.challenges_blended,
          submitted_at=CURRENT_TIMESTAMP
      `).run(
        schoolId, 
        report_date,
        attendance_type,
        executed_classes || 0,
        executed_classes_online || 0,
        executed_classes_offline || 0,
        total_students || 0,
        absent_students_offline || 0,
        absent_students_online || 0,
        total_teachers || 0,
        core_teachers || 0,
        absent_teachers || 0,
        challenges_offline || '',
        challenges_online || '',
        challenges_blended || ''
      );
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to submit data' });
    }
  });

  // Admin login
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === '0000') {
      res.json({ success: true, token: 'fake-jwt-token-for-demo' });
    } else {
      res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }
  });

  // Admin: Add school
  app.post('/api/admin/schools', (req, res) => {
    const { name } = req.body;
    try {
      const result = db.prepare('INSERT INTO schools (name) VALUES (?)').run(name);
      res.json({ id: result.lastInsertRowid, name });
    } catch (e) {
      res.status(400).json({ error: 'اسم المدرسة موجود مسبقاً أو غير صالح' });
    }
  });

  // Admin: Import schools
  app.post('/api/admin/schools/import', (req, res) => {
    const { schools } = req.body;
    if (!Array.isArray(schools)) return res.status(400).json({ error: 'Invalid data' });
    
    try {
      const insert = db.prepare('INSERT OR IGNORE INTO schools (name) VALUES (?)');
      const insertMany = db.transaction((schoolsList) => {
        for (const school of schoolsList) {
          if (school && typeof school === 'string') {
            insert.run(school.trim());
          }
        }
      });
      insertMany(schools);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to import schools' });
    }
  });

  // Admin: Edit school
  app.put('/api/admin/schools/:id', (req, res) => {
    const { name } = req.body;
    try {
      db.prepare('UPDATE schools SET name = ? WHERE id = ?').run(name, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: 'فشل التعديل' });
    }
  });

  // Admin: Delete school
  app.delete('/api/admin/schools/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM schools WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: 'فشل الحذف' });
    }
  });

  // Admin: Get Report/Infographic Data
  app.get('/api/admin/stats', (req, res) => {
    const totalSchools = db.prepare('SELECT COUNT(*) as c FROM schools').get() as { c: number };
    const submittedSchools = db.prepare('SELECT COUNT(*) as c FROM submissions').get() as { c: number };
    
    const stats = db.prepare(`
      SELECT 
        SUM(total_students) as all_students,
        SUM(absent_students_offline) as absent_students_offline,
        SUM(absent_students_online) as absent_students_online,
        SUM(total_teachers) as all_teachers,
        SUM(absent_teachers) as absent_teachers,
        SUM(executed_classes) as total_classes,
        SUM(executed_classes_online) as total_classes_online,
        SUM(executed_classes_offline) as total_classes_offline
      FROM submissions
    `).get() as any;

    const all_students = stats.all_students || 0;
    const total_absent_students = (stats.absent_students_offline || 0) + (stats.absent_students_online || 0);
    const student_attendance_percentage = all_students > 0 
      ? Math.round(((all_students - total_absent_students) / all_students) * 100) 
      : 0;

    const all_teachers = stats.all_teachers || 0;
    const total_absent_teachers = stats.absent_teachers || 0;
    const teacher_attendance_percentage = all_teachers > 0 
      ? Math.round(((all_teachers - total_absent_teachers) / all_teachers) * 100) 
      : 0;

    res.json({
      total_schools: totalSchools.c,
      submitted_schools: submittedSchools.c,
      commitment_percentage: totalSchools.c > 0 ? Math.round((submittedSchools.c / totalSchools.c) * 100) : 0,
      student_attendance_percentage,
      teacher_attendance_percentage,
      total_students: all_students,
      total_teachers: all_teachers,
      total_classes: (stats.total_classes || 0) + (stats.total_classes_online || 0) + (stats.total_classes_offline || 0)
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
