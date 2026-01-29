const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const statusDiv = document.getElementById('status');
const modal = document.getElementById('previewModal');
const modalClose = document.getElementById('modalClose');

let selectedFiles = new Set();
let allFiles = [];
let currentPreviewIndex = -1;

// Cihaz bilgilerini yükle
async function loadDeviceInfo() {
    try {
        const response = await fetch('/api/client-info');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        document.getElementById('ip').textContent = data.client_ip || 'Bilinmiyor';
        document.getElementById('hostname').textContent = data.device_type || 'Bilinmiyor';
        document.getElementById('deviceTitle').textContent = data.device_type || 'Bilinmiyor';
    } catch (error) {
        console.error('Bilgi yüklenemedi:', error);
        // Fallback olarak /api/info kullan
        try {
            const response = await fetch('/api/info');
            const data = await response.json();
            document.getElementById('ip').textContent = data.ip;
            document.getElementById('hostname').textContent = data.hostname;
            document.getElementById('deviceTitle').textContent = data.hostname;
        } catch (e) {
            console.error('Fallback bilgi yüklenemedi:', e);
        }
    }
}

// Dosya listesini yükle
async function loadFiles() {
    try {
        const response = await fetch('/api/files');
        const files = await response.json();
        allFiles = files;
        
        if (files.length === 0) {
            fileList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="bi bi-inbox"></i></div>
                    <div>Henüz dosya yok</div>
                </div>
            `;
            updateBulkActions();
            return;
        }

        fileList.innerHTML = files.map(file => {
            const isSelected = selectedFiles.has(file.name);
            const icon = getFileIcon(file.name);
            return `
                <div class="file-item ${isSelected ? 'selected' : ''}">
                    <input type="checkbox" class="file-checkbox" data-filename="${escapeHtml(file.name)}" ${isSelected ? 'checked' : ''}>
                    <div class="file-info">
                        <div class="file-name" onclick="previewFile('${escapeHtml(file.name)}')">${icon} ${escapeHtml(file.name)}</div>
                        <div class="file-size">${file.size}</div>
                    </div>
                    <div class="file-actions">
                        <button class="btn-secondary" onclick="downloadFile('${escapeHtml(file.name)}')"><i class="bi bi-download"></i> İndir</button>
                        <button class="btn-danger" onclick="deleteFile('${escapeHtml(file.name)}')"><i class="bi bi-trash"></i> Sil</button>
                    </div>
                </div>
            `;
        }).join('');

        // Checkbox event listeners
        document.querySelectorAll('.file-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const filename = e.target.dataset.filename;
                if (e.target.checked) {
                    selectedFiles.add(filename);
                    e.target.closest('.file-item').classList.add('selected');
                } else {
                    selectedFiles.delete(filename);
                    e.target.closest('.file-item').classList.remove('selected');
                }
                updateBulkActions();
            });
        });

        updateBulkActions();
    } catch (error) {
        console.error('Dosyalar yüklenemedi:', error);
    }
}

// Toplu işlem butonlarını güncelle
function updateBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    if (selectedFiles.size === 0) {
        bulkActions.classList.add('hidden');
    } else {
        bulkActions.classList.remove('hidden');
        document.getElementById('selectedCount').textContent = selectedFiles.size;
    }
}

// Toplu indirme
async function downloadMultiple() {
    if (selectedFiles.size === 0) {
        showStatus('✗ Dosya seçilmedi', 'error');
        return;
    }

    showStatus(`<span class="loading"></span> ${selectedFiles.size} dosya sıkıştırılıyor...`, 'info');
    updateProgress(50);

    try {
        const response = await fetch('/api/download-multiple', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: Array.from(selectedFiles)
            })
        });

        if (response.ok) {
            updateProgress(100);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dosyalar.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showStatus(`✓ ${selectedFiles.size} dosya indirildi`, 'success');
            hideProgress();
        } else {
            const errorData = await response.json();
            showStatus(`✗ İndirme hatası: ${errorData.error || 'Bilinmeyen hata'}`, 'error');
            hideProgress();
        }
    } catch (error) {
        showStatus(`✗ İndirme hatası: ${error.message}`, 'error');
        hideProgress();
        console.error('Download error:', error);
    }
}

// Tümünü seç
function selectAllFiles() {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        const filename = checkbox.dataset.filename;
        selectedFiles.add(filename);
        checkbox.closest('.file-item').classList.add('selected');
    });
    updateBulkActions();
}

// Seçimi temizle
function clearSelection() {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        const filename = checkbox.dataset.filename;
        selectedFiles.delete(filename);
        checkbox.closest('.file-item').classList.remove('selected');
    });
    updateBulkActions();
}

// Toplu silme
async function deleteMultiple() {
    if (selectedFiles.size === 0) {
        showStatus('✗ Dosya seçilmedi', 'error');
        return;
    }

    if (!confirm(`${selectedFiles.size} dosya silinsin mi? Bu işlem geri alınamaz.`)) return;

    showStatus(`<span class="loading"></span> ${selectedFiles.size} dosya siliniyor...`, 'info');

    let deletedCount = 0;
    let errorCount = 0;

    for (const filename of selectedFiles) {
        try {
            const response = await fetch(`/api/delete/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                deletedCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
        }
    }

    selectedFiles.clear();
    loadFiles();

    if (errorCount === 0) {
        showStatus(`✓ ${deletedCount} dosya silindi`, 'success');
    } else {
        showStatus(`✓ ${deletedCount} dosya silindi, ${errorCount} hata oluştu`, 'error');
    }
}

