# KÖK Oylama Sistemi (prototip v0.1)

Yönetici çalıştayında telefonla oylama ve puanlama. Node.js 20+ ve PostgreSQL (14+) gerekir; tek npm bağımlılığı `pg`.

## Çalıştırma

```
cd KOK_Oylama_Sistemi
npm ci
createdb kok      # PostgreSQL'de boş bir veritabanı
DATABASE_URL=postgres://localhost:5432/kok ADMIN_PIN=1234 node server.js
```

Tablolar açılışta kendiliğinden kurulur. Veritabanı boşsa ve `data/state.json` (eski sürümün dosyası) varsa bir kez içeri aktarılır.

Sunucu bir bilgisayarda (salonda yerel sunucu) çalışır. Katılımcı telefonları aynı Wi-Fi ağına bağlı olmalıdır. Açılışta ağdaki adres yazılır (örn. `http://10.80.23.175:3000`). macOS güvenlik duvarı gelen bağlantı için izin isteyebilir. Adres yanlışsa Yönetim › Ayarlar'dan değiştirin; QR kodları bu adresi kullanır.

## Sayfalar

| Adres | Kim | Ne için |
|---|---|---|
| `/yonetim` | Yönetim ekibi (PIN) | Katılımcı/masa ataması, oy sayıları, aşama, sunum kontrolü, sonuçlar, ayarlar |
| `/masa/3A?k=…` | Masa moderatörü | Post-it sayısı, oy hakkı, oylamayı aç/kapat, proje fikri adları |
| `/p/<kod>` | Katılımcı (yaka kartı QR) | Oy ve puan |
| `/katil` | Katılımcı | Yaka kartı QR yoksa 4 haneli kodla giriş |
| `/ekran` | Salon | Projeksiyon: katılım QR'ı, oylama durumu, sunum, sonuç slaytları |

Masa bağlantıları (anahtarlı) Yönetim › SWOT aşaması sekmesinde. Perdede sonuç slaytlarını ok tuşlarıyla geçmek için aynı tarayıcıda yönetim paneline bir kez giriş yapmış olmak yeterlidir.

## Moderatörler (katılımcı değildir)

Her masanın bir **moderatörü** vardır. Moderatör katılımcı değildir: oy vermez, fikir girmez, puanlamaz, masa katılımcı sayısına dahil edilmez; yalnızca masayı yürütür. Kendi ID'siyle girince doğrudan **Moderatör paneli** açılır. Üstteki rol çubuğundaki **Katılımcı görünümü** düğmesiyle katılımcıların gördüğü ekranı **salt okunur** izleyebilir (oy, fikir ve puan veremez; sunucu bu istekleri reddeder). Panelde masanın kontrolleri bulunur: post-it sayısını girip oylamayı aç/kapat, eşitlik çözümü, içerik girişi, seansı kapat, tema tablosu, fikir seçimi ve süre. Yönetim › Katılımcılar'da kişinin "Moderatör" kutusu işaretlenince kişi moderatör olur (varsa eski oy, fikir ve puan kayıtları silinir). ID listesinde 5. sütuna `m` yazmak (`ID;masa;ad;pozisyon;m`) da işaretler. Yönetim › **Moderatörler** sekmesi moderatörleri listeler, masa başına durumunu gösterir (moderatörü olmayan masalar kırmızı), yeni moderatör ekler, mevcut kişiyi moderatör yapar ve moderatörlükten çıkarır. Eski anahtarlı masa bağlantısı (`/masa/3A?k=…`) de çalışır.

**Terimler:** *Moderatör* = masayı yürüten kişi (eski adıyla kolaylaştırıcı). *Yönetici* = yönetim panelini ve genel süreci yöneten ekip (eski adıyla moderatör). *Katılımcı* = çalıştaya katılan her bir yönetici/üst düzey çalışan.

## Kayıt masası

