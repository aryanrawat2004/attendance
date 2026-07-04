import sql from 'mssql';

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

async function run() {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT EmployeeId, EmployeeName, EmployeeCode, CompanyId, Location, Designation, RecordStatus
      FROM dbo.Employees
      ORDER BY EmployeeName
    `);
    console.log(JSON.stringify(result.recordset, null, 2));
    await sql.close();
  } catch (err) {
    console.error(err);
  }
}

run();
