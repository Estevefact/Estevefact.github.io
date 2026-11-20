# Additional author portraits

Created with the built-in image generation tool. The visual style reference is `static/imgs/Saramago.png`: black ink, ivory paper, angular contours and fine hatching. Following feedback, all portraits after Hemingway use looser repeated pen traces, more visible crosshatching and unfinished shoulder contours.

These are generated illustrations, not downloaded Wikipedia photographs. Wikipedia pages supplied author research context; the Saramago image supplied the visual reference. The sketch revisions also used each first-pass generated portrait to preserve its identity and composition.

| Author | Project asset | Wikipedia research |
| --- | --- | --- |
| Ernest Hemingway | `static/imgs/Hemingway.png` | [Wikipedia](https://en.wikipedia.org/wiki/Ernest_Hemingway) |
| H. P. Lovecraft | `static/imgs/Lovecraft.png` | [Wikipedia](https://en.wikipedia.org/wiki/H._P._Lovecraft) |
| Hermann Hesse | `static/imgs/Hesse.png` | [Wikipedia](https://en.wikipedia.org/wiki/Hermann_Hesse) |
| Rainer Maria Rilke | `static/imgs/Rilke.png` | [Wikipedia](https://en.wikipedia.org/wiki/Rainer_Maria_Rilke) |
| Charles Baudelaire | `static/imgs/Baudelaire.png` | [Wikipedia](https://en.wikipedia.org/wiki/Charles_Baudelaire) |
| Gabriela Mistral | `static/imgs/Mistral.png` | [Wikipedia](https://en.wikipedia.org/wiki/Gabriela_Mistral) |
| Clarice Lispector | `static/imgs/Lispector.png` | [Wikipedia](https://en.wikipedia.org/wiki/Clarice_Lispector) |
| Alejo Carpentier | `static/imgs/Carpentier.png` | [Wikipedia](https://en.wikipedia.org/wiki/Alejo_Carpentier) |
| Carlos Fuentes | `static/imgs/Fuentes.png` | [Wikipedia](https://en.wikipedia.org/wiki/Carlos_Fuentes) |
| Rosario Castellanos | `static/imgs/Castellanos.png` | [Wikipedia](https://en.wikipedia.org/wiki/Rosario_Castellanos) |
| Alfonsina Storni | `static/imgs/Storni.png` | [Wikipedia](https://en.wikipedia.org/wiki/Alfonsina_Storni) |
| Miguel Ángel Asturias | `static/imgs/Asturias.png` | [Wikipedia](https://en.wikipedia.org/wiki/Miguel_%C3%81ngel_Asturias) |

Exact initial prompts are in `prompts.json`; the final sketch revision prompts are in `sketch-revision-prompts.json`. The source manifest is in `sources.json`.

The homepage uses responsive 480/960-pixel WebP assets and inline previews. Readers, maps and the oracle use `static/imgs/<surname>.webp`. Rebuild both with `python tools/optimize_landing_images.py`; PNGs remain the source artwork.

The second batch adds six Latin American authors, bringing the total to twelve new portraits. It uses the revised Mistral illustration as the visual style reference, retaining the more visible pen traces. Its exact prompts and Wikipedia research links are in `latin-american-batch.json`.
