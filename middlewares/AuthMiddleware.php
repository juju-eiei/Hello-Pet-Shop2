<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';

// Composer autoload
if(file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
}

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

class AuthMiddleware {
    public static function authenticate() {
        // 1. Try Token (Header)
        $headers = function_exists('apache_request_headers') ? apache_request_headers() : [];
        $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : null);
        
        if ($authHeader) {
            $token = trim(str_replace('Bearer ', '', $authHeader));
            // Only attempt JWT decoding if it is formatted as a 3-segment JWT (header.payload.signature)
            if (defined('JWT_SECRET') && JWT_SECRET !== '' && substr_count($token, '.') === 2) {
                try {
                    $decoded = JWT::decode($token, new Key(JWT_SECRET, 'HS256'));
                    return (array) $decoded->data; 
                } catch (Exception $e) {
                    error_log("AuthMiddleware JWT decode error: " . $e->getMessage());
                }
            }
        }

        // 2. Try PHP Session
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $headers = function_exists('apache_request_headers') ? apache_request_headers() : [];
        $userIdHeader = isset($headers['X-User-Id']) ? $headers['X-User-Id'] : (isset($_SERVER['HTTP_X_USER_ID']) ? $_SERVER['HTTP_X_USER_ID'] : null);

        // Synchronize session if client explicitly presents authenticated X-User-Id
        if ($userIdHeader && is_numeric($userIdHeader)) {
            $headerUid = (int)$userIdHeader;
            if (!isset($_SESSION['user_id']) || (int)$_SESSION['user_id'] !== $headerUid) {
                // Verify that headerUid represents a genuine user or customer
                $database = new Database();
                $db = $database->getConnection();
                
                // First check user_id
                $stmt = $db->prepare("
                    SELECT u.user_id, u.username, r.role_name 
                    FROM users u 
                    JOIN roles r ON u.role_id = r.role_id 
                    WHERE u.user_id = ?
                    LIMIT 1
                ");
                $stmt->execute([$headerUid]);
                $matchedUser = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$matchedUser) {
                    $stmtCust = $db->prepare("
                        SELECT u.user_id, u.username, r.role_name 
                        FROM customers c
                        JOIN users u ON c.user_id = u.user_id
                        JOIN roles r ON u.role_id = r.role_id 
                        WHERE c.customer_id = ?
                        LIMIT 1
                    ");
                    $stmtCust->execute([$headerUid]);
                    $matchedUser = $stmtCust->fetch(PDO::FETCH_ASSOC);
                }
                if ($matchedUser) {
                    $_SESSION['user_id'] = $matchedUser['user_id'];
                    $_SESSION['role'] = $matchedUser['role_name'];
                }
            }
        }

        if (isset($_SESSION['user_id'])) {
            // Check CSRF token for session-based state-modifying requests (POST, PUT, DELETE)
            $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
            if (in_array(strtoupper($method), ['POST', 'PUT', 'DELETE'])) {
                $requestToken = isset($headers['X-CSRF-Token']) ? $headers['X-CSRF-Token'] : (isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : null);
                
                if (!$requestToken && isset($_POST['csrf_token'])) {
                    $requestToken = $_POST['csrf_token'];
                }
                
                if (!$requestToken) {
                    $jsonInput = json_decode(file_get_contents("php://input"), true);
                    if (isset($jsonInput['csrf_token'])) {
                        $requestToken = $jsonInput['csrf_token'];
                    }
                }
                
                $sessionToken = $_SESSION['csrf_token'] ?? null;
                $isMatchingHeader = false;
                if ($userIdHeader) {
                    if ((int)$userIdHeader === (int)$_SESSION['user_id']) {
                        $isMatchingHeader = true;
                    } else {
                        try {
                            $database = new Database();
                            $db = $database->getConnection();
                            $stmtCustCheck = $db->prepare("SELECT customer_id FROM customers WHERE user_id = ?");
                            $stmtCustCheck->execute([(int)$_SESSION['user_id']]);
                            $cRow = $stmtCustCheck->fetch(PDO::FETCH_ASSOC);
                            if ($cRow && (int)$cRow['customer_id'] === (int)$userIdHeader) {
                                $isMatchingHeader = true;
                            }
                        } catch (Exception $eC) {}
                    }
                }

                if ($sessionToken && $requestToken && !hash_equals($sessionToken, $requestToken) && !$isMatchingHeader) {
                    Response::json(403, "Forbidden: CSRF token validation failed");
                }
            }

            return [
                'user_id' => $_SESSION['user_id'],
                'role' => $_SESSION['role']
            ];
        }

        // 3. Fallback: Validate via X-User-Id header for SPA / proxy session recovery
        if ($userIdHeader && is_numeric($userIdHeader)) {
            $database = new Database();
            $db = $database->getConnection();
            
            // Check by user_id first
            $stmt = $db->prepare("
                SELECT u.user_id, u.username, r.role_name 
                FROM users u 
                JOIN roles r ON u.role_id = r.role_id 
                WHERE u.user_id = ?
                LIMIT 1
            ");
            $stmt->execute([(int)$userIdHeader]);
            $u = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // If not found by user_id, check if customer_id was passed
            if (!$u) {
                $stmtCust = $db->prepare("
                    SELECT u.user_id, u.username, r.role_name 
                    FROM customers c
                    JOIN users u ON c.user_id = u.user_id
                    JOIN roles r ON u.role_id = r.role_id 
                    WHERE c.customer_id = ?
                    LIMIT 1
                ");
                $stmtCust->execute([(int)$userIdHeader]);
                $u = $stmtCust->fetch(PDO::FETCH_ASSOC);
            }

            if ($u) {
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                $_SESSION['user_id'] = $u['user_id'];
                $_SESSION['role'] = $u['role_name'];
                return [
                    'user_id' => $u['user_id'],
                    'role' => $u['role_name']
                ];
            }
        }

        Response::json(401, "Unauthorized: User not authenticated");
    }

    public static function checkRole($allowedRoles) {
        $user = self::authenticate();
        
        // Handle case-insensitive comparisons
        $allowedRolesLower = array_map('strtolower', $allowedRoles);
        $userRoleLower = strtolower($user['role'] ?? '');
        
        if(!in_array($userRoleLower, $allowedRolesLower)) {
            Response::json(403, "Forbidden: Access denied");
        }
        return $user;
    }

    public static function checkPermission($permission) {
        $user = self::authenticate();
        
        $database = new Database();
        $db = $database->getConnection();
        
        // Fetch user permissions, role name, and role permissions
        $query = "SELECT u.permissions AS user_permissions, r.role_name, r.permissions AS role_permissions 
                  FROM users u
                  JOIN roles r ON u.role_id = r.role_id
                  WHERE u.user_id = :user_id";
                  
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $user['user_id']);
        $stmt->execute();
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$data) {
            Response::json(403, "Forbidden: User record not found");
        }
        
        $roleNameLower = strtolower($data['role_name'] ?? '');
        
        // Superadmin role bypasses all checks
        if ($roleNameLower === 'admin') {
            return $user;
        }
        
        $userPerms = json_decode($data['user_permissions'] ?? '[]', true) ?: [];
        $rolePerms = json_decode($data['role_permissions'] ?? '[]', true) ?: [];
        
        if (empty($rolePerms) && ($roleNameLower === 'employee' || $roleNameLower === 'staff')) {
            $rolePerms = [
                'pos_access', 'orders_manage', 'orders_view', 'customers_view',
                'stock_view', 'stock_manage', 'promotions_view', 'staff_profile_manage', 'rewards_view'
            ];
        }
        
        // Merge user and role permissions
        $allPerms = array_merge($userPerms, $rolePerms);
        
        if (!in_array($permission, $allPerms)) {
            Response::json(403, "Forbidden: Lacking required permission '{$permission}'");
        }
        
        return $user;
    }

