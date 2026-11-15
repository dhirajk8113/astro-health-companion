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
import os
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

SUBS = [
    'A message to Mars can take 20 minutes each way.',
    "AeroNYX shows every reading against its safe range, using NASA's limits.",
    'It tracks each prescribed dose and how the reading moved afterwards.',
    'Astro, the chat companion, listens, runs a check-in and hands off to people.',
    'It reads real NASA data: space weather alerts, measured radiation dose and the live ISS cabin.',
    'Reports cross the signal delay to the flight surgeon. Doctors decide, not AeroNYX.',
    "Limits are NASA's. Readings are simulated. The device is a concept. Code written with AI.",
]
SCENE_FRAMES = [75, 120, 150, 150, 165, 120, 105]  # 885 frames = 29.5 s

# The machine that renders the video has no internet access, so the two live
# NASA services cannot be reached while filming. Space weather is shown through
# the app's own replay of the saved May 2024 storm. The ISS cabin table is fed
# the values the live NASA feed gave on the deployed site at 19:37 US Central on
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
    #f-wm { position: fixed; right: 14px; top: 13px; padding: 5px 13px; border-radius: 999px; background: rgba(12, 17, 27, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.6); color: #fff; font: 700 15px/1.2 Inter, sans-serif; letter-spacing: 0.02em; z-index: 9700; }
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
  add('f-wm', 'AI-generated video');
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

    def frame(self, state):
        self.page.evaluate('s => window.__film.apply(s)', state)
        ms = round((self.g + 1) * 1000 / FPS) - round(self.g * 1000 / FPS)
        self.page.clock.run_for(ms)
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
        page.route('**/DONKI/**', lambda route: route.abort())
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

        # ---- set up the app state: demo data, Mars mission ----
        go('#setup')
        ev("""() => { const f = document.querySelector('form[data-form="profile"]');
                      f.querySelector('select[name="mission"]').value = 'mars'; f.requestSubmit(); }""")
        time.sleep(0.2)
        go('#today')
        ev(OVERLAY_JS)
        page.clock.pause_at(datetime.datetime.now() + datetime.timedelta(seconds=2))
        page.clock.run_for(7000)  # let the toasts go
        film = Film(page)

        def sub_o(i, n):
            return min(1.0, i / 4, (n - 1 - i) / 4)

        # Content starts under the app's header, which sits inside the device's screen.
        HB = rect('header.top')['y'] + rect('header.top')['h']

        # ---- scene 1: title card ----
        n = SCENE_FRAMES[0]
        film.open(1)
        for i in range(n):
            o = 1 - seg(i, 58, 72)
            film.frame({'scrollY': 0, 'sub': SUBS[0], 'subO': sub_o(i, n),
                        'card': {'kind': 'title', 'o': o, 'p': seg(i, 4, 54)} if o > 0 else None})
        film.close()

        # ---- scene 2: the home screen in the concept device ----
        n = SCENE_FRAMES[1]
        row = lambda key: f'a.gauge[href="#readings/{key}"]'
        film.open(2)
        for i in range(n):
            if i < 44:
                ring = {'sel': row('urine_vol'), 'o': min(seg(i, 10, 18), 1 - seg(i, 38, 44)), 'pad': 5} if i >= 10 else None
            elif i < 82:
                ring = {'sel': row('vitd'), 'o': min(seg(i, 44, 52), 1 - seg(i, 76, 82)), 'pad': 5}
            else:
                ring = {'sel': row('dose'), 'o': min(seg(i, 82, 90), 1 - seg(i, n - 8, n - 2)), 'pad': 5}
            film.frame({'scrollY': 0, 'sub': SUBS[1], 'subO': sub_o(i, n), 'ring': ring,
                        'note': {'text': "Concept device from the team's sketch. No hardware exists.", 'o': min(seg(i, 6, 16), 1 - seg(i, n - 10, n - 2))}})
        film.close()

        # ---- scene 3: a dose is dispensed, then how the reading moved ----
        n = SCENE_FRAMES[2]
        go('#meds')

        def tag_rx():
            ev("() => window.__film.tag('section.card', 'Potassium citrate 20 mEq', 'rx')")
            ev("() => { const s = document.querySelector('[data-film=\"rx\"]'); const ps = [...s.querySelectorAll('p')].find((e) => e.textContent.includes('has averaged')); if (ps) ps.setAttribute('data-film', 'effect'); }")

        tag_rx()
        ya = top_for('[data-film="rx"]', HB + 12)
        ev('y => window.scrollTo(0, y)', ya)
        bx, by = center('[data-film="rx"] [data-action="take-dose"]')
        start = (VW * 0.55, VH * 0.3)
        film.open(3)
        pressed = False
        for i in range(n):
            st = {'scrollY': ya, 'sub': SUBS[2], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            if i < 26:
                t = seg(i, 6, 24)
                st['cur'] = {'x': lerp(start[0], bx, t), 'y': lerp(start[1], by, t)}
            else:
                if not pressed:
                    ev("() => document.querySelector('[data-film=\"rx\"] [data-action=\"take-dose\"]').click()")
                    time.sleep(0.15)
                    tag_rx()
                    pressed = True
                st['cur'] = {'x': bx, 'y': by, 'down': seg(i, 26, 34), 'o': 1 - seg(i, 30, 38)}
                if i < 96:
                    st['ring'] = {'sel': '.dv-meds', 'o': min(seg(i, 34, 42), 1 - seg(i, 90, 96)), 'pad': 6}
                else:
                    st['ring'] = {'sel': '[data-film="effect"]', 'o': seg(i, 98, 108), 'pad': 8}
            film.frame(st)
        film.close()

        # ---- scene 4: Astro, the chat companion ----
        n = SCENE_FRAMES[3]
        go('#astro')
        yb = top_for('section.chat', HB + 10)
        ev('y => window.scrollTo(0, y)', yb)
        film.open(4)
        # (frame, selector to press): a quick reply, the check-in, then three ratings
        steps = [(30, '[data-action="chat-say"]'), (72, '[data-action="chat-checkin"]'), (92, '[data-action="chat-rate"][data-value="4"]'),
                 (106, '[data-action="chat-rate"][data-value="7"]'), (120, '[data-action="chat-rate"][data-value="6"]')]
        done = 0
        pos = (VW * 0.6, VH * 0.32)
        target = center(steps[0][1])
        move_from = 8
        for i in range(n):
            st = {'scrollY': yb, 'sub': SUBS[3], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            if done < len(steps):
                at, sel = steps[done]
                t = seg(i, move_from, at - 3)
                st['cur'] = {'x': lerp(pos[0], target[0], t), 'y': lerp(pos[1], target[1], t), 'down': seg(i, at - 3, at)}
                if i == at:
                    ev('s => document.querySelector(s).click()', sel)
                    time.sleep(0.12)
                    ev('y => window.scrollTo(0, y)', yb)
                    pos = target
                    done += 1
                    move_from = i + 2
                    if done < len(steps):
                        target = center(steps[done][1])
            else:
                st['cur'] = {'x': pos[0], 'y': pos[1], 'o': 1 - seg(i, 122, 130)}
                st['ring'] = {'sel': '.thread .msg-astro:last-child .msg-text', 'o': seg(i, 128, 138), 'pad': 6}
            film.frame(st)
        film.close()

        # ---- scene 5: Space, the real NASA data ----
        n = SCENE_FRAMES[4]
        go('#environment')
        page.clock.run_for(2600)  # the cabin feed connects and the screen redraws
        ev("() => document.querySelector('[data-action=\"toggle-replay\"]').click()")
        time.sleep(0.15)
        sec = lambda k: f'main section.card:nth-of-type({k})'
        e1 = top_for(sec(2), HB + 10)
        e2 = top_for(sec(3), HB + 10)
        e3 = top_for(sec(4), HB + 10)
        film.open(5)
        for i in range(n):
            st = {'sub': SUBS[4], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            if i < 56:
                st['scrollY'] = e1
                if i >= 12:
                    st['ring'] = {'sel': f'{sec(2)} .banner-warn', 'o': min(seg(i, 12, 20), 1 - seg(i, 50, 56)), 'pad': 6}
            elif i < 108:
                st['scrollY'] = lerp(e1, e2, seg(i, 56, 72))
                if i >= 76:
                    st['ring'] = {'sel': f'{sec(3)} svg.chart', 'o': min(seg(i, 76, 84), 1 - seg(i, 102, 108)), 'pad': 4}
            else:
                st['scrollY'] = lerp(e2, e3, seg(i, 108, 124))
                # the render machine is offline, so say on screen that these values were recorded
                st['note'] = {'text': "Values recorded from NASA's live ISS feed, 14 Nov 2026", 'o': min(seg(i, 112, 122), 1 - seg(i, n - 8, n - 2))}
                if i >= 130:
                    st['ring'] = {'sel': f'{sec(4)} table', 'o': seg(i, 130, 138), 'pad': 6}
            film.frame(st)
        film.close()

        # ---- scene 6: a report crosses the signal delay to the flight surgeon ----
        n = SCENE_FRAMES[5]
        go('#surgeon')
        ye = top_for('form[data-form="send-report"]', HB + 60)
        ev('y => window.scrollTo(0, y)', ye)
        bx, by = center('form[data-form="send-report"] button[type="submit"]')
        start = (VW * 0.66, VH * 0.3)
        film.open(6)
        sent = False
        jumped = False
        yf = 0
        for i in range(n):
            st = {'scrollY': ye, 'sub': SUBS[5], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6)}
            if i < 20:
                t = seg(i, 4, 18)
                st['cur'] = {'x': lerp(start[0], bx, t), 'y': lerp(start[1], by, t)}
            elif i < 70:
                if not sent:
                    ev("() => document.querySelector('form[data-form=\"send-report\"]').requestSubmit()")
                    time.sleep(0.15)
                    sent = True
                st['cur'] = {'x': bx, 'y': by, 'down': seg(i, 20, 28), 'o': 1 - seg(i, 24, 30)}
                st['scrollY'] = lerp(ye, ye + 90, seg(i, 30, 42))
                if i >= 42:
                    st['ring'] = {'sel': 'form[data-form="send-report"] ~ ul.plain li:first-child', 'o': min(seg(i, 42, 50), 1 - seg(i, 64, 70)), 'pad': 7}
            else:
                if not jumped:
                    page.clock.run_for(22000)  # the report arrives on the ground
                    time.sleep(0.1)
                    yf = top_for('.console', HB + 10)
                    jumped = True
                st['fade'] = 1 - seg(i, 70, 76)
                st['scrollY'] = yf
                if i >= 82:
                    st['ring'] = {'sel': '.console details.report', 'o': seg(i, 82, 92), 'pad': 6}
            film.frame(st)
        film.close()

        # ---- scene 7: where each limit comes from, then the end card ----
        n = SCENE_FRAMES[6]
        go('#about')
        ev("() => window.__film.tag('section.card', 'Where each limit comes from', 'limits')")
        yi = top_for('[data-film="limits"] table', HB + 14)
        film.open(7)
        for i in range(n):
            o = seg(i, 46, 60)
            film.frame({'scrollY': yi, 'sub': SUBS[6], 'subO': sub_o(i, n), 'fade': 1 - seg(i, 0, 6),
                        'ring': {'sel': '[data-film="limits"] table', 'o': min(seg(i, 8, 16), 1 - seg(i, 40, 46)), 'pad': 6} if 8 <= i < 46 else None,
                        'card': {'kind': 'end', 'o': o} if o > 0 else None})
        film.close()
        browser.close()

    assert film.g == sum(SCENE_FRAMES), film.g
    if MODE == 'render':
        with open(f'{ROOT}/out/list.txt', 'w') as fh:
            for f in film.files:
                fh.write(f"file '{f}'\n")
        final_tmp = f'{ROOT}/out/astro-demo.tmp.mp4'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{ROOT}/out/list.txt',
                        '-c', 'copy', '-movflags', '+faststart', final_tmp], check=True)
        os.replace(final_tmp, f'{ROOT}/out/astro-demo.mp4')
        print('wrote', f'{ROOT}/out/astro-demo.mp4')
    print('frames', film.g)


if __name__ == '__main__':
    main()
