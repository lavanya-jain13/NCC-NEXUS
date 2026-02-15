import React, { useEffect, useState } from "react";
import "./anoAttendance.css";
import {
	ATTENDANCE_STORAGE_KEY,
	loadAttendanceSessions,
	MONTHS,
	saveAttendanceSessions,
} from "../attendanceStore";

function calculateAttendance(attArr) {
	const total = attArr.length;
	const attended = attArr.filter((value) => value === "P").length;
	const percent = total ? ((attended / total) * 100).toFixed(1) : "0";
	return { attended, total, percent };
}

const AnoAttendance = () => {
	const [selectedSession, setSelectedSession] = useState("February");
	const [sessionState, setSessionState] = useState(loadAttendanceSessions);
	const currentSession = sessionState[selectedSession] || sessionState[MONTHS[0]];
	const drills = currentSession.drills;
	const cadets = currentSession.cadets;

	useEffect(() => {
		saveAttendanceSessions(sessionState);
	}, [sessionState]);

	useEffect(() => {
		const syncAttendance = (event) => {
			if (event.key === ATTENDANCE_STORAGE_KEY) {
				setSessionState(loadAttendanceSessions());
			}
		};

		window.addEventListener("storage", syncAttendance);
		return () => window.removeEventListener("storage", syncAttendance);
	}, []);

	const setCurrentSession = (updater) => {
		setSessionState((prev) => ({
			...prev,
			[selectedSession]: updater(prev[selectedSession]),
		}));
	};

	const toggleAttendance = (cadetIdx, drillIdx) => {
		setCurrentSession((session) => ({
			...session,
			cadets: session.cadets.map((cadet, idx) =>
				idx !== cadetIdx
					? cadet
					: {
							...cadet,
							attendance: cadet.attendance.map((value, j) =>
								j !== drillIdx ? value : value === "P" ? "A" : "P"
							),
						}
			),
		}));
	};

	const handleDownload = () => {
		let csv = "Cadet Name,";
		drills.forEach((drill) => {
			csv += `${drill.label} (${drill.date}),`;
		});
		csv += "Total Drills,Total Attendance,Percentage\n";
		cadets.forEach((cadet) => {
			csv += `${cadet.name},`;
			cadet.attendance.forEach((status) => {
				csv += `${status},`;
			});
			const { attended, total, percent } = calculateAttendance(cadet.attendance);
			csv += `${total},${attended},${percent}%\n`;
		});
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${selectedSession}_attendance.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="ano-attendance-container">
			<h2 className="ano-attendance-title">Attendance Monitoring</h2>
			<div className="ano-attendance-toolbar">
				<label className="ano-attendance-label">Session:</label>
				<select
					className="ano-attendance-session-select"
					value={selectedSession}
					onChange={e => setSelectedSession(e.target.value)}
				>
					{MONTHS.map(month => (
						<option key={month} value={month}>{month}</option>
					))}
				</select>
				<button className="ano-attendance-btn ano-attendance-btn-primary" onClick={handleDownload}>
					Download Attendance
				</button>
			</div>
			<div className="ano-attendance-table-card">
				<table className="ano-attendance-table">
					<thead>
						<tr>
							<th className="ano-col-cadet">Cadet Name</th>
							{drills.map((drill) => (
								<th key={drill.id} className="ano-col-drill">
									<div className="ano-drill-head">{drill.label}</div>
									<div className="ano-drill-date">{drill.date}</div>
								</th>
							))}
							<th>Total Drills</th>
							<th>Total Attendance</th>
							<th>Percentage</th>
						</tr>
					</thead>
					<tbody>
						{cadets.map((cadet, cadetIdx) => {
							const { attended, total, percent } = calculateAttendance(cadet.attendance);
							return (
								<tr key={cadet.id}>
									<td className="ano-cadet-name-cell">{cadet.name}</td>
									{drills.map((drill, drillIdx) => {
										const status = cadet.attendance[drillIdx] || "P";
										return (
											<td key={`${cadet.id}-${drill.id}`}>
												<button
													className={`ano-attendance-pill ${status === "P" ? "present" : "absent"}`}
													onClick={() => toggleAttendance(cadetIdx, drillIdx)}
												>
													{status}
												</button>
											</td>
										);
									})}
									<td className="ano-total-cell">{total}</td>
									<td className="ano-total-cell">{attended}</td>
									<td className="ano-total-cell">{percent}%</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default AnoAttendance;