Sabah karşılamada kayıt görevlileri `/kayit` adresini **kayıt PIN'iyle** açar (`KAYIT_PIN` ortam değişkeni, varsayılan `kayit2026`; yönetim PIN'i de çalışır). Ekran: katılımcıyı ad, pozisyon veya ID ile arar; "Geldi" işareti koyar; masayı seçer veya değiştirir; listede olmayan kişiyi ekler (ID üretilir); telefon değiştiyse cihazı sıfırlar. Masa kartlarında gelen/atanan sayısı görünür. Yönetim › Ayarlar'dan "Kayıt kapansın" açılınca masa değişikliği ve yeni kişi eklenemez, yalnızca "Geldi" ve cihaz sıfırlama kalır. Kayıt ekranı kimsenin oy bağlantısını (jeton) görmez. Moderatörlerin masa panelinde artık katılımcı listesi, ID ve cihaz sıfırlama yoktur; kayıt işleri kayıt masasındadır.

## Cihazlar

- **Katılımcılar yalnızca telefonla** çalışır; masalarda projeksiyon gerekmez. Tek projeksiyon genel kurul içindir (`/ekran`).
- **Moderatör (masa) ekranı ve yönetim paneli** hem telefonda hem bilgisayarda kullanılabilir: telefonda tek sütun, büyük düğmeler ve ekranın altında sabit eylem çubuğu; yönetim tabloları kart görünümüne dönüşür.

## Katılım kimliği (ID) akışı

