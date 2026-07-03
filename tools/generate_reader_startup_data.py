#!/usr/bin/env python3
"""Generate the small catalog needed before reader discovery indexes hydrate."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    graph = json.loads((ROOT / "static/authorLinksSmallerAllStories.json").read_text())
    keep = (
        "id", "country", "birth_year", "death_year", "genre",
        "image", "story_name", "story_id", "stories",
    )
    catalog = {
        "nodes": [
            {key: author.get(key) for key in keep if author.get(key) is not None}
            for author in graph["nodes"]
            if author.get("stories")
        ]
    }
    output = ROOT / "static/storyReaderCatalog.json"
    output.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {len(catalog['nodes'])} story authors to {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
