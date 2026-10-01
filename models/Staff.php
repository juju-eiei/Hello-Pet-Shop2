<?php
require_once __DIR__ . '/../config/database.php';

class Staff {
    private $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getAll($keyword = '') {
        $thisMonth = date('Y-m');
        $sql = "SELECT e.*, u.email, u.username, u.role_id, u.permissions, r.role_name,
                (SELECT COUNT(*) FROM attendance_logs al WHERE al.employee_id = e.employee_id AND DATE_FORMAT(al.work_date, '%Y-%m') = '{$thisMonth}') as days_worked
                FROM employees e 
                JOIN users u ON e.user_id = u.user_id 
                LEFT JOIN roles r ON u.role_id = r.role_id ";
        
        if (!empty($keyword)) {
            $sql .= " WHERE e.first_name LIKE :keyword OR e.last_name LIKE :keyword OR u.email LIKE :keyword OR r.role_name LIKE :keyword ";
        }
        $sql .= " ORDER BY e.employee_id DESC";

        $stmt = $this->db->prepare($sql);
        if (!empty($keyword)) {
            $stmt->bindValue(':keyword', '%' . $keyword . '%');
        }
        $stmt->execute();
        
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($results as &$row) {
            $row['permissions'] = $row['permissions'] ? json_decode($row['permissions'], true) : [];
        }
        return $results;
    }