1. **Önceden:** Yönetim › Katılımcılar › "ID listesi yapıştır". Her satır `ID;masa;etiket` (örn. `4817;3A;Koltuk 12`). ID, katılımcının kartında yazan kimliktir (3-12 harf/rakam, büyük-küçük harf fark etmez). Kimler hangi masada olacak baştan belirlenir; her ID bir masaya, masa da bir temaya bağlıdır. ID'yi sistem de üretebilir (5 haneli).
2. **Gün içinde:** Katılımcı herkes için aynı olan QR'ı (veya `/katil` adresini) açar, kartındaki ID'yi girer, masasını ve temasını görüp "Oylamaya geç" der. Telefon bir sonraki açılışta kendiliğinden bağlanır.
3. **Değişiklik:** ID–masa eşleşmesini yalnızca yönetim (Katılımcılar sekmesi, masa seçimi veya toplu taşıma) değiştirir; telefon kendiliğinden yeni masaya geçer. ID'ler de aynı tablodan düzenlenebilir.
4. **Güvenlik:** Hatalı ID denemeleri IP başına sınırlıdır (10 dk'da 20). Bir ID'nin kaç farklı cihazdan kullanıldığı kaydedilir; birden fazlaysa yönetim panelinde "2 cihaz" uyarısı görünür. Ayarlar › "Bir ID yalnızca tek cihazdan kullanılabilsin" açılırsa ID ilk girildiği cihaza kilitlenir; telefon değişirse yönetim veya masa moderatörü "Cihazı sıfırla" der. Kimlik kartlarını Katılımcılar sekmesinden yazdırın (ID + ortak QR veya kişisel QR).

## Wi-Fi ve barındırma

Katılımcıların aynı Wi-Fi'de olması gerekmez; gereken, telefonların sunucuya **ulaşabilmesidir**. Sunucu bir dizüstü bilgisayarda çalışırken yalnızca o bilgisayarla aynı ağdaki cihazlar adrese erişir. Seçenekler:

- **Aynı Wi-Fi (en basit):** yerel adres (`http://10.x.x.x:3000`); internet kesilse de çalışır.
- **Tünel (Wi-Fi gerekmez):** bilgisayar internete bağlıyken `cloudflared tunnel --url http://localhost:3000` komutu herkese açık bir https adresi verir; telefonlar mobil veriyle bağlanabilir. Bu adresi Yönetim › Ayarlar › "Telefonların açacağı adres" alanına yazın (QR bunu kullanır). Adres internete açıldığı için **güçlü bir `ADMIN_PIN`** kullanın.
- **Kalıcı sunucu:** bankanın onaylı bir sunucusuna veya bulut ortamına kurulum; veri konumu ve güvenlik onayı gerektirir.

## Çalıştay günü akışı

1. **Önceden:** Yönetim › Katılımcılar: "Her masaya 9 katılımcı oluştur" veya "Liste yapıştır" (`etiket;masa`). "QR kartlarını yazdır" ile yaka kartlarını basın. Masa bağlantılarını moderatörlere gönderin.
2. **Gün içinde masa değişirse:** Katılımcılar sekmesinde masa seçimini değiştirin; telefon kendiliğinden yeni masaya geçer.
3. **Güçlü yönler (Tur 1 sonu):** Aşama = "Güçlü yön oylaması". Moderatör masa ekranında flipchart'ta kalan (aynı şeyi söyleyenler elendikten sonraki) post-it sayısını girer; her post-it oylanabilir bir seçenektir, ayrıca alan sayısı girilmez; moderatör yalnızca post-it sayısını girer; kişi başı oy hakkı (post-it sayısının yarısı, en çok 15) ve aynı post-it'e en fazla 2 oy otomatik üretilir, moderatör ekranında yalnızca bilgi olarak gösterilir. Yönetim isterse Yönetim › SWOT aşaması tablosundan masa bazında özel değer verebilir ( gerekçe: `test/simulasyon_swot_oy.js`). "Oylamayı aç." Katılımcılar telefonda flipchart'taki numaralara oy verir (tüm oylarını kullanmadan gönderemez). Moderatör kapatınca masanın ilk 5'i görünür.
4. **Zayıf yönler (Tur 2 sonu):** Aynı adımlar. Güçlü yön oylaması kapanmadan zayıf yön açılmaz.
5. **Fikir geliştirme ve masa içi seçim (her masa kendi içinde; masalarda projeksiyon yok, her şey telefonda):** Aşama = "Fikir yazımı". İsterseniz Genel sekmesinden ortak geri sayım başlatın (örn. 15 dk serbest düşünme); sayaç tüm telefonlarda ve perdede görünür. Moderatör tema tablosunu (iki masanın ilk 5+5 bulgusu) sesli okur ve masa ekranından (veya Genel sekmesinden tüm masalar için) "Tema tablosunu herkesin telefonunda aç" der; tablo masadaki herkesin telefonunda aynı anda açılır. Katılımcılar kendi hızında fikir geliştirir, seçtiği **bir** fikri telefonundan girer. Masa moderatörü "Sunumları başlat" der: fikirler rastgele sırayla sunulur; sahibi anlatır (telefonlarda fikrin numarası ve adı görünür), moderatör "Puanlamayı aç" der, herkes 1–5 puan verir (kendi fikrine veremez, süre dolunca kapanır). Son fikirden sonra "Gözden geçirmeyi aç": herkes tüm fikirleri ve kendi puanlarını görüp değiştirir (varsayılan 2 dk). "Sonucu hesapla": her kişinin ölçeği düzeltilerek sıralanır; moderatör ilk 2'yi (çeşitlilik kontrolüyle) "Masanın önerisi olarak kaydet" der. Sonra Yönetim › Fikirler ve sunum: "Kura ile numaralandır." (28 öneri). Genel kurul perdesi bu sırada yalnızca masaların ilerleyişini ve ortak sayacı gösterir.
6. **Sunumlar:** "İlk öneriyi seç", "Sunumu başlat" (geri sayım perdede), "Puanlamayı aç" (süre dolunca otomatik kapanır), "Sonraki öneri". Telefonda numara ve ad görünür; Etki ve Uygulanabilirlik 1–5.
7. **Sonuç:** Yönetim › Sonuç: "Sonuçları yayına al." Matris ve dört bölgenin listeleri hem perdede (5 slayt) hem telefonlarda.

## Kurallar ve ayarlar

- **Yönetici programı (yalnızca yönetim paneli):** Yönetim › Program sekmesi günün seanslarını süreleriyle listeler; "Şu an buradasınız" göstergesi, kalan süre ve sıradaki seans her sekmenin üstündeki çubukta da görünür. Gecikme olursa ±dk düğmeleri şu anki seansın bitişini ve sonraki seansları kaydırır; program metinle düzenlenebilir (`SS.DD–SS.DD | Başlık | Not | aşama`). Her seansın yanındaki "Aşama" düğmesi çalıştay aşamasını tek dokunuşla ayarlar. Program katılımcılara ve perdeye gösterilmez; "Her şeyi sıfırla" programı silmez.

- Masa içi seçimde puan 1–5 tek ölçüttür; sıralama her puanlayanın kendi ölçeği düzeltilerek (z-skoru) yapılır, eşitlikte önce 5 puan sayısı, sonra puanlayan sayısı belirleyicidir. Yöntemin gerekçesi: `test/simulasyon_oylama.js`.
- Oylama kapanınca masa moderatörü en çok oy alan ilk 5 post-it'in içeriğini masa ekranından yazıp "Seansı kapat" der; bulgular sisteme kaydedilir ve tema tablosunda bu içerikler görünür (eşitlikte masa hangi post-it'lerin gireceğini seçer). Yönetim › Sonuç'tan "SWOT bulguları (CSV)" alınır.
- Oy hakkı ve "aynı post-it'e en fazla oy" masa bazında değiştirilebilir; oy hakkı, post-it sayısı × en fazla değerden büyükse oylama açılmaz.
- Tüm oyları kullanma zorunluluğu, kendi masanın önerisini puanlama, puanlama/sunum süresi ve otomatik kapanma Ayarlar'dan yönetilir.
- Matris bölgeleri: etki ve uygulanabilirlik ≥ çizgi → yüksek. Çizgi sabit orta nokta (3) veya önerilerin ortalaması olabilir. ◆ = yüksek görüş ayrılığı (standart sapma eşiği ayarlanabilir).
- Sonuçlar oylama kapanınca görünür; kimse başkasının puanını göremez.

