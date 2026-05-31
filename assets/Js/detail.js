// 1. Tự động nhận diện môi trường để lấy API_URL chuẩn (dùng var để tránh lỗi trùng khai báo)
var API_URL = window.API_URL || (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" ? "http://localhost:5000" : "https://mangic.onrender.com");

document.addEventListener('DOMContentLoaded', function() {
    // 2. Lấy tham số id từ URL (ví dụ: ?id=a00000000000000000000001)
    const urlParams = new URLSearchParams(window.location.search);
    const truyenId = urlParams.get('id');

    console.log("ID nhận được từ URL là:", truyenId); // Kiểm tra xem URL bốc được chữ gì

    if (!truyenId) {
        console.error("Lỗi: Không tìm thấy ID sản phẩm trên thanh URL!");
        if(document.getElementById('detail-name')) {
            document.getElementById('detail-name').innerText = "Sản phẩm không tồn tại!";
        }
        return;
    }

    // 3. Gọi API lên Server Backend để lấy dữ liệu truyện từ MongoDB
    // ĐÃ SỬA: Ép kiểu đường dẫn chuẩn chỉnh nhất để không bao giờ bị dính lỗi nối chuỗi ký tự lạ
    const fetchUrl = API_URL.endsWith('/') ? `${API_URL}api/products/${truyenId}` : `${API_URL}/api/products/${truyenId}`;
    console.log("Đường link API thực tế đang gọi là:", fetchUrl);

    fetch(fetchUrl)
        .then(res => {
            console.log("Phản hồi từ Server Status:", res.status); // Log xem server trả về số mấy (200 hay 404)
            if (!res.ok) throw new Error("Không tìm thấy sản phẩm trên server");
            return res.json();
        })
        .then(truyen => {
            console.log("Dữ liệu truyện bốc từ Database về thành công:", truyen);

            // 4. Đổ dữ liệu động vào giao diện HTML (kiểm tra an toàn cả 2 kiểu đặt tên cột img/image, desc/description)
            if(document.getElementById('main-img')) {
                document.getElementById('main-img').src = truyen.image || truyen.img || "./assets/img/default.jpg";
                document.getElementById('main-img').alt = truyen.name;
            }
            
            if(document.getElementById('detail-name')) {
                document.getElementById('detail-name').innerText = truyen.name;
            }
            
            if(document.getElementById('breadcrumb-name')) {
                document.getElementById('breadcrumb-name').innerText = truyen.name;
            }
            
            // Định dạng giá tiền có dấu chấm phân cách (Ví dụ: 50.000 VND)
            if(document.getElementById('detail-price') && truyen.price) {
                const giaHienTai = isNaN(truyen.price) ? truyen.price : Number(truyen.price).toLocaleString('vi-VN') + " VND";
                document.getElementById('detail-price').innerText = giaHienTai;
            }
            
            if(document.getElementById('detail-old-price')) {
                if (truyen.oldPrice) {
                    const giaCu = isNaN(truyen.oldPrice) ? truyen.oldPrice : Number(truyen.oldPrice).toLocaleString('vi-VN') + " VND";
                    document.getElementById('detail-old-price').innerText = giaCu;
                } else {
                    document.getElementById('detail-old-price').innerText = ""; 
                }
            }
            
            if(document.getElementById('detail-discount')) {
                document.getElementById('detail-discount').innerText = truyen.discount ? (truyen.discount.toString().includes('%') ? truyen.discount : `${truyen.discount}%`) : "0%";
            }
            
            if(document.getElementById('detail-category')) {
                document.getElementById('detail-category').innerText = truyen.category || "Manga";
            }
            
            if(document.getElementById('detail-author')) {
                document.getElementById('detail-author').innerText = truyen.author || "Chưa cập nhật";
            }
            
            if(document.getElementById('detail-desc')) {
                document.getElementById('detail-desc').innerText = truyen.description || truyen.desc || "Đang cập nhật nội dung tóm tắt...";
            }

            // Đổi tên tiêu đề Tab trình duyệt theo tên cuốn truyện
            document.title = truyen.name + " | Mangic Store";
        })
        .catch(err => {
            console.error("Lỗi fetch dữ liệu cụ thể:", err);
            if(document.getElementById('detail-name')) {
                document.getElementById('detail-name').innerText = "Lỗi không thể tải dữ liệu sản phẩm!";
            }
        });
});