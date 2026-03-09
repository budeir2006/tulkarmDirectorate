import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('database.sqlite');

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_time DATETIME,
    end_time DATETIME,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS form_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    is_required INTEGER DEFAULT 1,
    options TEXT,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY(form_id) REFERENCES forms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS form_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(form_id) REFERENCES forms(id) ON DELETE CASCADE,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE(form_id, school_id)
  );

  CREATE TABLE IF NOT EXISTS form_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_value TEXT,
    FOREIGN KEY(response_id) REFERENCES form_responses(id) ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES form_questions(id) ON DELETE CASCADE
  );
`);

// Seed default form if not exists
const formCount = db.prepare('SELECT COUNT(*) as c FROM forms').get() as { c: number };
if (formCount.c === 0) {
  const insertForm = db.prepare('INSERT INTO forms (title, description) VALUES (?, ?)');
  const info = insertForm.run('نموذج المتابعة اليومي', 'يرجى تعبئة البيانات اليومية بدقة');
  const formId = info.lastInsertRowid;

  const insertQ = db.prepare('INSERT INTO form_questions (form_id, title, type, is_required, options, order_index) VALUES (?, ?, ?, ?, ?, ?)');
  
  const defaultQuestions = [
    { title: 'اليوم والتاريخ', type: 'date', req: 1, opt: null },
    { title: 'طبيعة الدوام', type: 'select', req: 1, opt: JSON.stringify(['وجاهي', 'إلكتروني', 'مدمج']) },
    { title: 'عدد الحصص المنفذة', type: 'number', req: 1, opt: null },
    { title: 'عدد الحصص الإلكترونية', type: 'number', req: 0, opt: null },
    { title: 'عدد الحصص الوجاهية', type: 'number', req: 0, opt: null },
    { title: 'عدد طلاب المدرسة', type: 'number', req: 1, opt: null },
    { title: 'الطلاب الغائبين (وجاهي)', type: 'number', req: 1, opt: null },
    { title: 'الطلاب الغائبين (إلكتروني)', type: 'number', req: 1, opt: null },
    { title: 'عدد معلمي المدرسة', type: 'number', req: 1, opt: null },
    { title: 'معلمي المواد الأساسية', type: 'number', req: 1, opt: null },
    { title: 'المعلمين الغائبين', type: 'number', req: 1, opt: null },
    { title: 'أبرز الصعوبات التي تواجه التعليم الوجاهي', type: 'textarea', req: 0, opt: null },
    { title: 'أبرز الصعوبات التي تواجه التعليم الإلكتروني', type: 'textarea', req: 0, opt: null },
    { title: 'أبرز الصعوبات التي تواجه التعليم المدمج', type: 'textarea', req: 0, opt: null },
  ];

  defaultQuestions.forEach((q, idx) => {
    insertQ.run(formId, q.title, q.type, q.req, q.opt, idx);
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Get all schools with submission status for active form
  app.get('/api/schools', (req, res) => {
    const activeForm = db.prepare('SELECT id FROM forms WHERE is_active = 1 LIMIT 1').get() as { id: number } | undefined;
    const formId = activeForm ? activeForm.id : 0;

    const schools = db.prepare(`
      SELECT s.id, s.name, 
             CASE WHEN fr.id IS NOT NULL THEN 1 ELSE 0 END as has_submitted
      FROM schools s
      LEFT JOIN form_responses fr ON s.id = fr.school_id AND fr.form_id = ?
      ORDER BY s.name ASC
    `).all(formId);
    res.json(schools);
  });

  // Get form for a specific school
  app.get('/api/schools/:id/form', (req, res) => {
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    if (!school) return res.status(404).json({ error: 'School not found' });
    
    const form = db.prepare('SELECT * FROM forms WHERE is_active = 1 LIMIT 1').get() as any;
    if (!form) return res.json({ school, form: null });

    const questions = db.prepare('SELECT * FROM form_questions WHERE form_id = ? ORDER BY order_index ASC').all(form.id);
    
    const response = db.prepare('SELECT id FROM form_responses WHERE form_id = ? AND school_id = ?').get(form.id, req.params.id) as any;
    let answers = [];
    if (response) {
      answers = db.prepare('SELECT question_id, answer_value FROM form_answers WHERE response_id = ?').all(response.id);
    }

    res.json({ school, form, questions, answers });
  });

  // Submit form for a school
  app.post('/api/schools/:id/form', (req, res) => {
    const schoolId = req.params.id;
    const { form_id, answers } = req.body;

    try {
      const insertResponse = db.prepare('INSERT INTO form_responses (form_id, school_id) VALUES (?, ?) ON CONFLICT(form_id, school_id) DO UPDATE SET submitted_at = CURRENT_TIMESTAMP RETURNING id');
      const response = insertResponse.get(form_id, schoolId) as { id: number };
      
      const deleteAnswers = db.prepare('DELETE FROM form_answers WHERE response_id = ?');
      deleteAnswers.run(response.id);

      const insertAnswer = db.prepare('INSERT INTO form_answers (response_id, question_id, answer_value) VALUES (?, ?, ?)');
      const insertMany = db.transaction((ansObj) => {
        for (const [qId, val] of Object.entries(ansObj)) {
          insertAnswer.run(response.id, qId, String(val));
        }
      });
      insertMany(answers);

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

  // Admin: Get Form
  app.get('/api/admin/form', (req, res) => {
    const form = db.prepare('SELECT * FROM forms WHERE is_active = 1 LIMIT 1').get() as any;
    if (!form) return res.json(null);
    const questions = db.prepare('SELECT * FROM form_questions WHERE form_id = ? ORDER BY order_index ASC').all(form.id);
    res.json({ ...form, questions });
  });

  // Admin: Save Form
  app.put('/api/admin/form', (req, res) => {
    const { id, title, description, start_time, end_time, questions } = req.body;
    try {
      db.transaction(() => {
        let currentFormId = id;
        if (id) {
          db.prepare('UPDATE forms SET title = ?, description = ?, start_time = ?, end_time = ? WHERE id = ?')
            .run(title, description, start_time, end_time, id);
          
          const existingQs = db.prepare('SELECT id FROM form_questions WHERE form_id = ?').all(id) as {id:number}[];
          const newQIds = questions.map((q:any) => q.id).filter(Boolean);
          const toDelete = existingQs.filter(q => !newQIds.includes(q.id));
          
          const delStmt = db.prepare('DELETE FROM form_questions WHERE id = ?');
          toDelete.forEach(q => delStmt.run(q.id));

          const updateQ = db.prepare('UPDATE form_questions SET title=?, type=?, is_required=?, options=?, order_index=? WHERE id=?');
          const insertQ = db.prepare('INSERT INTO form_questions (form_id, title, type, is_required, options, order_index) VALUES (?, ?, ?, ?, ?, ?)');

          questions.forEach((q:any, idx:number) => {
            if (q.id) {
              updateQ.run(q.title, q.type, q.is_required ? 1 : 0, q.options ? JSON.stringify(q.options) : null, idx, q.id);
            } else {
              insertQ.run(id, q.title, q.type, q.is_required ? 1 : 0, q.options ? JSON.stringify(q.options) : null, idx);
            }
          });
        } else {
          db.prepare('UPDATE forms SET is_active = 0').run();
          const info = db.prepare('INSERT INTO forms (title, description, start_time, end_time, is_active) VALUES (?, ?, ?, ?, 1)')
            .run(title, description, start_time, end_time);
          currentFormId = info.lastInsertRowid;
          const insertQ = db.prepare('INSERT INTO form_questions (form_id, title, type, is_required, options, order_index) VALUES (?, ?, ?, ?, ?, ?)');
          questions.forEach((q:any, idx:number) => {
            insertQ.run(currentFormId, q.title, q.type, q.is_required ? 1 : 0, q.options ? JSON.stringify(q.options) : null, idx);
          });
        }
      })();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save form' });
    }
  });

  // Admin: Get Report/Infographic Data
  app.get('/api/admin/stats', (req, res) => {
    const activeForm = db.prepare('SELECT id, title FROM forms WHERE is_active = 1 LIMIT 1').get() as { id: number, title: string } | undefined;
    if (!activeForm) return res.json({ total_schools: 0, submitted_schools: 0, commitment_percentage: 0, number_stats: [], excel_data: [] });

    const formId = activeForm.id;
    const totalSchools = db.prepare('SELECT COUNT(*) as c FROM schools').get() as { c: number };
    const submittedSchools = db.prepare('SELECT COUNT(*) as c FROM form_responses WHERE form_id = ?').get(formId) as { c: number };
    
    const numberQuestions = db.prepare('SELECT id, title FROM form_questions WHERE form_id = ? AND type = "number" ORDER BY order_index').all(formId) as {id:number, title:string}[];
    
    const number_stats = numberQuestions.map(q => {
      const sum = db.prepare('SELECT SUM(CAST(answer_value AS numeric)) as s FROM form_answers fa JOIN form_responses fr ON fa.response_id = fr.id WHERE fr.form_id = ? AND fa.question_id = ?').get(formId, q.id) as { s: number };
      return { title: q.title, sum: sum.s || 0 };
    });

    const allQuestions = db.prepare('SELECT id, title FROM form_questions WHERE form_id = ? ORDER BY order_index').all(formId) as {id:number, title:string}[];
    const responses = db.prepare(`
      SELECT fr.id, s.name as school_name, fr.submitted_at 
      FROM form_responses fr 
      JOIN schools s ON fr.school_id = s.id 
      WHERE fr.form_id = ?
    `).all(formId) as any[];

    const excel_data = responses.map(r => {
      const row: any = { 'المدرسة': r.school_name, 'تاريخ التقديم': r.submitted_at };
      const answers = db.prepare('SELECT question_id, answer_value FROM form_answers WHERE response_id = ?').all(r.id) as any[];
      allQuestions.forEach(q => {
        const ans = answers.find(a => a.question_id === q.id);
        row[q.title] = ans ? ans.answer_value : '';
      });
      return row;
    });

    res.json({
      form_title: activeForm.title,
      total_schools: totalSchools.c,
      submitted_schools: submittedSchools.c,
      commitment_percentage: totalSchools.c > 0 ? Math.round((submittedSchools.c / totalSchools.c) * 100) : 0,
      number_stats,
      excel_data
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
