"""
Nashmi Semantic Service Standardization (NSSS).

No model output has financial authority.

Production publication must fail closed when mandatory
moderation models are unavailable.
"""

import os

# ============================================================
# CPU / Memory Configuration
# ============================================================

os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import re
import unicodedata

from functools import lru_cache
from typing import Optional

from pydantic import BaseModel, Field
from fastapi import HTTPException

from ml.service.market_intelligence import classify_request


# ============================================================
# Models
# ============================================================

TOXICITY_MODEL = "youssefreda9/HAYAA"
SEMANTIC_MODEL = "intfloat/multilingual-e5-small"


# ============================================================
# Canonical Concepts
# ============================================================

CONCEPTS = {
    "CS_ALGORITHMS": (
        "الخوارزميات",
        "شرح دروس",
        [
            "خوارزميات",
            "الخوارزميات",
            "algorithms",
            "algorithm",
            "algorthm",
            "القورثم",
            "الالغوريثم",
            "الغوريثم",
        ],
    ),

    "CS_SORTING": (
        "خوارزميات الترتيب",
        "شرح دروس",
        [
            "sorting",
            "sorting algorithms",
            "الترتيب",
            "خوارزميات الترتيب",
        ],
    ),

    "CS_COMPLEXITY": (
        "تحليل التعقيد Big O",
        "شرح دروس",
        [
            "big o",
            "big-o",
            "تعقيد زمني",
            "تحليل التعقيد",
        ],
    ),

    "CS_PYTHON": (
        "Python",
        "شرح دروس",
        [
            "python",
            "بايثون",
            "البايثون",
        ],
    ),

    "CS_CPP": (
        "C++",
        "شرح دروس",
        [
            "c++",
            "سي بلس بلس",
        ],
    ),

    "CS_SQL": (
        "SQL",
        "شرح دروس",
        [
            "sql",
            "اس كيو ال",
        ],
    ),

    "CS_DATABASE": (
        "قواعد البيانات",
        "شرح دروس",
        [
            "قواعد البيانات",
            "قاعدة بيانات",
            "database",
            "databases",
        ],
    ),

    "CS_REACT": (
        "React",
        "برمجة",
        [
            "react",
            "reactjs",
            "ريأكت",
            "رياكت",
        ],
    ),

    "CS_ANDROID": (
        "تطبيق Android",
        "برمجة",
        [
            "android",
            "اندرويد",
            "أندرويد",
        ],
    ),

    "WEB": (
        "تطوير مواقع الويب",
        "برمجة",
        [
            "website",
            "web development",
            "موقع إلكتروني",
            "موقع الكتروني",
            "موقع ويب",
            "مواقع",
        ],
    ),

    "DESIGN_LOGO": (
        "تصميم شعار",
        "تصميم",
        [
            "logo",
            "لوغو",
            "لوجو",
            "شعار",
            "تصميم شعار",
            "لوغو للمشروع",
        ],
    ),

    "DESIGN_GRAPHIC": (
        "تصميم جرافيك",
        "تصميم",
        [
            "graphic design",
            "تصميم جرافيك",
            "تصميم غرافيك",
        ],
    ),

    "PRESENTATION": (
        "تصميم عروض تقديمية",
        "تصميم",
        [
            "powerpoint",
            "بوربوينت",
            "عرض تقديمي",
            "عروض تقديمية",
        ],
    ),

    "MATH": (
        "شرح الرياضيات",
        "شرح دروس",
        [
            "رياضيات",
            "الرياضيات",
            "math",
            "mathematics",
        ],
    ),

    "TRANSLATION": (
        "الترجمة",
        "ترجمة",
        [
            "ترجمة",
            "ترجم",
            "translation",
            "translate",
        ],
    ),

    "VIDEO": (
        "مونتاج الفيديو",
        "تحرير",
        [
            "مونتاج",
            "تحرير فيديو",
            "video editing",
            "مونتاج فيديو",
        ],
    ),
}


# ============================================================
# Concept Families
# ============================================================

FAMILIES = {
    "DESIGN_LOGO": "design",
    "DESIGN_GRAPHIC": "design",
    "PRESENTATION": "design",
    "TRANSLATION": "translation",
    "VIDEO": "video",
}

for _key in CONCEPTS:
    if _key.startswith("CS_") or _key == "WEB":
        FAMILIES[_key] = "computing"

    if _key == "MATH":
        FAMILIES[_key] = "tutoring"


# ============================================================
# Request Schema
# ============================================================

class Draft(BaseModel):
    title: str = Field(min_length=5, max_length=120)
    description: str = Field(min_length=20, max_length=5000)
    category: Optional[str] = None


# ============================================================
# Text Normalization
# ============================================================

def normalize(text: str):
    return re.sub(
        r"\s+",
        " ",
        unicodedata.normalize("NFC", text),
    ).strip()


