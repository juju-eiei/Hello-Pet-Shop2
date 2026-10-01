<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';

class AttendanceController {
    private $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function checkIn() {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);

        $employee_id = $data['employee_id'] ?? null;
        $work_date = $data['work_date'] ?? date('Y-m-d');

        if (!$employee_id) {
            Response::json(400, "Employee ID is required");
        }

        $dates = is_array($work_date) ? $work_date : [$work_date];

        try {
            $this->db->beginTransaction();
            // Using ON DUPLICATE KEY UPDATE to handle existing log gracefully
            $sql = "INSERT INTO attendance_logs (employee_id, work_date) 
                    VALUES (:employee_id, :work_date) 
                    ON DUPLICATE KEY UPDATE employee_id = employee_id";
            $stmt = $this->db->prepare($sql);
            
            foreach ($dates as $date) {
                $stmt->execute([
                    ':employee_id' => $employee_id,
                    ':work_date' => $date
                ]);
            }

            $this->db->commit();
            Response::json(200, "Checked in successfully", ["employee_id" => $employee_id, "work_dates" => $dates]);
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            Response::json(500, "Error checking in: " . $e->getMessage());
        }
    }

    public function checkOut() {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);

        $employee_id = $data['employee_id'] ?? null;
        $work_date = $data['work_date'] ?? null;

        if (!$employee_id || !$work_date) {
            Response::json(400, "Employee ID and Date are required");
        }

        $dates = is_array($work_date) ? $work_date : [$work_date];

        try {
            $this->db->beginTransaction();
            $sql = "DELETE FROM attendance_logs WHERE employee_id = :employee_id AND work_date = :work_date";
            $stmt = $this->db->prepare($sql);
            
            foreach ($dates as $date) {
                $stmt->execute([
                    ':employee_id' => $employee_id,
                    ':work_date' => $date
                ]);
            }

            $this->db->commit();
            Response::json(200, "Checked out successfully", ["employee_id" => $employee_id, "work_dates" => $dates]);
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            Response::json(500, "Error checking out: " . $e->getMessage());
        }
    }

    public function getAttendance() {
        $employee_id = $_GET['employee_id'] ?? null;
        $month = $_GET['month'] ?? date('Y-m');

        if (!$employee_id) {
            Response::json(400, "Employee ID is required");
        }

        try {
            if (strlen($month) === 4) {
                $sql = "SELECT work_date FROM attendance_logs 
                        WHERE employee_id = :employee_id AND DATE_FORMAT(work_date, '%Y') = :month 
                        ORDER BY work_date ASC";
            } else {
                $sql = "SELECT work_date FROM attendance_logs 
                        WHERE employee_id = :employee_id AND DATE_FORMAT(work_date, '%Y-%m') = :month 
                        ORDER BY work_date ASC";
            }
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':employee_id' => $employee_id,
                ':month' => $month
            ]);
            $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);

            Response::json(200, "Success", ["dates" => $dates]);
        } catch (Exception $e) {
            Response::json(500, "Error fetching attendance: " . $e->getMessage());
        }
    }

    public function adminOverview() {
        $period = $_GET['period'] ?? date('Y-m');
        try {
            $sql = "SELECT e.employee_id, e.first_name, e.last_name, COALESCE(r.role_name, 'พนักงาน') AS position,
                    COUNT(DISTINCT dates.work_date) AS scheduled_days,
                    COALESCE(SUM(av.attendance_status = 'present'), 0) AS present_days,
                    COALESCE(SUM(av.attendance_status = 'leave'), 0) AS leave_days,
                    COALESCE(SUM(av.attendance_status = 'absent'), 0) AS absent_days,
                    COUNT(DISTINCT dates.work_date) - COUNT(DISTINCT av.work_date) AS pending_days
                    FROM employees e
                    LEFT JOIN users u ON u.user_id = e.user_id
                    LEFT JOIN roles r ON r.role_id = u.role_id
                    LEFT JOIN (
                        SELECT employee_id, work_date FROM work_schedules WHERE booking_status = 'approved' AND DATE_FORMAT(work_date, '%Y-%m') = :period1
                        UNION
                        SELECT employee_id, work_date FROM attendance_logs WHERE DATE_FORMAT(work_date, '%Y-%m') = :period2
                    ) dates ON dates.employee_id = e.employee_id
                    LEFT JOIN attendance_verifications av ON av.employee_id = e.employee_id
                        AND av.work_date = dates.work_date
                    GROUP BY e.employee_id, e.first_name, e.last_name, r.role_name
                    ORDER BY e.first_name, e.last_name";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':period1' => $period, ':period2' => $period]);
            Response::json(200, 'Success', ['period' => $period, 'employees' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (Exception $e) {
            Response::json(500, 'Error fetching attendance overview: ' . $e->getMessage());
        }
    }

    public function adminDetails() {
        $employeeId = (int)($_GET['employee_id'] ?? 0);
        $period = $_GET['period'] ?? date('Y-m');
        if (!$employeeId) { Response::json(400, 'Employee ID is required'); return; }
        try {
            $employeeStmt = $this->db->prepare("SELECT e.employee_id, e.first_name, e.last_name, COALESCE(r.role_name, 'พนักงาน') AS position FROM employees e LEFT JOIN users u ON u.user_id = e.user_id LEFT JOIN roles r ON r.role_id = u.role_id WHERE e.employee_id = :id");
            $employeeStmt->execute([':id' => $employeeId]);
            $employee = $employeeStmt->fetch(PDO::FETCH_ASSOC);
            if (!$employee) { Response::json(404, 'Employee not found'); return; }
            $stmt = $this->db->prepare("SELECT dates.work_date, av.attendance_status, av.notes
                FROM (
                    SELECT work_date FROM work_schedules WHERE employee_id = :id1 AND booking_status = 'approved' AND DATE_FORMAT(work_date, '%Y-%m') = :period1
                    UNION
                    SELECT work_date FROM attendance_logs WHERE employee_id = :id2 AND DATE_FORMAT(work_date, '%Y-%m') = :period2
                ) dates
                LEFT JOIN attendance_verifications av ON av.employee_id = :id3 AND av.work_date = dates.work_date
                ORDER BY dates.work_date ASC");
            $stmt->execute([
                ':id1' => $employeeId,
                ':period1' => $period,
                ':id2' => $employeeId,
                ':period2' => $period,
                ':id3' => $employeeId
            ]);
            Response::json(200, 'Success', ['employee' => $employee, 'dates' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (Exception $e) {
            Response::json(500, 'Error fetching attendance details: ' . $e->getMessage());
        }
    }

    public function adminEmployeeDetails() {
        $this->adminDetails();
    }

    public function verify() {
        $this->verifyAttendance();
    }

    public function verifyAttendance() {
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $employeeId = (int)($data['employee_id'] ?? 0);
        $workDate = $data['work_date'] ?? '';
        $status = $data['attendance_status'] ?? '';
        $notes = trim($data['notes'] ?? '');
        if (!$employeeId || !$workDate || !in_array($status, ['present', 'leave', 'absent'], true)) {
            Response::json(400, 'Employee, date and a valid attendance status are required'); return;
        }
        try {
            $scheduled = $this->db->prepare("
                SELECT 1 FROM work_schedules WHERE employee_id = :id1 AND work_date = :date1 AND booking_status = 'approved'
                UNION
                SELECT 1 FROM attendance_logs WHERE employee_id = :id2 AND work_date = :date2
            ");
            $scheduled->execute([':id1' => $employeeId, ':date1' => $workDate, ':id2' => $employeeId, ':date2' => $workDate]);
            if (!$scheduled->fetchColumn()) { Response::json(400, 'This date is not in the employee work schedule'); return; }
            
            if (session_status() === PHP_SESSION_NONE) session_start();

            $logStmt = $this->db->prepare("INSERT INTO attendance_logs (employee_id, work_date) VALUES (:id, :date) ON DUPLICATE KEY UPDATE employee_id = employee_id");
            $logStmt->execute([':id' => $employeeId, ':date' => $workDate]);

            $stmt = $this->db->prepare("INSERT INTO attendance_verifications (employee_id, work_date, attendance_status, notes, verified_by)
                VALUES (:id, :date, :status, :notes, :by)
                ON DUPLICATE KEY UPDATE attendance_status = VALUES(attendance_status), notes = VALUES(notes), verified_by = VALUES(verified_by)");
            $stmt->execute([':id' => $employeeId, ':date' => $workDate, ':status' => $status, ':notes' => $notes ?: null, ':by' => $_SESSION['user_id'] ?? null]);
            Response::json(200, 'Attendance verified successfully');
        } catch (Exception $e) {
            Response::json(500, 'Error verifying attendance: ' . $e->getMessage());
        }
    }
}