## Veri ve gizlilik

- Katılımcılar yalnızca etiket (örn. koltuk) ve masa ile tanınır; isim gerekmez. Kimin oy kullanıp kullanmadığı yönetimde (SWOT aşaması › Oy durumu, tüm masalar) ve moderatör panelinde (yalnızca kendi masası) görünür; oyun içeriği kişiye bağlı gösterilmez. Puanlar kişiye bağlı gösterilmez; CSV çıktılarında kişi kimliği yoktur.
- Veri PostgreSQL'de tutulur (`DATABASE_URL`). Katılımcılar, oylar, puanlar, fikirler vb. ayrı tablolardadır; her değişiklik tek bir işlemde (transaction) yazılır ve yanıt ancak kayıt tamamlanınca döner. "İçeriği sıfırla" ve "Her şeyi sıfırla" öncesi durum `yedekler` tablosuna alınır. Çalıştay sonunda CSV alıp (Sonuç sekmesi) veritabanını silin (`dropdb kok`).
- PIN'i `ADMIN_PIN` ortam değişkeniyle değiştirin. Prototip kapalı ağ için tasarlandı; internete açmayın.

## Prova

**Moderatör eğitimi için demo SWOT verisi (geçici):** Yönetim › Ayarlar › Deneme araçları üstündeki kutuda masa ve tür seçilir. "Oylamaları üret" post-it sayısı ve oyları yazar, oylamayı kapatır; içeriği moderatör kendisi girer ve seansı kapatır. "Tam demo" içerikleri de ("1A masası - Güçlü Yön - Post-It #1") yazar ve seansı kapatır; tema tablosu hemen dolar. "Demo SWOT verisini temizle" seçilenleri sıfırlar.

Yönetim › Ayarlar › Deneme araçları: sahte katılımcı, oylama, fikir ve puan üretir. Gerçek çalıştaydan önce "Her şeyi sıfırla" ile temizleyin. `npm test` kalıcılık katmanı ve arka uç duman testini geçici bir PostgreSQL veritabanında çalıştırır (`TEST_DATABASE_URL`, varsayılan `postgres://localhost:5432/postgres`); `node test/seed.js` görsel prova verisi üretir.

