<?php
require_once __DIR__ . '/../models/Staff.php';

class StaffController {
    private $model;

    public function __construct() {
        $this->model = new Staff();
    }

    public function index() {
        header('Content-Type: application/json; charset=utf-8');
        $keyword = $_GET['keyword'] ?? '';
        $staff = $this->model->getAll($keyword);
        echo json_encode(["data" => $staff]);
    }

    public function show() {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "Employee ID is required"]);
            return;
        }

        $staff = $this->model->getById($id);
        if ($staff) {
            echo json_encode(["data" => $staff]);
        } else {
            http_response_code(404);
            echo json_encode(["message" => "Staff member not found"]);
        }
    }

    public function me() {
        $user_id = $_GET['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(400);
            echo json_encode(["message" => "User ID is required"]);
            return;
        }

        $staff = $this->model->getByUserId($user_id);
        if ($staff) {
            echo json_encode(["data" => $staff]);
        } else {
            http_response_code(404);
            echo json_encode(["message" => "Staff profile not found"]);
        }
    }

    public function create() {
        header('Content-Type: application/json; charset=utf-8');
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);

        // Validation
        if (empty($data['first_name']) || empty($data['email']) || empty($data['password'])) {
            http_response_code(400);
            echo json_encode(["message" => "กรุณากรอกชื่อ, อีเมล และรหัสผ่านให้ครบถ้วน"]);
            return;
        }

        try {
            if ($this->model->create($data)) {
                echo json_encode(["message" => "เพิ่มพนักงานสำเร็จ"]);
            } else {
                http_response_code(500);
                echo json_encode(["message" => "ไม่สามารถเพิ่มข้อมูลพนักงานได้"]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(["message" => $e->getMessage()]);
        }
    }

    public function update() {
        header('Content-Type: application/json; charset=utf-8');
        $json = file_get_contents('php://input');
        $data = json_decode($json, true) ?: [];
        if (isset($_POST['_override_data']) && is_array($_POST['_override_data'])) {
            $data = $_POST['_override_data'];
        }
        $id = $_GET['id'] ?? $data['id'] ?? null;

        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "Employee ID is required"]);
            return;
        }

        try {
            if ($this->model->update($id, $data)) {
                echo json_encode(["message" => "อัปเดตข้อมูลพนักงานสำเร็จ"]);
            } else {
                http_response_code(500);
                echo json_encode(["message" => "ไม่สามารถอัปเดตข้อมูลพนักงานได้"]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(["message" => $e->getMessage()]);
        }
    }

    public function delete() {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "Employee ID is required"]);
            return;
        }

        if ($this->model->delete($id)) {
            echo json_encode(["message" => "Staff member deleted successfully"]);
        } else {
            http_response_code(500);
            echo json_encode(["message" => "Failed to delete staff member"]);
        }
    }

    public function roles() {
        header('Content-Type: application/json; charset=utf-8');
        $roles = $this->model->getRoles();
        echo json_encode(["data" => $roles]);
    }
}
?>
