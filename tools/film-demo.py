#!/usr/bin/env python3
"""Films the 30-second AeroNYX demo video from the real app running locally.

AI disclosure: this script was written by an AI coding assistant (Claude).
The video it produces is AI-made and carries a visible watermark saying so.

Needs Python with Playwright, Google Chrome and ffmpeg. Serve the app first:
  python3 -m http.server 8765        (from the repository root)
Then:
  tools/film-demo.py probe 40,200,300   save those frame numbers as JPEGs and stop
  tools/film-demo.py render             encode every scene and join them
Output goes to ./film-out (set FILM_ROOT to change it).
"""
import json
import os
import pathlib
import subprocess
import sys
import time
import datetime

from playwright.sync_api import sync_playwright

W, H, FPS = 1920, 1080, 30
VW, VH = 1280, 720  # wide enough for the app to draw the concept device around the screen
BASE = os.environ.get('FILM_BASE', 'http://127.0.0.1:8765/')
ROOT = os.environ.get('FILM_ROOT', os.path.join(os.getcwd(), 'film-out'))
CHROME = os.environ.get('FILM_CHROME', '/usr/bin/google-chrome')
MODE = sys.argv[1] if len(sys.argv) > 1 else 'probe'
PROBE = set(int(x) for x in sys.argv[2].split(',')) if MODE == 'probe' and len(sys.argv) > 2 else set()

FINISH = os.environ.get('FILM_FINISH', 'graphite')  # the device finish the team picked: graphite, aluminium or white
ALARM_DOSE = 612.0  # a test dosimeter reading past NASA's 600 mSv career limit, entered to show the alarm
DEVICE_JS = (pathlib.Path(__file__).resolve().parent / 'film-device.js').read_text()

SUBS = [
    'A message to Mars can take 20 minutes each way.',
    "Every reading sits against its safe range; NASA's limits are tagged.",
    'A blood or urine specimen goes into the sample port, and the results are logged.',
    'It dispenses each prescribed dose and tracks how the reading moves afterwards.',
    "If the mission dose reaches NASA's 600 mSv limit, the bar turns red and says what to do.",
    'Astro talks with the crew about stress and runs a mental health check-in.',
    'Reports cross the signal delay to the flight surgeon, who makes the medical decisions.',
    "Limits are NASA's. Readings are simulated. The device is a concept. Made with AI.",
]
SCENE_FRAMES = [48, 120, 150, 120, 135, 120, 105, 57]  # 855 frames = 28.5 s

# The machine that renders the video has no internet access, so NASA's two live
# services cannot be reached while filming. Both are replayed from what they
# returned on the deployed site.
# Space weather: the records NASA DONKI returned at 22:03 UTC on 15 Nov 2026
# for 16 Oct to 15 Nov 2026 (no particle events, 14 flares, one storm).
DONKI_REPLAY = {
    'SEP': [],
    'FLR': [{'peakTime': t, 'classType': c} for t, c in [
        ('2026-10-16T15:42Z', 'M1.3'), ('2026-10-19T09:03Z', 'M1.6'), ('2026-10-23T03:55Z', 'C1.3'), ('2026-10-26T08:38Z', 'C1.9'),
        ('2026-10-26T18:40Z', 'C2.8'), ('2026-11-05T18:33Z', 'M3.5'), ('2026-11-07T12:43Z', 'M1.2'), ('2026-11-07T17:17Z', 'M1.4'),
        ('2026-11-07T18:42Z', 'M1.9'), ('2026-11-08T07:46Z', 'M1.7'), ('2026-11-08T15:37Z', 'M1.1'), ('2026-11-08T18:27Z', 'M1.1'),
        ('2026-11-11T21:21Z', 'M1.7'), ('2026-11-14T21:27Z', 'C2.8')]],
    'GST': [{'startTime': '2026-10-31T18:00Z', 'allKpIndex': [{'kpIndex': 6}]}],
}


