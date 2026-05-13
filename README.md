# 3Q Hatchery — Design System
### 3Q貢丸・台灣在地品牌孵化所 / TAIWAN BRAND HATCHERY

---

## 1. Context

**3Q Hatchery** is the incubator arm of a Taiwanese brand portfolio (parent matrix uses a black-and-gold identity; sister industrial brands — *米速 / 泡泡怪獸 / 丹若* — run high-contrast metallic). The hatchery is the *quiet* member: its job is to **hold** small local makers (rice merchants, calligraphers, weavers, food stalls) and let them be *seen the way Dior beauty is seen*.

> The aesthetic philosophy is not "look like Dior". It is **"learn Dior's restraint"** — wide negative space, single light source, two colors, one type voice — and translate that discipline onto *Taiwanese material culture* (rice paper, raw linen, ink stone, rush weaving, husk silhouettes, unbleached fiber).

The visual promise to incubated makers: **"however small your shop is, you deserve to be photographed like this."**

### Provided source material
This system was authored from a single attached brand brief (Traditional Chinese, ~7,000 chars). It includes:
- A full VI specification (palette, type, grid)
- Five core LINE Official Account asset specs (avatar, cover, rich menu, welcome card, carousel)
- Cross-platform extensions (Instagram, Threads, TikTok)
- Midjourney v6.1 photography prompts (Hasselblad / Paolo Roversi mood)
- "Fake-luxury" anti-pattern list (Do's & Don'ts)

There is **no codebase, no Figma, no logo file** attached. All visual artifacts in this system are built **from scratch in HTML/CSS** following the brief, including Logo lockups, dividers, the rich-menu icon set, and photography placeholders. See **Caveats** at bottom.

---

## 2. Content Fundamentals

### Voice
- **Bilingual primary.** Traditional Chinese (繁體中文) sits *above* English. English appears in light-weight, all-caps, wide-tracked lockups — never as body.
- **Quiet, declarative, host-like.** The hatchery speaks as a host receiving a guest, not a service pitching a customer.
- **"We hold, you grow."** Core emotional verbs: 托住 (hold), 照亮 (illuminate), 看見 (see), 陪跑 (run alongside), 長出來 (grow into being).
- **No marketing exclamation marks. No emoji. No "limited time!" urgency.** Restraint is the message.
- **Pronouns:** 你 (you, intimate) for the maker; 我們 (we) for the hatchery. Never 您 (formal-distant) — that turns the room cold.

### Casing & rhythm
- Chinese headlines use 思源宋體 Light + 0.15em tracking — never bold, never colored.
- English appears as `ALL CAPS · 0.3em` tracking, ≤14px. Lowercase running English is acceptable only in body.
- Sentences are short, often un-punctuated at the end. A trailing period feels too administrative.

### Signature copy specimens
> 「只要你願意說，我們就幫你被看見。」
> *(If you'll say it, we'll help it be seen.)*

> 「不管你的需求、想法、產品 — 多大、多小、多複雜，我們都有適合的平台、舞台、後台。」
> *(Whatever your need, idea, or product — however big, small, or complex, we have the right platform, stage, and backstage.)*

