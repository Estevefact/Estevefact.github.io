#!/usr/bin/env python3
"""Generate the Literary Guesser author/story data.

The source graph supplies the stable story ids and author attribution.  The
Wikipedia category snapshot in ``stories_metadata.tsv`` supplies sex and the
small, deliberately curated set of unusual author tags.  Familiarity and
reading complexity are editorial estimates: they are documented in README
and kept deterministic so the catalog can be regenerated without drift.
"""

import csv
import json
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
GRAPH_PATH = ROOT / "static/authorLinksSmallerAllStories.json"
FALLBACK_GRAPH_PATHS = (
    ROOT / "static/authorLinksSmaller_new.json",
    ROOT / "static/authorLinksSmallerShortCleaned_new.json",
)
TSV_PATH = ROOT / "tensors_generator/stories_metadata.tsv"
STORIES_DIR = ROOT / "static/Cuentos"
POEMS_DIR = ROOT / "static/Poemas"
POEMS_PATH = ROOT / "static/poems.json"
METADATA_PATH = ROOT / "static/storyReaderMetadata.json"
POEM_METADATA_PATH = ROOT / "static/poemReaderMetadata.json"
CATALOG_PATH = ROOT / "static/literaryGuesserCatalog.json"

INTRO_STORY_IDS = {
    "6e9e02d2-cbed-4113-8d61-329cc63143a4",
    "c4c576bf-194b-4186-a958-957681ff1cd4",
    "48d207d1-3a9f-4972-b28a-c27684afed92",
    "6f1fd77c-cbcb-4af8-b8ce-7386a4d3518b",
}

DISPUTED_ATTRIBUTIONS = {
    "43c5dcfd-ac67-4dac-be2e-b97c8a314534": "Aviso",
    "799a672c-3226-4f98-a193-d6cfa4cb94e7": "Vendo zapatos",
}
DISPUTED_ATTRIBUTION_SOURCE = (
    "https://quoteinvestigator.com/2013/01/28/baby-shoes/"
)