def donki_replay(route):
    kind = next((k for k in DONKI_REPLAY if f'/get/{k}?' in route.request.url), None)
    route.fulfill(status=200, content_type='application/json', body=json.dumps(DONKI_REPLAY.get(kind, [])),
                  headers={'access-control-allow-origin': '*'})


# The dose shown on the radiation bar while it climbs in the alarm scene.
RAD_TWEEN_JS = """d => { const s = document.querySelector('[data-film="rad"]'); if (!s) return;
  s.querySelector('.rad-fill').style.width = Math.min(100, d / 6).toFixed(1) + '%';
  s.querySelector('.rad-value strong').textContent = d.toFixed(1);
  const p = s.querySelector('.rad-pct'); if (p) p.textContent = (d < 6 ? '<1' : Math.round(d / 6)) + '%'; }"""

# The ISS cabin readings are the values the live NASA feed gave on the deployed site at 19:37 US Central on
# 14 Nov 2026 (cabin 23.7 C, 758 torr, carbon dioxide 2.44 mmHg last sent 12
# days earlier, urine tank 49 percent, waste water 71, clean water 57).
ISS_REPLAY_JS = r"""
(() => {
  const Real = window.WebSocket;
  class Replay {
    constructor(url) { this.url = url; setTimeout(() => this.onopen && this.onopen(), 50); }
    send(msg) {
      const reply = (data, ms) => setTimeout(() => this.onmessage && this.onmessage({ data }), ms);
      if (msg === 'wsok') reply('WSOK\r\n', 30);
      else if (msg.startsWith('create_session')) reply('CONOK,Sreplay,50000,5000,*\r\n', 30);
      else if (msg.startsWith('control')) {
        const hours = (age) => ((Date.now() - age - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 3.6e6 + 24).toFixed(6);
        const v = [[23.7, 8e3], [758.1, 12e3], [2.435, 12.3 * 864e5], [49, 73 * 6e4], [70.9, 5e3], [57.2, 5e3]];
        reply('SUBOK,1,6,2\r\n' + v.map(([val, age], i) => `U,1,${i + 1},${val}|${hours(age)}`).join('\r\n') + '\r\n', 60);
      }
    }
    close() {}
  }
  window.WebSocket = function (url, protocol) { return String(url).includes('lightstreamer') ? new Replay(url) : new Real(url, protocol); };
})();
"""

