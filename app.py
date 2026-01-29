from flask import Flask, render_template, request, send_file, jsonify, url_for
from flask_cors import CORS
import os
import socket
from pathlib import Path
from werkzeug.utils import secure_filename
import mimetypes
import zipfile
import tempfile

app = Flask(__name__)
CORS(app)

# Konfigürasyon
BASE_FOLDER = Path.home() / 'LocalFileTransporter_Files'
BASE_FOLDER.mkdir(exist_ok=True)
app.config['BASE_FOLDER'] = str(BASE_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024 * 1024  # 5GB limit

def get_device_folder():
    """Client cihazına göre klasör al"""
    user_agent = request.headers.get('User-Agent', '')
    client_ip = request.remote_addr
    if request.headers.get('X-Forwarded-For'):
        client_ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
    
    # User-Agent'dan cihaz türünü belirle
    device_type = 'Bilinmeyen'
    if 'Mobile' in user_agent or 'Android' in user_agent:
        device_type = 'Telefon'
    elif 'iPad' in user_agent or 'Tablet' in user_agent:
        device_type = 'Tablet'
    elif 'Windows' in user_agent:
        device_type = 'Windows'
    elif 'Macintosh' in user_agent:
        device_type = 'Mac'
    elif 'Linux' in user_agent:
        device_type = 'Linux'
    
    # Cihaz adı oluştur
    device_name = f"{device_type}_{client_ip.replace('.', '_')}"
    device_folder = BASE_FOLDER / device_name
    device_folder.mkdir(exist_ok=True)
    return str(device_folder)

def get_local_ip():
    """Yerel IP adresini al"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/templates/<filename>')
def serve_static(filename):
    """CSS ve JS dosyalarını sun"""
    return send_file(os.path.join('templates', filename), mimetype='text/css' if filename.endswith('.css') else 'text/javascript')

@app.route('/api/info')
def get_info():
    """Cihaz bilgilerini döndür"""
    return jsonify({
        'ip': get_local_ip(),
        'port': 5000,
        'hostname': socket.gethostname()
    })

@app.route('/api/client-info')
def get_client_info():
    """Client cihaz bilgilerini döndür"""
    user_agent = request.headers.get('User-Agent', '')
    
    # Client IP'sini al
    client_ip = request.remote_addr
    if request.headers.get('X-Forwarded-For'):
        client_ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
    
    # User-Agent'dan cihaz türünü belirle
    device_type = 'Bilinmeyen'
    if 'Mobile' in user_agent or 'Android' in user_agent:
        device_type = 'Telefon'
    elif 'iPad' in user_agent or 'Tablet' in user_agent:
        device_type = 'Tablet'
    elif 'Windows' in user_agent:
        device_type = 'Windows PC'
    elif 'Macintosh' in user_agent:
        device_type = 'Mac'
    elif 'Linux' in user_agent:
        device_type = 'Linux'
    
    # Cihaz adı oluştur
    device_name = f"{device_type}_{client_ip.replace('.', '_')}"
    
    return jsonify({
        'ip': get_local_ip(),
        'port': 5000,
        'hostname': socket.gethostname(),
        'client_ip': client_ip,
        'device_type': device_type,
        'device_name': device_name
    })

@app.route('/api/files', methods=['GET'])
def list_files():
    """Tüm cihazların dosyalarını listele"""
    files = []
    try:
        # BASE_FOLDER altındaki tüm klasörleri tara
        for device_folder in BASE_FOLDER.iterdir():
            if device_folder.is_dir():
                for file in device_folder.iterdir():
                    if file.is_file():
                        size = file.stat().st_size
                        files.append({
                            'name': file.name,
                            'size': format_size(size),
                            'size_bytes': size,
                            'device': device_folder.name
                        })
    except:
        pass
    return jsonify(sorted(files, key=lambda x: x['name']))

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Dosya yükle"""
    if 'file' not in request.files:
        return jsonify({'error': 'Dosya bulunamadı'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Dosya seçilmedi'}), 400
    
    try:
        upload_folder = get_device_folder()
        filename = secure_filename(file.filename)
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        return jsonify({
            'success': True,
            'filename': filename,
            'size': format_size(os.path.getsize(filepath))
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<filename>')
def download_file(filename):
    """Dosya indir - tüm cihazlarda ara"""
    try:
        # Tüm cihaz klasörlerinde dosyayı ara
        for device_folder in BASE_FOLDER.iterdir():
            if device_folder.is_dir():
                filepath = os.path.join(str(device_folder), secure_filename(filename))
                if os.path.exists(filepath):
                    # Dosya türüne göre MIME type belirle
                    ext = filename.split('.')[-1].lower()
                    mime_types = {
                        'mp4': 'video/mp4',
                        'webm': 'video/webm',
                        'ogg': 'video/ogg',
                        'mov': 'video/quicktime',
                        'avi': 'video/x-msvideo',
                        'mkv': 'video/x-matroska',
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'png': 'image/png',
                        'gif': 'image/gif',
                        'webp': 'image/webp',
                        'bmp': 'image/bmp'
                    }
                    
                    mimetype = mime_types.get(ext, 'application/octet-stream')
                    return send_file(filepath, as_attachment=True, mimetype=mimetype)
        
        return jsonify({'error': 'Dosya bulunamadı'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete/<filename>', methods=['DELETE'])
def delete_file(filename):
    """Dosya sil - tüm cihazlarda ara"""
    try:
        # Tüm cihaz klasörlerinde dosyayı ara ve sil
        for device_folder in BASE_FOLDER.iterdir():
            if device_folder.is_dir():
                filepath = os.path.join(str(device_folder), secure_filename(filename))
                if os.path.exists(filepath):
                    os.remove(filepath)
                    return jsonify({'success': True})
        
        return jsonify({'error': 'Dosya bulunamadı'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download-multiple', methods=['POST'])
def download_multiple():
    """Birden fazla dosyayı ZIP olarak indir"""
    try:
        data = request.get_json()
        filenames = data.get('files', [])
        
        if not filenames:
            return jsonify({'error': 'Dosya seçilmedi'}), 400
        
        # Geçici ZIP dosyası oluştur
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip', mode='w+b')
        temp_zip_path = temp_zip.name
        temp_zip.close()
        
        try:
            with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for filename in filenames:
                    # Tüm cihaz klasörlerinde dosyayı ara
                    for device_folder in BASE_FOLDER.iterdir():
                        if device_folder.is_dir():
                            filepath = os.path.join(str(device_folder), secure_filename(filename))
                            if os.path.exists(filepath) and os.path.isfile(filepath):
                                zipf.write(filepath, arcname=filename)
                                break
            
            def remove_file(response):
                try:
                    os.remove(temp_zip_path)
                except:
                    pass
                return response
            
            response = send_file(
                temp_zip_path,
                mimetype='application/zip',
                as_attachment=True,
                download_name='dosyalar.zip'
            )
            response.call_on_close(remove_file)
            return response
        except Exception as e:
            if os.path.exists(temp_zip_path):
                os.remove(temp_zip_path)
            raise e
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def format_size(bytes):
    """Dosya boyutunu formatla"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024
    return f"{bytes:.1f} TB"

if __name__ == '__main__':
    print(f"LocalFileTransporter başlatılıyor...")
    print(f"IP: {get_local_ip()}")
    print(f"Port: 5000")
    print(f"Cihaz: {socket.gethostname()}")
    print(f"Dosya klasörü: {BASE_FOLDER}")
    app.run(host='0.0.0.0', port=5000, debug=False)