    public static function checkAnyPermission($permissions) {
        $user = self::authenticate();
        
        $database = new Database();
        $db = $database->getConnection();
        
        $query = "SELECT u.permissions AS user_permissions, r.role_name, r.permissions AS role_permissions 
                  FROM users u
                  JOIN roles r ON u.role_id = r.role_id
                  WHERE u.user_id = :user_id";
                  
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $user['user_id']);
        $stmt->execute();
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$data) {
            Response::json(403, "Forbidden: User record not found");
        }
        
        $roleNameLower = strtolower($data['role_name'] ?? '');
        
        if ($roleNameLower === 'admin') {
            return $user;
        }
        
        $userPerms = json_decode($data['user_permissions'] ?? '[]', true) ?: [];
        $rolePerms = json_decode($data['role_permissions'] ?? '[]', true) ?: [];
        
        if (empty($rolePerms) && ($roleNameLower === 'employee' || $roleNameLower === 'staff')) {
            $rolePerms = [
                'pos_access', 'orders_manage', 'orders_view', 'customers_view',
                'stock_view', 'stock_manage', 'promotions_view', 'staff_profile_manage', 'rewards_view'
            ];
        }
        
        $allPerms = array_merge($userPerms, $rolePerms);
        
        foreach ($permissions as $permission) {
            if (in_array($permission, $allPerms)) {
                return $user;
            }
        }
        
        $permString = implode(' or ', $permissions);
        Response::json(403, "Forbidden: Lacking any of required permissions '{$permString}'");
    }
}
?>
