import express from 'express';
import sql from 'mssql';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Apna Database Config yahan set karo
const dbConfig = {
  server: '103.74.65.149',
  port: 7703,
  database: 'ESSLSEPLMBCN',
  user: 'sepl',
  password: 'SEPL@#5010',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// DB Connection Pool
let pool;
async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

// ─────────────────────────────────────────────
// API 1: Sabhi Employees ki list
// GET /api/employees
// ─────────────────────────────────────────────
app.get('/api/employees', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(`
      SELECT 
        EmployeeId, EmployeeName, EmployeeCode, Gender, EmployementType,
        CASE WHEN DOJ IS NULL OR YEAR(DOJ)<=1900 THEN NULL ELSE CONVERT(VARCHAR(10), DOJ, 120) END AS doj,
        CASE WHEN DOB IS NULL OR YEAR(DOB)<=1900 THEN NULL ELSE CONVERT(VARCHAR(10), DOB, 120) END AS dob,
        FatherName, ContactNo, Email, Designation, Location, AadhaarNumber, EmployeeRFIDNumber
      FROM dbo.Employees
      WHERE RecordStatus = 1 
        AND EmployeeName NOT LIKE 'del_%' 
        AND EmployeeName NOT LIKE 'ADMIN%'
      ORDER BY EmployeeName
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// API 2: Employee ki Monthly Attendance
// GET /api/attendance/:employeeId?month=6&year=2026
// ─────────────────────────────────────────────
app.get('/api/attendance/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const month = req.query.month || new Date().getMonth() + 1;
    const year  = req.query.year  || new Date().getFullYear();

    const db = await getPool();
    const result = await db.request()
      .input('empId', sql.Int, employeeId)
      .input('startDate', sql.DateTime, `${year}-${String(month).padStart(2,'0')}-01`)
      .input('endDate',   sql.DateTime, `${year}-${String(month).padStart(2,'0')}-31`)
      .query(`
        SELECT
          CAST(AttendanceDate AS DATE)  AS date,
          CASE 
            WHEN InTime IS NULL OR CAST(InTime AS VARCHAR) LIKE '1900%' OR SUBSTRING(CONVERT(VARCHAR(19), InTime, 120), 12, 5) = '00:00' THEN NULL 
            ELSE SUBSTRING(CONVERT(VARCHAR(19), InTime, 120), 12, 5) 
          END AS punchIn,
          CASE 
            WHEN OutTime IS NULL OR CAST(OutTime AS VARCHAR) LIKE '1900%' OR SUBSTRING(CONVERT(VARCHAR(19), OutTime, 120), 12, 5) = '00:00' THEN NULL 
            ELSE SUBSTRING(CONVERT(VARCHAR(19), OutTime, 120), 12, 5) 
          END AS punchOut,
          ISNULL(Duration, 0)    AS workingMinutes,
          ISNULL(LateBy, 0)      AS lateByMinutes,
          ISNULL(IsOnLeave, 0)   AS isOnLeave,
          LeaveType,
          PunchRecords
        FROM dbo.AttendanceLogs
        WHERE EmployeeId = @empId
          AND AttendanceDate >= @startDate
          AND AttendanceDate <= @endDate
        ORDER BY AttendanceDate DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// API 3: Daily Live Attendance for any specific date
// GET /api/daily?date=2026-06-29
// ─────────────────────────────────────────────
app.get(['/api/daily', '/api/today'], async (req, res) => {
  try {
    const db = await getPool();
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const result = await db.request()
      .input('targetDate', sql.DateTime, targetDate)
      .query(`
        SELECT
          e.EmployeeId,
          e.EmployeeName,
          e.EmployeeCode,
          e.Gender,
          e.EmployementType,
          CASE WHEN e.DOJ IS NULL OR YEAR(e.DOJ)<=1900 THEN NULL ELSE CONVERT(VARCHAR(10), e.DOJ, 120) END AS doj,
          CASE WHEN e.DOB IS NULL OR YEAR(e.DOB)<=1900 THEN NULL ELSE CONVERT(VARCHAR(10), e.DOB, 120) END AS dob,
          e.FatherName,
          e.ContactNo,
          e.Email,
          e.Designation,
          e.Location,
          e.AadhaarNumber,
          e.EmployeeRFIDNumber,
          CASE 
            WHEN a.InTime IS NULL OR CAST(a.InTime AS VARCHAR) LIKE '1900%' OR SUBSTRING(CONVERT(VARCHAR(19), a.InTime, 120), 12, 5) = '00:00' THEN NULL 
            ELSE SUBSTRING(CONVERT(VARCHAR(19), a.InTime, 120), 12, 5) 
          END AS punchIn,
          CASE 
            WHEN a.OutTime IS NULL OR CAST(a.OutTime AS VARCHAR) LIKE '1900%' OR SUBSTRING(CONVERT(VARCHAR(19), a.OutTime, 120), 12, 5) = '00:00' THEN NULL 
            ELSE SUBSTRING(CONVERT(VARCHAR(19), a.OutTime, 120), 12, 5) 
          END AS punchOut,
          ISNULL(a.Duration, 0)    AS workingMinutes,
          ISNULL(a.LateBy, 0)      AS lateByMinutes,
          ISNULL(a.IsOnLeave, 0)   AS isOnLeave,
          a.PunchRecords
        FROM dbo.Employees e
        LEFT JOIN dbo.AttendanceLogs a ON e.EmployeeId = a.EmployeeId AND CAST(a.AttendanceDate AS DATE) = @targetDate
        WHERE e.RecordStatus = 1 
          AND e.EmployeeName NOT LIKE 'del_%' 
          AND e.EmployeeName NOT LIKE 'ADMIN%'
        ORDER BY e.EmployeeName
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// API 4: Weekly Attendance Summary (Past 7 days)
// GET /api/weekly
// ─────────────────────────────────────────────
app.get('/api/weekly', async (req, res) => {
  try {
    const db = await getPool();
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const result = await db.request()
      .input('refDate', sql.DateTime, targetDate)
      .query(`
        SELECT 
          FORMAT(AttendanceDate, 'ddd') AS day,
          CONVERT(VARCHAR(10), CAST(AttendanceDate AS DATE), 120) AS date,
          COUNT(CASE WHEN InTime IS NOT NULL AND CAST(InTime AS VARCHAR) NOT LIKE '1900%' AND SUBSTRING(CONVERT(VARCHAR(19), InTime, 120), 12, 5) <> '00:00' AND ISNULL(IsOnLeave,0) = 0 THEN 1 END) AS present,
          COUNT(CASE WHEN ISNULL(LateBy,0) > 0 THEN 1 END) AS late
        FROM dbo.AttendanceLogs
        WHERE CAST(AttendanceDate AS DATE) >= DATEADD(day, -6, CAST(@refDate AS DATE))
          AND CAST(AttendanceDate AS DATE) <= CAST(@refDate AS DATE)
        GROUP BY CAST(AttendanceDate AS DATE), FORMAT(AttendanceDate, 'ddd')
        ORDER BY CAST(AttendanceDate AS DATE) ASC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// API 5: Update/Insert Attendance Record
// POST /api/attendance/update
// ─────────────────────────────────────────────
app.post('/api/attendance/update', async (req, res) => {
  try {
    const { employeeId, date, punchIn, punchOut, isOnLeave } = req.body;
    const db = await getPool();

    const targetDate = date || new Date().toISOString().split('T')[0];
    const inTimeVal  = punchIn  ? `${targetDate} ${punchIn}:00`  : null;
    const outTimeVal = punchOut ? `${targetDate} ${punchOut}:00` : null;

    const check = await db.request()
      .input('empId', sql.Int, employeeId)
      .input('attDate', sql.DateTime, targetDate)
      .query(`SELECT AttendanceLogId FROM dbo.AttendanceLogs WHERE EmployeeId = @empId AND CAST(AttendanceDate AS DATE) = CAST(@attDate AS DATE)`);

    if (check.recordset.length > 0) {
      await db.request()
        .input('empId', sql.Int, employeeId)
        .input('attDate', sql.DateTime, targetDate)
        .input('inTime', sql.DateTime, inTimeVal)
        .input('outTime', sql.DateTime, outTimeVal)
        .input('isOnLeave', sql.Bit, isOnLeave ? 1 : 0)
        .query(`
          UPDATE dbo.AttendanceLogs
          SET InTime = @inTime,
              OutTime = @outTime,
              IsOnLeave = @isOnLeave
          WHERE EmployeeId = @empId
            AND CAST(AttendanceDate AS DATE) = CAST(@attDate AS DATE)
        `);
    } else {
      await db.request()
        .input('empId', sql.Int, employeeId)
        .input('attDate', sql.DateTime, targetDate)
        .input('inTime', sql.DateTime, inTimeVal)
        .input('outTime', sql.DateTime, outTimeVal)
        .input('isOnLeave', sql.Bit, isOnLeave ? 1 : 0)
        .query(`
          INSERT INTO dbo.AttendanceLogs (EmployeeId, AttendanceDate, InTime, OutTime, IsOnLeave)
          VALUES (@empId, @attDate, @inTime, @outTime, @isOnLeave)
        `);
    }

    res.json({ success: true, message: 'Attendance updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// API 5B: Update Employee Master Profile Details
// POST /api/employee/update-profile
// ─────────────────────────────────────────────
app.post('/api/employee/update-profile', async (req, res) => {
  try {
    const { employeeId, fatherName, contactNo, email, designation, location, aadhaarNumber } = req.body;
    const db = await getPool();

    await db.request()
      .input('empId', sql.Int, employeeId)
      .input('fatherName', sql.VarChar, fatherName || '')
      .input('contactNo', sql.VarChar, contactNo || '')
      .input('email', sql.VarChar, email || '')
      .input('designation', sql.VarChar, designation || '')
      .input('location', sql.VarChar, location || '')
      .input('aadhaarNumber', sql.VarChar, aadhaarNumber || '')
      .query(`
        UPDATE dbo.Employees
        SET FatherName = @fatherName,
            ContactNo = @contactNo,
            Email = @email,
            Designation = @designation,
            Location = @location,
            AadhaarNumber = @aadhaarNumber
        WHERE EmployeeId = @empId
      `);

    res.json({ success: true, message: 'Profile updated successfully in SQL Database' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
// API 6: Monthly Payroll Summary across all employees
// GET /api/payroll?month=6&year=2026
// ─────────────────────────────────────────────
app.get('/api/payroll', async (req, res) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year  = req.query.year  || new Date().getFullYear();

    const db = await getPool();
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate   = `${year}-${String(month).padStart(2,'0')}-31`;

    const result = await db.request()
      .input('startDate', sql.DateTime, startDate)
      .input('endDate',   sql.DateTime, endDate)
      .query(`
        SELECT 
          e.EmployeeId,
          e.EmployeeName,
          e.EmployeeCode,
          COUNT(CASE WHEN a.InTime IS NOT NULL AND a.IsOnLeave = 0 THEN 1 END) AS presentDays,
          COUNT(CASE WHEN a.IsOnLeave = 1 THEN 1 END) AS leaveDays,
          COUNT(CASE WHEN a.LateBy > 0 THEN 1 END) AS lateDays,
          ISNULL(SUM(a.Duration), 0) AS totalWorkingMinutes,
          ISNULL(SUM(CASE WHEN a.Duration > 480 THEN (a.Duration - 480) ELSE 0 END), 0) AS totalOvertimeMinutes
        FROM dbo.Employees e
        LEFT JOIN dbo.AttendanceLogs a 
          ON e.EmployeeId = a.EmployeeId 
          AND a.AttendanceDate >= @startDate 
          AND a.AttendanceDate <= @endDate
        WHERE e.RecordStatus = 1 
          AND e.EmployeeName NOT LIKE 'del_%' 
          AND e.EmployeeName NOT LIKE 'ADMIN%'
        GROUP BY e.EmployeeId, e.EmployeeName, e.EmployeeCode
        ORDER BY e.EmployeeName
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Server start karo
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server chal raha hai: http://localhost:${PORT}`);
});

