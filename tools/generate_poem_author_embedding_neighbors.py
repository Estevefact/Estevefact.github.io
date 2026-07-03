#!/usr/bin/env python3
"""Build poem-author neighbors using only the poem embedding shards."""

import csv
import json
from collections import defaultdict
from pathlib import Path

import numpy as np

from generate_nearest_poems import normalize

ROOT = Path(__file__).resolve().parents[1]


def main():
    data = json.loads((ROOT / "static/poems.json").read_text())
    poems_by_title = defaultdict(list)
    authors_by_uuid = {
        author["author_uuid"]: author
        for author in data["authors"]
        if normalize(author.get("author_name")) not in {"", "unknown"}
    }
    for poem in data["poems"]:
        poems_by_title[normalize(poem["story_name"])].append(poem)

    author_vectors = defaultdict(list)
    mapped_rows = 0
    for part in range(1, 5):
        metadata_path = (
            ROOT / f"tensors_generator/poems_metadata_{part}.tsv"
        )
        with metadata_path.open(newline="") as handle:
            metadata = list(csv.DictReader(handle, delimiter="\t"))
        tensors = np.loadtxt(
            ROOT / f"tensors_generator/poems_tensors_{part}.tsv",
            dtype=np.float32,
            delimiter="\t",
        )
        if len(metadata) != len(tensors):
            raise ValueError(f"Poem metadata/tensor mismatch in part {part}")
        tensors /= np.maximum(
            np.linalg.norm(tensors, axis=1, keepdims=True),
            np.finfo(np.float32).eps,
        )
        for row_number, row in enumerate(metadata):
            candidates = poems_by_title[normalize(row["Título"])]
            if not candidates:
                continue
            metadata_author = normalize(row["Nombre Completo Autor"])
            matching = [
                poem for poem in candidates
                if all(
                    piece in metadata_author
                    for piece in normalize(poem["author_name"]).split()
                )
            ]
            poem = (matching or candidates)[0]
            if poem["author_uuid"] not in authors_by_uuid:
                continue
            author_vectors[poem["author_uuid"]].append(tensors[row_number])
            mapped_rows += 1

    author_ids = sorted(author_vectors)
    centroids = np.stack([
        np.mean(author_vectors[author_id], axis=0) for author_id in author_ids
    ])
    centroids /= np.maximum(
        np.linalg.norm(centroids, axis=1, keepdims=True),
        np.finfo(np.float32).eps,
    )
    similarities = centroids @ centroids.T

    neighbors = {}
    for source_position, source_id in enumerate(author_ids):
        nearest = np.argsort(similarities[source_position])[::-1]
        neighbors[source_id] = [
            {
                "id": author_ids[target_position],
                "similarity": round(
                    float(similarities[source_position, target_position]),
                    4,
                ),
                "sourcePoems": len(author_vectors[source_id]),
                "targetPoems": len(
                    author_vectors[author_ids[target_position]]
                ),
            }
            for target_position in nearest
            if target_position != source_position
        ][:5]

    output = ROOT / "static/poemAuthorEmbeddingNeighbors.json"
    serialized = json.dumps(
        neighbors,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    output.write_text(serialized + "\n")
    print(
        f"Wrote poem-only neighbors for {len(neighbors)} authors "
        f"from {mapped_rows} poem vectors"
    )


if __name__ == "__main__":
    main()
