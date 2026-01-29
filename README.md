# LocalFileTransporter

Yerel ağda cihazlar arası hızlı dosya transferi yapabilen basit ve kullanıcı dostu bir uygulama.

## Özellikler

- 🚀 Hızlı dosya transferi
- 📱 PC, tablet ve telefon desteği
- 🎨 Basit, göz yormayan arayüz
- 📤 Sürükle-bırak dosya yükleme
- 📥 Dosya indirme
- 🗑️ Dosya silme
- 🌐 Yerel ağda çalışır
- ⚡ Sınırsız dosya boyutu (5GB limit)

## Kurulum

1. Python 3.7+ yüklü olduğundan emin olun
2. Gerekli paketleri yükleyin:

```bash
pip install -r requirements.txt
```

## Çalıştırma

```bash
python app.py
```

Uygulama başladığında:
- IP adresiniz gösterilecek
- Tarayıcıda `http://[IP]:5000` adresine gidin
- Aynı ağdaki diğer cihazlardan da bu adrese erişebilirsiniz

## Kullanım

### Dosya Gönderme
- Dosya seçmek için tıklayın veya sürükleyip bırakın
- Birden fazla dosya aynı anda yükleyebilirsiniz

### Dosya İndirme
- Dosya listesinden "İndir" butonuna tıklayın

### Dosya Silme
- Dosya listesinden "Sil" butonuna tıklayın

## Sistem Gereksinimleri

- Python 3.7+
- Flask 3.0.0
- Flask-CORS 4.0.0
- Werkzeug 3.0.1
