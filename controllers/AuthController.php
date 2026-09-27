<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/RateLimiter.php';

class AuthController {
    private $db;
    private $userModel;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->userModel = new User($this->db);
    }

    public function login() {
        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['username']) || empty($data['password'])) {
            Response::json(400, "กรุณากรอก Username และ Password");
            return;
        }

        $user = $this->userModel->findByUsername($data['username']);

        if ($user && password_verify($data['password'], $user['password'])) {
            // Remove password from response
            unset($user['password']);
            
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            // Clear any lingering session keys from previously logged-in accounts
            $_SESSION = [];
            session_regenerate_id(true); // Regenerate session ID to prevent Session Fixation
            $_SESSION['user_id'] = $user['user_id'];
            $_SESSION['role'] = $user['role_name'];

            // Generate CSRF Token on successful login
            if (empty($_SESSION['csrf_token'])) {
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            }
            $user['csrf_token'] = $_SESSION['csrf_token'];

            $roleNameLower = strtolower($user['role_name'] ?? '');

            // Calculate user and role permissions
            $userPerms = json_decode($user['permissions'] ?? '[]', true) ?: [];
            $stmtRole = $this->db->prepare("SELECT permissions FROM roles WHERE role_id = ?");
            $stmtRole->execute([$user['role_id']]);
            $roleData = $stmtRole->fetch(PDO::FETCH_ASSOC);
            $rolePerms = json_decode($roleData['permissions'] ?? '[]', true) ?: [];

            if ($roleNameLower === 'admin') {
                $allPerms = [
                    "dashboard_view", "products_manage", "stock_view", "stock_manage",
                    "orders_manage", "orders_view", "customers_view", "customers_manage",
                    "promotions_view", "promotions_manage", "delivery_view", "delivery_manage",
                    "rewards_view", "rewards_manage", "staff_manage", "staff_profile_manage", "pos_access"
                ];
            } else {
                if (empty($rolePerms) && ($roleNameLower === 'employee' || $roleNameLower === 'staff')) {
                    $rolePerms = [
                        'pos_access', 'orders_manage', 'orders_view', 'customers_view',
                        'stock_view', 'stock_manage', 'promotions_view', 'staff_profile_manage', 'rewards_view'
                    ];
                }
                $allPerms = array_values(array_unique(array_merge($userPerms, $rolePerms)));
            }
            $user['permissions'] = $allPerms;

            if (strtolower($user['role_name']) === 'customer') {
                $stmtCust = $this->db->prepare("SELECT customer_id, first_name, last_name, 
                             COALESCE(NULLIF(phone, ''), (SELECT a.phone FROM addresses a WHERE a.customer_id = customers.customer_id AND a.phone IS NOT NULL AND a.phone != '' ORDER BY a.is_default DESC, a.address_id DESC LIMIT 1)) as phone
                             FROM customers WHERE user_id = ?");
                $stmtCust->execute([$user['user_id']]);
                $cust = $stmtCust->fetch(PDO::FETCH_ASSOC);
                if ($cust) {
                    $user['customer_id'] = $cust['customer_id'];
                    $user['first_name'] = $cust['first_name'];
                    $user['last_name'] = $cust['last_name'];
                    $user['phone'] = $cust['phone'] ?: '';
                }
            } elseif (in_array(strtolower($user['role_name']), ['admin', 'employee', 'staff'])) {
                $stmtEmp = $this->db->prepare("SELECT employee_id, first_name, last_name, phone FROM employees WHERE user_id = ?");
                $stmtEmp->execute([$user['user_id']]);
                $emp = $stmtEmp->fetch(PDO::FETCH_ASSOC);
                if ($emp) {
                    $user['employee_id'] = $emp['employee_id'];
                    if (empty($user['first_name']) && !empty($emp['first_name'])) {
                        $user['first_name'] = $emp['first_name'];
                        $user['last_name'] = $emp['last_name'];
                        $user['phone'] = $emp['phone'];
                    }
                }
            }

            Response::json(200, "เข้าสู่ระบบสำเร็จ", $user);
        } else {
            Response::json(401, "Username หรือ Password ไม่ถูกต้อง");
        }
    }

    public function register() {


        $data = json_decode(file_get_contents("php://input"), true);

        if (empty($data['full_name']) || empty($data['email']) || empty($data['password']) || empty($data['username'])) {
            Response::json(400, "กรุณากรอกข้อมูลให้ครบถ้วน");
            return;
        }

        // Check if username already exists
        if ($this->userModel->findByUsername($data['username'])) {
            Response::json(400, "Username นี้ถูกใช้งานแล้ว");
            return;
        }

        // Check if email already exists
        if ($this->userModel->findByEmail($data['email'])) {
            Response::json(400, "Email นี้ถูกใช้งานแล้ว");
            return;
        }

        $userId = $this->userModel->create($data);

        if ($userId) {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            RateLimiter::hit('register:' . $ip, 600);
            Response::json(201, "สมัครสมาชิกสำเร็จ", ["user_id" => $userId]);
        } else {
            Response::json(500, "เกิดข้อผิดพลาดในการสมัครสมาชิก");
        }
    }

    public function me() {
        if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
            session_start();
        }
        
        $userId = $_SESSION['user_id'] ?? null;
        if (!$userId) {
            $headers = function_exists('apache_request_headers') ? apache_request_headers() : [];
            $userId = $headers['X-User-Id'] ?? ($headers['x-user-id'] ?? ($_SERVER['HTTP_X_USER_ID'] ?? null));
        }
        
        if (!$userId) {
            http_response_code(401);
            echo json_encode(["message" => "Unauthorized: Please log in first"]);
            return;
        }

        $query = "SELECT u.user_id, u.username, u.email, u.permissions AS user_permissions, r.role_name, r.permissions AS role_permissions
                  FROM users u
                  JOIN roles r ON u.role_id = r.role_id
                  WHERE u.user_id = :user_id
                  LIMIT 0,1";

        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            http_response_code(404);
            echo json_encode(["message" => "User not found"]);
            return;
        }

        // Restore session if needed
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['role'] = $user['role_name'];


        // Generate CSRF Token if not exists
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        $userPerms = json_decode($user['user_permissions'] ?? '[]', true) ?: [];
        $rolePerms = json_decode($user['role_permissions'] ?? '[]', true) ?: [];
        
        $roleNameLower = strtolower($user['role_name'] ?? '');
        if ($roleNameLower === 'admin') {
            $allPerms = [
                "dashboard_view",
                "products_manage",
                "stock_view",
                "stock_manage",
                "orders_manage",
                "orders_view",
                "customers_view",
                "customers_manage",
                "promotions_view",
                "promotions_manage",
                "delivery_view",
                "delivery_manage",
                "rewards_view",
                "rewards_manage",
                "staff_manage",
                "staff_profile_manage",
                "pos_access"
            ];
        } else {
            if (empty($rolePerms) && ($roleNameLower === 'employee' || $roleNameLower === 'staff')) {
                $rolePerms = [
                    'pos_access',
                    'orders_manage',
                    'orders_view',
                    'customers_view',
                    'stock_view',
                    'stock_manage',
                    'promotions_view',
                    'staff_profile_manage',
                    'rewards_view'
                ];
            }
            $allPerms = array_values(array_unique(array_merge($userPerms, $rolePerms)));
        }

        $customerId = null;
        $employeeId = null;
        $firstName = null;
        $lastName = null;
        $phone = null;
        if ($roleNameLower === 'customer') {
            $stmtCust = $this->db->prepare("SELECT customer_id, first_name, last_name, 
                         COALESCE(NULLIF(phone, ''), (SELECT a.phone FROM addresses a WHERE a.customer_id = customers.customer_id AND a.phone IS NOT NULL AND a.phone != '' ORDER BY a.is_default DESC, a.address_id DESC LIMIT 1)) as phone 
                         FROM customers WHERE user_id = ?");
            $stmtCust->execute([$user['user_id']]);
            $cust = $stmtCust->fetch(PDO::FETCH_ASSOC);
            if ($cust) {
                $customerId = $cust['customer_id'];
                $firstName = $cust['first_name'];
                $lastName = $cust['last_name'];
                $phone = $cust['phone'] ?: '';
            }
        } else {
            $stmtEmp = $this->db->prepare("SELECT employee_id, first_name, last_name, phone FROM employees WHERE user_id = ?");
            $stmtEmp->execute([$user['user_id']]);
            $emp = $stmtEmp->fetch(PDO::FETCH_ASSOC);
            if ($emp) {
                $employeeId = $emp['employee_id'];
                $firstName = $emp['first_name'];
                $lastName = $emp['last_name'];
                $phone = $emp['phone'] ?: '';
            }
        }

        $response_data = [
            "user_id" => $user['user_id'],
            "username" => $user['username'],
            "first_name" => $firstName,
            "last_name" => $lastName,
            "phone" => $phone,
            "email" => $user['email'],
            "role_name" => $user['role_name'],
            "customer_id" => $customerId,
            "employee_id" => $employeeId,
            "permissions" => array_values($allPerms),
            "csrf_token" => $_SESSION['csrf_token']
        ];

        Response::json(200, "Successfully retrieved user state", $response_data);
    }

    public function logout() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        Response::json(200, "ออกจากระบบสำเร็จ");
    }
}
?>