def search_normalize(text: str):
    text = normalize(text).casefold().replace("ـ", "")

    text = re.sub(
        r"[\u064b-\u065f]",
        "",
        text,
    )

    return (
        text.replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ى", "ي")
    )


# ============================================================
# Garbage Detection
# ============================================================

def garbage(text: str):
    s = normalize(text)

    if not re.search(r"[\w\u0600-\u06ff]", s):
        return True

    compact = re.sub(
        r"\W+",
        "",
        s,
        flags=re.UNICODE,
    )

    if len(compact) >= 5 and len(set(compact)) <= 2:
        return True

    if re.search(r"(.)\1{5,}", s):
        return True

    if re.search(
        r"(?i)\b(asdjkhqwe|qweqwe\w*|asdfgh\w*|ضصثقفغعه)\b",
        s,
    ):
        return True

    return False


# ============================================================
# Concept Extraction
# ============================================================

def concepts(text: str):
    from rapidfuzz import process, fuzz

    s = search_normalize(text)

    found = set()

    aliases = [
        (key, search_normalize(alias))
        for key, (_, _, terms) in CONCEPTS.items()
        for alias in terms
    ]

    for key, alias in aliases:
        if re.search(
            r"(?<!\w)" + re.escape(alias) + r"(?!\w)",
            s,
        ):
            found.add(key)

    # Fuzzy matching for alphabetic tokens only.

    for token in re.findall(
        r"(?<!\w)[a-z]{6,}(?!\w)",
        s,
    ):
        if any(token in alias for _, alias in aliases):
            continue

        candidates = [
            value
            for _, value in aliases
            if re.fullmatch(r"[a-z]{6,}", value)
        ]

        nearest = process.extractOne(
            token,
            candidates,
            scorer=fuzz.ratio,
            score_cutoff=88,
        )

        if nearest:
            for key, alias in aliases:
                if alias == nearest[0]:
                    found.add(key)
                    break

    return sorted(found)


# ============================================================
# Toxicity Model - HAYAA
# ============================================================

@lru_cache(maxsize=1)
def toxicity_model():
    import torch
    from transformers import pipeline

    torch.set_num_threads(2)

    print(
        "[NSSS] Loading toxicity model: HAYAA...",
        flush=True,
    )

    model = pipeline(
        task="text-classification",
        model=TOXICITY_MODEL,
        top_k=None,
        device=-1,
    )

    print(
        "[NSSS] Toxicity model loaded successfully.",
        flush=True,
    )

    return model


# ============================================================
# Semantic Model - E5
# ============================================================

@lru_cache(maxsize=1)
def semantic_model():
    import torch
    from sentence_transformers import SentenceTransformer

    torch.set_num_threads(2)

    print(
        "[NSSS] Loading semantic model: multilingual-e5-small...",
        flush=True,
    )

    model = SentenceTransformer(
        SEMANTIC_MODEL,
        device="cpu",
    )

    print(
        "[NSSS] Semantic model loaded successfully.",
        flush=True,
    )

    return model


# ============================================================
# Toxicity Analysis
# ============================================================

def toxicity_result(text: str):
    clf = toxicity_model()

    tok = clf.tokenizer

    token_ids = tok.encode(
        text,
        add_special_tokens=False,
    )

    # Screen every part of the text using overlapping chunks.

    chunks = [
        token_ids[i:i + 112]
        for i in range(0, len(token_ids), 96)
    ] or [[]]

    max_toxic = 0.0

    for chunk in chunks:
        segment = tok.decode(
            chunk,
            skip_special_tokens=True,
        )

        result = clf(
            segment,
            truncation=True,
            max_length=128,
        )

        rows = (
            result[0]
            if result and isinstance(result[0], list)
            else result
        )

        for row in rows:
            label = str(row["label"]).lower()

            if label == "toxic":
                max_toxic = max(
                    max_toxic,
                    float(row["score"]),
                )

    return max_toxic


# ============================================================
# Semantic Similarity
# ============================================================

def semantic_similarity(a: str, b: str):
    model = semantic_model()

    embeddings = model.encode(
        [
            "query: " + a,
            "query: " + b,
        ],
        normalize_embeddings=True,
    )

    return float(
        embeddings[0] @ embeddings[1]
    )


# ============================================================
# Deterministic Suggestions
# ============================================================

def deterministic_suggestion(title, description, ids):
    """
    Conservative fallback.

    Never invent requirements or paraphrase descriptions.
    """

    if len(ids) == 1:
        key = ids[0]

        if key == "DESIGN_LOGO" and re.search(
            r"(?i)\b(logo|لوغو|لوجو)\b",
            title,
        ):
            return "تصميم شعار", description

        if key == "CS_ALGORITHMS" and re.search(
            r"(?i)algorthm|القورثم|الالغوريثم",
            title,
        ):
            return "شرح الخوارزميات", description

    return title, description


