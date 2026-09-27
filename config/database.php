<?php
require_once __DIR__ . '/config.php';

class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    public $conn;

    public function __construct() {
        $this->host = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? 'localhost');
        $this->db_name = getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? 'hello_pet_shop2');
        $this->username = getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? 'root');
        $this->password = getenv('DB_PASS') !== false ? getenv('DB_PASS') : ($_ENV['DB_PASS'] ?? '');
    }

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new PDO("mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4", $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch(PDOException $exception) {
            error_log("Database Connection error: " . $exception->getMessage());
            echo json_encode(["status" => 500, "message" => "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง"]);
            exit;
        }
        return $this->conn;
    }
}
?>
