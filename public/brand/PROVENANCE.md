# sleepy-operator.png

Pixel-art operator, sleepy (eye mask pushed up, drowsy eyes, coffee mug with steam). Synthetic brand art; no private data.

- Cast reference (inspected): hev/mind `cf76b492` — `site/public/mascots/writing.png`, `services.png`, `site/public/vibe-check-head.png`; rules in `strategy/brand.md` ("The mascot": never stretch, recolor or smooth; `image-rendering: pixelated`).
- Generated 2026-10-14 on the Mini with the `nano-banana` skill (`gemini-3-pro-image`, `--aspect 2:3`), the three references above passed with `--in`, 3 candidates (`sleepy-1..3`). Prompt: same operator, no sunglasses, sleep eye mask pushed up on forehead, half-closed drowsy eyes, holding a coffee mug with steam, flat white background, no text.
- Selected candidate 3 (mask reads as a mask, not goggles; closest to the cast; upright pose). Candidate 1's mask read as goggles; candidate 2 slumped off-model.
- Optimized: re-sampled on the model's ~10.1px pixel grid, white background removed (transparent), 6x integer nearest-neighbour upscale, 40-colour palette PNG. 282x738, ~4 KB.
- Use with `image-rendering: pixelated`; do not stretch or recolor. Originals (candidates, references, scripts) are on the Mini at `/Users/hev/jobs/prep-155/art/` (session prep-155, order oven-858).
