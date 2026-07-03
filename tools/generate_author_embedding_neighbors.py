#!/usr/bin/env python3
"""Build author-to-author similarities from the story TensorFlow embeddings."""

import csv
import json
from collections import defaultdict
from pathlib import Path

import numpy as np

from generate_nearest_stories import normalize

ROOT = Path(__file__).resolve().parents[1]


def main():
    graph = json.loads((ROOT / "static/authorLinksSmallerAllStories.json").read_text())
    graph_authors = {normalize(node["id"]): node["id"] for node in graph["nodes"]}

    with (ROOT / "tensors_generator/stories_metadata.tsv").open(newline="") as handle:
        metadata = list(csv.DictReader(handle, delimiter="\t"))
    tensors = np.loadtxt(
        ROOT / "tensors_generator/stories_tensors.tsv",
        dtype=np.float32,
        delimiter="\t",
    )
    tensors /= np.maximum(
        np.linalg.norm(tensors, axis=1, keepdims=True),
        np.finfo(np.float32).eps,
    )

    author_rows = defaultdict(list)
    for row_number, row in enumerate(metadata):
        metadata_author = normalize(row["Autor"])
        candidates = [
            author_id
            for normalized, author_id in graph_authors.items()
            if all(part in metadata_author for part in normalized.split())
        ]
        if candidates:
            author_rows[candidates[0]].append(row_number)

    authors = sorted(author_rows)
    clusters = {author: tensors[author_rows[author]] for author in authors}
    centroids = np.stack([clusters[author].mean(axis=0) for author in authors])
    centroids /= np.maximum(
        np.linalg.norm(centroids, axis=1, keepdims=True),
        np.finfo(np.float32).eps,
    )
    centroid_similarities = centroids @ centroids.T

    result = {}
    for source_position, source_author in enumerate(authors):
        scores = centroid_similarities[source_position]
        nearest_positions = np.argsort(scores)[::-1]
        neighbors = []
        for target_position in nearest_positions:
            if source_position == target_position:
                continue
            target_author = authors[target_position]
            pairwise = (clusters[source_author] @ clusters[target_author].T).reshape(-1)
            neighbors.append(
                {
                    "id": target_author,
                    "similarity": round(float(scores[target_position]), 4),
                    "storyPairs": int(pairwise.size),
                    "sourceStories": len(author_rows[source_author]),
                    "targetStories": len(author_rows[target_author]),
                }
            )
            if len(neighbors) == 5:
                break
        result[source_author] = neighbors

    output = ROOT / "static/authorEmbeddingNeighbors.json"
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote embedding neighbors for {len(result)} authors to {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
