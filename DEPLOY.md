# KÖK Oylama Sistemi: Kendi Sunucunuzda Barındırma

Uygulama tek bir Node.js sürecidir (bağımlılık yok). Veri tek bir klasörde (JSON) tutulur; veritabanı gerekmez. Aşağıdaki iki yoldan birini seçin. Önerilen: **Docker Compose** (HTTPS otomatik).

## 0. Önce karar verilecekler (BT ekibinizle)

| Soru | Neden önemli |
|---|---|
| Katılımcılar uygulamayı **internetten** mi (kendi mobil veri), **kurum Wi-Fi'sinden** mi açacak, yoksa ikisi de mi? | "Mobilden de Wi-Fi'den de" istiyorsanız sunucunun **hem internetten hem kurum ağından** aynı alan adıyla erişilebilir olması gerekir. En kolayı: genel IP'li bir sunucu/DMZ ve herkese açık bir alan adı. |
| Alan adı | Örn. `kok.kurumunuz.com.tr`. DNS A kaydı sunucunun genel IP'sine gitmeli. |
| HTTPS | Zorunlu. Telefonlar şifresiz (http) siteyi uyarıyla açar; ayrıca PIN'ler açık gider. Docker kurulumunda Caddy sertifikayı otomatik alır. |
| Kurum güvenlik duvarı | 80 ve 443 portları dışarıdan sunucuya açık olmalı (sertifika alımı için 80 de). |
| Veri | Katılımcı adları ve oylar sunucuda tutulur. Kurumunuzun KVKK/bilgi güvenliği süreçlerinden geçirin; çalıştay sonunda veriyi silin. |

Alan adı ve sunucu hazır değilse çalıştay günü için en kolay yol: sunucuyu geçici bir alan adıyla (ör. kok2026.kurumunuz.com.tr) yayına almak.

## 1. Gereken sunucu

- Linux (Ubuntu 22.04/24.04 LTS önerilir), 1 vCPU, 1 GB RAM yeter (126 kişi için bol bol yeterli).
- Docker ve Docker Compose eklentisi kurulu (`docker compose version` çalışmalı).
- Genel IP + 80/443 portları açık.

## 2. Kurulum (Docker Compose)

1. Proje klasörünü (KOK_Oylama_Sistemi) sunucuya kopyalayın, örn. `/opt/kok`. (`data`, `data_deneme`, `test*` klasörlerini kopyalamanıza gerek yok; `.dockerignore` zaten dışarıda bırakır.)
2. Ayar dosyasını hazırlayın:
   ```
   cd /opt/kok
   cp .env.example .env
   nano .env        # ALAN_ADI, ADMIN_PIN, KAYIT_PIN'i doldurun
   ```
   - `ADMIN_PIN` uzun olsun (en az 8 karakter). Varsayılan `kok2026` ile canlıya çıkmayın.
   - Kurum içi sertifikanız varsa ya da genel sertifika alınamıyorsa `.env` içine `TLS_AYARI=tls internal` ekleyin (telefonlar bu sertifikaya güvenmez; bu yüzden yalnızca kurum cihazlarında kök sertifika dağıtımı varsa kullanın). Mümkünse kurumun kendi geçerli sertifikasını kullanın.
3. Başlatın:
   ```
   docker compose up -d --build
   docker compose ps          # iki servis de "running" olmalı
   docker compose logs -f app # uygulama kaydı
   ```
4. Tarayıcıdan `https://ALAN_ADI/yonetim` açın, PIN ile girin. QR ve bağlantı adresleri otomatik olarak `https://ALAN_ADI` olarak üretilir (`BASE_URL`). Yönetim › Ayarlar'dan da görebilirsiniz.

Güncelleme: yeni dosyaları kopyalayıp `docker compose up -d --build`. Veri `kok-veri` birimindedir; güncellemede silinmez.

## 3. Çalıştay gününden önce kontrol listesi

- [ ] Telefondan **mobil veriyle** `https://ALAN_ADI` açılıyor (kilit simgesi var).
- [ ] Telefondan **kurum Wi-Fi'siyle** aynı adres açılıyor. (Kurum Wi-Fi'si genel adrese çıkışı engelliyorsa BT'ye "alan adını iç ağda da çözümle" ya da "hairpin/NAT loopback" izni isteyin.)
- [ ] Yönetim ekranında "Deneme araçları" ile uçtan uca prova yapıldı, sonra **"Her şeyi sıfırla"** yapıldı.
- [ ] `ADMIN_PIN` ve `KAYIT_PIN` varsayılan değil ve yalnızca ekip biliyor.
- [ ] Yedek alma çalışıyor (aşağıda).
- [ ] 126 telefonun aynı anda bağlanması için sunucu logunda hata yok (SSE bağlantısı kişi başı 1; sorun çıkarmaz).