// Dosya yükle
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const xhr = new XMLHttpRequest();
        
        // Progress event
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                updateProgress(percentComplete);
            }
        });

        // Load event
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                showStatus(`✓ ${file.name} başarıyla yüklendi`, 'success');
                hideProgress();
                loadFiles();
            } else {
                const data = JSON.parse(xhr.responseText);
                showStatus(`✗ Hata: ${data.error}`, 'error');
                hideProgress();
            }
        });

        // Error event
        xhr.addEventListener('error', () => {
            showStatus(`✗ Yükleme hatası`, 'error');
            hideProgress();
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    } catch (error) {
        showStatus(`✗ Yükleme hatası: ${error.message}`, 'error');
        hideProgress();
    }
}

// Dosya indir
async function downloadFile(filename) {
    try {
        window.location.href = `/api/download/${encodeURIComponent(filename)}`;
    } catch (error) {
        showStatus(`✗ İndirme hatası: ${error.message}`, 'error');
    }
}

// Dosya sil
async function deleteFile(filename) {
    if (!confirm(`"${filename}" silinsin mi?`)) return;

    try {
        const response = await fetch(`/api/delete/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showStatus(`✓ ${filename} silindi`, 'success');
            selectedFiles.delete(filename);
            loadFiles();
        } else {
            showStatus('✗ Silme hatası', 'error');
        }
    } catch (error) {
        showStatus(`✗ Silme hatası: ${error.message}`, 'error');
    }
}

// Dosya önizleme
async function previewFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];

    if (imageExts.includes(ext)) {
        currentPreviewIndex = allFiles.findIndex(f => f.name === filename);
        showImagePreview(filename);
    } else if (videoExts.includes(ext)) {
        currentPreviewIndex = allFiles.findIndex(f => f.name === filename);
        showVideoPreview(filename);
    } else {
        showStatus('✗ Bu dosya türü önizlenemez', 'error');
    }
}

// Resim önizlemesi
function showImagePreview(filename) {
    const modalBody = document.getElementById('modalBody');
    const modalHeader = document.querySelector('.modal-header h3');
    
    modalHeader.textContent = filename;
    modalBody.innerHTML = `
        <img src="/api/download/${encodeURIComponent(filename)}" alt="${escapeHtml(filename)}" class="preview-image">
        <div class="preview-controls">
            <button class="btn-secondary" onclick="previousPreview()"><i class="bi bi-chevron-left"></i> Önceki</button>
            <button class="btn-secondary" onclick="downloadFile('${escapeHtml(filename)}')"><i class="bi bi-download"></i> İndir</button>
            <button class="btn-secondary" onclick="nextPreview()">Sonraki <i class="bi bi-chevron-right"></i></button>
        </div>
    `;
    modal.classList.add('show');
}

// Video önizlemesi
function showVideoPreview(filename) {
    const modalBody = document.getElementById('modalBody');
    const modalHeader = document.querySelector('.modal-header h3');
    const ext = filename.split('.').pop().toLowerCase();
    
    const mimeTypes = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska'
    };
    
    const mimeType = mimeTypes[ext] || 'video/mp4';
    
    modalHeader.textContent = filename;
    modalBody.innerHTML = `
        <video controls class="preview-video" style="width: 100%; max-width: 100%;">
            <source src="/api/download/${encodeURIComponent(filename)}" type="${mimeType}">
            Tarayıcınız video oynatmayı desteklemiyor.
        </video>
        <div class="preview-controls">
            <button class="btn-secondary" onclick="previousPreview()"><i class="bi bi-chevron-left"></i> Önceki</button>
            <button class="btn-secondary" onclick="downloadFile('${escapeHtml(filename)}')"><i class="bi bi-download"></i> İndir</button>
            <button class="btn-secondary" onclick="nextPreview()">Sonraki <i class="bi bi-chevron-right"></i></button>
        </div>
    `;
    modal.classList.add('show');
}

// Önceki dosya
function previousPreview() {
    if (currentPreviewIndex > 0) {
        currentPreviewIndex--;
        const file = allFiles[currentPreviewIndex];
        previewFile(file.name);
    }
}

// Sonraki dosya
function nextPreview() {
    if (currentPreviewIndex < allFiles.length - 1) {
        currentPreviewIndex++;
        const file = allFiles[currentPreviewIndex];
        previewFile(file.name);
    }
}

// Dosya türü ikonu
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];

    if (imageExts.includes(ext)) return '<i class="bi bi-image"></i>';
    if (videoExts.includes(ext)) return '<i class="bi bi-film"></i>';
    if (docExts.includes(ext)) return '<i class="bi bi-file-earmark-text"></i>';
    if (archiveExts.includes(ext)) return '<i class="bi bi-archive"></i>';
    return '<i class="bi bi-file-earmark"></i>';
}

// Durum mesajı göster
function showStatus(message, type) {
    statusDiv.innerHTML = message;
    statusDiv.className = `status show ${type}`;
    setTimeout(() => {
        statusDiv.classList.remove('show');
    }, 4000);
}

// Progress güncelle
function updateProgress(percent) {
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressContainer.classList.remove('hidden');
    progressFill.style.width = percent + '%';
    progressText.textContent = Math.round(percent) + '%';
}

// Progress gizle
function hideProgress() {
    const progressContainer = document.getElementById('progressContainer');
    setTimeout(() => {
        progressContainer.classList.add('hidden');
    }, 1000);
}

// HTML escape
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Upload area event listeners
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    for (let file of files) {
        uploadFile(file);
    }
});

fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    for (let file of files) {
        uploadFile(file);
    }
    fileInput.value = '';
});

// Modal close
modalClose.addEventListener('click', () => {
    modal.classList.remove('show');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
    }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('show')) return;
    
    if (e.key === 'ArrowLeft') {
        previousPreview();
    } else if (e.key === 'ArrowRight') {
        nextPreview();
    } else if (e.key === 'Escape') {
        modal.classList.remove('show');
    }
});

// İlk yükleme
loadDeviceInfo();
loadFiles();

// Her 3 saniyede bir dosya listesini güncelle
setInterval(loadFiles, 3000);
