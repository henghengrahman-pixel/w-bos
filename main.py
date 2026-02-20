import os
import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests
from telegram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
CHANNEL = os.getenv("CHANNEL", "").strip()

CITY = os.getenv("CITY", "Poipet")
COUNTRY = os.getenv("COUNTRY", "Cambodia")
TZ = os.getenv("TZ", "Asia/Phnom_Penh")

if not BOT_TOKEN or not CHANNEL:
    raise SystemExit("Missing BOT_TOKEN or CHANNEL env var")

bot = Bot(token=BOT_TOKEN)
tz = ZoneInfo(TZ)

BRAND_TITLE = "⏰ *ALARM PUASA MAWAR GROUP*"


def get_timings_today():
    url = f"https://api.aladhan.com/v1/timingsByCity?city={CITY}&country={COUNTRY}&method=2"
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    data = r.json()["data"]
    t = data["timings"]

    def hhmm(x: str) -> str:
        return x.strip()[:5]

    return {
        "date": data["date"]["readable"],
        "imsak": hhmm(t["Imsak"]),
        "fajr": hhmm(t["Fajr"]),
        "maghrib": hhmm(t["Maghrib"]),
    }


def dt_today(hhmm: str) -> datetime:
    h, m = hhmm.split(":")
    now = datetime.now(tz)
    return now.replace(hour=int(h), minute=int(m), second=0, microsecond=0)


async def post_and_auto_delete(text: str, delete_after_seconds: int = 3600):
    msg = await bot.send_message(chat_id=CHANNEL, text=text, parse_mode="Markdown")
    await asyncio.sleep(delete_after_seconds)
    try:
        await bot.delete_message(chat_id=CHANNEL, message_id=msg.message_id)
    except Exception:
        pass


def build_msg_bot_active():
    now_str = datetime.now(tz).strftime("%d %b %Y • %H:%M")
    return (
        f"{BRAND_TITLE}\n"
        f"✅ *BOT SUDAH AKTIF*\n"
        f"📍 *Poipet* • {now_str}\n\n"
        f"Alarm sahur (H-1 jam), imsak, dan buka siap jalan 😎🤍"
    )


def build_msg_sahur_1jam(t):
    return (
        f"{BRAND_TITLE}\n"
        f"📍 Poipet — {t['date']}\n\n"
        f"🥣 Bro & Sis… waktunya sahur nih 😎\n"
        f"⏳ 1 jam lagi masuk imsak\n\n"
        f"🕓 Imsak: {t['imsak']}\n"
        f"🕌 Subuh: {t['fajr']}\n\n"
        f"Gas makan dulu jangan kelewatan 🤍✨"
    )


def build_msg_imsak(t):
    return (
        f"{BRAND_TITLE}\n"
        f"📍 Poipet — {t['date']}\n\n"
        f"🚨 Stop makan ya guys 😅\n"
        f"Udah masuk waktu imsak\n\n"
        f"🕓 Imsak: {t['imsak']}\n"
        f"🕌 Subuh: {t['fajr']}\n\n"
        f"Semoga puasanya lancar seharian yaa wee  🤲🔥"
    )


def build_msg_buka(t):
    return (
        f"{BRAND_TITLE}\n"
        f"📍 Poipet — {t['date']}\n\n"
        f"🍽️ Yesss… waktunya buka puasa 😍🔥\n\n"
        f"🌇 Maghrib: {t['maghrib']}\n\n"
        f"Selamat berbuka guys 🤲✨"
    )


async def schedule_today(scheduler: AsyncIOScheduler):
    """
    Resync jadwal hari ini. Dipanggil berkala biar aman walau Railway restart.
    """
    t = get_timings_today()
    now = datetime.now(tz)

    imsak_dt = dt_today(t["imsak"])
    sahur_1jam_dt = imsak_dt - timedelta(hours=1)
    maghrib_dt = dt_today(t["maghrib"])

    # bersihkan job harian sebelumnya
    for job in scheduler.get_jobs():
        if job.id.startswith("daily_"):
            scheduler.remove_job(job.id)

    def add_if_future(job_id: str, run_date: datetime, text: str):
        if run_date > now:
            scheduler.add_job(
                post_and_auto_delete,
                "date",
                run_date=run_date,
                args=[text],
                id=job_id,
                misfire_grace_time=900,  # toleransi 15 menit
            )

    add_if_future("daily_sahur_1jam", sahur_1jam_dt, build_msg_sahur_1jam(t))
    add_if_future("daily_imsak", imsak_dt, build_msg_imsak(t))
    add_if_future("daily_maghrib", maghrib_dt, build_msg_buka(t))

    print("RESYNC OK:", t["date"], "Imsak", t["imsak"], "Maghrib", t["maghrib"])


async def main():
    scheduler = AsyncIOScheduler(timezone=tz)
    scheduler.start()

    # notif bot aktif (hapus 1 jam)
    asyncio.create_task(post_and_auto_delete(build_msg_bot_active(), delete_after_seconds=3600))

    # langsung resync saat start
    await schedule_today(scheduler)

    # resync tiap 30 menit (biar pasti kirim tiap hari sesuai jadwal Poipet)
    scheduler.add_job(
        lambda: asyncio.create_task(schedule_today(scheduler)),
        "cron",
        minute="*/30",
        id="refresh_often",
        replace_existing=True,
    )

    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())