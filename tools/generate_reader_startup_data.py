#!/usr/bin/env python3
"""Generate the small catalog needed before reader discovery indexes hydrate."""

import json
import random
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

    poem_data = json.loads((ROOT / "static/poems.json").read_text())
    poems_by_author = {}
    for poem in poem_data["poems"]:
        poem_file = ROOT / "static/Poemas" / f"{poem['id']}.json"
        if poem_file.exists():
            poems_by_author.setdefault(poem["author_uuid"], []).append(poem)
    eligible_authors = [
        author for author in poem_data["authors"]
        if author.get("author_name")
        and author["author_name"].strip().lower() != "unknown"
        and poems_by_author.get(author["author_uuid"])
    ]
    random.Random(20260703).shuffle(eligible_authors)
    selected_authors = eligible_authors[:384]
    selected_author_ids = {author["author_uuid"] for author in selected_authors}
    poem_keep = (
        "id", "author_uuid", "story_name", "reading_time",
        "author_name", "country", "birth_year",
    )
    author_keep = (
        "author_uuid", "author_name", "country", "birth_year",
        "death_year", "genre", "image",
    )
    poem_pool = {
        "poems": [
            {key: poems_by_author[author["author_uuid"]][0].get(key) for key in poem_keep}
            for author in selected_authors
        ],
        "authors": [
            {key: author.get(key) for key in author_keep}
            for author in selected_authors
            if author["author_uuid"] in selected_author_ids
        ],
    }
    poem_output = ROOT / "static/poemStartupPool.json"
    poem_output.write_text(json.dumps(poem_pool, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {len(poem_pool['poems'])} startup poems to {poem_output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
