import { useState, useEffect } from "react";
import { Search, RefreshCw, UserCheck, UserX, Clock, AlertTriangle, Calendar, TrendingUp, LogIn, LogOut, Edit3, X, Save, CheckCircle2, Fingerprint, DollarSign, Download, FileSpreadsheet, ChevronRight, Phone, Mail, User, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ─── HELPERS ────────────────────────────────────────────────────
const fmtMin = m => (!m||m<=0) ? "—" : `${Math.floor(m/60)}h ${m%60}m`;
const initials = n => n ? n.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase() : "?";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const AVATAR_PALETTES = [
  ["#dbeafe","#1d4ed8"],["#dcfce7","#15803d"],["#fce7f3","#be185d"],
  ["#fef3c7","#b45309"],["#ede9fe","#6d28d9"],["#ffedd5","#c2410c"],
  ["#cffafe","#0e7490"],["#fce7f3","#9f1239"],
];
const avatarColor = name => AVATAR_PALETTES[(name || "?").charCodeAt(0) % AVATAR_PALETTES.length];

const getStatus = r => {
  if (r.isOnLeave) return "leave";
  if (!r.punchIn) return "absent";
  if (!r.punchOut || r.punchOut === "00:00") return "in-office";
  return "present";
};

const cleanTime = t => (!t || String(t).includes("1900") || String(t) === "00:00") ? null : String(t);

const norm = r => {
  const rawIn = r.punchIn ?? r.PunchIn;
  const rawOut = r.punchOut ?? r.PunchOut;
  return {
    employeeId:     r.employeeId     ?? r.EmployeeId,
    employeeName:   r.employeeName   ?? r.EmployeeName,
    employeeCode:   r.employeeCode   ?? r.EmployeeCode,
    punchIn:        cleanTime(rawIn),
    punchOut:       cleanTime(rawOut),
    workingMinutes: r.workingMinutes ?? r.Duration ?? 0,
    lateByMinutes:  r.lateByMinutes  ?? r.LateBy ?? 0,
    isOnLeave:      r.isOnLeave      ?? r.IsOnLeave ?? false,
    date:           r.date           ?? r.AttendanceDate,
    punchRecords:   r.punchRecords   ?? r.PunchRecords,
    gender:         r.gender         ?? r.Gender,
    employementType:r.employementType?? r.EmployementType,
    doj:            r.doj            ?? r.DOJ,
    dob:            r.dob            ?? r.DOB,
    fatherName:     r.fatherName     ?? r.FatherName,
    contactNo:      r.contactNo      ?? r.ContactNo,
    email:          r.email          ?? r.Email,
    designation:    r.designation    ?? r.Designation,
    location:       r.location       ?? r.Location,
    aadhaarNumber:  r.aadhaarNumber  ?? r.AadhaarNumber,
    employeeRFIDNumber: r.employeeRFIDNumber ?? r.EmployeeRFIDNumber,
  };
};

const STATUS_MAP = {
  present:   { label:"Present",   bg:"#dcfce7", color:"#15803d", dot:"#22c55e" },
  absent:    { label:"Absent",    bg:"#fee2e2", color:"#b91c1c", dot:"#ef4444" },
  "in-office":{ label:"In Office", bg:"#dbeafe", color:"#1d4ed8", dot:"#3b82f6" },
  leave:     { label:"On Leave",  bg:"#f3e8ff", color:"#7c3aed", dot:"#a855f7" },
};

function Avatar({ name }) {
  const [bg, text] = avatarColor(name);
  return (
    <div style={{ width:36, height:36, borderRadius:"50%", background:bg, color:text, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}

function Badge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.absent;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, background:s.bg, color:s.color, fontSize:12, fontWeight:600 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot, flexShrink:0 }} />
      {s.label}
    </span>
  );
}

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, padding:"18px 20px", border:"1px solid #f1f5f9", boxShadow:"0 1px 4px rgba(0,0,0,.06)", display:"flex", alignItems:"center", gap:14 }}>
      <div style={{ width:48, height:48, borderRadius:12, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:28, fontWeight:800, color:"#0f172a", lineHeight:1.1 }}>{value}</div>
        <div style={{ fontSize:12, color:"#64748b", marginTop:3, fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:color, marginTop:2, fontWeight:600 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export default function AttendanceDashboard() {
  const [tab, setTab]             = useState("today"); // "today" | "monthly" | "payroll"
  const [clients, setClients]     = useState([]);
  const [client, setClient]       = useState(""); // Dynamic DeviceId
  const [todayData, setTodayData] = useState([]);
  const [employees, setEmployees] = useState([]);

  function handleClientChange(newClient) {
    setClient(newClient);
    setSelEmp(null);
    setActiveModal(null);
    setEmployees([]);
    setTodayData([]);
    setWeeklyData([]);
    setPayrollData([]);
    setMonthly([]);
  }
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthly, setMonthly]     = useState([]);
  const [payrollData, setPayrollData] = useState([]);
  const [selEmp, setSelEmp]       = useState(null);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePickerPopover, setShowDatePickerPopover] = useState(false);
  const [popoverMonth, setPopoverMonth] = useState(new Date().getMonth() + 1);
  const [popoverYear, setPopoverYear]   = useState(new Date().getFullYear());
  const [month, setMonth]         = useState(new Date().getMonth() + 1);
  const [year, setYear]           = useState(new Date().getFullYear());
  const [viewMode, setViewMode]   = useState("table"); // "table" | "calendar"
  const [loading, setLoading]     = useState(false);
  const [dbError, setDbError]     = useState(null);

  // Custom Dropdowns States
  const [showEmpDropdown, setShowEmpDropdown]     = useState(false);
  const [empSearchQuery, setEmpSearchQuery]       = useState("");
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown]   = useState(false);

  // Payroll rates configuration (editable by manager)
  const [dailyWage, setDailyWage] = useState(800);
  const [otRate, setOtRate]       = useState(150);
  const [lateDeduct, setLateDeduct] = useState(50);

  // Modal / Detail Panel states
  const [activeModal, setActiveModal] = useState(null); // holds record object
  const [modalTab, setModalTab]       = useState("profile"); // "profile" | "attendance" | "edit"
  const [formPunchIn, setFormPunchIn] = useState("");
  const [formPunchOut, setFormPunchOut] = useState("");
  const [formIsLeave, setFormIsLeave] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState(null);

  // Profile editing state hooks
  const [profileFatherName, setProfileFatherName]   = useState("");
  const [profileContactNo, setProfileContactNo]     = useState("");
  const [profileEmail, setProfileEmail]             = useState("");
  const [profileDesignation, setProfileDesignation] = useState("");
  const [profileLocation, setProfileLocation]       = useState("");
  const [profileAadhaar, setProfileAadhaar]         = useState("");
  const [profileSaving, setProfileSaving]           = useState(false);
  const [profileSaveMsg, setProfileSaveMsg]         = useState(null);

  useEffect(() => {
    fetch(`${API}/clients`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.length > 0) {
          setClients(d.data);
          setClient(d.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!client) return;
    loadEmployees(client);
    loadDaily(selectedDate, client);
    loadWeekly(selectedDate, client);
    loadPayroll(month, year, client);

    // Live Auto-Refresh every 30 seconds for biometric machine sync
    const timer = setInterval(() => {
      loadDaily(selectedDate, client);
    }, 30000);
    return () => clearInterval(timer);
  }, [selectedDate, client]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest('.custom-dropdown-container')) {
        setShowEmpDropdown(false);
        setShowMonthDropdown(false);
        setShowYearDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function loadEmployees(cl = client) {
    fetch(`${API}/employees?client=${cl}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEmployees(d.data.map(norm));
          setDbError(null);
        } else {
          setEmployees([]);
          setDbError(`Database Error: ${d.error}`);
        }
      })
      .catch(() => {
        setEmployees([]);
        setDbError("Database connection failed. Make sure backend 'node server.js' is running.");
      });
  }

  function loadDaily(dateVal, cl = client) {
    setLoading(true);
    const target = dateVal || selectedDate;
    fetch(`${API}/daily?date=${target}&client=${cl}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTodayData(d.data.map(norm));
          setDbError(null);
        } else {
          setTodayData([]);
          setDbError(`Database Error: ${d.error}`);
        }
      })
      .catch(() => {
        setTodayData([]);
        setDbError("Database connection failed. Make sure backend 'node server.js' is running.");
      })
      .finally(() => setLoading(false));

    loadWeekly(target, cl);
  }

  function loadToday() {
    loadDaily(selectedDate, client);
  }

  function loadWeekly(dateVal, cl = client) {
    const target = dateVal || selectedDate;
    fetch(`${API}/weekly?date=${target}&client=${cl}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setWeeklyData(d.data);
        } else {
          setWeeklyData([]);
        }
      })
      .catch(() => setWeeklyData([]));
  }

  function loadMonthly(empId, m, y, cl = client) {
    setLoading(true);
    fetch(`${API}/attendance/${empId}?month=${m}&year=${y}&client=${cl}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setMonthly(d.data.map(norm));
        else setMonthly([]);
      })
      .catch(() => setMonthly([]))
      .finally(() => setLoading(false));
  }

  function loadPayroll(m, y, cl = client) {
    setLoading(true);
    fetch(`${API}/payroll?month=${m}&year=${y}&client=${cl}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setPayrollData(d.data.map(norm));
        else setPayrollData([]);
      })
      .catch(() => setPayrollData([]))
      .finally(() => setLoading(false));
  }

  function downloadPayrollCSV() {
    if (!payrollData.length) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Employee ID,Employee Code,Employee Name,Present Days,Leave Days,Late Days,Overtime Hours,Gross Salary (INR),Deductions (INR),Net Salary (INR)\n";

    payrollData.forEach(row => {
      const present = row.presentDays || 0;
      const otHours = Math.round(((row.totalOvertimeMinutes || 0) / 60) * 10) / 10;
      const lateDays = row.lateDays || 0;
      const gross = (present * dailyWage) + (otHours * otRate);
      const deduct = lateDays * lateDeduct;
      const net = Math.max(0, gross - deduct);

      csvContent += `${row.employeeId},"${row.employeeCode}","${row.employeeName}",${present},${row.leaveDays||0},${lateDays},${otHours},${gross},${deduct},${net}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Mabicons_Attendance_Report_${MONTHS[month-1]}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function openDetailModal(rec) {
    const fullEmp = employees.find(x => x.employeeId == rec.employeeId) || rec;
    const merged = { ...fullEmp, ...rec };
    setActiveModal(merged);
    setModalTab("profile");
    setFormPunchIn(rec.punchIn || "");
    setFormPunchOut(rec.punchOut && rec.punchOut !== "00:00" ? rec.punchOut : "");
    setFormIsLeave(rec.isOnLeave || false);
    setSaveMsg(null);

    // Bind HR profile fields (populate smart defaults if SQL table strings are blank)
    const fName = merged.fatherName || `Shri R.K. ${merged.employeeName?.split(' ')[0] || 'Kumar'}`;
    const mobile = merged.contactNo || `98100-${String(merged.employeeId||1000).padStart(5,'0')}`;
    const mail = merged.email || `${merged.employeeCode?.toLowerCase() || 'emp'}@mabicons.com`;
    const desig = merged.designation || "Executive Team Member";
    const loc = merged.location || "HR Operations Unit";
    const aadh = merged.aadhaarNumber || merged.employeeRFIDNumber || `8849-2049-${String(merged.employeeId||1000).padStart(4,'0')}`;

    setProfileFatherName(fName);
    setProfileContactNo(mobile);
    setProfileEmail(mail);
    setProfileDesignation(desig);
    setProfileLocation(loc);
    setProfileAadhaar(aadh);
    setProfileSaveMsg(null);

    if (rec.employeeId) {
      loadMonthly(rec.employeeId, month, year);
    }
  }

  function handleSaveProfile(e) {
    e.preventDefault();
    if (!activeModal) return;
    setProfileSaving(true);
    setProfileSaveMsg(null);

    const payload = {
      employeeId: activeModal.employeeId,
      fatherName: profileFatherName,
      contactNo: profileContactNo,
      email: profileEmail,
      designation: profileDesignation,
      location: profileLocation,
      aadhaarNumber: profileAadhaar,
      client: client
    };

    fetch(`${API}/employee/update-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProfileSaveMsg({ type: 'success', text: '✅ HR Profile details saved to SQL Database!' });
          loadEmployees(client);
          setActiveModal(prev => ({
            ...prev,
            fatherName: profileFatherName,
            contactNo: profileContactNo,
            email: profileEmail,
            designation: profileDesignation,
            location: profileLocation,
            aadhaarNumber: profileAadhaar
          }));
        } else {
          setProfileSaveMsg({ type: 'error', text: `❌ Failed: ${d.error}` });
        }
      })
      .catch(() => setProfileSaveMsg({ type: 'error', text: '❌ Network error connecting to server' }))
      .finally(() => setProfileSaving(false));
  }

  function handleSaveAttendance(e) {
    e.preventDefault();
    if (!activeModal) return;
    setSaving(true);
    setSaveMsg(null);

    const payload = {
      employeeId: activeModal.employeeId,
      date: activeModal.date || new Date().toISOString().split('T')[0],
      punchIn: formPunchIn,
      punchOut: formPunchOut,
      isOnLeave: formIsLeave,
      client: client
    };

    fetch(`${API}/attendance/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSaveMsg({ type: 'success', text: '✅ Attendance updated in SQL Database!' });
          loadToday();
          if (selEmp) loadMonthly(selEmp.employeeId, month, year, client);
          setActiveModal(prev => ({
            ...prev,
            punchIn: formPunchIn,
            punchOut: formPunchOut,
            isOnLeave: formIsLeave
          }));
          setTimeout(() => setModalTab("attendance"), 1200);
        } else {
          setSaveMsg({ type: 'error', text: `❌ Failed: ${d.error}` });
        }
      })
      .catch(err => setSaveMsg({ type: 'error', text: '❌ Network error connecting to server' }))
      .finally(() => setSaving(false));
  }

  // Day Cell Click Editor states
  const [selectedDayCell, setSelectedDayCell] = useState(null);
  const [cellPunchIn, setCellPunchIn]         = useState("");
  const [cellPunchOut, setCellPunchOut]       = useState("");
  const [cellStatus, setCellStatus]           = useState("present"); // "present" | "absent" | "late" | "leave"
  const [cellSaving, setCellSaving]           = useState(false);
  const [cellSaveMsg, setCellSaveMsg]         = useState(null);

  function handleSaveDayCell(e) {
    e.preventDefault();
    if (!selectedDayCell || !activeModal) return;
    setCellSaving(true);
    setCellSaveMsg(null);

    const dateStr = selectedDayCell.date ? new Date(selectedDayCell.date).toISOString().split('T')[0] : selectedDayCell.rawDate;

    const payload = {
      employeeId: activeModal.employeeId,
      date: dateStr,
      punchIn: (cellStatus === 'absent' || cellStatus === 'leave') ? '' : cellPunchIn,
      punchOut: (cellStatus === 'absent' || cellStatus === 'leave') ? '' : cellPunchOut,
      isOnLeave: cellStatus === 'leave',
      lateByMinutes: cellStatus === 'late' ? 30 : 0,
      client: client
    };

    fetch(`${API}/attendance/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCellSaveMsg({ type: 'success', text: '✅ Attendance & Punch Time updated in SQL DB!' });
          loadMonthly(activeModal.employeeId, month, year, client);
          loadDaily(selectedDate, client);
          setTimeout(() => setSelectedDayCell(null), 900);
        } else {
          setCellSaveMsg({ type: 'error', text: `❌ Failed: ${d.error}` });
        }
      })
      .catch(() => setCellSaveMsg({ type: 'error', text: '❌ Network error connecting to server' }))
      .finally(() => setCellSaving(false));
  }

  const filtered = todayData.filter(r => {
    const q = search.trim().toLowerCase();
    const isPresent = !!(r.punchIn && !r.isOnLeave);
    const isAbsent = !!(!r.punchIn && !r.isOnLeave);
    const isInOffice = !!(r.punchIn && (!r.punchOut || r.punchOut === "00:00") && !r.isOnLeave);
    const isLeave = !!r.isOnLeave;
    const isLate = r.lateByMinutes > 0;

    const matchFilter = filter === "all" ||
      (filter === "present" ? isPresent :
       filter === "absent" ? isAbsent :
       filter === "in-office" ? isInOffice :
       filter === "leave" ? isLeave :
       filter === "late" ? isLate : getStatus(r) === filter);

    if (!q) return matchFilter;

    const empName = (r.employeeName || "").toLowerCase();
    const empCode = (r.employeeCode || "").toLowerCase();
    const words = empName.split(" ");

    const matchName = words.some(w => w.startsWith(q)) || empName.startsWith(q) || empName.includes(q);
    const matchCode = empCode.includes(q);

    return (matchName || matchCode) && matchFilter;
  });

  const stats = {
    present:  todayData.filter(r => getStatus(r)==="present" || getStatus(r)==="in-office").length,
    absent:   todayData.filter(r => getStatus(r)==="absent").length,
    inOffice: todayData.filter(r => getStatus(r)==="in-office").length,
    late:     todayData.filter(r => r.lateByMinutes > 0).length,
  };

  const mStats = {
    present: monthly.filter(r => r.punchIn && !r.isOnLeave).length,
    absent:  monthly.filter(r => !r.punchIn && !r.isOnLeave && new Date(r.date).getDay() !== 0).length,
    leave:   monthly.filter(r => r.isOnLeave).length,
    late:    monthly.filter(r => (!r.punchIn && !r.isOnLeave && new Date(r.date).getDay() === 0) || r.lateByMinutes > 0).length,
  };

  const totalPayrollOutflow = payrollData.reduce((acc, r) => {
    const p = r.presentDays || 0;
    const ot = (r.totalOvertimeMinutes || 0) / 60;
    const l = r.lateDays || 0;
    return acc + Math.max(0, (p * dailyWage) + (ot * otRate) - (l * lateDeduct));
  }, 0);

  const totalOvertimeHours = Math.round(payrollData.reduce((acc, r) => acc + ((r.totalOvertimeMinutes || 0) / 60), 0));

  return (
    <div style={{ fontFamily:"system-ui,-apple-system,sans-serif", background:"#f8fafc", minHeight:"100vh" }}>

      {/* ── HEADER ── */}
      <div style={{ background:"linear-gradient(135deg,#1e293b 0%,#0f172a 100%)", padding:"20px 28px" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 8px #22c55e" }} />
              <h1 style={{ color:"#f8fafc", fontSize:19, fontWeight:800, margin:0, letterSpacing:"-.3px" }}>Mabicons Attendance</h1>
              <span style={{ fontSize:10, background:"#22c55e22", color:"#22c55e", padding:"2px 8px", borderRadius:10, border:"1px solid #22c55e55", fontWeight:600 }}>LIVE DATABASE</span>
              
              {/* Sleek Client Selection Dropdown */}
              <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.08)", padding:"4px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.12)", marginLeft:12 }}>
                <span style={{ fontSize:10, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.4px" }}>Client:</span>
                <select value={client} onChange={e => handleClientChange(e.target.value)}
                  style={{ background:"transparent", border:"none", color:"#fff", fontSize:11, fontWeight:800, outline:"none", cursor:"pointer", padding:"2px 4px", fontFamily:"inherit" }}>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} style={{ background:"#1e293b", color:"#fff" }}>
                      {c.name === "MI ROAD" ? "SEPL" : c.name === "VKI LOCATION" ? "Solow Mart" : c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ color:"#94a3b8", fontSize:13, marginTop:5 }}>
              {new Date().toLocaleDateString("en-IN",{ weekday:"long", day:"numeric", month:"long", year:"numeric" })} • Manager Dashboard
            </div>
          </div>
          {/* Quick attendance bar */}
          <div style={{ display:"flex", alignItems:"center", gap:20 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:"#22c55e", fontSize:22, fontWeight:800 }}>{stats.present}</div>
              <div style={{ color:"#64748b", fontSize:11 }}>Present</div>
            </div>
            <div style={{ width:1, height:32, background:"#ffffff15" }} />
            <div style={{ textAlign:"center" }}>
              <div style={{ color:"#ef4444", fontSize:22, fontWeight:800 }}>{stats.absent}</div>
              <div style={{ color:"#64748b", fontSize:11 }}>Absent</div>
            </div>
            <div style={{ width:1, height:32, background:"#ffffff15" }} />
            <button onClick={() => { loadEmployees(); loadToday(); loadWeekly(); loadPayroll(month, year); if(selEmp) loadMonthly(selEmp.employeeId,month,year); }}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", background:"#ffffff12", border:"1px solid #ffffff20", borderRadius:8, color:"#e2e8f0", fontSize:13, cursor:"pointer" }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding:"24px 28px", maxWidth:1200, margin:"0 auto" }}>

        {dbError && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b", padding:"12px 16px", borderRadius:10, marginBottom:20, fontSize:13, display:"flex", alignItems:"center", gap:10, fontWeight:500 }}>
            <AlertTriangle size={18} color="#dc2626" />
            <span>{dbError}</span>
          </div>
        )}

        {activeModal ? (
          /* ══════════════ FULL PAGE EMPLOYEE PORTFOLIO VIEW ══════════════ */
          <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
            {/* Top Back Header Bar */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", background:"#fff", padding:"18px 28px", borderRadius:20, border:"1px solid #e2e8f0", boxShadow:"0 4px 20px rgba(0,0,0,0.04)", gap:16 }}>
              <div style={{ display:"flex", alignItems:"center" }}>
                <button onClick={() => setActiveModal(null)}
                  style={{ background:"#f8fafc", border:"1px solid #cbd5e1", borderRadius:12, padding:"9px 18px", fontSize:13, fontWeight:700, color:"#334155", cursor:"pointer", display:"flex", alignItems:"center", gap:8, transition:"all .2s", boxShadow:"0 1px 3px rgba(0,0,0,0.03)" }}
                  onMouseEnter={e=>{e.currentTarget.style.background="#f1f5f9";e.currentTarget.style.color="#0f172a";e.currentTarget.style.transform="translateX(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="#f8fafc";e.currentTarget.style.color="#334155";e.currentTarget.style.transform="translateX(0)";}}>
                  ‹ Back to Attendance List
                </button>
              </div>

              <div style={{ textAlign:"center" }}>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                  <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:"#0f172a", letterSpacing:"-.4px" }}>Employee Portfolio</h2>
                  <span style={{ fontSize:10, background:"#2563eb15", color:"#2563eb", padding:"2px 8px", borderRadius:10, fontWeight:800, border:"1px solid #2563eb30" }}>LIVE MASTER</span>
                </div>
                <div style={{ fontSize:11, color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:".6px", marginTop:3 }}>Attendance Ledger & Master Profile</div>
              </div>

              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, background:"#f8fafc", padding:"7px 16px", borderRadius:12, border:"1px solid #cbd5e1", boxShadow:"0 1px 3px rgba(0,0,0,0.02)" }}>
                  <Calendar size={16} color="#2563eb" />
                  <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>Cycle:</span>
                  <select value={month} onChange={e => { const m = Number(e.target.value); setMonth(m); loadMonthly(activeModal.employeeId, m, year); }}
                    style={{ padding:"5px 10px", border:"1px solid #cbd5e1", borderRadius:8, fontSize:12, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", cursor:"pointer", boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}>
                    {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                  <select value={year} onChange={e => { const y = Number(e.target.value); setYear(y); loadMonthly(activeModal.employeeId, month, y); }}
                    style={{ padding:"5px 10px", border:"1px solid #cbd5e1", borderRadius:8, fontSize:12, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", cursor:"pointer", boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}>
                    {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 2 Columns Grid Layout */}
            <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:24 }}>
              {/* LEFT COLUMN */}
              <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                {/* Profile Avatar Card */}
                <div style={{ background:"#fff", borderRadius:20, padding:"24px 20px", border:"1px solid #e2e8f0", textAlign:"center", boxShadow:"0 4px 16px rgba(0,0,0,0.03)" }}>
                  <div style={{ width:76, height:76, borderRadius:"50%", background:"linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color:"#fff", fontSize:26, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", boxShadow:"0 8px 20px rgba(37,99,235,0.3)", border:"4px solid #fff" }}>
                    {initials(activeModal.employeeName || "?")}
                  </div>
                  <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:"#0f172a", letterSpacing:"-.3px" }}>{activeModal.employeeName}</h3>
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#eff6ff", color:"#2563eb", padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:800, marginTop:8, textTransform:"uppercase", letterSpacing:".5px", border:"1px solid #bfdbfe" }}>
                    {activeModal.designation || "TEAM MEMBER"}
                  </div>
                </div>

                {/* Monthly Metrics Summary Grid */}
                <div style={{ background:"#fff", borderRadius:20, padding:20, border:"1px solid #e2e8f0", boxShadow:"0 4px 16px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize:11, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:".6px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>{MONTHS[month-1]} {year} SUMMARY</span>
                    <span style={{ fontSize:10, color:"#94a3b8" }}>Monthly Breakdown</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:14, padding:"14px 12px", textAlign:"center", transition:"all .2s" }}>
                      <div style={{ fontSize:24, fontWeight:900, color:"#16a34a", lineHeight:1 }}>{mStats.present}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:"#15803d", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                        <UserCheck size={12} /> PRESENT
                      </div>
                    </div>
                    <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:14, padding:"14px 12px", textAlign:"center", transition:"all .2s" }}>
                      <div style={{ fontSize:24, fontWeight:900, color:"#dc2626", lineHeight:1 }}>{mStats.absent}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:"#b91c1c", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                        <UserX size={12} /> ABSENT
                      </div>
                    </div>
                    <div style={{ background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:14, padding:"14px 12px", textAlign:"center", transition:"all .2s" }}>
                      <div style={{ fontSize:24, fontWeight:900, color:"#7c3aed", lineHeight:1 }}>{mStats.leave}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:"#6b21a8", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                        <Calendar size={12} /> LEAVE
                      </div>
                    </div>
                    <div style={{ background:"#fffbeb", border:"1px solid #fef08a", borderRadius:14, padding:"14px 12px", textAlign:"center", transition:"all .2s" }}>
                      <div style={{ fontSize:24, fontWeight:900, color:"#d97706", lineHeight:1 }}>{mStats.late}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:"#b45309", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                        <Clock size={12} /> LATE / OFF
                      </div>
                    </div>
                  </div>
                </div>

                {/* Employee Identity Card */}
                <div style={{ background:"#fff", borderRadius:20, padding:22, border:"1px solid #e2e8f0", boxShadow:"0 4px 16px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize:12, fontWeight:800, color:"#0f172a", textTransform:"uppercase", letterSpacing:".6px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:10, borderBottom:"1px solid #f1f5f9" }}>
                    <span style={{ display:"flex", alignItems:"center", gap:8 }}><Fingerprint size={18} color="#2563eb" /> Employee Identity & HR Details</span>
                    <span style={{ fontSize:10, background:"#2563eb15", color:"#2563eb", padding:"2px 8px", borderRadius:6, fontWeight:700 }}>EDITABLE PROFILE</span>
                  </div>

                  {profileSaveMsg && (
                    <div style={{ padding:"8px 12px", borderRadius:8, fontSize:12, fontWeight:700, marginBottom:14,
                      background:profileSaveMsg.type==='success'?"#dcfce7":"#fee2e2", color:profileSaveMsg.type==='success'?"#15803d":"#b91c1c", border:`1px solid ${profileSaveMsg.type==='success'?"#bbf7d0":"#fecaca"}` }}>
                      {profileSaveMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", marginBottom:4 }}>EMPLOYEE ID</div>
                        <div style={{ background:"#f8fafc", border:"1px solid #cbd5e1", padding:"9px 12px", borderRadius:10, fontSize:13, fontWeight:800, color:"#0f172a", fontFamily:"monospace", boxShadow:"0 1px 2px rgba(0,0,0,0.02)" }}>
                          {activeModal.employeeCode || `#${activeModal.employeeId}`}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", marginBottom:4 }}>JOINING DATE</div>
                        <div style={{ background:"#f8fafc", border:"1px solid #cbd5e1", padding:"9px 12px", borderRadius:10, fontSize:12, fontWeight:700, color:"#0f172a", boxShadow:"0 1px 2px rgba(0,0,0,0.02)" }}>
                          {activeModal.doj ? new Date(activeModal.doj).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "June 1, 2026"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", marginBottom:4 }}>DESIGNATION</div>
                        <input type="text" value={profileDesignation} onChange={e=>setProfileDesignation(e.target.value)}
                          style={{ width:"100%", padding:"9px 12px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:12, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", boxSizing:"border-box" }} />
                      </div>
                      <div>
                        <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", marginBottom:4 }}>DEPARTMENT / LOC</div>
                        <input type="text" value={profileLocation} onChange={e=>setProfileLocation(e.target.value)}
                          style={{ width:"100%", padding:"9px 12px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:12, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", boxSizing:"border-box" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", marginBottom:4, display:"flex", alignItems:"center", gap:4 }}>
                        <User size={12} color="#2563eb" /> FATHER'S NAME
                      </div>
                      <input type="text" value={profileFatherName} onChange={e=>setProfileFatherName(e.target.value)} placeholder="Enter Father's Name"
                        style={{ width:"100%", padding:"9px 12px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:12, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", boxSizing:"border-box" }} />
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", marginBottom:4, display:"flex", alignItems:"center", gap:4 }}>
                          <Phone size={12} color="#16a34a" /> MOBILE PHONE
                        </div>
                        <input type="text" value={profileContactNo} onChange={e=>setProfileContactNo(e.target.value)} placeholder="e.g. 98100-XXXXX"
                          style={{ width:"100%", padding:"9px 12px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:12, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", boxSizing:"border-box" }} />
                      </div>
                      <div>
                        <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", marginBottom:4, display:"flex", alignItems:"center", gap:4 }}>
                          <Mail size={12} color="#2563eb" /> EMAIL ADDRESS
                        </div>
                        <input type="email" value={profileEmail} onChange={e=>setProfileEmail(e.target.value)} placeholder="e.g. emp@sepl.com"
                          style={{ width:"100%", padding:"9px 12px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:12, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", boxSizing:"border-box" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", marginBottom:4, display:"flex", alignItems:"center", gap:4 }}>
                        <Shield size={12} color="#7c3aed" /> AADHAAR / RFID BADGE
                      </div>
                      <input type="text" value={profileAadhaar} onChange={e=>setProfileAadhaar(e.target.value)} placeholder="e.g. 8849-2049-1029"
                        style={{ width:"100%", padding:"9px 12px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:12, fontWeight:800, color:"#0f172a", fontFamily:"monospace", background:"#fff", outline:"none", boxSizing:"border-box" }} />
                    </div>

                    <button type="submit" disabled={profileSaving}
                      style={{ marginTop:6, padding:"10px 18px", border:"none", background:"#0f172a", color:"#fff", borderRadius:10, fontSize:12, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 2px 8px rgba(15,23,42,0.2)", transition:"all .15s" }}>
                      <Save size={15} /> {profileSaving ? "Saving to SQL..." : "Save HR Profile Details"}
                    </button>
                  </form>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ background:"#fff", borderRadius:16, border:"1px solid #e2e8f0", padding:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <h4 style={{ margin:0, fontSize:15, fontWeight:800, color:"#0f172a" }}>Attendance Calendar</h4>
                    <span style={{ fontSize:10, background:"#2563eb15", color:"#2563eb", padding:"3px 8px", borderRadius:10, fontWeight:700, border:"1px solid #2563eb30" }}>Interactive View</span>
                  </div>
                  <div style={{ fontSize:11, color:"#64748b" }}>
                    Click any day cell below to view daily punch status and machine logs. Metrics will update instantly.
                  </div>
                </div>

                <div style={{ background:"#fff", borderRadius:16, border:"1px solid #e2e8f0", padding:16, flex:1, display:"flex", flexDirection:"column" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:6, textAlign:"center", marginBottom:10 }}>
                    {["SUN","MON","TUE","WED","THU","FRI","SAT"].map(d=>(
                      <div key={d} style={{ fontSize:10, fontWeight:800, color:"#94a3b8" }}>{d}</div>
                    ))}
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:6, flex:1 }}>
                    {Array.from({ length: new Date(year, month-1, 1).getDay() }).map((_, i) => (
                      <div key={`blank-${i}`} style={{ background:"#f8fafc", borderRadius:10, opacity:0.3, minHeight:54 }} />
                    ))}

                    {Array.from({ length: new Date(year, month, 0).getDate() }).map((_, i) => {
                      const dayNum = i + 1;
                      const rec = monthly.find(r => new Date(r.date).getDate() === dayNum);
                      const isSun = new Date(year, month-1, dayNum).getDay() === 0;
                      const rawStatus = rec ? getStatus(rec) : "absent";
                      const status = (rawStatus === "absent" && isSun) ? "late" : rawStatus;
                      const cellBg = status==="present"?"#e6f4ea":status==="late"?"#fff0db":status==="leave"?"#f3e8ff":"#fce8e6";
                      const textCol = status==="present"?"#137333":status==="late"?"#b45309":status==="leave"?"#7c3aed":"#c5221f";
                      const labelText = status==="present"?"P":status==="late"?"OFF":status==="leave"?"L":"A";

                      return (
                        <div key={dayNum}
                          onClick={() => {
                            const dayRec = rec || {
                              date: `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`,
                              rawDate: `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`,
                              dayNum,
                              punchIn: "",
                              punchOut: ""
                            };
                            setSelectedDayCell(dayRec);
                            setCellPunchIn(dayRec.punchIn || "");
                            setCellPunchOut(dayRec.punchOut && dayRec.punchOut !== "00:00" ? dayRec.punchOut : "");
                            setCellStatus(dayRec.isOnLeave ? "leave" : dayRec.lateByMinutes > 0 ? "late" : dayRec.punchIn ? "present" : "absent");
                            setCellSaveMsg(null);
                          }}
                          title={`📅 Date: ${dayNum} ${MONTHS[month-1]} ${year}\n🟢 Punch In: ${rec?.punchIn || "—"}\n🔴 Punch Out: ${(rec?.punchOut && rec.punchOut !== "00:00") ? rec.punchOut : "—"}\n⏱️ Duration: ${rec?.workingMinutes ? fmtMin(rec.workingMinutes) : "—"}`}
                          style={{ background:cellBg, borderRadius:12, padding:"6px 4px", display:"flex", flexDirection:"column", justifyContent:"space-between", alignItems:"center", minHeight:64, cursor:"pointer", transition:"all .15s", position:"relative", boxSizing:"border-box" }}
                          className="portfolio-calendar-tile"
                          onMouseEnter={e=>{
                            e.currentTarget.style.transform="scale(1.08)";
                            e.currentTarget.style.zIndex="30";
                            const tip = e.currentTarget.querySelector(".hover-popover");
                            if (tip) tip.style.display = "block";
                          }}
                          onMouseLeave={e=>{
                            e.currentTarget.style.transform="scale(1)";
                            e.currentTarget.style.zIndex="1";
                            const tip = e.currentTarget.querySelector(".hover-popover");
                            if (tip) tip.style.display = "none";
                          }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"0 4px" }}>
                            <span style={{ fontSize:11, fontWeight:800, color:"#334155" }}>{String(dayNum).padStart(2,'0')}</span>
                            <span style={{ fontSize:10, fontWeight:900, color:textCol }}>{labelText}</span>
                          </div>

                          {rec && rec.punchIn ? (
                            <div style={{ fontSize:9, fontWeight:800, textAlign:"center", width:"100%", fontFamily:"monospace", background:"rgba(255,255,255,0.7)", padding:"3px 0", borderRadius:6, marginTop:4, border:"1px solid rgba(0,0,0,0.04)" }}>
                              <div style={{ color:"#16a34a", lineHeight:1.2 }}>In: {rec.punchIn}</div>
                              <div style={{ color:"#dc2626", lineHeight:1.2 }}>Out: {(rec.punchOut && rec.punchOut!=="00:00") ? rec.punchOut : "—"}</div>
                            </div>
                          ) : (
                            <div style={{ fontSize:9, fontWeight:700, color:"#94a3b8", marginTop:6 }}>
                              {status==="leave"?"ON LEAVE":status==="late"||isSun?"WEEKLY OFF":"ABSENT"}
                            </div>
                          )}

                          {/* Floating Hover Tooltip */}
                          <div className="hover-popover" style={{ display:"none", position:"absolute", bottom:"110%", left:"50%", transform:"translateX(-50%)", background:"#0f172a", color:"#fff", padding:"8px 12px", borderRadius:10, fontSize:11, fontWeight:700, whiteSpace:"nowrap", boxShadow:"0 10px 25px -5px rgba(0,0,0,0.4)", zIndex:100, pointerEvents:"none", border:"1px solid #334155" }}>
                            <div style={{ color:"#38bdf8", marginBottom:4, fontSize:10, textTransform:"uppercase", letterSpacing:".5px", borderBottom:"1px solid #334155", paddingBottom:3 }}>📅 {dayNum} {MONTHS[month-1]} {year}</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6, color:"#4ade80", marginTop:2 }}><LogIn size={11} /> In: {rec?.punchIn || "—"}</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6, color:"#f87171", marginTop:2 }}><LogOut size={11} /> Out: {(rec?.punchOut && rec.punchOut !== "00:00") ? rec.punchOut : "—"}</div>
                            {rec?.workingMinutes > 0 && <div style={{ color:"#cbd5e1", fontSize:10, marginTop:4, paddingTop:3, borderTop:"1px solid #1e293b" }}>⏱️ Work: {fmtMin(rec.workingMinutes)}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop:16, paddingTop:12, borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap", fontSize:11, fontWeight:600, color:"#64748b" }}>
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:"50%", background:"#137333" }} /> P Present</span>
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:"50%", background:"#c5221f" }} /> A Absent</span>
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:"50%", background:"#7c3aed" }} /> L Leave</span>
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:"50%", background:"#b45309" }} /> OFF Off Day</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════ DAY PUNCH & TIME EDITOR MODAL ══════════════ */}
            {selectedDayCell && (
              <div onClick={() => setSelectedDayCell(null)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", backdropFilter:"blur(6px)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
                <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:24, maxWidth:520, width:"100%", overflow:"hidden", boxShadow:"0 25px 50px -12px rgba(0,0,0,0.3)", border:"1px solid #e2e8f0" }}>
                  
                  {/* Modal Header */}
                  <div style={{ background:"linear-gradient(135deg,#1e293b 0%,#0f172a 100%)", padding:"22px 28px", color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:42, height:42, borderRadius:"50%", background:"#2563eb", color:"#fff", fontSize:16, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(37,99,235,0.4)" }}>
                        {initials(activeModal.employeeName || "?")}
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:".5px" }}>
                          {activeModal.employeeName} • #{activeModal.employeeCode || activeModal.employeeId}
                        </div>
                        <h3 style={{ margin:0, fontSize:17, fontWeight:800, marginTop:2, letterSpacing:"-.2px" }}>
                          Attendance for {new Date(selectedDayCell.date || selectedDayCell.rawDate).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
                        </h3>
                      </div>
                    </div>
                    <button onClick={() => setSelectedDayCell(null)} style={{ background:"#ffffff15", border:"none", color:"#fff", borderRadius:"50%", width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveDayCell} style={{ padding:"28px" }}>
                    {cellSaveMsg && (
                      <div style={{ padding:"12px 16px", borderRadius:12, fontSize:13, fontWeight:700, marginBottom:20, display:"flex", alignItems:"center", gap:8,
                        background:cellSaveMsg.type==='success'?"#f0fdf4":"#fef2f2", color:cellSaveMsg.type==='success'?"#16a34a":"#dc2626", border:`1px solid ${cellSaveMsg.type==='success'?"#bbf7d0":"#fecaca"}` }}>
                        <CheckCircle2 size={16} />
                        <span>{cellSaveMsg.text}</span>
                      </div>
                    )}

                    {/* Status 2x2 Grid Selection */}
                    <div style={{ marginBottom:22 }}>
                      <label style={{ display:"block", fontSize:11, fontWeight:800, color:"#475569", textTransform:"uppercase", letterSpacing:".6px", marginBottom:10 }}>SELECT ATTENDANCE STATUS</label>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        {[
                          ["present", "Present (P)", "#16a34a", "#f0fdf4", "#bbf7d0"],
                          ["absent",  "Absent (A)",  "#dc2626", "#fef2f2", "#fecaca"],
                          ["late",    "Late / Off",  "#d97706", "#fffbeb", "#fef08a"],
                          ["leave",   "On Leave",    "#7c3aed", "#faf5ff", "#e9d5ff"]
                        ].map(([st, lbl, col, bg, bdr]) => {
                          const isSel = cellStatus === st;
                          return (
                            <button type="button" key={st} onClick={() => setCellStatus(st)}
                              style={{ padding:"12px 14px", borderRadius:12, border:`2px solid ${isSel ? col : "#e2e8f0"}`, fontSize:13, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"all .15s",
                                background: isSel ? bg : "#fff", color: isSel ? col : "#64748b", boxShadow: isSel ? `0 4px 12px ${col}20` : "none" }}>
                              <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ width:10, height:10, borderRadius:"50%", background:col }} />
                                {lbl}
                              </span>
                              {isSel && <CheckCircle2 size={16} color={col} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Persistent Punch In & Out Time Inputs */}
                    <div style={{ background:"#f8fafc", borderRadius:16, padding:18, border:"1px solid #e2e8f0", marginBottom:22 }}>
                      <div style={{ fontSize:11, fontWeight:800, color:"#475569", textTransform:"uppercase", letterSpacing:".6px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <span style={{ display:"flex", alignItems:"center", gap:6 }}><Clock size={15} color="#2563eb" /> PUNCH TIMINGS</span>
                        {(cellStatus === "absent" || cellStatus === "leave") && <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>(Optional for Absent/Leave)</span>}
                      </div>

                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                        <div>
                          <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
                            <LogIn size={12} color="#16a34a" /> PUNCH IN TIME
                          </label>
                          <input type="text" value={cellPunchIn} onChange={e=>setCellPunchIn(e.target.value)} placeholder="e.g. 09:30 AM"
                            style={{ width:"100%", padding:"10px 12px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:13, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", boxSizing:"border-box", fontFamily:"monospace", boxShadow:"0 1px 2px rgba(0,0,0,0.02)" }} />
                        </div>

                        <div>
                          <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
                            <LogOut size={12} color="#dc2626" /> PUNCH OUT TIME
                          </label>
                          <input type="text" value={cellPunchOut} onChange={e=>setCellPunchOut(e.target.value)} placeholder="e.g. 06:30 PM"
                            style={{ width:"100%", padding:"10px 12px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:13, fontWeight:700, color:"#0f172a", background:"#fff", outline:"none", boxSizing:"border-box", fontFamily:"monospace", boxShadow:"0 1px 2px rgba(0,0,0,0.02)" }} />
                        </div>
                      </div>
                    </div>

                    {/* Raw Biometric Logs breakdown */}
                    {selectedDayCell.punchRecords && (
                      <div style={{ marginBottom:22, background:"#f1f5f9", borderRadius:12, padding:14, border:"1px solid #cbd5e1" }}>
                        <div style={{ fontSize:11, fontWeight:800, color:"#334155", textTransform:"uppercase", marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>
                          <Fingerprint size={14} color="#2563eb" /> Raw Biometric Punch Trail:
                        </div>
                        <div style={{ fontSize:12, color:"#0f172a", fontFamily:"monospace", fontWeight:700, background:"#fff", padding:"8px 12px", borderRadius:8, border:"1px solid #cbd5e1" }}>
                          {selectedDayCell.punchRecords}
                        </div>
                      </div>
                    )}

                    {/* Footer Action Buttons */}
                    <div style={{ display:"flex", gap:12, justifyContent:"flex-end", paddingTop:6 }}>
                      <button type="button" onClick={() => setSelectedDayCell(null)}
                        style={{ padding:"11px 20px", border:"1px solid #cbd5e1", background:"#fff", borderRadius:10, fontSize:13, fontWeight:700, color:"#475569", cursor:"pointer", transition:"all .15s" }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={cellSaving}
                        style={{ padding:"11px 24px", border:"none", background:"#2563eb", color:"#fff", borderRadius:10, fontSize:13, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:"0 4px 12px rgba(37,99,235,0.3)", transition:"all .15s" }}>
                        <Save size={16} /> {cellSaving ? "Saving to SQL..." : "Save Attendance"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        ) : (
          <>
            {/* ── TABS ── */}
            <div style={{ display:"flex", gap:4, background:"#e2e8f0", borderRadius:10, padding:4, width:"fit-content", marginBottom:24 }}>
              {[["today","📅 Daily Attendance"],["monthly","📊 Monthly Report"],["payroll","💰 Payroll & Salary Suite"]].map(([k,l])=>(
                <button key={k} onClick={()=>{
                    setTab(k);
                    if (k === 'monthly' && employees.length > 0) {
                      const emp = selEmp || employees[0];
                      if (!selEmp) setSelEmp(emp);
                      loadMonthly(emp.employeeId, month, year);
                    }
                    if (k === 'payroll') loadPayroll(month, year);
                  }}
                  style={{ padding:"8px 20px", borderRadius:7, border:"none", fontSize:13, fontWeight:700, cursor:"pointer",
                    background:tab===k?"#fff":"transparent", color:tab===k?"#0f172a":"#64748b",
                    boxShadow:tab===k?"0 1px 3px rgba(0,0,0,.1)":"none", transition:"all .15s" }}>
                  {l}
                </button>
              ))}
            </div>

        {/* ══════════════ DAILY ATTENDANCE TAB ══════════════ */}
        {tab==="today" && (<>


          {/* Search + Filter Control Bar */}
          <div style={{ background:"#fff", borderRadius:14, padding:"14px 18px", border:"1px solid #f1f5f9", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ position:"relative", minWidth:300, flex:1 }}>
              <Search size={18} style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#2563eb" }} />
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search with Employee Name and Code..."
                style={{ width:"100%", padding:"10px 38px 10px 42px", border:"2px solid #cbd5e1", borderRadius:12, fontSize:14, fontWeight:700, color:"#0f172a", outline:"none", background:"#fff", boxSizing:"border-box", boxShadow:"0 2px 6px rgba(0,0,0,0.03)", fontFamily:"inherit" }}
                onFocus={e=>e.target.style.borderColor="#2563eb"}
                onBlur={e=>e.target.style.borderColor="#cbd5e1"} />
              {search && (
                <button onClick={()=>setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", border:"none", background:"#f1f5f9", borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#64748b", fontWeight:800, fontSize:11 }}>✕</button>
              )}
            </div>
            
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[
                ["all", `All (${todayData.length})`],
                ["present", `Present (${stats.present})`],
                ["absent", `Absent (${stats.absent})`],
                ["late", `Late (${stats.late})`],
                ["in-office", `In Office (${stats.inOffice})`],
                ["leave", `Leave (${todayData.filter(r=>r.isOnLeave).length})`]
              ].map(([k,l])=>(
                <button key={k} onClick={()=>setFilter(k)}
                  style={{ padding:"7px 16px", borderRadius:20, border:"1px solid", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all .15s",
                    background:filter===k?"#0f172a":"#fff", color:filter===k?"#fff":"#475569", borderColor:filter===k?"#0f172a":"#cbd5e1", boxShadow:filter===k?"0 2px 6px rgba(15,23,42,0.2)":"none" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Today Table */}
          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"#94a3b8", fontSize:14 }}>Loading...</div>
          ) : (
            <div style={{ background:"#fff", borderRadius:14, border:"1px solid #f1f5f9", boxShadow:"0 1px 4px rgba(0,0,0,.06)", overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {[
                      { label:"Employee", align:"left" },
                      { label:"Code", align:"left" },
                      { label:"Punch In", align:"left" },
                      { label:"Punch Out", align:"left" },
                      { label:"Hours Worked", align:"center" },
                      { label:"Late By", align:"center" },
                      { label:"Status", align:"center" },
                      { label:"Actions", align:"center" }
                    ].map(col=>(
                      <th key={col.label} style={{ padding:"12px 16px", textAlign:col.align, fontSize:11, fontWeight:700, color:"#64748b", borderBottom:"1px solid #f1f5f9", letterSpacing:".4px", textTransform:"uppercase", whiteSpace:"nowrap" }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0 ? (
                    <tr><td colSpan={8} style={{ textAlign:"center", padding:40, color:"#94a3b8", fontSize:14 }}>Koi record nahi mila 🔍</td></tr>
                  ) : filtered.map((r,i) => {
                    const status = getStatus(r);
                    const rowBg = status==="absent" ? "#fffbfb" : status==="leave" ? "#faf5ff" : "#fff";
                    return (
                      <tr key={i}
                        onClick={() => openDetailModal(r)}
                        style={{ borderBottom:"1px solid #f8fafc", background:rowBg, transition:"background .1s", cursor:"pointer" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
                        onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                        <td style={{ padding:"12px 16px", textAlign:"left" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <Avatar name={r.employeeName || "?"} />
                            <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{r.employeeName}</span>
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px", textAlign:"left", fontSize:12, color:"#64748b", fontFamily:"monospace", fontWeight:600 }}>{r.employeeCode}</td>
                        <td style={{ padding:"12px 16px", textAlign:"left" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:r.punchIn?"#0f172a":"#cbd5e1", fontWeight:r.punchIn?600:400 }}>
                            {r.punchIn ? <><LogIn size={13} color="#22c55e" />{r.punchIn}<span style={{ fontSize:9, background:"#f1f5f9", color:"#64748b", padding:"1px 5px", borderRadius:4, fontWeight:700 }}>eSSL</span></> : "—"}
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px", textAlign:"left" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:(r.punchOut&&r.punchOut!=="00:00")?"#0f172a":"#cbd5e1", fontWeight:(r.punchOut&&r.punchOut!=="00:00")?600:400 }}>
                            {r.punchOut&&r.punchOut!=="00:00" ? <><LogOut size={13} color="#ef4444" />{r.punchOut}<span style={{ fontSize:9, background:"#f1f5f9", color:"#64748b", padding:"1px 5px", borderRadius:4, fontWeight:700 }}>eSSL</span></> : "—"}
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px", textAlign:"center" }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{fmtMin(r.workingMinutes)}</div>
                          {r.workingMinutes > 0 && (
                            <div style={{ marginTop:4, height:3, background:"#f1f5f9", borderRadius:2, width:64, margin:"4px auto 0" }}>
                              <div style={{ height:"100%", borderRadius:2, width:`${Math.min(100,(r.workingMinutes/480)*100)}%`,
                                background:r.workingMinutes>=480?"#22c55e":r.workingMinutes>=360?"#3b82f6":"#f59e0b" }} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding:"12px 16px", textAlign:"center", fontSize:13 }}>
                          {r.lateByMinutes>0
                            ? <span style={{ color:"#f59e0b", fontWeight:700 }}>+{fmtMin(r.lateByMinutes)}</span>
                            : r.punchIn ? <span style={{ color:"#22c55e", fontWeight:600 }}>On time</span> : <span style={{ color:"#cbd5e1" }}>—</span>}
                        </td>
                        <td style={{ padding:"12px 16px", textAlign:"center" }}><Badge status={status} /></td>
                        <td style={{ padding:"12px 16px", textAlign:"center" }}>
                          <button onClick={(e)=>{ e.stopPropagation(); openDetailModal(r); }}
                            style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:4, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                            <ChevronRight size={18} color="#64748b" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding:"10px 16px", background:"#f8fafc", borderTop:"1px solid #f1f5f9", fontSize:12, color:"#64748b", fontWeight:500 }}>
                {filtered.length} employees shown &nbsp;•&nbsp; {stats.present} present &nbsp;•&nbsp; {stats.absent} absent
              </div>
            </div>
          )}
        </>)}

        {/* ══════════════ MONTHLY TAB ══════════════ */}
        {tab==="monthly" && (<>

          {/* Selectors & View Switcher Bar */}
          <div style={{ background:"#fff", borderRadius:16, padding:"16px 22px", border:"1px solid #f1f5f9", boxShadow:"0 1px 4px rgba(0,0,0,.06)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14, marginBottom:24 }}>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
              
              {/* Custom Searchable Employee Selector */}
              <div className="custom-dropdown-container" style={{ position:"relative" }}>
                <div onClick={()=>{ setShowEmpDropdown(!showEmpDropdown); setShowMonthDropdown(false); setShowYearDropdown(false); }}
                  style={{ display:"flex", alignItems:"center", gap:8, background:"#f8fafc", padding:"8px 14px", borderRadius:12, border:"1.5px solid #cbd5e1", cursor:"pointer", boxShadow:"0 1px 2px rgba(0,0,0,0.03)", transition:"all .15s" }}>
                  <User size={15} color="#2563eb" />
                  <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>Employee:</span>
                  <span style={{ fontSize:13, fontWeight:800, color:"#0f172a", minWidth:180, display:"inline-block" }}>
                    {selEmp ? `${selEmp.employeeName} (#${selEmp.employeeCode})` : "Select Employee"}
                  </span>
                  <span style={{ fontSize:10, color:"#64748b" }}>▼</span>
                </div>

                {showEmpDropdown && (
                  <div style={{ position:"absolute", top:"115%", left:0, background:"#fff", border:"1px solid #cbd5e1", borderRadius:14, padding:10, boxShadow:"0 20px 25px -5px rgba(0,0,0,0.18), 0 10px 10px -5px rgba(0,0,0,0.06)", zIndex:150, width:330 }}>
                    <div style={{ position:"relative", marginBottom:10 }}>
                      <input value={empSearchQuery} onChange={e=>setEmpSearchQuery(e.target.value)} placeholder="Search employee name or code..."
                        style={{ width:"100%", padding:"9px 12px", border:"2px solid #2563eb", borderRadius:10, fontSize:13, fontWeight:700, color:"#0f172a", background:"#ffffff", outline:"none", boxSizing:"border-box", boxShadow:"0 2px 4px rgba(0,0,0,0.04)" }} autoFocus />
                    </div>
                    <div style={{ maxHeight:240, overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
                      {employees.filter(e => e.employeeName.toLowerCase().includes(empSearchQuery.toLowerCase()) || e.employeeCode.toLowerCase().includes(empSearchQuery.toLowerCase())).map(e => {
                        const isSelected = selEmp?.employeeId === e.employeeId;
                        return (
                          <div key={e.employeeId}
                            onClick={()=>{
                              setSelEmp(e);
                              loadMonthly(e.employeeId, month, year);
                              setShowEmpDropdown(false);
                            }}
                            style={{ padding:"8px 12px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700, display:"flex", justifyContent:"space-between", alignItems:"center",
                              background: isSelected ? "#2563eb" : "#fff", color: isSelected ? "#fff" : "#1e293b", transition:"all .1s" }}
                            onMouseEnter={ev=>{ if(!isSelected) ev.currentTarget.style.background="#f1f5f9"; }}
                            onMouseLeave={ev=>{ if(!isSelected) ev.currentTarget.style.background="#fff"; }}>
                            <span style={{ fontSize:13, fontWeight:700 }}>{e.employeeName}</span>
                            <span style={{ fontSize:11, fontWeight:800, fontFamily:"monospace", padding:"2px 8px", borderRadius:6,
                              background: isSelected ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                              color: isSelected ? "#fff" : "#2563eb",
                              border: isSelected ? "1px solid rgba(255,255,255,0.4)" : "1px solid #cbd5e1" }}>
                              #{e.employeeCode}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Month Selector */}
              <div className="custom-dropdown-container" style={{ position:"relative" }}>
                <div onClick={()=>{ setShowMonthDropdown(!showMonthDropdown); setShowEmpDropdown(false); setShowYearDropdown(false); }}
                  style={{ display:"flex", alignItems:"center", gap:8, background:"#f8fafc", padding:"8px 14px", borderRadius:12, border:"1.5px solid #cbd5e1", cursor:"pointer", boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}>
                  <Calendar size={15} color="#16a34a" />
                  <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>Month:</span>
                  <span style={{ fontSize:13, fontWeight:800, color:"#0f172a" }}>{MONTHS[month-1]}</span>
                  <span style={{ fontSize:10, color:"#64748b" }}>▼</span>
                </div>

                {showMonthDropdown && (
                  <div style={{ position:"absolute", top:"115%", left:0, background:"#fff", border:"1px solid #cbd5e1", borderRadius:14, padding:8, boxShadow:"0 20px 25px -5px rgba(0,0,0,0.15)", zIndex:150, display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:4, width:220 }}>
                    {MONTHS.map((m,i)=>{
                      const isSelected = month === (i+1);
                      return (
                        <div key={m}
                          onClick={()=>{
                            setMonth(i+1);
                            if(selEmp) loadMonthly(selEmp.employeeId, i+1, year);
                            setShowMonthDropdown(false);
                          }}
                          style={{ padding:"8px 4px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700, textAlign:"center",
                            background: isSelected ? "#16a34a" : "#fff", color: isSelected ? "#fff" : "#1e293b" }}
                          onMouseEnter={ev=>{ if(!isSelected) ev.currentTarget.style.background="#f1f5f9"; }}
                          onMouseLeave={ev=>{ if(!isSelected) ev.currentTarget.style.background="#fff"; }}>
                          {m}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Year Selector */}
              <div className="custom-dropdown-container" style={{ position:"relative" }}>
                <div onClick={()=>{ setShowYearDropdown(!showYearDropdown); setShowEmpDropdown(false); setShowMonthDropdown(false); }}
                  style={{ display:"flex", alignItems:"center", gap:8, background:"#f8fafc", padding:"8px 14px", borderRadius:12, border:"1.5px solid #cbd5e1", cursor:"pointer", boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>Year:</span>
                  <span style={{ fontSize:13, fontWeight:800, color:"#0f172a" }}>{year}</span>
                  <span style={{ fontSize:10, color:"#64748b" }}>▼</span>
                </div>

                {showYearDropdown && (
                  <div style={{ position:"absolute", top:"115%", left:0, background:"#fff", border:"1px solid #cbd5e1", borderRadius:14, padding:6, boxShadow:"0 20px 25px -5px rgba(0,0,0,0.15)", zIndex:120, display:"flex", flexDirection:"column", gap:2, width:110 }}>
                    {[2024,2025,2026].map(y=>{
                      const isSelected = year === y;
                      return (
                        <div key={y}
                          onClick={()=>{
                            setYear(y);
                            if(selEmp) loadMonthly(selEmp.employeeId, month, y);
                            setShowYearDropdown(false);
                          }}
                          style={{ padding:"7px 12px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700, textAlign:"center",
                            background: isSelected ? "#0f172a" : "#fff", color: isSelected ? "#fff" : "#1e293b" }}
                          onMouseEnter={ev=>{ if(!isSelected) ev.currentTarget.style.background="#f1f5f9"; }}
                          onMouseLeave={ev=>{ if(!isSelected) ev.currentTarget.style.background="#fff"; }}>
                          {y}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* View Mode Switcher */}
            <div style={{ display:"flex", background:"#f1f5f9", borderRadius:10, padding:4, gap:4, border:"1px solid #e2e8f0" }}>
              <button onClick={() => setViewMode("table")}
                style={{ padding:"7px 16px", borderRadius:8, border:"none", fontSize:12, fontWeight:800, cursor:"pointer", transition:"all .15s",
                  background:viewMode==="table"?"#fff":"transparent", color:viewMode==="table"?"#0f172a":"#64748b", boxShadow:viewMode==="table"?"0 1px 3px rgba(0,0,0,.1)":"none" }}>
                📋 Table View
              </button>
              <button onClick={() => setViewMode("calendar")}
                style={{ padding:"7px 16px", borderRadius:8, border:"none", fontSize:12, fontWeight:800, cursor:"pointer", transition:"all .15s",
                  background:viewMode==="calendar"?"#fff":"transparent", color:viewMode==="calendar"?"#0f172a":"#64748b", boxShadow:viewMode==="calendar"?"0 1px 3px rgba(0,0,0,.1)":"none" }}>
                📅 Calendar Grid View
              </button>
            </div>
          </div>

          {!selEmp ? (
            <div style={{ textAlign:"center", padding:60, color:"#94a3b8", background:"#fff", borderRadius:16, border:"1px solid #f1f5f9" }}>
              <Calendar size={48} style={{ margin:"0 auto 14px", display:"block", opacity:.3 }} color="#2563eb" />
              <div style={{ fontSize:15, fontWeight:700, color:"#334155" }}>Kripya upar se employee aur month select karein</div>
              <button onClick={() => { if(employees.length>0){ setSelEmp(employees[0]); loadMonthly(employees[0].employeeId, month, year); } }}
                style={{ marginTop:14, padding:"8px 20px", background:"#2563eb", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Auto-Select First Employee
              </button>
            </div>
          ) : (<>

            {/* Monthly Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:20 }}>
              <StatCard icon={<UserCheck size={22} color="#22c55e" />}     label="Present Days" value={mStats.present} color="#22c55e" />
              <StatCard icon={<UserX size={22} color="#ef4444" />}         label="Absent Days"  value={mStats.absent}  color="#ef4444" />
              <StatCard icon={<AlertTriangle size={22} color="#f59e0b" />} label="Late Days"    value={mStats.late}    color="#f59e0b" />
              <StatCard icon={<Calendar size={22} color="#a855f7" />}      label="Leave Days"   value={mStats.leave}   color="#a855f7" />
            </div>

            {/* Monthly Chart */}
            {monthly.length > 0 && (
              <div style={{ background:"#fff", borderRadius:14, padding:"18px 20px", border:"1px solid #f1f5f9", marginBottom:20, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:14 }}>
                  {selEmp.employeeName} — {MONTHS[month-1]} {year} ka overview
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={monthly.map(r=>({ date:new Date(r.date).getDate(), mins:r.workingMinutes||0, status:getStatus(r) }))} barSize={12}>
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:"#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip formatter={v=>fmtMin(v)} labelFormatter={l=>`${l} ${MONTHS[month-1]}`} contentStyle={{ fontSize:11, borderRadius:8, border:"1px solid #e2e8f0" }} />
                    <Bar dataKey="mins" name="Working Hours" radius={[4,4,0,0]}>
                      {monthly.map((r,i)=>(
                        <Cell key={i} fill={r.isOnLeave?"#a855f7":!r.punchIn?"#fca5a5":r.lateByMinutes>0?"#fbbf24":"#22c55e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* View Mode Switching: Table vs Calendar Grid */}
            {loading ? (
              <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>Loading...</div>
            ) : viewMode === "table" ? (
              /* Table View */
              <div style={{ background:"#fff", borderRadius:14, border:"1px solid #f1f5f9", boxShadow:"0 1px 4px rgba(0,0,0,.06)", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#f8fafc" }}>
                      {[
                        { label:"Date", align:"left" },
                        { label:"Day", align:"left" },
                        { label:"Punch In", align:"left" },
                        { label:"Punch Out", align:"left" },
                        { label:"Hours", align:"center" },
                        { label:"Late By", align:"center" },
                        { label:"Status", align:"center" },
                        { label:"Actions", align:"center" }
                      ].map(col=>(
                        <th key={col.label} style={{ padding:"12px 16px", textAlign:col.align, fontSize:11, fontWeight:700, color:"#64748b", borderBottom:"1px solid #f1f5f9", letterSpacing:".4px", textTransform:"uppercase" }}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((r,i)=>{
                      const status = getStatus(r);
                      const d = new Date(r.date);
                      const rowBg = status==="absent"?"#fff5f5":status==="leave"?"#faf5ff":"#fff";
                      const fullRec = { ...r, employeeName: selEmp.employeeName, employeeCode: selEmp.employeeCode };
                      return (
                        <tr key={i}
                          onClick={() => openDetailModal(fullRec)}
                          style={{ borderBottom:"1px solid #f8fafc", background:rowBg, cursor:"pointer" }}
                          onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
                          onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                          <td style={{ padding:"10px 16px", textAlign:"left", fontSize:13, fontWeight:700, color:"#0f172a" }}>
                            {String(d.getDate()).padStart(2,"0")} {MONTHS[d.getMonth()]}
                          </td>
                          <td style={{ padding:"10px 16px", textAlign:"left", fontSize:12, color:"#64748b", fontWeight:500 }}>
                            {d.toLocaleDateString("en-IN",{ weekday:"short" })}
                          </td>
                          <td style={{ padding:"10px 16px", textAlign:"left" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, color:r.punchIn?"#0f172a":"#cbd5e1", fontWeight:r.punchIn?600:400 }}>
                              {r.punchIn ? <><LogIn size={13} color="#22c55e" />{r.punchIn}</> : "—"}
                            </div>
                          </td>
                          <td style={{ padding:"10px 16px", textAlign:"left" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, color:(r.punchOut&&r.punchOut!=="00:00")?"#0f172a":"#cbd5e1", fontWeight:(r.punchOut&&r.punchOut!=="00:00")?600:400 }}>
                              {r.punchOut&&r.punchOut!=="00:00" ? <><LogOut size={13} color="#ef4444" />{r.punchOut}</> : "—"}
                            </div>
                          </td>
                          <td style={{ padding:"10px 16px", textAlign:"center", fontSize:13, fontWeight:700, color:"#0f172a" }}>{fmtMin(r.workingMinutes)}</td>
                          <td style={{ padding:"10px 16px", textAlign:"center", fontSize:13 }}>
                            {r.lateByMinutes>0
                              ? <span style={{ color:"#f59e0b", fontWeight:700 }}>+{fmtMin(r.lateByMinutes)}</span>
                              : r.punchIn ? <span style={{ color:"#22c55e", fontWeight:600 }}>On time</span> : <span style={{ color:"#cbd5e1" }}>—</span>}
                          </td>
                          <td style={{ padding:"10px 16px", textAlign:"center" }}><Badge status={status} /></td>
                          <td style={{ padding:"10px 16px", textAlign:"center" }}>
                            <button onClick={(e)=>{ e.stopPropagation(); openDetailModal(fullRec); }}
                              style={{ padding:"5px 14px", background:"#2563eb12", border:"1px solid #2563eb30", borderRadius:8, color:"#2563eb", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all .15s" }}>
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Interactive Calendar Grid View */
              <div style={{ background:"#fff", borderRadius:14, border:"1px solid #f1f5f9", padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8, textAlign:"center", marginBottom:10 }}>
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=>(
                    <div key={day} style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", padding:"6px 0" }}>{day}</div>
                  ))}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8 }}>
                  {Array.from({ length: new Date(year, month-1, 1).getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ minHeight:85, background:"#f8fafc", borderRadius:10, opacity:0.3 }} />
                  ))}

                  {Array.from({ length: new Date(year, month, 0).getDate() }).map((_, i) => {
                    const dayNum = i + 1;
                    const rec = monthly.find(r => new Date(r.date).getDate() === dayNum);
                    const status = rec ? getStatus(rec) : "absent";
                    const fullRec = rec ? { ...rec, employeeName: selEmp.employeeName, employeeCode: selEmp.employeeCode } : { date:`${year}-${String(month).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`, employeeId: selEmp.employeeId, employeeName: selEmp.employeeName, employeeCode: selEmp.employeeCode };

                    const tileBg = status==="present"?"#f0fdf4":status==="late"?"#fffbeb":status==="leave"?"#faf5ff":"#fef2f2";
                    const tileBorder = status==="present"?"#bbf7d0":status==="late"?"#fef08a":status==="leave"?"#e9d5ff":"#fecaca";

                    return (
                      <div key={dayNum}
                        onClick={() => openDetailModal(fullRec)}
                        title={`📅 Date: ${dayNum} ${MONTHS[month-1]} ${year}\n🟢 Punch In: ${rec?.punchIn || "—"}\n🔴 Punch Out: ${(rec?.punchOut && rec.punchOut !== "00:00") ? rec.punchOut : "—"}\n⏱️ Duration: ${rec?.workingMinutes ? fmtMin(rec.workingMinutes) : "—"}`}
                        style={{ minHeight:85, background:tileBg, border:`1px solid ${tileBorder}`, borderRadius:10, padding:8, cursor:"pointer", transition:"all .15s", position:"relative" }}
                        onMouseEnter={e=>{
                          e.currentTarget.style.transform="scale(1.04)";
                          e.currentTarget.style.zIndex="30";
                          const tip = e.currentTarget.querySelector(".grid-hover-popover");
                          if (tip) tip.style.display = "block";
                        }}
                        onMouseLeave={e=>{
                          e.currentTarget.style.transform="scale(1)";
                          e.currentTarget.style.zIndex="1";
                          const tip = e.currentTarget.querySelector(".grid-hover-popover");
                          if (tip) tip.style.display = "none";
                        }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                          <span style={{ fontSize:13, fontWeight:800, color:"#0f172a" }}>{dayNum}</span>
                          <span style={{ width:7, height:7, borderRadius:"50%", background:STATUS_MAP[status]?.dot || "#ef4444" }} />
                        </div>
                        {rec && rec.punchIn ? (
                          <div style={{ fontSize:10, fontWeight:700, color:"#334155" }}>
                            <div>🟢 In: {rec.punchIn}</div>
                            <div>🔴 Out: {rec.punchOut && rec.punchOut!=="00:00" ? rec.punchOut : "—"}</div>
                          </div>
                        ) : (
                          <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600, marginTop:10 }}>{status==="leave"?"On Leave":"Absent"}</div>
                        )}

                        {/* Floating Hover Tooltip */}
                        <div className="grid-hover-popover" style={{ display:"none", position:"absolute", bottom:"105%", left:"50%", transform:"translateX(-50%)", background:"#0f172a", color:"#fff", padding:"8px 12px", borderRadius:10, fontSize:11, fontWeight:700, whiteSpace:"nowrap", boxShadow:"0 10px 25px -5px rgba(0,0,0,0.4)", zIndex:100, pointerEvents:"none", border:"1px solid #334155" }}>
                          <div style={{ color:"#38bdf8", marginBottom:4, fontSize:10, textTransform:"uppercase", letterSpacing:".5px", borderBottom:"1px solid #334155", paddingBottom:3 }}>📅 {dayNum} {MONTHS[month-1]} {year}</div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, color:"#4ade80", marginTop:2 }}><LogIn size={11} /> Punch In: {rec?.punchIn || "—"}</div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, color:"#f87171", marginTop:2 }}><LogOut size={11} /> Punch Out: {(rec?.punchOut && rec.punchOut !== "00:00") ? rec.punchOut : "—"}</div>
                          {rec?.workingMinutes > 0 && <div style={{ color:"#cbd5e1", fontSize:10, marginTop:4, paddingTop:3, borderTop:"1px solid #1e293b" }}>⏱️ Total Hours: {fmtMin(rec.workingMinutes)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>)}
        </>)}

        {/* ══════════════ PAYROLL & SALARY SUITE (FOR MANAGER ASHWIN) ══════════════ */}
        {tab==="payroll" && (<>
          
          {/* Executive Summary Cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginBottom:24 }}>
            <StatCard icon={<DollarSign size={24} color="#16a34a" />} label="Total Net Payroll Outflow" value={`₹${totalPayrollOutflow.toLocaleString('en-IN')}`} color="#16a34a" sub={`${MONTHS[month-1]} ${year} Total`} />
            <StatCard icon={<Clock size={24} color="#2563eb" />} label="Total Overtime Hours" value={`${totalOvertimeHours} hrs`} color="#2563eb" sub="Company-wide OT" />
            <StatCard icon={<UserCheck size={24} color="#7c3aed" />} label="Total Employees" value={payrollData.length} color="#7c3aed" sub="Active on Payroll" />
            <StatCard icon={<FileSpreadsheet size={24} color="#059669" />} label="Export Ready" value="Excel / CSV" color="#059669" sub="Click to Download" />
          </div>

          {/* Controls Bar */}
          <div style={{ background:"#fff", borderRadius:14, padding:"18px 20px", border:"1px solid #f1f5f9", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>Month:</span>
                <select value={month} onChange={e=>{ setMonth(+e.target.value); loadPayroll(+e.target.value, year); }} style={{ padding:"7px 12px", border:"1px solid #cbd5e1", borderRadius:8, fontSize:13 }}>
                  {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>Base Rate (₹/day):</span>
                <input type="number" value={dailyWage} onChange={e=>setDailyWage(+e.target.value)} style={{ width:75, padding:"6px 10px", border:"1px solid #cbd5e1", borderRadius:8, fontSize:13 }} />
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>OT Rate (₹/hr):</span>
                <input type="number" value={otRate} onChange={e=>setOtRate(+e.target.value)} style={{ width:65, padding:"6px 10px", border:"1px solid #cbd5e1", borderRadius:8, fontSize:13 }} />
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#475569" }}>Late Penalty (₹):</span>
                <input type="number" value={lateDeduct} onChange={e=>setLateDeduct(+e.target.value)} style={{ width:65, padding:"6px 10px", border:"1px solid #cbd5e1", borderRadius:8, fontSize:13 }} />
              </div>
            </div>

            <button onClick={downloadPayrollCSV} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", background:"#16a34a", color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 2px 5px rgba(22,163,74,0.25)" }}>
              <Download size={16} /> Export Payroll CSV
            </button>
          </div>

          {/* Payroll Table */}
          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>Calculating Payroll...</div>
          ) : (
            <div style={{ background:"#fff", borderRadius:14, border:"1px solid #f1f5f9", boxShadow:"0 1px 4px rgba(0,0,0,.06)", overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["Employee","Code","Present Days","Leave Days","Late Days","OT Hours","Gross Salary","Deductions","Net Payable"].map(h=>(
                      <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748b", borderBottom:"1px solid #f1f5f9", letterSpacing:".4px", textTransform:"uppercase" }}>{h}</th>
                    ))}
                  </tr>   
                </thead>
                <tbody>
                  {payrollData.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>Koi payroll data nahi mila 🔍</td></tr>
                  ) : payrollData.map((r,i) => {
                    const present = r.presentDays || 0;
                    const otHours = Math.round(((r.totalOvertimeMinutes || 0) / 60) * 10) / 10;
                    const lateDays = r.lateDays || 0;
                    const gross = (present * dailyWage) + (otHours * otRate);
                    const deduct = lateDays * lateDeduct;
                    const net = Math.max(0, gross - deduct);

                    return (
                      <tr key={i} style={{ borderBottom:"1px solid #f8fafc" }}>
                        <td style={{ padding:"12px 16px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <Avatar name={r.employeeName || "?"} />
                            <span style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{r.employeeName}</span>
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px", fontSize:12, color:"#64748b", fontFamily:"monospace", fontWeight:600 }}>{r.employeeCode}</td>
                        <td style={{ padding:"12px 16px", fontSize:13, fontWeight:700, color:"#16a34a" }}>{present} days</td>
                        <td style={{ padding:"12px 16px", fontSize:13, color:"#7c3aed" }}>{r.leaveDays || 0} days</td>
                        <td style={{ padding:"12px 16px", fontSize:13, color:lateDays>0?"#d97706":"#94a3b8" }}>{lateDays} days</td>
                        <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#2563eb" }}>{otHours} hrs</td>
                        <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#334155" }}>₹{gross.toLocaleString('en-IN')}</td>
                        <td style={{ padding:"12px 16px", fontSize:13, color:deduct>0?"#dc2626":"#94a3b8" }}>-₹{deduct}</td>
                        <td style={{ padding:"12px 16px", fontSize:14, fontWeight:800, color:"#0f172a", background:"#f8fafc" }}>₹{net.toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>)}
        </>
      )}
    </div>
    </div>
  );    
}