> 「來，幫你圓夢。」
> *(Let's make it real.)*

### CTAs (4-grid LINE menu) — poetic, addressed to a user state

Each label is written to meet a specific emotional state the maker arrives in. Not a service category — an invitation.

| ZH | EN sublabel | Function | The maker walks in feeling… |
|---|---|---|---|
| **說說你的店** | TELL US YOUR SHOP | Consultation | uncertain — "am I even big enough to be here?" |
| **好物・好照** | WORTHY IMAGES | Refined imagery | their product is good but unseen |
| **陪你被看見** | SEEN, TOGETHER | Tailored marketing | overwhelmed — "I don't know where to start" |
| **走到哪了** | WHERE WE ARE | Track status | afraid of being forgotten |

Each pair sits stacked vertically, ZH on top in 思源宋體 28px (5-char ZH labels okay — let them breathe), EN below in Inter Light 14px / 0.3em tracking / Hatchery Gold.

> **Voice note — pricing copy.** Prices are never headlines. If a price must appear (carousel meta line, service page footer), it is recessed as a small Inter caption (e.g. `好物・好照 · FROM 500`). The headline is always about what the maker *gets seen as*, not what they *pay*.

> **Voice note — labels as invitations.** A label like "諮詢" describes what *we* do. A label like "說說你的店" describes what *they* get to do. The hatchery's CTAs always speak from the second perspective.

---

## 3. Visual Foundations

### Palette (7 only — never invent)
| Token | Hex | Role | Notes |
|---|---|---|---|
| `--color-black` 孵化墨 | `#0A0A0A` | Primary bg, headlines, logo | Hero color |
| `--color-paper` 米紙白 | `#F5F2EC` | Card/secondary bg | Hero color |
| `--color-white` 純白 | `#FFFFFF` | Photo bg | Use sparingly |
| `--color-gold` 孵化金 | `#B8924A` | Hairlines only, **≤3%** | Never fill |
| `--color-ink` 墨灰 | `#1A1A1A` | Body text | |
| `--color-stone` 石灰 | `#8A8A8A` | Captions | |
| `--color-sand` 暖砂 | `#E8DFD0` | Subtle card layer | |

**Banned:** bright yellow gold `#FFD700`, champagne, rose gold, all Canva-preset metallic gradients, marble textures, drop shadows on text, vignettes, HDR sharpening.

### Typography
- **Display / headline:** Cormorant Garamond (free proxy for Nicolas Cochin / Didot) + Noto Serif TC. Always **Light 300**.
- **Body / UI:** Inter + Noto Sans TC. Light 300 or Regular 400 only.
- Tracking is structural: `0.15em` for Chinese display, `0.3em` for English caps lockups.
- Line-height **1.75** on Chinese body (CJK needs more breathing room than Latin).

### Layout
- **8pt baseline grid.** Every spacing token is a multiple of 8.
- **12-column grid, 24px gutter, 48px outer margin.**
- **≥50% negative space.** A composition with under 50% empty area is failing.
- **Central vertical axis** is the dominant alignment, especially on LINE assets. Off-axis is the *exception* (e.g. cover photo 60/40 split).

### Backgrounds
- Flat color (paper, black) is default. Never gradients.
- Photography is **full-bleed, single soft light source, low saturation, high tonal contrast, film grain visible.**
- Mood references: Paolo Roversi, Peter Lindbergh, Steven Meisel — all monochromatic-warm.
- Subject library: white porcelain rice bowl, raw linen square, ink stone, single rice stalk, unsealed cream envelope, open empty palm. **Never** chickens, eggs, sprouts, or any literal "incubator" metaphor.

### Color grading anchor (apply uniformly)
`-5 saturation · +10 contrast · 5200K temp · shadow tint RGB(0,5,15) · highlight tint RGB(8,5,0)` — every Carousel and post must share this LUT.

### Borders, lines, dividers
- **Hairlines (1px, gold)** are the *only* decorative element. 40px wide is canonical.
- No rounded card corners. Sharp 0–2px radius only.
- No drop shadows on UI. Cards differentiate via tone (sand on paper, paper on black).

### Motion
- Fades (180–640ms), `cubic-bezier(0.22, 0.61, 0.36, 1)`. Nothing bounces. Nothing slides aggressively.
- Hover: opacity to `0.7`, or tone shift one neutral step. **No color hover.**
- Press: tone darken; no shrink.

### Transparency & blur
- Used for photo darkening overlays only (`rgba(10,10,10, 0.0→0.4)`).
- Never glassmorphism. Never frosted UI panels.

### What a "card" looks like
- Background `--bg-3` (sand) on paper, OR paper on black.
- 0 or 2px corner radius.
- No border. No shadow. Maybe a single 1px gold hairline running across one edge.
- Generous internal padding (48px minimum on a 400px-wide card).

---

## 4. Iconography

This system uses **hairline gold line icons, 1.5px stroke, ~80×80 viewBox, no fill, no rounded join.** That's it. The icon library is curated and small (consultation, camera, compass, clock for the LINE rich menu; plus arrow, close, mail, instagram glyph, line glyph, threads glyph for extensions).

- **No icon font.** Icons are inline SVG strings in components.
- **No emoji. Ever.** The brief explicitly forbids them.
- **No unicode symbol icons** (★ ✓ → etc). If you need an arrow, draw a hairline SVG.
- **No filled, no two-tone, no duotone, no isometric.** Outline-only, in `var(--color-gold)`, at 1.5px stroke.

The 4 brief-specified icons (`Speech Bubble`, `Camera`, `Compass`, `Clock`) live in `assets/icons/` and are reused as the canonical icon vocabulary. New icons are drawn matching the same stroke weight + visual rhythm.

> **Substitution note:** Since no brand-supplied icon set was provided, the four core icons were custom-drawn following the brief's "1.5px gold hairline, 80×80, outline only" spec. If you have an existing icon family, swap them in.

---

## 5. Files (Index)

```
README.md                  ← you are here
SKILL.md                   ← agent skill manifest (Claude / Claude Code compatible)
colors_and_type.css        ← all design tokens as CSS vars + semantic classes

assets/
  logo/
    logo-stacked.svg       ← primary lockup (zh + en, central axis)
    logo-mark-3Q.svg       ← single-character "3Q" mark for avatar/favicon
    logo-horizontal.svg    ← single-line variant for rich-menu pageheaders
  icons/
    consultation.svg       ← 諮詢 — speech bubble
    camera.svg             ← 質感生圖 — camera
    compass.svg            ← 客製行銷 — compass
    clock.svg              ← 查進度 — clock
    arrow-right.svg
    arrow-down.svg
    line.svg               ← LINE glyph
    instagram.svg
    threads.svg

preview/
  card-color-base.html
  card-color-neutrals.html
  card-color-gold-discipline.html
  card-color-banned.html
  card-type-display.html
  card-type-body.html
  card-type-tracking.html
  card-type-scale.html
  card-spacing-grid.html
  card-spacing-tokens.html
  card-divider.html
  card-logo.html
  card-iconography.html
  card-buttons.html
  card-cards.html
  card-cta-grid.html

ui_kits/
  line_oa/
    README.md
    index.html             ← clickable LINE OA preview (chat → menu → assets)
    Avatar.jsx
    CoverImage.jsx
    RichMenu.jsx
    WelcomeCard.jsx
    Carousel.jsx
    LineChrome.jsx
  social/
    README.md
    index.html             ← IG / Threads / TikTok template gallery
    IGPost.jsx
    IGStory.jsx
    TikTokCover.jsx
    ThreadsPost.jsx
```

---

## 6. Caveats — please help me iterate

1. **No brand assets were provided.** The Logo lockups, the four hairline icons, and all photography placeholders were authored from scratch following the brief. The Logo specifically uses the type pairing the brief specified — **swap to your real lockup when ready**.
2. **Photography is placeholder.** The brief specifies real Hasselblad-shot still life (porcelain bowl with rice, raw linen, ink stone, palm-cupped light particle). I represented these with carefully-cropped solid swatches + grain + Midjourney prompt captions. Generate or shoot the real images before any production push.
3. **Cormorant Garamond is a free proxy for Nicolas Cochin.** The brief permits it. If you have a licensed Nicolas Cochin or Atacama / Hellix, swap them in `colors_and_type.css`.
4. **No real LINE OA, IG, or TikTok API integration** — the UI kits are pixel-fidelity recreations of these surfaces, not functional clients.
5. **Color grading LUT is documented but not bundled.** Apply the LUT spec in your own image pipeline before exporting.

### Strong ask
Please review the **Logo lockup** and the **four hairline icons** first — those are the most opinionated calls I had to make without source material. If they're wrong, everything downstream needs to follow.
