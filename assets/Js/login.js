const API_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://mangic.onrender.com";

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const userInp = document.getElementById('username').value.trim();
    const passInp = document.getElementById('password').value.trim();

    // Thông báo Loading chuẩn hệ thống
    Swal.fire({
        title: 'Hệ thống đang xác thực...',
        text: 'Vui lòng lòng chờ trong giây lát.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // ĐÃ SỬA: Thay thế link localhost tĩnh thành biến trỏ sang Render động
    fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: userInp, password: passInp })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            // Thông báo lỗi văn phong doanh nghiệp
            Swal.fire({
                icon: 'error',
                title: 'Đăng nhập thất bại',
                text: 'Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
                confirmButtonColor: '#212529'
            });
        } else {
            // Lưu thông tin phiên làm việc
            localStorage.setItem("currentUser", JSON.stringify(data.user));
            
            // Thông báo thành công trang trọng
            Swal.fire({
                icon: 'success',
                title: 'Đăng nhập thành công',
                text: `Xin chào ${data.user.fullName}. Hệ thống đang chuyển hướng...`,
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                // Điều hướng phân quyền
                if (data.user.role === 'admin') {
                    window.location.href = "admin.html";
                } else {
                    window.location.href = "index.html";
                }
            });
        }
    })
    .catch(err => {
        // Thông báo lỗi mất kết nối Server
        Swal.fire({
            icon: 'error',
            title: 'Lỗi kết nối',
            text: 'Không thể kết nối đến máy chủ dịch vụ. Vui lòng thử lại sau.',
            confirmButtonColor: '#dc3545'
        });
    });
});