# ============================================================
# Main NSSS Analysis
# ============================================================

def analyze_draft(
    draft: Draft,
    *,
    require_models: bool = True,
):
    title = normalize(draft.title)
    description = normalize(draft.description)

    problems = []

    # --------------------------------------------------------
    # 1. Detect meaningless text
    # --------------------------------------------------------

    if garbage(title) or garbage(description):
        return {
            "status": "needs_edit",
            "publishable": False,

            "original": {
                "title": title,
                "description": description,
            },

            "suggested": None,
            "canonical_concepts": [],

            "issues": [
                {
                    "code": "MEANINGLESS_TEXT",
                    "message": "يرجى كتابة عنوان ووصف مفهومين.",
                }
            ],

            "model_status": {
                "toxicity": "skipped",
                "semantic": "skipped",
                "rewrite": "unavailable",
            },
        }

    # --------------------------------------------------------
    # 2. Extract canonical concepts
    # --------------------------------------------------------

    title_ids = concepts(title)
    desc_ids = concepts(description)

    all_ids = sorted(
        set(title_ids + desc_ids)
    )

    model_status = {
        "toxicity": "unavailable",
        "semantic": "unavailable",
        "rewrite": "deterministic",
    }

    # --------------------------------------------------------
    # 3. Mandatory toxicity screening
    # --------------------------------------------------------

    try:
        risk = max(
            toxicity_result(title),
            toxicity_result(description),
        )

        model_status["toxicity"] = "completed"

    except Exception as exc:
        print(
            f"[NSSS] Toxicity analysis failed: {exc}",
            flush=True,
        )

        if require_models:
            raise HTTPException(
                status_code=503,
                detail="NSSS toxicity model unavailable",
            ) from exc

        risk = None

    if (
        risk is not None
        and risk >= float(
            os.getenv(
                "NSSS_TOXIC_REVIEW_THRESHOLD",
                "0.80",
            )
        )
    ):
        problems.append(
            {
                "code": "TOXICITY_REVIEW",
                "message":
                    "يحتاج النص إلى مراجعة للتأكد من ملاءمته.",
            }
        )

    # --------------------------------------------------------
    # 4. Semantic similarity
    # --------------------------------------------------------

    try:
        similarity = semantic_similarity(
            title,
            description,
        )

        model_status["semantic"] = "completed"

    except Exception as exc:
        print(
            f"[NSSS] Semantic analysis failed: {exc}",
            flush=True,
        )

        if require_models:
            raise HTTPException(
                status_code=503,
                detail="NSSS semantic model unavailable",
            ) from exc

        similarity = None

    # --------------------------------------------------------
    # 5. Detect category conflicts
    # --------------------------------------------------------

    a = {
        FAMILIES[x]
        for x in title_ids
        if x in FAMILIES
    }

    b = {
        FAMILIES[x]
        for x in desc_ids
        if x in FAMILIES
    }

    incompatible = bool(
        a and b and a.isdisjoint(b)
    )

    if incompatible:
        problems.append(
            {
                "code": "CATEGORY_CONFLICT",
                "message":
                    "العنوان والوصف يشيران إلى نوعين مختلفين من الخدمات.",
            }
        )

    # --------------------------------------------------------
    # 6. Generate conservative suggestions
    # --------------------------------------------------------

    rewrite_title, rewrite_desc = deterministic_suggestion(
        title,
        description,
        all_ids,
    )

    if rewrite_title != title:
        problems.append(
            {
                "code": "SUGGESTED_TITLE",
                "message":
                    "يوجد عنوان أوضح يمكنك اعتماده.",
            }
        )

    # --------------------------------------------------------
    # 7. Publication safety
    # --------------------------------------------------------

    publishable = (
        not any(
            issue["code"] in (
                "TOXICITY_REVIEW",
                "CATEGORY_CONFLICT",
            )
            for issue in problems
        )
        and risk is not None
        and similarity is not None
    )

    # --------------------------------------------------------
    # 8. Classification and skills
    # --------------------------------------------------------

    intelligence = classify_request(
        title,
        description,
    )

    # --------------------------------------------------------
    # 9. Final response
    # --------------------------------------------------------

    return {
        **intelligence,

        "status": (
            "needs_review"
            if not publishable
            else "needs_confirmation"
        ),

        "publishable": publishable,

        "original": {
            "title": title,
            "description": description,
        },

        "suggested": {
            "title": rewrite_title,
            "description": rewrite_desc,
        },

        "canonical_concepts": all_ids,

        "issues": problems,

        "semantic_similarity": similarity,

        "model_status": model_status,

        "requires_user_confirmation": True,
    }