---
name: 3q-hatchery-design
description: Use this skill to generate well-branded interfaces and assets for 3Q Hatchery (3Q貢丸・台灣在地品牌孵化所 / Taiwan Brand Hatchery), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, photography direction, and UI kit components for prototyping LINE Official Account, Instagram, Threads, and TikTok assets.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out of `assets/` and create static HTML files for the user to view. Include `colors_and_type.css` to inherit all design tokens. Pull JSX components from `ui_kits/line_oa/` and `ui_kits/social/` to assemble high-fidelity surfaces quickly. If working on production code, read the rules in README.md to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design (LINE rich menu? IG post series? Welcome card? Cover image?), ask 2-3 questions about content and which photographic subject to use (white porcelain bowl with rice / cupped palm with light / unsealed envelope / rice stalk / ink stone / raw linen), and act as an expert designer who outputs HTML artifacts or production code, depending on the need.

### Cardinal rules (do not break)

1. **Palette is exactly 7 colors.** Never invent. Hatchery Gold (`#B8924A`) is restricted to ≤ 3% of any composition and only as hairlines / signatures — never a fill.
2. **No emoji. No unicode-symbol icons. No stock gradient metallics.** The brief explicitly forbids these.
3. **Type is Cormorant Garamond + Noto Serif TC for display (Light 300 only)**, Inter + Noto Sans TC for body. Letter-spacing is structural: `0.05em` body / `0.15em` zh headlines / `0.3em` latin caps.
4. **Negative space ≥ 50%** of every composition. If you can't reach 50%, cut content.
5. **Photography is editorial still life** — single soft light, low saturation, high tonal contrast, film grain. Subjects from the curated list (rice bowl / palm / envelope / rice stalk / ink stone / raw linen). Never literal "incubator" imagery (chicks, eggs, sprouts).
6. **Central axis alignment** is the default. Off-axis is the exception (the 60/40 cover split, e.g.).
7. **Tone is the host receiving a guest, not the service pitching a customer.** 你 (intimate you), not 您 (formal-distant).
