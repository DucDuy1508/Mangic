// detail.js hoàn chỉnh và an toàn nhất
document.addEventListener('DOMContentLoaded', function() {
    // 1. Lấy tham số id từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const truyenId = urlParams.get('id');

    console.log("ID nhận được từ URL là:", truyenId); // Dòng này để ông kiểm tra trong F12 Console

    // 2. So khớp với kho dữ liệu danhSachTruyen (trong data.js)
    if (truyenId && typeof danhSachTruyen !== 'undefined' && danhSachTruyen[truyenId]) {
        const truyen = danhSachTruyen[truyenId];

        // 3. Đổ dữ liệu vào các thẻ chắc chắn có ID trên giao diện
        if(document.getElementById('main-img')) {
            document.getElementById('main-img').src = truyen.img;
            document.getElementById('main-img').alt = truyen.name;
        }
        
        if(document.getElementById('detail-name')) {
            document.getElementById('detail-name').innerText = truyen.name;
        }
        
        if(document.getElementById('breadcrumb-name')) {
            document.getElementById('breadcrumb-name').innerText = truyen.name;
        }
        
        if(document.getElementById('detail-price')) {
            document.getElementById('detail-price').innerText = truyen.price;
        }
        
        if(document.getElementById('detail-old-price')) {
            document.getElementById('detail-old-price').innerText = truyen.oldPrice;
        }
        
        if(document.getElementById('detail-discount')) {
            document.getElementById('detail-discount').innerText = truyen.discount;
        }
        
        if(document.getElementById('detail-category')) {
            document.getElementById('detail-category').innerText = truyen.category;
        }
        
        if(document.getElementById('detail-author')) {
            document.getElementById('detail-author').innerText = truyen.author;
        }
        
        if(document.getElementById('detail-desc')) {
            document.getElementById('detail-desc').innerText = truyen.desc;
        }

        // Đổi tên tiêu đề Tab trình duyệt
        document.title = truyen.name + " | Mangic Store";

    } else {
        console.log("Lỗi: Không tìm thấy ID này trong data.js hoặc chưa load được data.js");
        if(document.getElementById('detail-name')) {
            document.getElementById('detail-name').innerText = "Sản phẩm không tồn tại!";
        }
    }
});