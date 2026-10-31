# Amaldagi sozlamalar: OpenAI, FAL, ElevenLabs, Gemini

Asosiy oqim qayta tanlandi: OpenAI — transkripsiya va tarjima; FAL — dialog/fonni ajratish; ElevenLabs — ovoz klonlash va nutq yaratish; Gemini — qahramon ovozlarini solishtirish.

```env
TRANSLATION_PROVIDER=openai
TRANSCRIPTION_PROVIDER=openai
FILM_IDENTITY_PROVIDER=gemini
FILM_SEPARATION_PROVIDER=fal
TTS_PROVIDER=elevenlabs
```

Bu rejim tayyor subtitr importini talab qilmaydi. To‘rtta provayder kaliti va administrator xarajat chegaralari sozlanishi kerak. `.env` o‘zgarishlari backend qayta ishga tushganda yuklanadi.

## Ixtiyoriy tajriba: DeepSeek + ElevenLabs, FALsiz (hozir o‘chiq)

Oldingi tajriba sozlamalari (faqat alohida yoqilganda ishlaydi):

```env
TRANSLATION_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
TRANSCRIPTION_PROVIDER=transcript
FILM_IDENTITY_PROVIDER=manual
FILM_SEPARATION_PROVIDER=none
TTS_PROVIDER=elevenlabs
```