OVERLAY_JS = r"""
(() => {
  const style = document.createElement('style');
  style.textContent = `
    html { scroll-behavior: auto !important; }
    ::-webkit-scrollbar { display: none; }
    body, button, input, select, textarea { font-family: Inter, system-ui, sans-serif !important; }
    #f-sub { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); width: max-content; max-width: 1000px;
      padding: 10px 22px; border-radius: 12px; background: rgba(5, 8, 14, 0.9); color: #fff; font: 600 24px/1.3 Inter, sans-serif;
      text-align: center; z-index: 9600; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.55); opacity: 0; }
    /* The AI mark the challenge rules require: small, in a corner, on every frame. */
    #f-wm { position: fixed; left: 12px; bottom: 9px; padding: 3px 10px; border-radius: 999px; background: rgba(5, 8, 14, 0.7);
      color: #fff; font: 600 12px/1.2 Inter, sans-serif; letter-spacing: 0.02em; z-index: 9700; }
    .toast { display: none !important; }
    .rad-fill { transition: none !important; }
    #f-note { position: fixed; right: 14px; top: 50px; padding: 5px 13px; border-radius: 999px; background: rgba(12, 17, 27, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.35); color: #e9edf5; font: 600 14px/1.2 Inter, sans-serif; z-index: 9700; opacity: 0; }
    #f-cur { position: fixed; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; background: rgba(255, 255, 255, 0.92);
      border: 2px solid #0c111b; z-index: 9200; opacity: 0; pointer-events: none; }
    #f-ring { position: fixed; border: 3px solid #7ea6ff; border-radius: 12px; box-shadow: 0 0 0 7px rgba(126, 166, 255, 0.2);
      z-index: 9100; opacity: 0; pointer-events: none; }
    #f-fade { position: fixed; inset: 0; background: #0c111b; z-index: 9300; opacity: 0; pointer-events: none; }
    #f-card { position: fixed; inset: 0; background: radial-gradient(circle at 50% 38%, #18233a 0%, #0c111b 62%); z-index: 9400; opacity: 0;
      pointer-events: none; display: grid; place-items: center; color: #e9edf5; font-family: Inter, sans-serif; text-align: center; }
    #f-card .mark { display: inline-grid; place-items: center; width: 84px; height: 84px; border-radius: 50%; background: #7ea6ff;
      color: #0c111b; font: 800 46px/1 Inter, sans-serif; }
    #f-card h1 { font: 800 76px/1.05 Inter, sans-serif; margin: 18px 0 6px; letter-spacing: -0.02em; }
    #f-card .tag { font: 500 27px/1.3 Inter, sans-serif; color: #a0aabb; margin: 0; }
    #f-card .link { position: relative; width: 560px; height: 46px; margin: 44px auto 6px; }
    #f-card .link::before { content: ''; position: absolute; left: 18px; right: 18px; top: 22px; border-top: 2px dashed #3a4762; }
    #f-card .planet { position: absolute; top: 5px; width: 36px; height: 36px; border-radius: 50%; }
    #f-card .earth { left: 0; background: #7ea6ff; }
    #f-card .mars { right: 0; background: #ff9a90; }
    #f-card .signal { position: absolute; top: 15px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: #fff;
      box-shadow: 0 0 14px 4px rgba(255, 255, 255, 0.55); left: 0; }
    #f-card .ends { display: flex; justify-content: space-between; width: 600px; margin: 0 auto; font: 600 17px/1.2 Inter, sans-serif; color: #a0aabb; }
    #f-card .delay { font: 600 21px/1.3 Inter, sans-serif; color: #e9edf5; margin: 14px 0 0; }
    #f-card .url { font: 600 27px/1.3 Inter, sans-serif; color: #7ea6ff; margin: 22px 0 10px; }
    #f-card .small { font: 500 19px/1.4 Inter, sans-serif; color: #a0aabb; margin: 0; }
  `;
  document.head.appendChild(style);
  const add = (id, html) => { const el = document.createElement('div'); el.id = id; el.innerHTML = html || ''; document.body.appendChild(el); return el; };
  const sub = add('f-sub');
  add('f-wm', 'AI-generated video · concept device');
  const note = add('f-note');
  const cur = add('f-cur');
  const ring = add('f-ring');
  const fade = add('f-fade');
  const card = add('f-card', `
    <div id="f-title">
      <div class="mark">A</div>
      <h1>AeroNYX</h1>
      <p class="tag">Health monitoring for astronauts</p>
      <div class="link"><span class="planet earth"></span><span class="planet mars"></span><span class="signal"></span></div>
      <div class="ends"><span>Earth</span><span>Mars</span></div>
      <p class="delay">One way: up to 20 minutes</p>
    </div>
    <div id="f-end">
      <div class="mark">A</div>
      <h1>AeroNYX</h1>
      <p class="url">dhirajk8113.github.io/astro-health-companion</p>
      <p class="small">Concept device: no hardware exists. Demo readings are simulated, except the radiation dose.<br>Code and video made with AI assistance.</p>
    </div>`);
  const titleBox = card.querySelector('#f-title');
  const endBox = card.querySelector('#f-end');
  const signal = card.querySelector('.signal');
  window.__film = {
    apply(s) {
      if (s.scrollY != null) window.scrollTo(0, s.scrollY);
      if (window.__filmDevice) window.__filmDevice.set(s.dev || {});
      sub.textContent = s.sub || '';
      sub.style.opacity = s.sub ? (s.subO == null ? 1 : s.subO) : 0;
      cur.style.opacity = s.cur ? (s.cur.o == null ? 1 : s.cur.o) : 0;
      if (s.cur) {
        cur.style.left = s.cur.x + 'px';
        cur.style.top = s.cur.y + 'px';
        const d = s.cur.down || 0;
        cur.style.boxShadow = d > 0 ? `0 0 0 ${6 + 22 * d}px rgba(126,166,255,${0.6 * (1 - d)})` : 'none';
      }
      let r = null;
      if (s.ring) { const el = document.querySelector(s.ring.sel); if (el) r = el.getBoundingClientRect(); }
      if (r) {
        const p = s.ring.pad == null ? 6 : s.ring.pad;
        ring.style.left = (r.left - p) + 'px';
        ring.style.top = (r.top - p) + 'px';
        ring.style.width = (r.width + 2 * p) + 'px';
        ring.style.height = (r.height + 2 * p) + 'px';
        ring.style.opacity = s.ring.o == null ? 1 : s.ring.o;
      } else ring.style.opacity = 0;
      fade.style.opacity = s.fade || 0;
      note.textContent = s.note ? s.note.text : '';
      note.style.opacity = s.note ? s.note.o : 0;
      card.style.opacity = s.card ? s.card.o : 0;
      if (s.card) {
        titleBox.style.display = s.card.kind === 'title' ? '' : 'none';
        endBox.style.display = s.card.kind === 'end' ? '' : 'none';
        if (s.card.p != null) signal.style.left = (3 + s.card.p * 94) + '%';
      }
    },
    rect(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, sy: window.scrollY };
    },
    tag(sel, text, name) {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text));
      if (el) el.setAttribute('data-film', name);
      return !!el;
    },
  };
})();
"""


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def seg(i, a, b):
    return ease((i - a) / (b - a)) if b > a else 1.0