    public function getById($id) {
        $sql = "SELECT e.*, u.email, u.username, u.role_id, u.permissions, r.role_name 
                FROM employees e 
                JOIN users u ON e.user_id = u.user_id 
                LEFT JOIN roles r ON u.role_id = r.role_id 
                WHERE e.employee_id = :id";
        
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) {
            $result['permissions'] = $result['permissions'] ? json_decode($result['permissions'], true) : [];
        }
        return $result;
    }

    public function getByUserId($user_id) {
        $sql = "SELECT e.*, u.email, u.username, u.role_id, u.permissions, r.role_name 
                FROM employees e 
                JOIN users u ON e.user_id = u.user_id 
                LEFT JOIN roles r ON u.role_id = r.role_id 
                WHERE e.user_id = :user_id";
        
        $stmt = $this->db->prepare($sql);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) {
            $result['permissions'] = $result['permissions'] ? json_decode($result['permissions'], true) : [];
        }
        return $result;
    }

    public function create($data) {
        try {
            $this->db->beginTransaction();

            $password = password_hash($data['password'], PASSWORD_DEFAULT);
            
            // Allow manual username or fallback to generated
            $username = !empty($data['username']) ? trim($data['username']) : (strtolower(str_replace(' ', '', $data['first_name'])) . rand(100, 999));
            $roleId = !empty($data['role_id']) ? (int)$data['role_id'] : 2; // Default to Employee (role_id = 2)
            
            $sqlUser = "INSERT INTO users (role_id, username, password, email, permissions) 
                        VALUES (:role_id, :username, :password, :email, :permissions)";
            $stmtUser = $this->db->prepare($sqlUser);
            $stmtUser->bindValue(':role_id', $roleId);
            $stmtUser->bindValue(':username', $username);
            $stmtUser->bindValue(':password', $password);
            $stmtUser->bindValue(':email', $data['email']);
            $stmtUser->bindValue(':permissions', json_encode($data['permissions'] ?? []));
            $stmtUser->execute();
            
            $userId = $this->db->lastInsertId();

            $sqlEmp = "INSERT INTO employees 
                        (user_id, first_name, last_name, phone, position, address, base_salary, payment_frequency, bank_account_details) 
                        VALUES (:user_id, :first_name, :last_name, :phone, :position, :address, :base_salary, :payment_frequency, :bank_account_details)";
            $stmtEmp = $this->db->prepare($sqlEmp);
            $stmtEmp->bindValue(':user_id', $userId);
            $stmtEmp->bindValue(':first_name', $data['first_name']);
            $stmtEmp->bindValue(':last_name', $data['last_name'] ?? '');
            $stmtEmp->bindValue(':phone', $data['phone'] ?? null);
            $stmtEmp->bindValue(':position', $data['position'] ?? null);
            $stmtEmp->bindValue(':address', $data['address'] ?? null);
            $stmtEmp->bindValue(':base_salary', !empty($data['base_salary']) ? (float)$data['base_salary'] : 0);
            $stmtEmp->bindValue(':payment_frequency', $data['payment_frequency'] ?? 'Monthly');
            $stmtEmp->bindValue(':bank_account_details', $data['bank_account_details'] ?? null);
            $stmtEmp->execute();

            $employeeId = $this->db->lastInsertId();
            $frequency = $data['payment_frequency'] ?? 'Monthly';
            $rate = !empty($data['base_salary']) ? (float)$data['base_salary'] : 0;

            $rightStmt = $this->db->prepare("SELECT * FROM pay_right_settings WHERE pay_frequency = :freq");
            $rightStmt->execute([':freq' => $frequency]);
            $rightData = $rightStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $leaveDed = (float)($rightData['leave_deduction_per_day'] ?? 0);
            $absDed = (float)($rightData['absence_deduction_per_day'] ?? 0);

            $stmtPay = $this->db->prepare("INSERT INTO employee_pay_settings 
                (employee_id, pay_frequency, monthly_salary, weekly_rate, daily_rate, leave_deduction_per_day, absence_deduction_per_day)
                VALUES (:id, :frequency, :monthly, :weekly, :daily, :leave, :absence)
                ON DUPLICATE KEY UPDATE 
                pay_frequency = VALUES(pay_frequency), 
                monthly_salary = VALUES(monthly_salary), 
                weekly_rate = VALUES(weekly_rate), 
                daily_rate = VALUES(daily_rate),
                leave_deduction_per_day = VALUES(leave_deduction_per_day),
                absence_deduction_per_day = VALUES(absence_deduction_per_day)");
            $stmtPay->execute([
                ':id' => $employeeId,
                ':frequency' => $frequency,
                ':monthly' => $frequency === 'Monthly' ? $rate : 0,
                ':weekly' => 0,
                ':daily' => $frequency === 'Daily' ? $rate : 0,
                ':leave' => $leaveDed,
                ':absence' => $absDed
            ]);

            $this->db->commit();

            if ($frequency === 'Daily') {
                $delWs = $this->db->prepare("DELETE FROM work_schedules WHERE employee_id = :id AND created_by IS NULL AND attendance_status = 'unverified'");
                $delWs->execute([':id' => $employeeId]);
            }

            return true;
        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log("Staff create PDOException: " . $e->getMessage());
            if ($e->getCode() == 23000 || strpos($e->getMessage(), '1062 Duplicate entry') !== false) {
                if (strpos($e->getMessage(), 'username') !== false) {
                    throw new Exception("ชื่อผู้ใช้งาน (Username) นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น");
                } elseif (strpos($e->getMessage(), 'email') !== false) {
                    throw new Exception("อีเมล (Email) นี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น");
                } else {
                    throw new Exception("ข้อมูลซ้ำกับที่มีอยู่ในระบบแล้ว");
                }
            }
            throw new Exception("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " . $e->getMessage());
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Staff create Exception: " . $e->getMessage());
            throw $e;
        }
    }

    public function update($id, $data) {
        try {
            $this->db->beginTransaction();

            $emp = $this->getById($id);
            if (!$emp) throw new Exception("Employee not found");
            $userId = $emp['user_id'];
            $roleId = !empty($data['role_id']) ? (int)$data['role_id'] : (int)($emp['role_id'] ?? 2);

            $sqlUser = "UPDATE users SET role_id = :role_id, email = :email, username = :username, permissions = :permissions";
            if (!empty($data['password'])) {
                $sqlUser .= ", password = :password";
            }
            $sqlUser .= " WHERE user_id = :user_id";

            $stmtUser = $this->db->prepare($sqlUser);
            $stmtUser->bindValue(':role_id', $roleId);
            $stmtUser->bindValue(':email', $data['email'] ?? $emp['email']);
            $stmtUser->bindValue(':username', !empty($data['username']) ? trim($data['username']) : $emp['username']);
            $stmtUser->bindValue(':permissions', json_encode($data['permissions'] ?? ($emp['permissions'] ?? [])));
            $stmtUser->bindValue(':user_id', $userId);
            
            if (!empty($data['password'])) {
                $stmtUser->bindValue(':password', password_hash($data['password'], PASSWORD_DEFAULT));
            }
            $stmtUser->execute();

            $sqlEmp = "UPDATE employees SET 
                        first_name = :first_name, 
                        last_name = :last_name, 
                        phone = :phone, 
                        position = :position, 
                        address = :address, 
                        base_salary = :base_salary, 
                        payment_frequency = :payment_frequency, 
                        bank_account_details = :bank_account_details 
                        WHERE employee_id = :id";
            $stmtEmp = $this->db->prepare($sqlEmp);
            $stmtEmp->bindValue(':id', $id);
            $stmtEmp->bindValue(':first_name', $data['first_name'] ?? $emp['first_name']);
            $stmtEmp->bindValue(':last_name', $data['last_name'] ?? $emp['last_name'] ?? '');
            $stmtEmp->bindValue(':phone', $data['phone'] ?? $emp['phone']);
            $stmtEmp->bindValue(':position', $data['position'] ?? $emp['position'] ?? null);
            $stmtEmp->bindValue(':address', $data['address'] ?? $emp['address']);
            $stmtEmp->bindValue(':base_salary', isset($data['base_salary']) ? (float)$data['base_salary'] : (float)($emp['base_salary'] ?? 0));
            $stmtEmp->bindValue(':payment_frequency', $data['payment_frequency'] ?? $emp['payment_frequency'] ?? 'Monthly');
            $stmtEmp->bindValue(':bank_account_details', $data['bank_account_details'] ?? $emp['bank_account_details']);
            $stmtEmp->execute();

            $frequency = $data['payment_frequency'] ?? $emp['payment_frequency'] ?? 'Monthly';
            $rate = isset($data['base_salary']) ? (float)$data['base_salary'] : (float)($emp['base_salary'] ?? 0);

            $rightStmt = $this->db->prepare("SELECT * FROM pay_right_settings WHERE pay_frequency = :freq");
            $rightStmt->execute([':freq' => $frequency]);
            $rightData = $rightStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $leaveDed = (float)($rightData['leave_deduction_per_day'] ?? 0);
            $absDed = (float)($rightData['absence_deduction_per_day'] ?? 0);

            $stmtPay = $this->db->prepare("INSERT INTO employee_pay_settings 
                (employee_id, pay_frequency, monthly_salary, weekly_rate, daily_rate, leave_deduction_per_day, absence_deduction_per_day)
                VALUES (:id, :frequency, :monthly, :weekly, :daily, :leave, :absence)
                ON DUPLICATE KEY UPDATE 
                pay_frequency = VALUES(pay_frequency), 
                monthly_salary = VALUES(monthly_salary), 
                weekly_rate = VALUES(weekly_rate), 
                daily_rate = VALUES(daily_rate),
                leave_deduction_per_day = VALUES(leave_deduction_per_day),
                absence_deduction_per_day = VALUES(absence_deduction_per_day)");
            $stmtPay->execute([
                ':id' => $id,
                ':frequency' => $frequency,
                ':monthly' => $frequency === 'Monthly' ? $rate : 0,
                ':weekly' => 0,
                ':daily' => $frequency === 'Daily' ? $rate : 0,
                ':leave' => $leaveDed,
                ':absence' => $absDed
            ]);

            $this->db->commit();

            if ($frequency === 'Daily') {
                $delWs = $this->db->prepare("DELETE FROM work_schedules WHERE employee_id = :id AND created_by IS NULL AND attendance_status = 'unverified'");
                $delWs->execute([':id' => $id]);
            }

            return true;
        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log("Staff update PDOException: " . $e->getMessage());
            if ($e->getCode() == 23000 || strpos($e->getMessage(), '1062 Duplicate entry') !== false) {
                if (strpos($e->getMessage(), 'username') !== false) {
                    throw new Exception("ชื่อผู้ใช้งาน (Username) นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น");
                } elseif (strpos($e->getMessage(), 'email') !== false) {
                    throw new Exception("อีเมล (Email) นี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น");
                } else {
                    throw new Exception("ข้อมูลซ้ำกับที่มีอยู่ในระบบแล้ว");
                }
            }
            throw new Exception("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " . $e->getMessage());
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Staff update Exception: " . $e->getMessage());
            throw $e;
        }
    }

    public function delete($id) {
        try {
            $this->db->beginTransaction();
            $emp = $this->getById($id);
            if ($emp) {
                $this->db->prepare("DELETE FROM employees WHERE employee_id = :id")->execute([':id' => $id]);
                $this->db->prepare("DELETE FROM users WHERE user_id = :user_id")->execute([':user_id' => $emp['user_id']]);
            }
            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    public function getRoles() {
        $stmt = $this->db->query("SELECT * FROM roles ORDER BY role_name");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>