Bu konfiguratsiyada OpenAI, Gemini va FAL chaqirilmaydi. Oldingi kalitlar saqlangan bo‘lsa ham ushbu oqim ularni ishlatmaydi. DeepSeek’ning Chat API’si audio ASR yoki ovoz mosligini tekshirish o‘rniga ishlatilmaydi: u tayyor matnni tarjima va qisqartirishga xizmat qiladi. [DeepSeek Chat API](https://api-docs.deepseek.com/api/create-chat-completion/).

Avval Studio’da vaqtli manba subtitrini yuklang (`SRT` yoki `JSON`). `PUT /api/films/projects/:projectId/source-transcript` ham shuni bajaradi: `{ "format":"srt", "text":"..." }`. Subtitr bo‘lmasa job daqiqa yoki provayder xarajati zaxiralashdan oldin rad etiladi. Manba subtitrini birinchi run oldidan import qiling; keyin Studio muharririda tuzating.

SRT replikasi boshida `[Ali]` kabi qahramon nomi qo‘yilsa, bu qo‘lda kiritilgan moslik sifatida saqlanadi. Bir loyihadagi bir xil nom keyingi sahnada o‘sha qahramon profiliga bog‘lanadi. Belgisiz subtitr `Unknown` bo‘ladi va ovoz yaratishdan oldin Studio’da tekshirish talab etiladi. Audio asosida odamni tanish bor deb ko‘rsatilmaydi.

```srt
1
00:00:00,000 --> 00:00:12,000
[Ali] Hello, we have been waiting for you.

2
00:00:12,100 --> 00:00:14,000
[Mary] Thank you.
```

JSON shakli: `[{"id":"s1","startTime":0,"endTime":12,"speaker":"Ali","originalText":"Hello..."}]`.

FALsiz original musiqa va effektlar finalga qo‘shilmaydi. Original soundtrack’ni qayta aralashtirish inglizcha/ruscha dialogni ham qaytarib yuborishi sababli finalda o‘zbekcha nutq va jim fon ishlatiladi. Klon namunalari ajratilmagan manbadan olinadi; fon aralashgan namuna klon sifatini pasaytirishi mumkin. `background_omitted` va `unseparated_clone_sample` warninglari, `backgroundPreserved:false` va `separationMode:"none"` natijada qaytariladi. Bu sifatni kafolatlaydigan asosiy oqim emas, foydalanuvchi so‘ragan taqqoslash tajribasidir.

Administrator ushbu rejimda faqat faol `translation`, `clone`, `speech` request ceilinglarini sozlashi kerak; qolgan bosqichlar nol va chaqirilmaydi. DeepSeek xatosida OpenAI yoki DeepL’ga avtomatik o‘tish yo‘q. ElevenLabs xatosida OpenAI TTS’ga ham o‘tilmaydi.

Agar keyin audiodan avtomatik transkripsiya kerak bo‘lsa, `TRANSCRIPTION_PROVIDER=elevenlabs` alohida qo‘llab-quvvatlanadi; bu tajribada yoqilmagan. U mavjud ElevenLabs kaliti bilan Scribe v2’dan speaker belgilari va word timestamp’larini oladi. [ElevenLabs Scribe API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).

Quyida to‘liq fon saqlaydigan dastlabki beta oqimi bayon qilingan. Uni tiklash uchun providerlarni mos ravishda `openai`, `openai`, `gemini`, `fal`, `auto` ga almashtiring.

---

# Film va serial dublyaji: ichki beta

Yangi Cinema loyihasi avval Studio’da ochiladi. Studio’da inglizcha yoki ruscha manba, o‘zbekcha natija, serial/epizod, lug‘at, davomiylik taxmini va USD sarf chegarasi tanlanadi. Hisoblashdan keyingina film boshlanadi. Mavjud qisqa `/api/dubbing/process` oqimi saqlangan; uzun Cinema manbalari `/api/films` orqali ishlanadi.

## Sozlash

- `CINEMA_ENABLED=true`, `CINEMA_USER_IDS=<ichki tester IDlari>`.
- `FAL_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`.
- `FILM_ADMIN_USER_IDS=<administrator IDlari>`.
- `MAX_FILM_DURATION_SECONDS=21600` — umumiy xavfsizlik chegarasi, provayder bo‘lagi 60 soniya.
- `MAX_UPLOAD_SIZE_BYTES` — disk va reverse proxy upload limitiga mos sozlang. Standart 250 MB katta film uchun oshirilishi kerak.
- `TRUST_PROXY_HOPS=1` faqat ilova oldida aynan bitta ishonchli reverse proxy bo‘lsa. Tashqi foydalanuvchi backendga bevosita ulanmasligi kerak.

Migratsiya `013_film_workflow` mavjud loyihalarni saqlaydi. U serial, epizod, qahramon, namuna, bo‘lak, xarajat zaxirasi va pullik so‘rov jurnalini qo‘shadi. Ishga tushirishdan oldin `npm run backup:film` bilan baza va media fayllarining tekshirilgan nusxasini oling. Zaxira olishda media o‘chirilsa, snapshot `.incomplete-*` holatda qoladi va muvaffaqiyat deb e’lon qilinmaydi. Tiklashda manifestdagi SHA-256 qiymatlarini tekshiring, bazani va `uploads`ni birga qaytaring; boshqa media katalogiga ko‘chirilsa bazadagi mutlaq artifact yo‘llarini ham yangilang.

Administrator Studio’dagi sozlamalar yoki `PUT /api/films/settings` orqali olti turdagi cheklangan provayder so‘rovi uchun konservativ xarajat yuqori chegaralarini kiritadi. Qiymatlar butun USD micro-dollar: 1 USD = 1 000 000. Misol sxemasi:

```json
{
  "defaultLimitMicros": 100000000,
  "requestCeilingsMicros": {
    "separation": 1000000,
    "transcription": 100000,
    "translation": 100000,
    "identity": 1000000,
    "clone": 1000000,
    "speech": 1000000
  }
}
```

Bu qiymatlar provayder tariflari emas: amaldagi tariflar, maksimal kirish/chiqish va hisoblash birligiga qarab administrator belgilaydigan request ceiling namunasidir. Nol qiymat ish boshlashga yo‘l qo‘ymaydi. Har bir job sozlamalarning o‘zgarmas nusxasini oladi. Dashboarddagi sarf — ehtiyotkor zaxira, haqiqiy provayder invoice emas. Tashqi hisobni provayder invoice bilan solishtiring; tarif noto‘g‘ri kiritilsa haqiqiy xarajat uchun qat’iy kafolat yo‘q.

## Tiklash va xarajat

Manba FFmpeg orqali 60 soniyadan ajratiladi. Butun filmni base64ga aylantirish yoki bitta provayder so‘roviga yuborish yo‘q. Tayyor stem, ASR, tarjima va TTS disk/SQLite orqali qayta ishlatiladi. Nutq har bir sahnada ko‘pi bilan 20 kirishli FFmpeg passlarda yig‘iladi, so‘ng WAVlar diskda birlashtiriladi.

Pullik chaqiruvdan **oldin** tranzaksiya jurnalga `pending` yozadi va xarajatni zaxiralaydi. Limit yetmasa job `paused` bo‘ladi; daqiqa zaxirasi, tayyor bo‘laklar va media saqlanadi. `POST /api/films/jobs/:jobId/resume` yangi `budgetMicros` bilan o‘sha jobni davom ettiradi. Tugagan chaqiruv qayta yuborilmaydi. Crash/timeout natijasi noaniq bo‘lsa jurnal `pending/uncertain` holatida qoladi; avtomatik takrorlash yo‘q.

Administrator provayder jurnalida so‘rov yuborilmaganini tekshirganidan keyingina `POST /api/films/projects/:projectId/requests/:key/reconcile` ga `confirmedNotSubmitted: true` va kamida 10 belgili `providerEvidence` beradi. Bu faqat tekshirilgan yuborilmagan so‘rov zaxirasini qaytaradi. Bajarilgan so‘rov natijasini tiklash uchun operator artifact va jurnalni zaxiradan qaytarishi kerak. Yuborilgan, ammo natijasi yo‘q so‘rovni `confirmedNotSubmitted` bilan tozalash mumkin emas.

## Qahramon xotirasi

Har bir bo‘lakning speaker belgisi alohida boshlanadi. Qisqa, ustma-ust bo‘lmagan namunalar diskda saqlanadi. Gemini ko‘pi bilan sakkizta oldingi qahramon namunasini bir so‘rovda solishtiradi (maksimal 32 nomzod). Yuqori ishonchli mosliklar profilga bog‘lanadi, avtomatik mosliklar ham ko‘rib chiqish uchun belgilanadi. Studio’da bir serialdagi oldingi epizod qahramonini tanlash mumkin; studiyalar orasida profil yoki clone ulashilmaydi. Matn/timing asosida odamni taxmin qilish yo‘q.

Klon uchun jami kamida 10 soniyalik toza namuna kerak. Boshqa sahna va bog‘langan epizod namunalari ishlatiladi. Clone qahramon profilida xususiy saqlanadi va job tugashi bilan o‘chirilmaydi. Mustaqil film o‘chirilganda uning klonlari ham o‘chiriladi; serial qahramoni epizod o‘chirilganda saqlanadi. Eski qisqa job clone lifecycle o‘z holicha qoladi, per-job rozilik UI/parametri talab qilinmaydi.

## Sifat va eksport

Tarjima sahna ichidagi qo‘shni replikalar, sahna chegarasidagi kontekst va lug‘atni oladi. Uzun avtomatik tarjima ko‘pi bilan ikki marta qisqartiriladi; qo‘lda yozilgan tarjima avtomatik o‘zgartirilmaydi. 1.45× tezlashtirishdan ortiq talab qilinsa replika `translation_too_long` bo‘ladi.

Klon yoki nutq yaratilmasa tayyor site ovoziga o‘tish yo‘q. Filmning boshqa replikalari davom etadi. `partial` natijada hal qilinmagan dialog oralig‘i jim; ajratilgan fon saqlanadi. Ustma-ust nutq va qahramon mosligi alohida review warning. To‘liq natija `completed`.

Studio eksportlari: MP4 ko‘rish nusxasi (audio manbada MP4 yo‘q), o‘zbekcha dialog PCM WAV, fon PCM WAV, SRT, VTT, JSON tekshiruv hisoboti. Subtitrlar hal qilinmagan oraliqni `[UNRESOLVED: ...]` bilan ko‘rsatadi. Matn yoki qahramon o‘zgarsa qayta boshlash tayyor ASR/stem/ovozlarni ishlatadi, faqat o‘zgargan TTS input yangi chaqiruvga sabab bo‘ladi. Yangi job uchun daqiqa tarifida filmning davomiyligi 1.5× rezerv qilinadi; USD zaxirasi faqat yangi provayder so‘rovlari uchun.

## Qabul sinovlari

`server/__tests__/films.test.js` generatsiya qilingan audio va mock provayderlar bilan xarajat, pause/resume, noaniq chaqiruv, studio izolyatsiyasi, qisman eksport, klonni saqlash, o‘zgargan replika va uzun film bo‘laklarini tekshiradi. Bu testlar haqiqiy o‘zbekcha nutq sifati yoki film ustidagi provayder sifatini tasdiqlamaydi.

Ichki beta davomida ruxsat etilgan inglizcha va ruscha materiallar uchun quyidagi nazorat to‘plamini to‘ldiring; foydalanuvchi materiallari ushbu repo bilan berilmagan:

1. 1–5 daqiqalik sahna: sokin dialog, musiqa, shovqin, effekt, pichirlash, baqirish, qisqa va ustma-ust replika.
2. Uzun epizod: bir qahramon turli sahnada; keyingi epizodda o‘sha clone ID; noaniq moslikni qo‘lda tuzatish.
3. To‘liq film: manba davomiyligi bilan WAV/MP4 farqi, dialog leakage, ovoz tabiiyligi va gap oxirlarini ona tilida so‘zlashuvchi reviewer tekshiradi.
4. Restart, provayder timeouti, disk ENOSPC, sarf chegarasi, stale lease: tayyor chaqiruvlar qaytmasin, daqiqa ikki marta yozilmasin, eski tayyor eksport yo‘qolmasin.
5. Har run uchun manba/ruxsat, til, davomiylik, success/partial, request soni, rezerv/invoice, qayta yaratilgan replika va qo‘lda tuzatishlar, reviewer/sana yoziladi. Ushbu hisobotlarsiz public rollout qilinmaydi.
