#!/usr/bin/env python3
"""Build story neighbors from TensorFlow projector data."""

import csv
import json
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
    graph_path = ROOT / "static/authorLinksSmallerAllStories.json"
    graph = json.loads(graph_path.read_text())
    by_title = defaultdict(list)
    for author in graph["nodes"]:
        for story_id, title in author.get("stories", {}).items():
            by_title[normalize(title)].append(
                (story_id, normalize(author["id"]))
            )

    metadata_path = ROOT / "tensors_generator/stories_metadata.tsv"
    with metadata_path.open(newline="") as handle:
        metadata = list(csv.DictReader(handle, delimiter="\t"))

    row_to_story = {}
    story_metadata = {}
    used = set()
    for row_number, row in enumerate(metadata):
        candidates = [
            candidate
            for candidate in by_title[normalize(row["Título"])]
            if candidate[0] not in used
        ]
        if not candidates:
            continue
        metadata_author = normalize(row["Autor"])
        matching = [
            candidate
            for candidate in candidates
            if all(
                part in metadata_author
                for part in candidate[1].split()
            )
        ]
        story_id = (matching or candidates)[0][0]
        row_to_story[row_number] = story_id
        story_metadata[story_id] = {
            "readingTime": float(row["Tiempo de Lectura (min)"] or 0),
        }
        used.add(story_id)

    tensors = np.loadtxt(
        ROOT / "tensors_generator/stories_tensors.tsv",
        dtype=np.float32,
        delimiter="\t",
    )
    norms = np.linalg.norm(tensors, axis=1, keepdims=True)
    tensors = tensors / np.maximum(norms, np.finfo(np.float32).eps)
    mapped_rows = np.array(sorted(row_to_story), dtype=np.int32)
    mapped_tensors = tensors[mapped_rows]

    neighbors = {}
    batch_size = 128
    candidate_count = min(12, len(mapped_rows))
    for start in range(0, len(mapped_rows), batch_size):
        batch = mapped_tensors[start:start + batch_size]
        similarities = batch @ mapped_tensors.T
        for offset, scores in enumerate(similarities):
            source_row = mapped_rows[start + offset]
            source_id = row_to_story[int(source_row)]
            positions = np.argpartition(
                scores,
                -candidate_count,
            )[-candidate_count:]
            positions = positions[np.argsort(scores[positions])[::-1]]
            nearest = [
                {
                    "id": row_to_story[int(mapped_rows[position])],
                    "similarity": round(float(scores[position]), 4),
                }
                for position in positions
                if row_to_story[int(mapped_rows[position])] != source_id
            ][:5]
            neighbors[source_id] = nearest

    # A story can be newer than the tensor. Use its author's embedded
    # stories until the TensorFlow export is regenerated.
    for author in graph["nodes"]:
        mapped_siblings = [
            story_id
            for story_id in author.get("stories", {})
            if story_id in neighbors
        ]
        for story_id in author.get("stories", {}):
            if story_id in neighbors:
                continue
            consensus = []
            for sibling_id in mapped_siblings:
                for neighbor in neighbors[sibling_id]:
                    neighbor_id = neighbor["id"]
                    existing_ids = [entry["id"] for entry in consensus]
                    if (
                        neighbor_id != story_id
                        and neighbor_id not in existing_ids
                    ):
                        consensus.append(dict(neighbor))
            neighbors[story_id] = consensus[:5]
            story_file = ROOT / "static/Cuentos" / f"{story_id}.json"
            if story_file.exists():
                story_data = json.loads(story_file.read_text())
                story_metadata[story_id] = {
                    "readingTime": float(
                        story_data.get("metadata", {}).get(
                            "reading_time_min",
                            0,
                        )
                    )
                }

    output = ROOT / "static/storyEmbeddingNeighbors.json"
    serialized = json.dumps(
        neighbors,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    output.write_text(serialized + "\n")
    (ROOT / "static/storyReaderMetadata.json").write_text(
        json.dumps(
            story_metadata,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    )
    print(
        f"Wrote {len(neighbors)} mapped stories "
        f"to {output.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