def lerp(a, b, t):
    return a + (b - a) * t


class Film:
    def __init__(self, page):
        self.page = page
        self.g = 0
        self.proc = None
        self.files = []

    def open(self, k):
        if MODE != 'render':
            return
        self.tmp = f'{ROOT}/out/scene{k}.tmp.mp4'
        self.final = f'{ROOT}/out/scene{k}.mp4'
        self.proc = subprocess.Popen([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
            '-vf', f'scale={W}:{H}:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast',
            '-pix_fmt', 'yuv420p', '-r', str(FPS), self.tmp], stdin=subprocess.PIPE)

    def close(self):
        if MODE != 'render':
            return
        self.proc.stdin.close()
        code = self.proc.wait()
        if code != 0:
            raise SystemExit(f'ffmpeg failed with {code}')
        os.replace(self.tmp, self.final)
        self.files.append(self.final)

    def frame(self, state, post=None):
        self.page.evaluate('s => window.__film.apply(s)', state)
        ms = round((self.g + 1) * 1000 / FPS) - round(self.g * 1000 / FPS)
        self.page.clock.run_for(ms)
        if post:
            post()  # a change drawn after the clock moves, so a redraw of the screen cannot undo it
        if MODE == 'render':
            self.proc.stdin.write(self.page.screenshot(type='jpeg', quality=92))
        elif self.g in PROBE:
            with open(f'{ROOT}/probe/f{self.g:04d}.jpg', 'wb') as fh:
                fh.write(self.page.screenshot(type='jpeg', quality=92))
        self.g += 1