def normalize(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def name_tokens(value):
    return frozenset(normalize(value).split())


def author_match(left, right):
    """Match full normalized names, never a title-only or surname-only join."""
    a, b = name_tokens(left), name_tokens(right)
    if not a or not b:
        return False
    # TSV uses ``Apellido, Nombre`` while the graph uses display order.
    if a == b:
        return True
    # Particles and occasional middle names can differ in the snapshot, but
    # require every token from the shorter name and at least two tokens.
    return len(a) >= 2 and len(b) >= 2 and (a <= b or b <= a)


def as_year(value):
    try:
        year = int(float(value))
    except (TypeError, ValueError):
        return None
    # Negative years are useful for ancient authors (for example Aesop).
    return year if year != 0 else None


def country_value(value):
    value = str(value or "").strip()
    return (
        value
        if value and normalize(value) not in {"unknown", "desconocido"}
        else None
    )


def word_count(text):
    # Keep punctuation out while counting accented Spanish words.
    without_fin = re.sub(r"(?im)^\s*FIN\s*$", "", text)
    return len(
        re.findall(
            r"[\wÀ-ÿ]+(?:['’][\wÀ-ÿ]+)?",
            without_fin,
            flags=re.UNICODE,
        )
    )


def complexity_score(text, words):
    """Transparent 0..10 reading estimate based on text shape.

    Longer sentences, lexical variety, and punctuation density contribute to
    the estimate. It is a reading aid, not a readability measurement.
    """
    if words <= 12:
        return 0
    sentences = [part for part in re.split(r"[.!?]+", text) if part.strip()]
    sentence_count = max(1, len(sentences))
    avg_sentence = words / sentence_count
    tokens = [normalize(token) for token in re.findall(r"[\wÀ-ÿ]+", text)]
    unique_ratio = len(set(tokens)) / max(1, len(tokens))
    punctuation = len(re.findall(r"[,;:()—–…]", text)) / max(1, words)
    score = (
        min(4.0, words / 900.0)
        + min(3.0, max(0.0, (avg_sentence - 9.0) / 13.0))
        + min(2.0, max(0.0, (unique_ratio - 0.38) * 8.0))
        + min(1.0, punctuation * 5.0)
    )
    return max(0, min(10, int(round(score))))


# Broad, conservative author notoriety tiers. These are editorial priors for
# game balancing, not measurements of readership or sales.
AUTHOR_FAMILIARITY = {
    "esopo": 9,
    "hermanos grimm": 9,
    "jean de la fontaine": 8,
    "anton chejov": 9,
    "fernando pessoa": 8,
    "adolfo bioy casares": 8,
    "guy de maupassant": 8,
    "lewis carroll": 9,
    "voltaire": 8,
    "rabindranath tagore": 8,
    "ramon gomez de la serna": 6,
    "julio ramon ribeyro": 7,
    "emilia pardo bazan": 7,
    "juan jose arreola": 7,
    "alfonso reyes": 6,
    "ambrose bierce": 7,
    "juan carlos onetti": 7,
    "fredric brown": 6,
    "bertolt brecht": 8,
    "jorge luis borges": 10,
    "gabriel garcia marquez": 10,
    "miguel de cervantes": 10,
    "william shakespeare": 10,
    "franz kafka": 9,
    "leon tolstoi": 9,
    "fyodor dostoevsky": 9,
    "charles dickens": 9,
    "edgar allan poe": 9,
    "anton chekhov": 9,
    "ernest hemingway": 9,
    "virginia woolf": 9,
    "james joyce": 9,
    "jane austen": 9,
    "dante alighieri": 9,
    "pablo neruda": 9,
    "julio cortazar": 9,
    "octavio paz": 9,
    "mario vargas llosa": 9,
    "italo calvino": 9,
    "ray bradbury": 8,
    "isaac asimov": 8,
    "h p lovecraft": 8,
    "hans christian andersen": 8,
    "alexandre dumas": 8,
    "victor hugo": 8,
    "honore de balzac": 8,
    "emile zola": 8,
    "albert camus": 8,
    "jose saramago": 8,
    "alejo carpentier": 8,
    "juan rulfo": 8,
    "augusto monterroso": 8,
    "adolf bioy casares": 8,
    "silvina ocampo": 8,
    "robert louis stevenson": 8,
    "jorge amado": 8,
    "mario benedetti": 8,
    "leopoldo lugones": 7,
    "horacio quiroga": 7,
    "alfonsina storni": 7,
    "federico garcia lorca": 8,
    "gustave flaubert": 8,
    "alexander pushkin": 8,
    "nikolai gogol": 8,
    "antonio machado": 7,
    "benito perez galdos": 7,
    "camilo jose cela": 7,
    "pío baroja": 7,
    "pio baroja": 7,
    "miguel de unamuno": 7,
    "clarice lispector": 8,
    "marguerite yourcenar": 7,
    "katherine mansfield": 7,
    "doris lessing": 7,
    "yukio mishima": 7,
    "osamu dazai": 7,
    "haruki murakami": 8,
}

STORY_FAMILIARITY = {
    ("augusto monterroso", "el dinosaurio"): 10,
    ("julio cortazar", "amor 77"): 9,
    ("franz kafka", "una pequena fabula"): 9,
    ("jorge luis borges", "del rigor en la ciencia"): 9,
    ("esopo", "la liebre y la tortuga"): 9,
    ("jean de la fontaine", "la liebre y la tortuga"): 9,
    ("charles perrault", "caperucita roja"): 9,
}

STORY_COMPLEXITY = {
    ("augusto monterroso", "el dinosaurio"): 0,
    ("julio cortazar", "amor 77"): 1,
    ("franz kafka", "una pequena fabula"): 1,
    ("jorge luis borges", "del rigor en la ciencia"): 2,
}

POEM_FAMILIARITY = {
    "pablo neruda": 9,
    "ruben dario": 9,
    "gabriela mistral": 9,
    "federico garcia lorca": 9,
    "antonio machado": 8,
    "alfonsina storni": 8,
    "mario benedetti": 8,
    "sor juana ines de la cruz": 8,
    "gustavo adolfo becquer": 8,
    "jose marti": 8,
    "juan ramon jimenez": 8,
}

POEM_FAMILIARITY_OVERRIDES = {
    ("gustavo adolfo becquer", "rima xxi que es poesia"): 10,
    ("jose marti", "cultivo una rosa blanca"): 10,
    ("antonio machado", "caminante no hay camino"): 9,
    ("gabriela mistral", "piececitos"): 9,
    ("ruben dario", "a margarita debayle"): 9,
}

# Checked against the actual local text, rather than title matches alone.
POEM_INTRO_COMPLEXITY = {
    "7e2311c5-0866-4b76-a645-32aa28bf4197": 0,
    "57b6c3fa-514b-417f-a82e-90546b1b65f4": 1,
    "992b9152-cde8-457d-8e61-60e4b0fe4bd0": 1,
    "a6c745b5-0dcc-497f-ad93-61330cf88f33": 3,
}
POEM_TEXT_MISMATCHES = {
    # Martí title, local text starts "Pomona".
    "a297c490-8997-40e3-a2a8-518119dc1631",
    # Caminante title, different poem body.
    "f913c5f2-9c6e-4629-8b70-1b527f5026d4",
}

# The poem export has one duplicate Antonio Machado record that says Mexico
# while omitting his birth and death years. The Biblioteca Nacional de España
# authority record identifies him as born in Seville in 1875; use the complete,
# matching Spain/1875 source record and retain this citation in generated data.
CURATED_BIOGRAPHY_SOURCES = {
    "antonio machado": "https://www.bne.es/es/autores/machado-antonio",
}

CANONICAL_AUTHORS = {
    normalize(name)
    for name in (
        "Jorge Luis Borges", "Gabriel García Márquez", "Franz Kafka",
        "Julio Cortázar", "Augusto Monterroso", "Juan Rulfo", "León Tolstói",
        "Edgar Allan Poe", "Anton Chéjov", "Charles Dickens", "Virginia Woolf",
        "Federico García Lorca", "Pablo Neruda", "Octavio Paz",
        "Mario Benedetti",
        "José Saramago", "Ray Bradbury", "Isaac Asimov", "Dante Alighieri",
        "William Shakespeare", "Miguel de Cervantes", "Horacio Quiroga",
        "Adolfo Bioy Casares", "Silvina Ocampo", "Clarice Lispector",
        "Katherine Mansfield", "Marguerite Yourcenar", "Juan Carlos Onetti",
        "Alejo Carpentier", "Mario Vargas Llosa", "Italo Calvino",
    )
}


def author_story_prior(normalized_author):
    """Use fame as a prior while reserving 10 for famous individual works."""
    raw = AUTHOR_FAMILIARITY.get(normalized_author, 4)
    return 8 if raw >= 10 else min(raw, 9)


def image_filename(value):
    value = str(value or "").strip()
    if not value or normalize(value) in {"sagan png", "preview png"}:
        return None
    filename = Path(value).name
    if (
        (ROOT / "static/imgs" / filename).exists()
        or (ROOT / "static" / filename).exists()
    ):
        return filename
    return None


def categories_to_tags(categories, source_url):
    tags = []
    patterns = [
        r"suicid", r"ateos|ateo", r"lgbt|gais|gay|lesbian", r"exiliad",
        r"prisioner|preso político", r"polímata|polimata", r"médic|medic",
        r"militares", r"autobiógraf|autobiograf", r"autodidact", r"zurd",
        r"asteroide", r"mensa",
    ]
    for category in categories:
        category = category.strip()
        if not category:
            continue
        if any(
            re.search(pattern, category, flags=re.IGNORECASE)
            for pattern in patterns
        ):
            tags.append({
                "label": category,
                "rawCategory": category,
                "source": source_url,
            })
    # Preserve order while avoiding duplicate category rows.
    tags = list({tag["rawCategory"]: tag for tag in tags}.values())
    return tags


def source_for_author(name, has_snapshot):
    slug = quote(name.replace(" ", "_"), safe="_()")
    return f"https://es.wikipedia.org/wiki/{slug}"


def poem_source_url(author):
    value = str(author.get("wiki_url") or "").strip()
    if value.startswith("https://") or value.startswith("http://"):
        return value
    return source_for_author(
        str(author.get("author_name") or "Unknown").strip(), False
    )


def poem_prior(author_name):
    normalized = normalize(author_name)
    if normalized in POEM_FAMILIARITY:
        return POEM_FAMILIARITY[normalized]
    return author_story_prior(normalized)


def source_sex(row):
    categories = {
        normalize(category)
        for category in str(row.get("categories") or "").split(",")
        if category.strip()
    }
    if "hombres" in categories:
        return "male"
    if "mujeres" in categories:
        return "female"
    return "unknown"


def poem_author_facts(rows):
    """Return the complete, internally consistent biography rows for one name.

    Duplicate rows with missing fields are common in the poem export. A country
    is accepted only from a row that also supplies a birth year. Contradictory
    complete rows are flagged, leaving the author out of quiz answers until the
    source can be resolved.
    """
    complete = [
        row for row in rows
        if (
            country_value(row.get("country"))
            and as_year(row.get("birth_year")) is not None
        )
    ]
    candidates = complete or list(rows)
    facts = {
        (country_value(row.get("country")), as_year(row.get("birth_year")))
        for row in complete
    }
    conflict = len(facts) > 1
    sexes = {
        source_sex(row) for row in candidates if source_sex(row) != "unknown"
    }
    if len(sexes) > 1:
        conflict = True
    primary = candidates[0] if candidates else {}
    country, birth_year = (
        next(iter(facts), (None, None)) if not conflict else (None, None)
    )
    return {
        "primary": primary,
        "country": country,
        "birthYear": birth_year,
        "sex": next(iter(sexes), "unknown") if not conflict else "unknown",
        "conflict": conflict,
    }


def load_sources(graph):
    rows = list(csv.DictReader(TSV_PATH.open(newline=""), delimiter="\t"))
    fallback_nodes = []
    for fallback_path in FALLBACK_GRAPH_PATHS:
        if fallback_path.exists():
            fallback_nodes.extend(
                json.loads(fallback_path.read_text())["nodes"]
            )
    # Prefer the complete graph when an id occurs in more than one snapshot.
    # Keep fallback rows even for an author already in the primary graph: they
    # often contribute additional story ids. ``setdefault`` below still gives
    # the primary graph precedence for duplicate ids.
    attribution_nodes = list(graph) + fallback_nodes
    by_title = defaultdict(list)
    for author in attribution_nodes:
        for story_id, title in author.get("stories", {}).items():
            by_title[normalize(title)].append((story_id, author["id"]))
        if author.get("story_id") and author.get("story_name"):
            by_title[normalize(author["story_name"])].append(
                (author["story_id"], author["id"])
            )
    story_rows = {}
    author_rows = defaultdict(list)
    for row in rows:
        author_name = row.get("Autor", "")
        for source_author in attribution_nodes:
            if author_match(source_author["id"], author_name):
                author_rows[source_author["id"]].append(row)
        candidates = [
            candidate
            for candidate in by_title.get(normalize(row.get("Título")), [])
            if author_match(candidate[1], author_name)
        ]
        # There can be duplicate title/author entries; consume
        # deterministically.
        for story_id, _ in candidates:
            if story_id not in story_rows:
                story_rows[story_id] = row
                break
    attribution = {}
    for author in attribution_nodes:
        if author.get("stories"):
            for story_id, title in author["stories"].items():
                attribution.setdefault(story_id, (author, title))
        elif author.get("story_id") and author.get("story_name"):
            attribution.setdefault(
                author["story_id"], (author, author["story_name"])
            )
    return rows, story_rows, author_rows, attribution


def main():
    graph = json.loads(GRAPH_PATH.read_text())["nodes"]
    source_rows, story_rows, author_rows, attribution = load_sources(graph)
    known_countries = {}
    for source_author in graph:
        value = country_value(source_author.get("country"))
        if value:
            known_countries.setdefault(normalize(value), value)
    for source_row in source_rows:
        value = country_value(source_row.get("País"))
        if value:
            known_countries.setdefault(normalize(value), value)
    preserved_reading_times = {}
    if METADATA_PATH.exists():
        existing = json.loads(METADATA_PATH.read_text())
        preserved_reading_times = {
            story_id: item["readingTime"]
            for story_id, item in existing.items()
            if isinstance(item, dict)
            and isinstance(item.get("readingTime"), (int, float))
        }
    attributed_story_ids = set(attribution)
    all_files = sorted(STORIES_DIR.glob("*.json"), key=lambda path: path.stem)
    texts = {}
    for path in all_files:
        data = json.loads(path.read_text())
        text = str(data.get("text", ""))
        # Source ``words`` includes the conventional FIN marker in several
        # records. Recompute from the text so the game count describes prose.
        words = word_count(text)
        reading_time = float(
            preserved_reading_times.get(
                path.stem,
                data.get("metadata", {}).get("reading_time_min")
                or (words / 200.0),
            )
        )
        texts[path.stem] = (text, words, reading_time)

    # Start with every local story, including texts absent from the graph.
    metadata = {}
    for story_id, (text, words, reading_time) in texts.items():
        title = None
        row = story_rows.get(story_id)
        if row:
            title = row.get("Título")
        if title is None and story_id in attribution:
            title = attribution[story_id][1]
        complexity = complexity_score(text, words)
        metadata[story_id] = {
            "readingTime": round(reading_time, 4),
            "wordCount": words,
            "familiarity": 0,
            "readingComplexity": complexity,
            "isClassic": 0,
            "classificationMethod": "unmapped-text-heuristic",
            "classificationStatus": "unmapped",
            "confidence": "low",
            "unmapped": story_id not in attributed_story_ids,
            "unreviewed": story_id not in attributed_story_ids,
            "quizEligible": story_id in attributed_story_ids,
        }

        if story_id in attribution:
            attributed_author, attributed_title = attribution[story_id]
            author_key = normalize(attributed_author.get("id"))
            override_key = (author_key, normalize(attributed_title))
            birth_year = as_year(attributed_author.get("birth_year"))
            classic = author_key in CANONICAL_AUTHORS or bool(
                birth_year and birth_year <= 1900
            )
            if override_key in STORY_FAMILIARITY:
                classic = True
            metadata[story_id].update({
                "title": attributed_title,
                "authorId": attributed_author.get("id"),
                "familiarity": STORY_FAMILIARITY.get(
                    override_key, author_story_prior(author_key)
                ),
                "readingComplexity": STORY_COMPLEXITY.get(
                    override_key, complexity
                ),
                "isClassic": int(bool(classic)),
                "classificationMethod": (
                    "editorial-author-tier-and-text-heuristic"
                ),
                "classificationStatus": "mapped",
                "confidence": "editorial-estimate",
                "unmapped": False,
                "unreviewed": False,
            })
        if story_id in DISPUTED_ATTRIBUTIONS:
            metadata[story_id].update({
                "quizEligible": False,
                "attributionStatus": "disputed",
                "attributionSource": DISPUTED_ATTRIBUTION_SOURCE,
            })

    authors = []
    stories = []
    for author in graph:
        author_name = str(author.get("id", "")).strip()
        rows = author_rows.get(author.get("id", ""), [])
        representative = rows[0] if rows else {}
        countries = []
        for value in [
            author.get("country"), *(row.get("País") for row in rows)
        ]:
            value = country_value(value)
            if value and value not in countries:
                countries.append(value)
        birth_year = as_year(author.get("birth_year"))
        if birth_year is None:
            birth_year = as_year(representative.get("Año de nacimiento"))
        sex = "unknown"
        categories = []
        for row in rows:
            categories.extend(str(row.get("Categorías") or "").split(","))
        category_set = {
            normalize(category) for category in categories if category.strip()
        }
        # A second nationality is accepted only when the imported snapshot
        # explicitly says "Nacionalizados de X". Exile, residence, language,
        # and birthplace categories are not treated as nationality.
        for category in categories:
            match = re.match(
                r"^Nacionalizados de (.+)$",
                category.strip(),
                flags=re.IGNORECASE,
            )
            if match:
                country = known_countries.get(normalize(match.group(1)))
                if country and country not in countries:
                    countries.append(country)
        if "hombres" in category_set:
            sex = "male"
        elif "mujeres" in category_set:
            sex = "female"
        genres = []
        for value in [
            author.get("genre"), *(row.get("Género") for row in rows)
        ]:
            value = str(value or "").strip()
            if (
                value
                and normalize(value) not in {"unknown", "desconocido"}
                and value not in genres
            ):
                genres.append(value)
        author_id = author_name
        normalized_author = normalize(author_name)
        image = image_filename(author.get("image"))
        source_url = source_for_author(author_name, bool(rows))
        authors.append({
            "id": author_id,
            "name": author_name,
            "countries": countries,
            "sex": sex,
            "birthYear": birth_year,
            "birthDecade": (
                math.trunc(birth_year / 10) * 10 if birth_year else None
            ),
            "image": image,
            "genres": genres,
            "weirdTags": categories_to_tags(categories, source_url),
            "source": source_url,
            "sourceNote": (
                "Wikipedia categories snapshot imported from "
                "tensors_generator/stories_metadata.tsv"
                if rows
                else "Story graph snapshot; author category row not matched"
            ),
        })
        # Author recognition is only a prior. Individual stories remain below
        # the maximum unless a title has a specific, curated override.
        familiarity = author_story_prior(normalized_author)
        for story_id, title in author.get("stories", {}).items():
            text, words, _ = texts.get(story_id, ("", 0, 0))
            normalized_title = normalize(title)
            override_key = (normalized_author, normalized_title)
            score = STORY_FAMILIARITY.get(override_key, familiarity)
            classic = normalized_author in CANONICAL_AUTHORS or bool(
                birth_year and birth_year <= 1900
            )
            if override_key in STORY_FAMILIARITY:
                classic = True
            if story_id in metadata:
                metadata[story_id].update({
                    "familiarity": max(0, min(10, int(score))),
                    "readingComplexity": STORY_COMPLEXITY.get(
                        override_key, complexity_score(text, words)
                    ),
                    "isClassic": int(bool(classic)),
                    "classificationMethod": (
                        "editorial-author-tier-and-text-heuristic"
                    ),
                    "classificationStatus": "mapped",
                    "confidence": "editorial-estimate",
                    "unmapped": False,
                    "unreviewed": False,
                })
            stories.append({
                "id": story_id,
                "title": title,
                "authorId": author_id,
                "kind": "story",
                "wordCount": metadata.get(story_id, {}).get(
                    "wordCount", words
                ),
                "familiarity": max(0, min(10, int(score))),
                "readingComplexity": metadata.get(story_id, {}).get(
                    "readingComplexity", complexity_score(text, words)
                ),
                "isClassic": int(bool(classic)),
                "quizEligible": story_id not in DISPUTED_ATTRIBUTIONS,
            })

    # Poems use the same public catalog and author records. Exact normalized
    # name matches reuse a story author id; poem-only authors use their
    # displayed name, merged across duplicate poem author rows.
    poem_source = json.loads(POEMS_PATH.read_text())
    author_by_normalized_name = {
        normalize(author["name"]): author
        for author in authors
        if normalize(author.get("name"))
    }
    poem_authors_seen = defaultdict(list)
    for poem_author in poem_source.get("authors", []):
        poem_authors_seen[
            normalize(poem_author.get("author_name")) or "unknown"
        ].append(poem_author)

    for normalized_name, source_author_rows in poem_authors_seen.items():
        source_facts = poem_author_facts(source_author_rows)
        source_author = source_facts["primary"]
        display_name = (
            str(source_author.get("author_name") or "Unknown").strip()
            or "Unknown"
        )
        author_record = author_by_normalized_name.get(normalized_name)
        if author_record is None:
            categories = []
            for row in source_author_rows:
                categories.extend(str(row.get("categories") or "").split(","))
            sex = source_facts["sex"]
            birth_year = source_facts["birthYear"]
            countries = (
                [source_facts["country"]] if source_facts["country"] else []
            )
            genres = []
            for row in source_author_rows:
                genre = str(row.get("genre") or "").strip()
                if (
                    genre
                    and normalize(genre) not in {"unknown", "desconocido"}
                    and genre not in genres
                ):
                    genres.append(genre)
            source_url = poem_source_url(source_author)
            author_record = {
                "id": display_name,
                "name": display_name,
                "countries": countries,
                "sex": sex,
                "birthYear": birth_year,
                "birthDecade": (
                    math.trunc(birth_year / 10) * 10 if birth_year else None
                ),
                "image": image_filename(source_author.get("image")),
                "genres": genres,
                "weirdTags": categories_to_tags(categories, source_url),
                "source": source_url,
                "sourceNote": (
                    "Poem author snapshot imported from static/poems.json"
                ),
                "biographyConflict": source_facts["conflict"],
            }
            if normalized_name in CURATED_BIOGRAPHY_SOURCES:
                author_record["biographySource"] = (
                    CURATED_BIOGRAPHY_SOURCES[normalized_name]
                )
            authors.append(author_record)
            author_by_normalized_name[normalized_name] = author_record
        else:
            # Story graph facts are authoritative when already present. The
            # poem export can contribute categories and genres, but never a
            # competing country, birth year, or sex answer.
            for row in source_author_rows:
                genre = str(row.get("genre") or "").strip()
                if (
                    genre
                    and normalize(genre) not in {"unknown", "desconocido"}
                    and genre not in author_record["genres"]
                ):
                    author_record["genres"].append(genre)
                categories = str(row.get("categories") or "").split(",")
                source_url = poem_source_url(row)
                existing_categories = {
                    tag.get("rawCategory")
                    for tag in author_record["weirdTags"]
                }
                for tag in categories_to_tags(categories, source_url):
                    if tag["rawCategory"] not in existing_categories:
                        author_record["weirdTags"].append(tag)
                        existing_categories.add(tag["rawCategory"])

        # Unknown source records refer to different people; their combined
        # biography must never become an answer or a source of distractors.
        if normalized_name == "unknown":
            author_record.update(
                countries=[],
                sex="unknown",
                birthYear=None,
                birthDecade=None,
                weirdTags=[],
                biographyConflict=True,
            )

    existing_poem_metadata = (
        json.loads(POEM_METADATA_PATH.read_text())
        if POEM_METADATA_PATH.exists()
        else {}
    )
    poem_metadata = dict(existing_poem_metadata)
    poems_by_id = {
        poem.get("id"): poem for poem in poem_source.get("poems", [])
    }
    poem_texts = {}
    for poem_path in sorted(
        POEMS_DIR.glob("*.json"), key=lambda path: path.stem
    ):
        data = json.loads(poem_path.read_text())
        text = str(data.get("text", ""))
        poem_texts[poem_path.stem] = (
            text,
            word_count(text),
            data.get("metadata", {}).get("reading_time_min"),
        )

    # Conflicting author labels for identical text cannot form a fair quiz.
    text_attributions = defaultdict(set)
    for poem in poem_source.get("poems", []):
        text_info = poem_texts.get(poem.get("id"))
        if text_info and text_info[1] >= 4:
            text_attributions[normalize(text_info[0])].add(
                normalize(poem.get("author_name"))
            )

    poem_catalog = []
    for poem in poem_source.get("poems", []):
        poem_id = poem.get("id")
        author_name = (
            str(poem.get("author_name") or "Unknown").strip() or "Unknown"
        )
        normalized_author = normalize(author_name) or "unknown"
        author_record = author_by_normalized_name.get(normalized_author)
        author_id = author_record["id"] if author_record else author_name
        text_info = poem_texts.get(poem_id)
        existing_item = dict(poem_metadata.get(poem_id, {}))
        if text_info:
            text, words, file_time = text_info
        else:
            text, words, file_time = "", 0, None
        try:
            source_time = float(poem.get("reading_time") or 0)
        except (TypeError, ValueError):
            source_time = 0
        reading_time = existing_item.get("readingTime")
        if not isinstance(reading_time, (int, float)):
            reading_time = source_time or file_time or (
                words / 200.0 if words else 0
            )
        override_key = (normalized_author, normalize(poem.get("story_name")))
        score = POEM_FAMILIARITY_OVERRIDES.get(
            override_key, poem_prior(author_name)
        )
        birth_year = (
            author_record.get("birthYear")
            if author_record
            else as_year(poem.get("birth_year"))
        )
        known_author = (
            normalized_author != "unknown"
            and author_record is not None
            and not author_record.get("biographyConflict", False)
        )
        classic = bool(birth_year is not None and birth_year <= 1900)
        if author_record and normalized_author in CANONICAL_AUTHORS:
            classic = True
        item = {
            **existing_item,
            "readingTime": round(float(reading_time), 4),
            "wordCount": words,
            "familiarity": int(max(0, min(10, score if known_author else 0))),
            "readingComplexity": POEM_INTRO_COMPLEXITY.get(
                poem_id, complexity_score(text, words)
            ),
            "isClassic": int(bool(classic and known_author)),
            "classificationMethod": "editorial-poet-tier-and-verse-heuristic",
            "classificationStatus": (
                "mapped" if known_author and text_info else "unmapped"
            ),
            "confidence": (
                "editorial-estimate"
                if known_author and text_info
                else "unreviewed"
            ),
            "unmapped": not (known_author and text_info),
            "unreviewed": poem_id not in POEM_INTRO_COMPLEXITY,
            "quizEligible": bool(known_author and text_info and words >= 4),
            "title": poem.get("story_name") or "",
            "authorId": author_id,
            "kind": "poem",
            "attributionIssues": [],
        }
        item.pop("attributionStatus", None)
        if len(text_attributions.get(normalize(text), set())) > 1:
            item["attributionIssues"].append(
                "conflicting-catalog-attributions"
            )
        if poem_id in POEM_TEXT_MISMATCHES:
            item["attributionIssues"].append("title-text-mismatch")
        if author_record and author_record.get("biographyConflict", False):
            item["attributionIssues"].append("conflicting-author-facts")
        if item["attributionIssues"]:
            item["quizEligible"] = False
            item["attributionStatus"] = (
                item["attributionIssues"][0]
                if len(item["attributionIssues"]) == 1
                else "multiple-attribution-issues"
            )
        if not existing_item.get("country"):
            item["country"] = poem.get("country") or ""
        poem_metadata[poem_id] = item
        poem_catalog.append({
            "id": poem_id,
            "title": poem.get("story_name") or "",
            "authorId": author_id,
            "kind": "poem",
            "wordCount": words,
            "familiarity": item["familiarity"],
            "readingComplexity": item["readingComplexity"],
            "isClassic": item["isClassic"],
            "quizEligible": item["quizEligible"],
        })

    # Preserve metadata for local poem files that are not in the compact poem
    # source list, while making their attribution state explicit.
    poem_source_ids = set(poems_by_id)
    for poem_id, (text, words, file_time) in poem_texts.items():
        if poem_id in poem_source_ids:
            continue
        old = dict(poem_metadata.get(poem_id, {}))
        reading_time = old.get("readingTime")
        if not isinstance(reading_time, (int, float)):
            reading_time = file_time or (words / 200.0 if words else 0)
        poem_metadata[poem_id] = {
            **old,
            "readingTime": round(float(reading_time), 4),
            "wordCount": words,
            "familiarity": 0,
            "readingComplexity": complexity_score(text, words),
            "isClassic": 0,
            "classificationMethod": "unmapped-text-heuristic",
            "classificationStatus": "unmapped",
            "confidence": "unreviewed",
            "unmapped": True,
            "unreviewed": True,
            "quizEligible": False,
            "kind": "poem",
        }

    catalog = {
        "version": 1,
        "authors": authors,
        "stories": stories + poem_catalog,
    }
    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    METADATA_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    POEM_METADATA_PATH.write_text(
        json.dumps(poem_metadata, ensure_ascii=False, separators=(",", ":"))
        + "\n"
    )
    mapped = sum(1 for item in metadata.values() if not item["unmapped"])
    print(
        f"Wrote {len(authors)} authors and {len(stories)} stories plus "
        f"{len(poem_catalog)} poems to {CATALOG_PATH.relative_to(ROOT)}"
    )
    print(
        f"Wrote metadata for {len(metadata)} local texts ({mapped} mapped, "
        f"{len(metadata) - mapped} unmapped) to "
        f"{METADATA_PATH.relative_to(ROOT)}"
    )
    print(
        f"Wrote metadata for {len(poem_metadata)} poems "
        f"({len(poem_catalog)} source poems, {len(poem_texts)} local files) "
        f"to {POEM_METADATA_PATH.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
