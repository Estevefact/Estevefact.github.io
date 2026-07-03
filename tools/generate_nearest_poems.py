#!/usr/bin/env python3
"""Build exact cosine neighbors for the poem reader from projector embeddings."""

import csv
import json
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def normalize(value):
    value = unicodedata.normalize("NFKD", str(value))
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def main():
    data = json.loads((ROOT / "static/poems.json").read_text())
    by_title = defaultdict(list)
    poem_metadata = {}
    for poem in data["poems"]:
        by_title[normalize(poem["story_name"])].append(poem)
        reading_time = float(poem.get("reading_time") or 0)
        poem_metadata[poem["id"]] = {
            "readingTime": reading_time if math.isfinite(reading_time) else 0,
            "country": poem.get("country") or "",
        }

    vectors = []
    row_to_poem = {}
    used = set()
    row_number = 0
    for part in range(1, 5):
        with (ROOT / f"tensors_generator/poems_metadata_{part}.tsv").open(newline="") as handle:
            metadata = list(csv.DictReader(handle, delimiter="\t"))
        tensor = np.loadtxt(
            ROOT / f"tensors_generator/poems_tensors_{part}.tsv",
            dtype=np.float32,
            delimiter="\t",
        )
        if len(metadata) != len(tensor):
            raise ValueError(f"Poem metadata/tensor mismatch in part {part}")
        vectors.append(tensor)
        for row in metadata:
            candidates = [
                poem for poem in by_title[normalize(row["Título"])]
                if poem["id"] not in used
            ]
            if candidates:
                metadata_author = normalize(row["Nombre Completo Autor"])
                author_matches = [
                    poem for poem in candidates
                    if all(piece in metadata_author for piece in normalize(poem["author_name"]).split())
                ]
                poem_id = (author_matches or candidates)[0]["id"]
                row_to_poem[row_number] = poem_id
                used.add(poem_id)
            row_number += 1

    tensor = np.concatenate(vectors)
    tensor /= np.maximum(
        np.linalg.norm(tensor, axis=1, keepdims=True),
        np.finfo(np.float32).eps,
    )
    mapped_rows = np.array(sorted(row_to_poem), dtype=np.int32)
    mapped_tensor = tensor[mapped_rows]
    neighbors = {}
    candidate_count = min(8, len(mapped_rows))

    # Batched multiplication keeps memory bounded while retaining exact cosine KNN.
    for start in range(0, len(mapped_rows), 64):
        similarities = mapped_tensor[start:start + 64] @ mapped_tensor.T
        positions = np.argpartition(similarities, -candidate_count, axis=1)[:, -candidate_count:]
        for offset, candidates in enumerate(positions):
            scores = similarities[offset]
            source_id = row_to_poem[int(mapped_rows[start + offset])]
            ordered = candidates[np.argsort(scores[candidates])[::-1]]
            neighbors[source_id] = [
                {"id": row_to_poem[int(mapped_rows[position])], "similarity": round(float(scores[position]), 4)}
                for position in ordered
                if row_to_poem[int(mapped_rows[position])] != source_id
            ][:5]

    poems_by_author = defaultdict(list)
    for poem in data["poems"]:
        if poem["id"] in neighbors:
            poems_by_author[poem["author_uuid"]].append(poem["id"])
    for poem in data["poems"]:
        if poem["id"] in neighbors:
            continue
        consensus = []
        for sibling_id in poems_by_author[poem["author_uuid"]]:
            for neighbor in neighbors[sibling_id]:
                if neighbor["id"] != poem["id"] and neighbor["id"] not in [entry["id"] for entry in consensus]:
                    consensus.append(dict(neighbor))
            if len(consensus) >= 5:
                break
        # Extremely rare authors without a tensor row get a deterministic global fallback.
        if not consensus:
            for candidate_id in sorted(neighbors):
                if candidate_id != poem["id"]:
                    consensus.append({"id": candidate_id, "similarity": 0.0})
                if len(consensus) == 5:
                    break
        neighbors[poem["id"]] = consensus[:5]

    (ROOT / "static/poemEmbeddingNeighbors.json").write_text(
        json.dumps(neighbors, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    (ROOT / "static/poemReaderMetadata.json").write_text(
        json.dumps(poem_metadata, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    print(f"Wrote neighbors for {len(neighbors)} poems ({len(mapped_rows)} exact embedding rows)")


if __name__ == "__main__":
    main()