def main():
    os.makedirs(f'{ROOT}/out', exist_ok=True)
    os.makedirs(f'{ROOT}/probe', exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--force-color-profile=srgb'])
        ctx = browser.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=W / VW, color_scheme='dark',
                                  locale='en-US', timezone_id='America/Chicago')
        page = ctx.new_page()
        page.add_init_script(ISS_REPLAY_JS)
        page.route('**/DONKI/**', donki_replay)
        page.clock.install(time=datetime.datetime.now())
        page.goto(BASE)
        ev = page.evaluate

        def rect(sel):
            r = ev('s => window.__film.rect(s)', sel)
            if r is None:
                raise SystemExit(f'missing element: {sel}')
            return r

        def center(sel, fx=0.5, fy=0.5):
            r = rect(sel)
            return r['x'] + r['w'] * fx, r['y'] + r['h'] * fy

        def top_for(sel, top=74):
            r = rect(sel)
            return max(0, r['sy'] + r['y'] - top)

        def go(hash_):
            ev('h => { location.hash = h; }', hash_)
            time.sleep(0.2)
            ev('() => window.scrollTo(0, 0)')

        def press(sel):
            ev('s => document.querySelector(s).click()', sel)
            time.sleep(0.12)

        # ---- set up, off camera: choose the Mars mission ----
        page.wait_for_selector('a.gauge')
        go('#setup')
        ev("""() => { const f = document.querySelector('form[data-form="profile"]');
                      f.querySelector('select[name="mission"]').value = 'mars'; f.requestSubmit(); }""")
        time.sleep(0.2)
        go('#today')
        ev(OVERLAY_JS)
        ev(DEVICE_JS)
        ev('f => window.__filmDevice.build(f)', FINISH)
        # Content starts under the app's header, which sits inside the device's screen.
        HB = rect('header.top')['y'] + rect('header.top')['h']
        page.clock.pause_at(datetime.datetime.now() + datetime.timedelta(seconds=2))
        page.clock.run_for(7000)  # let the toasts go
        film = Film(page)

        def sub_o(i, n):
            return min(1.0, i / 4, (n - 1 - i) / 4)

        # ---- scene 1: title card ----
        n = SCENE_FRAMES[0]
        film.open(1)
        for i in range(n):
            o = 1 - seg(i, n - 12, n - 2)
            film.frame({'scrollY': 0, 'sub': SUBS[0], 'subO': sub_o(i, n),
                        'card': {'kind': 'title', 'o': o, 'p': seg(i, 3, n - 14)} if o > 0 else None})
        film.close()

        # ---- scene 2: the home screen ----
        n = SCENE_FRAMES[1]
        row = lambda name: f'a.gauge[href="#readings/{name}"]'
        film.open(2)
        for i in range(n):
            st = {'scrollY': 0, 'sub': SUBS[1], 'subO': sub_o(i, n), 'fade': 0}
            if 14 <= i < 62:
                st['ring'] = {'sel': row('urine_vol'), 'o': min(seg(i, 14, 22), 1 - seg(i, 56, 62)), 'pad': 5}
            elif i >= 62:
                st['ring'] = {'sel': row('dose'), 'o': min(seg(i, 62, 70), 1 - seg(i, n - 8, n - 2)), 'pad': 5}
            film.frame(st)
        film.close()

        # ---- scene 3: a specimen goes into the sample port and is analysed ----
        n = SCENE_FRAMES[2]
        go('#sample')
        blood = '[data-action="run-sample"][data-kind="blood"]'
        bx, by = center(blood)
        start = (VW * 0.62, VH * 0.3)
        film.open(3)
        pressed = False
        skipped = False
        for i in range(n):
            st = {'scrollY': 0, 'sub': SUBS[2], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            dev = {'vial': {'kind': 'blood', 't': seg(i, 10, 48), 'o': seg(i, 3, 9)}}
            if i < 56:
                t = seg(i, 34, 54)
                st['cur'] = {'x': lerp(start[0], bx, t), 'y': lerp(start[1], by, t), 'o': seg(i, 30, 36)}
            else:
                if not pressed:
                    press(blood)
                    pressed = True
                st['cur'] = {'x': bx, 'y': by, 'down': seg(i, 56, 62), 'o': 1 - seg(i, 60, 66)}
                if i < 110:
                    dev['ring'] = 'busy'
                    dev['phase'] = (i - 56) / 54
                else:
                    if not skipped:
                        page.clock.run_for(900)  # the rest of the analysis
                        time.sleep(0.15)
                        skipped = True
                    dev['ring'] = 'done'
                    st['ring'] = {'sel': 'section.sample table', 'o': min(seg(i, 114, 124), 1 - seg(i, n - 8, n - 2)), 'pad': 6}
            st['dev'] = dev
            film.frame(st)
        film.close()

        # ---- scene 4: a dose is dispensed, then how the reading moved ----
        n = SCENE_FRAMES[3]
        go('#meds')

        def tag_rx():
            ev("() => window.__film.tag('section.card', 'Potassium citrate', 'rx')")

        tag_rx()
        ya = top_for('[data-film="rx"]', HB + 12)
        ev('y => window.scrollTo(0, y)', ya)
        take = '[data-film="rx"] [data-action="take-dose"]'
        bx, by = center(take)
        start = (VW * 0.55, VH * 0.34)
        film.open(4)
        pressed = False
        for i in range(n):
            st = {'scrollY': ya, 'sub': SUBS[3], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            dev = {}
            if i < 22:
                t = seg(i, 5, 20)
                st['cur'] = {'x': lerp(start[0], bx, t), 'y': lerp(start[1], by, t)}
            else:
                if not pressed:
                    press(take)
                    tag_rx()
                    pressed = True
                st['cur'] = {'x': bx, 'y': by, 'down': seg(i, 22, 30), 'o': 1 - seg(i, 26, 34)}
                dev['medGlow'] = min(seg(i, 22, 28), 1 - seg(i, 52, 66))
                if i >= 27:
                    dev['pill'] = min(1.0, (i - 27) / 36)
                if i >= 72:
                    st['ring'] = {'sel': '[data-film="rx"] .effect', 'o': min(seg(i, 72, 82), 1 - seg(i, n - 8, n - 2)), 'pad': 6}
            st['dev'] = dev
            film.frame(st)
        film.close()

        # ---- scene 5: the radiation bar, and the alarm at NASA's career limit ----
        n = SCENE_FRAMES[4]
        go('#environment')
        page.clock.run_for(900)  # space weather and the cabin feed arrive
        time.sleep(0.2)
        ev('() => window.scrollTo(0, 0)')
        RAD = '[data-film="rad"]'
        d0 = float(ev("() => document.querySelector('[data-film=\"rad\"] .rad-value strong').textContent"))
        film.open(5)
        switched = False
        for i in range(n):
            st = {'scrollY': 0, 'sub': SUBS[4], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            post = None
            if i < 36:
                if i >= 8:
                    st['ring'] = {'sel': RAD, 'o': min(seg(i, 8, 16), 1 - seg(i, 28, 34)), 'pad': 6}
            elif i < 84:
                # the dose climbs: a time-lapse drawn over the real bar, ending in the real alarm below
                u = (i - 36) / 47
                dose = lerp(d0, ALARM_DOSE, u * u)
                post = lambda dose=dose: ev(RAD_TWEEN_JS, dose)
            else:
                if not switched:
                    go('#readings/dose')
                    ev("""v => { const f = document.querySelector('form[data-form="add-reading"]');
                                 f.querySelector('input[name="value"]').value = String(v); f.requestSubmit(); }""", ALARM_DOSE)
                    time.sleep(0.15)
                    go('#environment')
                    time.sleep(0.15)
                    switched = True
                if i >= 94:
                    st['ring'] = {'sel': f'{RAD} .rad-warn', 'o': min(seg(i, 94, 104), 1 - seg(i, n - 8, n - 2)), 'pad': 7}
            film.frame(st, post)
        film.close()

        # ---- scene 6: Astro speaks ----
        n = SCENE_FRAMES[5]
        go('#astro')
        yb = top_for('section.chat', HB + 10)
        ev('y => window.scrollTo(0, y)', yb)
        steps = [(36, '[data-action="chat-say"]'), (100, '[data-action="chat-checkin"]')]
        done = 0
        pos = (VW * 0.62, VH * 0.56)
        target = center(steps[0][1])
        move_from = 14
        film.open(6)
        for i in range(n):
            st = {'scrollY': yb, 'sub': SUBS[5], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            if done < len(steps):
                at, sel = steps[done]
                t = seg(i, move_from, at - 3)
                st['cur'] = {'x': lerp(pos[0], target[0], t), 'y': lerp(pos[1], target[1], t), 'down': seg(i, at - 3, at), 'o': seg(i, 8, 14) if done == 0 else 1}
                if i == at:
                    press(sel)
                    ev('y => window.scrollTo(0, y)', yb)
                    pos = target
                    done += 1
                    move_from = i + 24
                    if done < len(steps):
                        target = center(steps[done][1])
            else:
                st['cur'] = {'x': pos[0], 'y': pos[1], 'o': 1 - seg(i, 102, 108)}
            film.frame(st)
        film.close()

        # ---- scene 7: a report crosses the signal delay to the flight surgeon ----
        n = SCENE_FRAMES[6]
        go('#surgeon')
        ye = top_for('form[data-form="send-report"]', HB + 60)
        ev('y => window.scrollTo(0, y)', ye)
        bx, by = center('form[data-form="send-report"] button[type="submit"]')
        start = (VW * 0.66, VH * 0.3)
        film.open(7)
        sent = False
        jumped = False
        yf = 0
        for i in range(n):
            st = {'scrollY': ye, 'sub': SUBS[6], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            if i < 18:
                t = seg(i, 4, 16)
                st['cur'] = {'x': lerp(start[0], bx, t), 'y': lerp(start[1], by, t)}
            elif i < 60:
                if not sent:
                    ev("() => document.querySelector('form[data-form=\"send-report\"]').requestSubmit()")
                    time.sleep(0.15)
                    sent = True
                st['cur'] = {'x': bx, 'y': by, 'down': seg(i, 18, 26), 'o': 1 - seg(i, 22, 28)}
                st['scrollY'] = lerp(ye, ye + 90, seg(i, 26, 36))
                if i >= 36:
                    st['ring'] = {'sel': 'form[data-form="send-report"] ~ ul.plain li:first-child', 'o': min(seg(i, 36, 44), 1 - seg(i, 54, 60)), 'pad': 7}
            else:
                if not jumped:
                    page.clock.run_for(22000)  # the report arrives on the ground
                    time.sleep(0.1)
                    yf = top_for('.console', HB + 10)
                    jumped = True
                st['fade'] = 1 - seg(i, 60, 66)
                st['scrollY'] = yf
                if i >= 70:
                    st['ring'] = {'sel': '.console details.report', 'o': min(seg(i, 70, 80), 1 - seg(i, n - 8, n - 2)), 'pad': 6}
            film.frame(st)
        film.close()

        # ---- scene 8: the end card ----
        n = SCENE_FRAMES[7]
        film.open(8)
        for i in range(n):
            film.frame({'scrollY': yf, 'sub': SUBS[7], 'subO': sub_o(i, n), 'card': {'kind': 'end', 'o': seg(i, 0, 10)}})
        film.close()
        browser.close()

    assert film.g == sum(SCENE_FRAMES), film.g
    if MODE == 'render':
        with open(f'{ROOT}/out/list.txt', 'w') as fh:
            for f in film.files:
                fh.write(f"file '{f}'\n")
        final_tmp = f'{ROOT}/out/aeronyx-demo.tmp.mp4'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{ROOT}/out/list.txt',
                        '-c', 'copy', '-movflags', '+faststart', final_tmp], check=True)
        os.replace(final_tmp, f'{ROOT}/out/aeronyx-demo.mp4')
        print('wrote', f'{ROOT}/out/aeronyx-demo.mp4')
    print('frames', film.g)


if __name__ == '__main__':
    main()