## Henüz yapılmayanlar

- SWOT bulgularının tema bazında konsolide görünümü: şu an yalnızca küme numaraları ve (isteğe bağlı) başlıklar var; tasarım ayrıca konuşulacak.
- 126 cihazla gerçek Wi-Fi yük testi ve kurumsal güvenlik onayı.

## Fikir aşaması: puanlama, takımlar ve PowerPoint

- **Masa içi puanlama:** Moderatör "Sunumları başlat" deyince masadaki herkes tüm fikirleri, yanlarında 1–5 puanlama alanıyla görür ve **dinledikçe** puanlar (ayrı bir puanlama penceresi yok). "Sonraki fikir" yalnızca anlatılan fikri işaretler. "Puanlamayı sonlandır ve sırala" fikirleri puanlarına göre dizer; sıralamayı masadaki herkes görür.
- **Önerilerin detayı (sade, 2-3 dk'lık sunuma göre):** Masanın seçtiği iki öneri için masa iki takıma ayrılır. Katılımcı "Bu takımdayım" der ve yalnızca beş kısa alanı doldurur: ne yapılacak, kimler için ve nerede, beklenen öğrenme katkısı, ilk adım ve sahiplik. **Dayandığı SWOT bulguları elle girilmez**; fikri yazanın seçtiği maddeler (kod ve içerik) otomatik gelir. Sunumcu bilgisi istenmez. Yazdıkça kaydedilir, "Gönder" ile kilitlenir, "Düzenlemeye aç" ile geri alınır. Moderatör da her öneriyi doldurup gönderebilir.
- **Slayt görünümü (perde):** Genel kurulda aktif önerinin slaytı perdede (/ekran) otomatik gösterilir: başlık, otomatik SWOT dayanağı ve beş kısa alan; sunum geri sayımı ve puanlama ilerlemesi aynı slaytta. PowerPoint dosyası üretilmez, python gerekmez.
- **Genel kurul puanlaması** (etki × uygulanabilirlik) ve matris önceki gibidir.
- **Demo:** Ayarlar › Deneme araçları › "Demo fikir aşaması" fikir girişinden "iki önerinin detayı gönderildi"ye kadar yedi adımdan istenene kurar; masadaki herkes için "Fikir 1A-1" gibi fikirler yazılır.
- **Süreler moderatör panelinde:** Panelin üstünde "Şu an" şeridi (seans adı, kalan süre, sıradaki seans) ve her kartta o adımın tahsis edilen süresi (ör. Brainwriting 22 dk, Okuma ve eleme 28 dk, Oylama 5 dk) görünür. Veri yönetici programından gelir; yönetici saatleri kaydırınca burada da güncellenir. Moderatör yalnızca seans adı ve saatleri görür, yönetici notlarını görmez.
- **Fikrin SWOT dayanağı:** Katılımcı fikrini girerken temanın iki masasının kapatılmış bulgularından (3AG-5, 3AZ-12 gibi) en az 1, en çok 3 madde seçer. Seçilenler sunum sırasında fikrin altında ("Dayanak"), moderatör panelinde ve fikir girişi listesinde görünür. Masanın önerisi kaydedilince bu maddeler detay formunda salt okunur gösterilir ve slayta otomatik girer. Tema bulguları henüz kaydedilmemişse seçim istenmez.


## Test ortamı (sahte veri, izole)

`npm run test:ortam` (ya da `node tools/test_ortami.js --asama=genel-kurul`) geçici bir PostgreSQL veritabanıyla, 3200 numaralı portta sahte verili bir sunucu başlatır (kapanınca veritabanı silinir); gerçek verilere ve 3000/3001 sunucularına dokunmaz. Ayrıntılı test planı için `GPT_TEST_BRIFI.md`.
