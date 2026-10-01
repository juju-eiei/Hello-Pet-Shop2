<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';

class SalaryController {
    private $db;
    public function __construct() { $this->db = (new Database())->getConnection(); }
    private function getUserId() { if (session_status() === PHP_SESSION_NONE) session_start(); return $_SESSION['user_id'] ?? null; }

    private function getCalculation($employee, $period) {
        $id = (int)$employee['employee_id'];
        $frequency = $employee['payment_frequency'] ?? 'Monthly';
        if (!in_array($frequency, ['Monthly', 'Daily'], true)) $frequency = 'Monthly';

        $settingsStmt = $this->db->prepare('SELECT * FROM employee_pay_settings WHERE employee_id = :id');
        $settingsStmt->execute([':id' => $id]);
        $setting = $settingsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $rightStmt = $this->db->prepare('SELECT * FROM pay_right_settings WHERE pay_frequency = :freq');
        $rightStmt->execute([':freq' => $frequency]);
        $rightSetting = $rightStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $monthly = $frequency === 'Monthly' ? (float)($employee['base_salary'] ?? $setting['monthly_salary'] ?? $rightSetting['default_rate'] ?? 0) : (float)($setting['monthly_salary'] ?? 0);
        $daily = $frequency === 'Daily' ? (float)($employee['base_salary'] ?? $setting['daily_rate'] ?? $rightSetting['default_rate'] ?? 0) : (float)($setting['daily_rate'] ?? 0);
        $hourlyRate = $frequency === 'Daily' ? (float)($rightSetting['hourly_rate'] ?? 50.00) : 0;

        $attendanceStmt = $this->db->prepare("SELECT COUNT(al.work_date) scheduled_days,
            COUNT(DISTINCT YEARWEEK(al.work_date, 3)) scheduled_weeks,
            COALESCE(SUM(av.attendance_status = 'present'), 0) present_days,
            COALESCE(SUM(av.attendance_status = 'leave'), 0) leave_days,
            COALESCE(SUM(av.attendance_status = 'absent'), 0) absent_days
            FROM attendance_logs al LEFT JOIN attendance_verifications av
                ON av.employee_id = al.employee_id AND av.work_date = al.work_date
            WHERE al.employee_id = :id AND DATE_FORMAT(al.work_date, '%Y-%m') = :period");
        $attendanceStmt->execute([':id' => $id, ':period' => $period]);
        $attendance = $attendanceStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        // Calculate total hours worked for Daily Part-Time staff from approved work_schedules where attendance status is present (or unverified future dates)
        $hoursStmt = $this->db->prepare("SELECT 
            COALESCE(SUM(
                CASE 
                    WHEN ws.start_time IS NOT NULL AND ws.end_time IS NOT NULL AND ws.end_time > ws.start_time 
                    THEN TIMESTAMPDIFF(MINUTE, ws.start_time, ws.end_time) / 60.0 
                    ELSE 8.0 
                END
            ), 0) AS total_hours
            FROM work_schedules ws
            LEFT JOIN attendance_verifications av 
                ON av.employee_id = ws.employee_id AND av.work_date = ws.work_date
            WHERE ws.employee_id = :id 
              AND DATE_FORMAT(ws.work_date, '%Y-%m') = :period 
              AND ws.booking_status = 'approved'
              AND (av.attendance_status = 'present' OR (av.attendance_status IS NULL AND ws.work_date >= CURRENT_DATE()))");
        $hoursStmt->execute([':id' => $id, ':period' => $period]);
        $hoursRow = $hoursStmt->fetch(PDO::FETCH_ASSOC);
        $totalHours = (float)($hoursRow['total_hours'] ?? 0);

        if ($frequency === 'Daily') {
            $base = $totalHours * $hourlyRate;
        } else {
            $base = $monthly;
        }

        $leaveRate = isset($setting['leave_deduction_per_day']) && (float)$setting['leave_deduction_per_day'] > 0
            ? (float)$setting['leave_deduction_per_day']
            : (float)($rightSetting['leave_deduction_per_day'] ?? 0);

        $absenceRate = isset($setting['absence_deduction_per_day']) && (float)$setting['absence_deduction_per_day'] > 0
            ? (float)$setting['absence_deduction_per_day']
            : (float)($rightSetting['absence_deduction_per_day'] ?? 0);

        $leaveDeduction = (int)($attendance['leave_days'] ?? 0) * $leaveRate;
        $absenceDeduction = (int)($attendance['absent_days'] ?? 0) * $absenceRate;

        $weekly = (float)($setting['weekly_rate'] ?? 0);
        return array_merge($attendance, [
            'pay_frequency' => $frequency, 'monthly_salary' => $monthly, 'weekly_rate' => $weekly, 'daily_rate' => $daily,
            'hourly_rate' => $hourlyRate, 'total_hours' => $totalHours,
            'leave_deduction_per_day' => $leaveRate, 'absence_deduction_per_day' => $absenceRate,
            'base_salary' => $base, 'leave_deduction' => $leaveDeduction,
            'absence_deduction' => $absenceDeduction, 'deductions' => $leaveDeduction + $absenceDeduction,
            'net_paid' => max(0, $base - $leaveDeduction - $absenceDeduction)
        ]);
    }

    public function index() {
        try {
            $period = $_GET['period'] ?? date('Y-m');
            $search = trim($_GET['search'] ?? '');
            $sql = "SELECT e.*, u.email, COALESCE(r.role_name, 'พนักงาน') AS position FROM employees e LEFT JOIN users u ON e.user_id = u.user_id LEFT JOIN roles r ON r.role_id = u.role_id WHERE 1=1";
            $params = [];
            if ($search !== '') { $sql .= ' AND (e.first_name LIKE :s OR e.last_name LIKE :s OR r.role_name LIKE :s OR u.email LIKE :s)'; $params[':s'] = "%$search%"; }
            $sql .= ' ORDER BY e.employee_id';
            $stmt = $this->db->prepare($sql); $stmt->execute($params); $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $payStmt = $this->db->prepare('SELECT * FROM salary_payments WHERE pay_period = :period'); $payStmt->execute([':period' => $period]);
            $payments = []; foreach ($payStmt->fetchAll(PDO::FETCH_ASSOC) as $payment) $payments[$payment['employee_id']] = $payment;
            $items = []; $summary = ['total_employees' => count($employees), 'total_payroll' => 0, 'paid_count' => 0, 'paid_amount' => 0, 'pending_count' => 0, 'pending_amount' => 0];
            foreach ($employees as $employee) {
                $calc = $this->getCalculation($employee, $period); $id = $employee['employee_id']; $payment = $payments[$id] ?? null; $paid = (bool)$payment;
                $base = $paid ? (float)$payment['base_salary'] : $calc['base_salary'];
                $deduction = $paid ? (float)$payment['deductions'] : $calc['deductions'];
                $net = $paid ? (float)$payment['net_paid'] : $calc['net_paid'];
                $items[] = array_merge($calc, ['employee_id'=>(int)$id, 'name'=>trim($employee['first_name'].' '.$employee['last_name']), 'position'=>$employee['position'] ?? 'พนักงาน', 'email'=>$employee['email'] ?? '', 'bank_account_details'=>$employee['bank_account_details'] ?? '', 'days_worked'=>(int)$calc['scheduled_days'], 'status'=>$paid?'paid':'pending', 'payment_id'=>$paid?(int)$payment['payment_id']:null, 'base_salary'=>$base, 'deductions'=>$deduction, 'net_paid'=>$net, 'payment_date'=>$paid?$payment['payment_date']:null, 'payment_method'=>$paid?$payment['payment_method']:'transfer', 'notes'=>$paid?$payment['notes']:null, 'transaction_id'=>$paid&&!empty($payment['transaction_id'])?(int)$payment['transaction_id']:null]);
                $summary['total_payroll'] += $net;
                if ($paid) { $summary['paid_count']++; $summary['paid_amount'] += $net; } else { $summary['pending_count']++; $summary['pending_amount'] += $net; }
            }
            Response::json(200, 'Success', ['period'=>$period, 'summary'=>$summary, 'data'=>$items]);
        } catch (Exception $e) { Response::json(500, 'Error fetching payroll info', ['error'=>$e->getMessage()]); }
    }

    public function pay() {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?: $_POST; $id = (int)($data['employee_id'] ?? 0); $period = trim($data['pay_period'] ?? date('Y-m')); $date = substr($data['payment_date'] ?? date('Y-m-d'), 0, 10); $method = $data['payment_method'] ?? 'transfer'; $notes = trim($data['notes'] ?? '');
            if (!$id) { Response::json(400, 'Employee ID is required'); return; }
            $stmt = $this->db->prepare('SELECT * FROM employees WHERE employee_id = :id'); $stmt->execute([':id'=>$id]); $employee = $stmt->fetch(PDO::FETCH_ASSOC); if (!$employee) { Response::json(404, 'Employee not found'); return; }
            $calc = $this->getCalculation($employee, $period); if ($calc['net_paid'] <= 0) { Response::json(400, 'Net salary must be greater than zero'); return; }
            $this->db->beginTransaction();
            $sql = "INSERT INTO salary_payments (employee_id,pay_period,base_salary,bonus,deductions,net_paid,payment_date,payment_method,notes,created_by) VALUES (:id,:period,:base,0,:deduct,:net,:date,:method,:notes,:by) ON DUPLICATE KEY UPDATE base_salary=VALUES(base_salary),bonus=0,deductions=VALUES(deductions),net_paid=VALUES(net_paid),payment_date=VALUES(payment_date),payment_method=VALUES(payment_method),notes=VALUES(notes),created_by=VALUES(created_by)";
            $this->db->prepare($sql)->execute([':id'=>$id, ':period'=>$period, ':base'=>$calc['base_salary'], ':deduct'=>$calc['deductions'], ':net'=>$calc['net_paid'], ':date'=>$date, ':method'=>$method, ':notes'=>$notes, ':by'=>$this->getUserId()]);
            $get = $this->db->prepare('SELECT payment_id, transaction_id FROM salary_payments WHERE employee_id=:id AND pay_period=:period'); $get->execute([':id'=>$id, ':period'=>$period]); $payment = $get->fetch(PDO::FETCH_ASSOC);
            $title = 'จ่ายเงินเดือนพนักงาน: '.trim($employee['first_name'].' '.$employee['last_name'])." (ประจำเดือน $period)";
            $desc = 'ค่าจ้างก่อนหัก: '.number_format($calc['base_salary'],2).' บาท, หักลา '.$calc['leave_days'].' วัน: '.number_format($calc['leave_deduction'],2).' บาท, หักขาด '.$calc['absent_days'].' วัน: '.number_format($calc['absence_deduction'],2).' บาท'.($notes ? " ($notes)" : '');
            if (!empty($payment['transaction_id'])) $this->db->prepare('UPDATE financial_transactions SET amount=:amount, description=:description, transaction_date=:date, title=:title WHERE transaction_id=:id')->execute([':amount'=>$calc['net_paid'], ':description'=>$desc, ':date'=>$date, ':title'=>$title, ':id'=>$payment['transaction_id']]);
            else { $this->db->prepare("INSERT INTO financial_transactions (type,category,title,amount,description,transaction_date,reference_type,reference_id,created_by) VALUES ('expense','เงินเดือนพนักงาน',:title,:amount,:description,:date,'salary',:reference,:by)")->execute([':title'=>$title, ':amount'=>$calc['net_paid'], ':description'=>$desc, ':date'=>$date, ':reference'=>$payment['payment_id'], ':by'=>$this->getUserId()]); $this->db->prepare('UPDATE salary_payments SET transaction_id=:transaction WHERE payment_id=:payment')->execute([':transaction'=>$this->db->lastInsertId(), ':payment'=>$payment['payment_id']]); }
            $this->db->commit(); Response::json(200, 'Recorded salary payment successfully', ['payment_id'=>(int)$payment['payment_id'], 'net_paid'=>$calc['net_paid']]);
        } catch (Exception $e) { if ($this->db->inTransaction()) $this->db->rollBack(); Response::json(500, 'Error recording salary payment', ['error'=>$e->getMessage()]); }
    }

    public function getRights() {
        try {
            $stmt = $this->db->query("SELECT * FROM pay_right_settings ORDER BY FIELD(pay_frequency, 'Monthly', 'Daily')");
            Response::json(200, 'Success', $stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (Exception $e) { Response::json(500, 'Error fetching pay rights: '.$e->getMessage()); }
    }

    public function updateRights() {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
            $rights = isset($data[0]) ? $data : [$data];
            $stmt = $this->db->prepare("INSERT INTO pay_right_settings 
                (pay_frequency, right_name, default_rate, hourly_rate, work_start_time, work_end_time, leave_deduction_per_day, absence_deduction_per_day)
                VALUES (:freq, :name, :rate, :hourly, :start_t, :end_t, :leave, :absence)
                ON DUPLICATE KEY UPDATE 
                right_name=VALUES(right_name), 
                default_rate=VALUES(default_rate), 
                hourly_rate=VALUES(hourly_rate), 
                work_start_time=VALUES(work_start_time), 
                work_end_time=VALUES(work_end_time), 
                leave_deduction_per_day=VALUES(leave_deduction_per_day), 
                absence_deduction_per_day=VALUES(absence_deduction_per_day)");
            foreach ($rights as $r) {
                $freq = $r['pay_frequency'] ?? '';
                if (!in_array($freq, ['Monthly', 'Daily'], true)) continue;
                $name = $r['right_name'] ?? ($freq === 'Monthly' ? 'สิทธิ์รายเดือน' : 'สิทธิ์รายวัน');
                $rate = max(0, (float)($r['default_rate'] ?? 0));
                $hourly = max(0, (float)($r['hourly_rate'] ?? 50.00));
                $startTime = !empty($r['work_start_time']) ? $r['work_start_time'] : '10:00:00';
                $endTime = !empty($r['work_end_time']) ? $r['work_end_time'] : '18:00:00';
                $leave = max(0, (float)($r['leave_deduction_per_day'] ?? 0));
                $absence = max(0, (float)($r['absence_deduction_per_day'] ?? 0));

                $stmt->execute([
                    ':freq' => $freq,
                    ':name' => $name,
                    ':rate' => $rate,
                    ':hourly' => $hourly,
                    ':start_t' => $startTime,
                    ':end_t' => $endTime,
                    ':leave' => $leave,
                    ':absence' => $absence
                ]);
            }
            Response::json(200, 'Pay rights updated successfully');
        } catch (Exception $e) { Response::json(500, 'Error updating pay rights: '.$e->getMessage()); }
    }

    public function settings() {
        try {
            $rightsStmt = $this->db->query("SELECT * FROM pay_right_settings ORDER BY FIELD(pay_frequency, 'Monthly', 'Daily')");
            $rights = $rightsStmt->fetchAll(PDO::FETCH_ASSOC);
            $sql = "SELECT e.employee_id, e.first_name, e.last_name, COALESCE(r.role_name, 'พนักงาน') AS position, e.base_salary, e.payment_frequency, ps.pay_frequency, ps.monthly_salary, ps.weekly_rate, ps.daily_rate, ps.leave_deduction_per_day, ps.absence_deduction_per_day FROM employees e LEFT JOIN users u ON e.user_id = u.user_id LEFT JOIN roles r ON r.role_id = u.role_id LEFT JOIN employee_pay_settings ps ON ps.employee_id=e.employee_id ORDER BY e.first_name,e.last_name";
            $employees = $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
            Response::json(200, 'Success', ['rights' => $rights, 'employees' => $employees, 'data' => $rights]);
        } catch (Exception $e) { Response::json(500, 'Error fetching pay settings: '.$e->getMessage()); }
    }

    public function updateSettings() {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
            if (isset($data['rights'])) {
                $this->updateRights();
                return;
            }
            $id=(int)($data['employee_id']??0); $frequency=$data['pay_frequency']??'Monthly'; if (!$id || !in_array($frequency,['Monthly','Daily'],true)) { Response::json(400,'Invalid pay-setting data'); return; }
            $values=[':id'=>$id, ':frequency'=>$frequency, ':monthly'=>max(0,(float)($data['monthly_salary']??0)), ':weekly'=>max(0,(float)($data['weekly_rate']??0)), ':daily'=>max(0,(float)($data['daily_rate']??0)), ':leave'=>max(0,(float)($data['leave_deduction_per_day']??0)), ':absence'=>max(0,(float)($data['absence_deduction_per_day']??0))];
            $sql='INSERT INTO employee_pay_settings (employee_id,pay_frequency,monthly_salary,weekly_rate,daily_rate,leave_deduction_per_day,absence_deduction_per_day) VALUES (:id,:frequency,:monthly,:weekly,:daily,:leave,:absence) ON DUPLICATE KEY UPDATE pay_frequency=VALUES(pay_frequency),monthly_salary=VALUES(monthly_salary),weekly_rate=VALUES(weekly_rate),daily_rate=VALUES(daily_rate),leave_deduction_per_day=VALUES(leave_deduction_per_day),absence_deduction_per_day=VALUES(absence_deduction_per_day)'; $this->db->prepare($sql)->execute($values);
            $legacyRate = $frequency==='Monthly' ? $values[':monthly'] : $values[':daily']; $this->db->prepare('UPDATE employees SET base_salary=:rate, payment_frequency=:frequency WHERE employee_id=:id')->execute([':rate'=>$legacyRate, ':frequency'=>$frequency, ':id'=>$id]); Response::json(200,'Pay settings updated successfully');
        } catch (Exception $e) { Response::json(500, 'Error updating pay settings: '.$e->getMessage()); }
    }

    public function delete() { try { $data=json_decode(file_get_contents('php://input'),true)?:[]; $id=$data['payment_id']??$_GET['payment_id']??null; if(!$id){Response::json(400,'Payment ID is required');return;} $this->db->beginTransaction(); $s=$this->db->prepare('SELECT transaction_id FROM salary_payments WHERE payment_id=:id');$s->execute([':id'=>$id]);$p=$s->fetch(PDO::FETCH_ASSOC); if($p){if($p['transaction_id'])$this->db->prepare('DELETE FROM financial_transactions WHERE transaction_id=:id')->execute([':id'=>$p['transaction_id']]);$this->db->prepare("DELETE FROM financial_transactions WHERE reference_type='salary' AND reference_id=:id")->execute([':id'=>$id]);$this->db->prepare('DELETE FROM salary_payments WHERE payment_id=:id')->execute([':id'=>$id]);}$this->db->commit();Response::json(200,'Salary payment deleted successfully'); } catch(Exception $e){if($this->db->inTransaction())$this->db->rollBack();Response::json(500,'Error deleting salary payment',['error'=>$e->getMessage()]);} }
    public function history() { try {$id=(int)($_GET['employee_id']??0);if(!$id){Response::json(400,'Employee ID is required');return;}$e=$this->db->prepare('SELECT first_name,last_name,position FROM employees WHERE employee_id=:id');$e->execute([':id'=>$id]);$employee=$e->fetch(PDO::FETCH_ASSOC);if(!$employee){Response::json(404,'Employee not found');return;}$s=$this->db->prepare('SELECT * FROM salary_payments WHERE employee_id=:id ORDER BY pay_period DESC');$s->execute([':id'=>$id]);Response::json(200,'Success',['employee'=>['employee_id'=>$id,'name'=>trim($employee['first_name'].' '.$employee['last_name']),'position'=>$employee['position']??'พนักงาน'],'data'=>$s->fetchAll(PDO::FETCH_ASSOC)]);}catch(Exception $e){Response::json(500,'Error fetching payment history',['error'=>$e->getMessage()]);} }
    public function updateBaseSalary() { $this->updateSettings(); }
}
?>