## 4. Yedek ve geri dönüş

Uygulama durumu `/data/state.json` dosyasına yazar (ayrıca her 30 saniyede `.onceki` kopyası alır). Gün içinde dışarıya yedek almak için:

```
# veriyi bir klasöre kopyala
docker compose cp app:/data ./yedek-$(date +%Y%m%d-%H%M)
```

Yönetim panelinde ayrıca CSV dışa aktarımları vardır (matris, puanlar, SWOT oyları, katılımcı listesi). Çalıştay sonunda bunları indirin.

Sunucu yeniden başlarsa ya da çökerse `restart: unless-stopped` sayesinde kendiliğinden kalkar ve son duruma devam eder.

## 5. Çalıştay sonrası

1. CSV'leri indirin.
2. Veriyi kalıcı silin: `docker compose down -v` (veri birimini de siler). Ya da yalnızca yönetimden "Her şeyi sıfırla".
3. Alan adı/sunucu geçici ise kapatın.

## 6. Docker olmadan (alternatif)

Sunucuda Node.js 20 veya üzeri kuruluysa:

```
cd /opt/kok
ADMIN_PIN=... KAYIT_PIN=... BASE_URL=https://ALAN_ADI TRUST_PROXY=1 DATA_DIR=/var/lib/kok node server.js
```

Önüne HTTPS veren bir ters vekil (Nginx/Caddy/kurumun yük dengeleyicisi) koyun. Ters vekilde **canlı güncelleme akışı** (`/api/events`, SSE) için tamponlamayı kapatın:

- Nginx: `proxy_buffering off; proxy_read_timeout 1h; proxy_http_version 1.1;` ve `X-Forwarded-For` başlığını ekleyin.
- Kurumun yük dengeleyicisinde: boşta kalma zaman aşımını en az 60 sn yapın (sunucu belli aralıklarla veri gönderir), yanıt tamponlamasını kapatın.

Systemd hizmeti örneği (`/etc/systemd/system/kok.service`):

```
[Unit]
Description=KOK Oylama
After=network.target
[Service]
WorkingDirectory=/opt/kok
EnvironmentFile=/opt/kok/.env.sunucu
ExecStart=/usr/bin/node server.js
Restart=always
User=kok
[Install]
WantedBy=multi-user.target
```

## 7. Ortam değişkenleri

| Değişken | Anlamı | Varsayılan |
|---|---|---|
| `ADMIN_PIN` | Yönetim paneli PIN'i | `kok2026` (canlıda değiştirin) |
| `KAYIT_PIN` | Kayıt masası PIN'i | `kayit2026` (değiştirin) |
| `BASE_URL` | QR ve bağlantılarda kullanılan adres | boş (otomatik) |
| `TRUST_PROXY` | `1` ise gerçek istemci IP'si `X-Forwarded-For`'dan alınır (ters vekil arkasında şart). Site Cloudflare proxy'si arkasındaysa `cloudflare` yazın: IP, istemcinin sahteleyemediği `CF-Connecting-IP` başlığından alınır (sunucu yalnızca Cloudflare IP'lerine açık olmalı) | kapalı |
| `PORT` | Dinlenen port | 3000 |
| `DATA_DIR` | Verinin yazıldığı klasör | `./data` |

## 8. Güvenlik notları

- Yönetim ve kayıt PIN'leri 10 dakikada en çok 15 hatalı denemeye izin verir (IP başına), sonra bloklanır.
- Katılımcı ID girişi de hatalı denemelere karşı sınırlıdır.
- Yönetim/kayıt sayfaları herkese açık adreste durur; yalnızca PIN korur. Mümkünse yönetim yolunu (`/yonetim`, `/kayit`) kurum ağı IP aralığıyla kısıtlayın (Caddy/Nginx ile) ve PIN'i uzun tutun.
- Sunucuda yalnızca 80/443 açık olsun. Uygulama portu (3000) dışarı açılmaz (Docker kurulumunda zaten açılmaz).
