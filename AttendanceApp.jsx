import { useState, useEffect } from "react";

const API = "http://localhost:5000/api";

// Minute → "Xh Ym" format
function fmtDuration(mins) {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Late badge
function LateBadge({ mins }) {
  if (!mins || mins <= 0) return <span className="badge green">On time</span>;
  return <span className="badge red">Late {fmtDuration(mins)}</span>;
}

// Status badge
function StatusBadge({ row }) {
  if (row.isOnLeave) return <span className="badge yellow">Leave</span>;
  if (!row.punchIn || row.punchIn === "00:00") return <span className="badge gray">Absent</span>;
  if (!row.punchOut || row.punchOut === "00:00") return <span className="badge blue">In Office</span>;
  return <span className="badge green">Present</span>;
}

export default function AttendanceApp() {
  const [employees, setEmployees]   = useState([]);
  const [selEmp, setSelEmp]         = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [todayData, setTodayData]   = useState([]);
  const [tab, setTab]               = useState("today"); // "today" | "monthly"
  const [month, setMonth]           = useState(new Date().getMonth() + 1);
  const [year, setYear]             = useState(new Date().getFullYear());
  const [loading, setLoading]       = useState(false);

  // Employees load karo
  useEffect(() => {
    fetch(`${API}/employees`)
      .then(r => r.json())
      .then(d => { if (d.success) setEmployees(d.data); });
    loadToday();
  }, []);

  function loadToday() {
    setLoading(true);
    fetch(`${API}/today`)
      .then(r => r.json())
      .then(d => { if (d.success) setTodayData(d.data); })
      .finally(() => setLoading(false));
  }

  function loadMonthly(empId, m, y) {
    setLoading(true);
    fetch(`${API}/attendance/${empId}?month=${m}&year=${y}`)
      .then(r => r.json())
      .then(d => { if (d.success) setAttendance(d.data); })
      .finally(() => setLoading(false));
  }

  function handleEmpChange(e) {
    const emp = employees.find(x => x.employeeId == e.target.value);
    setSelEmp(emp || null);
    if (emp) loadMonthly(emp.employeeId, month, year);
    setTab("monthly");
  }

  // Summary counts
  const present = attendance.filter(r => r.punchIn && r.punchIn !== "00:00" && !r.isOnLeave).length;
  const absent  = attendance.filter(r => (!r.punchIn || r.punchIn === "00:00") && !r.isOnLeave).length;
  const leaves  = attendance.filter(r => r.isOnLeave).length;
  const lates   = attendance.filter(r => r.lateByMinutes > 0).length;

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, sans-serif; background: #f5f6fa; }
        .app { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .header { background: #1a1a2e; color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 20px; font-weight: 600; }
        .header span { font-size: 13px; opacity: .6; }
        .controls { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }
        select, button { padding: 8px 14px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; cursor: pointer; background: #fff; }
        button.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
        button:hover:not(.active) { background: #f0f0f0; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: #fff; border-radius: 10px; padding: 16px; border: 1px solid #eee; }
        .stat-card .val { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
        .stat-card .lbl { font-size: 13px; color: #888; }
        .stat-card.green .val { color: #22c55e; }
        .stat-card.red   .val { color: #ef4444; }
        .stat-card.yellow .val { color: #f59e0b; }
        .stat-card.blue  .val { color: #3b82f6; }
        table { width: 100%; background: #fff; border-radius: 10px; border: 1px solid #eee; border-collapse: collapse; overflow: hidden; }
        th { background: #f8f9fc; padding: 12px 14px; font-size: 13px; font-weight: 600; color: #555; text-align: left; border-bottom: 1px solid #eee; }
        td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid #f5f5f5; color: #333; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #fafafa; }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .badge.green  { background: #dcfce7; color: #166534; }
        .badge.red    { background: #fee2e2; color: #991b1b; }
        .badge.yellow { background: #fef9c3; color: #854d0e; }
        .badge.blue   { background: #dbeafe; color: #1e40af; }
        .badge.gray   { background: #f3f4f6; color: #6b7280; }
        .empty { text-align: center; padding: 40px; color: #999; font-size: 14px; }
        .loading { text-align: center; padding: 30px; color: #aaa; }
        .refresh-btn { margin-left: auto; }
      `}</style>

      <div className="app">
        <div className="header">
          <div>
            <h1>🏢 Attendance Dashboard</h1>
            <span>SEPL — Real-time Attendance Tracker</span>
          </div>
          <span>{new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</span>
        </div>

        {/* Controls */}
        <div className="controls">
          <button className={tab === "today" ? "active" : ""} onClick={() => { setTab("today"); loadToday(); }}>
            📅 Aaj ki Attendance
          </button>
          <button className={tab === "monthly" ? "active" : ""} onClick={() => setTab("monthly")}>
            📊 Monthly Report
          </button>

          {tab === "monthly" && (
            <>
              <select value={selEmp?.employeeId || ""} onChange={handleEmpChange}>
                <option value="">-- Employee Chuniye --</option>
                {employees.map(e => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.employeeName} ({e.employeeCode})
                  </option>
                ))}
              </select>
              <select value={month} onChange={e => { setMonth(+e.target.value); if (selEmp) loadMonthly(selEmp.employeeId, +e.target.value, year); }}>
                {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => { setYear(+e.target.value); if (selEmp) loadMonthly(selEmp.employeeId, month, +e.target.value); }}>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}

          <button className="refresh-btn" onClick={tab === "today" ? loadToday : () => selEmp && loadMonthly(selEmp.employeeId, month, year)}>
            🔄 Refresh
          </button>
        </div>

        {/* TODAY TAB */}
        {tab === "today" && (
          <>
            <div className="stats">
              <div className="stat-card green"><div className="val">{todayData.filter(r => r.punchIn).length}</div><div className="lbl">Aaj Present</div></div>
              <div className="stat-card red"><div className="val">{todayData.filter(r => r.lateByMinutes > 0).length}</div><div className="lbl">Late Aaye</div></div>
              <div className="stat-card blue"><div className="val">{todayData.filter(r => r.punchIn && !r.punchOut).length}</div><div className="lbl">Office Mein</div></div>
              <div className="stat-card yellow"><div className="val">{todayData.filter(r => r.isOnLeave).length}</div><div className="lbl">Leave Par</div></div>
            </div>

            {loading ? <div className="loading">Loading...</div> : (
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Code</th>
                    <th>Punch In</th>
                    <th>Punch Out</th>
                    <th>Working Time</th>
                    <th>Status</th>
                    <th>Late?</th>
                  </tr>
                </thead>
                <tbody>
                  {todayData.length === 0 ? (
                    <tr><td colSpan="7"><div className="empty">Aaj ka koi data nahi mila</div></td></tr>
                  ) : todayData.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.employeeName}</strong></td>
                      <td>{r.employeeCode}</td>
                      <td>{r.punchIn || "—"}</td>
                      <td>{r.punchOut && r.punchOut !== "00:00" ? r.punchOut : "—"}</td>
                      <td>{fmtDuration(r.workingMinutes)}</td>
                      <td><StatusBadge row={r} /></td>
                      <td><LateBadge mins={r.lateByMinutes} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* MONTHLY TAB */}
        {tab === "monthly" && (
          <>
            {selEmp && (
              <div className="stats">
                <div className="stat-card green"><div className="val">{present}</div><div className="lbl">Present Days</div></div>
                <div className="stat-card red"><div className="val">{absent}</div><div className="lbl">Absent Days</div></div>
                <div className="stat-card yellow"><div className="val">{leaves}</div><div className="lbl">Leave Days</div></div>
                <div className="stat-card blue"><div className="val">{lates}</div><div className="lbl">Late Arrivals</div></div>
              </div>
            )}

            {loading ? <div className="loading">Loading...</div> : (
              !selEmp ? (
                <div className="empty">⬆️ Upar se employee chuniye</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Punch In</th>
                      <th>Punch Out</th>
                      <th>Working Time</th>
                      <th>Late By</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 ? (
                      <tr><td colSpan="6"><div className="empty">Is mahine ka koi data nahi</div></td></tr>
                    ) : attendance.map((r, i) => (
                      <tr key={i}>
                        <td>{new Date(r.date).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' })}</td>
                        <td>{r.punchIn || "—"}</td>
                        <td>{r.punchOut && r.punchOut !== "00:00" ? r.punchOut : "—"}</td>
                        <td>{fmtDuration(r.workingMinutes)}</td>
                        <td><LateBadge mins={r.lateByMinutes} /></td>
                        <td><StatusBadge row={r} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </>
        )}
      </div>
    </>
  );
}
