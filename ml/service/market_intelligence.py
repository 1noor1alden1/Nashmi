"""Transparent, auditable Arabic/English baseline extraction for Nashmi.

This is a dictionary + intent classifier, NOT a trained model. The existing E5
encoder is used separately for optional semantic retrieval. User corrections
must be retained so a supervised model can eventually replace this baseline.
"""
import re
import unicodedata

SKILLS = {
    "Python": ["python", "بايثون"],
    "Java": ["java", "جافا"],
    "JavaScript": ["javascript", "جافاسكربت", "جافا سكربت"],
    "React": ["react", "رياكت", "ريأكت"],
    "React Native": ["react native"],
    "HTML": ["html"],
    "CSS": ["css"],
    "Django": ["django", "جانغو"],
    "SQL": ["sql", "اس كيو ال"],
    "Databases": ["database", "databases", "قواعد البيانات", "قاعدة بيانات"],
    "Algorithms": ["algorithms", "algorithm", "خوارزميات", "الخوارزميات", "خوارزميه", "خورازميات"],
    "Data Structures": ["data structures", "هياكل البيانات"],
    "Sorting Algorithms": ["sorting", "merge sort", "quick sort", "خوارزميات الفرز", "خوارزميات الترتيب"],
    "Graph Algorithms": ["dijkstra", "bfs", "dfs", "graph theory", "خوارزميات الرسم"],
    "Machine Learning": ["machine learning", "تعلم الاله", "تعلم الآلة"],
    "Data Analysis": ["pandas", "تحليل بيانات", "تحليل البيانات"],
    "Graphic Design": ["graphic design", "تصميم جرافيك", "جرافيك", "فوتوشوب", "photoshop"],
    "Logo Design": ["logo", "لوجو", "لوغو", "شعار"],
    "PowerPoint": ["powerpoint", "بوربوينت", "عرض تقديمي"],
    "Video Editing": ["مونتاج", "تحرير فيديو", "video editing"],
    "Translation": ["ترجمة", "ترجم", "translation"],
    "Academic Writing": ["كتابة بحث", "كتابة مقال", "تدقيق لغوي"],
    "Mathematics": ["رياضيات", "mathematics", "calculus", "تفاضل", "تكامل"],
}

TEACH = ["شرح", "يشرح", "اشرح", "يفهمني", "فهمني", "تعليم", "مدرس", "معلم", "دروس", "تدريس", "درس", "امتحان", "محاضرة", "محاضره", "tutor", "teach", "explain"]
BUILD = ["برمج", "تطوير", "اصلاح", "إصلاح", "كود", "code", "api", "موقع", "تطبيق", "bug", "خطأ", "اخطاء", "أخطاء", "تنفيذ", "إنشاء"]
DESIGN = ["تصميم", "شعار", "لوجو", "بوستر", "logo", "design", "فوتوشوب", "illustrator"]
TRANSLATE = ["ترجمة", "ترجم", "ترجمه", "translate", "translation"]
RESEARCH = ["بحث علمي", "مراجعة أدبيات", "دراسة علمية", "جمع مراجع", "research", "بحث أكاديمي"]
EDIT = ["تدقيق", "تحرير", "صياغة", "مونتاج", "تحرير فيديو", "مراجعة لغوية"]


def norm(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).casefold()
    text = re.sub(r"[\u064b-\u065fـ]", "", text)
    # Arabic conjunctions often attach directly to Latin skill names: وPython.
    text = re.sub(r"(?<=[\u0600-\u06ff])(?=[a-z])", " ", text)
    text = re.sub(r"(?<=[a-z])(?=[\u0600-\u06ff])", " ", text)
    return text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي")


def has(text: str, phrase: str) -> bool:
    key = re.escape(norm(phrase))
    return bool(re.search(r"(?<!\w)" + key + r"(?!\w)", text))


def extract_skills(text: str) -> list[str]:
    t = norm(text)
    found = [skill for skill, variants in SKILLS.items() if any(has(t, v) for v in variants)]
    # Parent skills support discovery while preserving more specific exact terms.
    if any(x in found for x in ("Sorting Algorithms", "Graph Algorithms")) and "Algorithms" not in found:
        found.insert(0, "Algorithms")
    return found[:20]


def classify_request(title: str, description: str) -> dict:
    text = norm(title + " " + description)
    skills = extract_skills(title + " " + description)
    votes = {
        "شرح دروس": 4 * sum(has(text, x) for x in TEACH),
        "برمجة": 3 * sum(has(text, x) for x in BUILD),
        "تصميم": 3 * sum(has(text, x) for x in DESIGN),
        "ترجمة": 5 * sum(has(text, x) for x in TRANSLATE),
        "أبحاث": 5 * sum(has(text, x) for x in RESEARCH),
        "تحرير": 3 * sum(has(text, x) for x in EDIT),
    }
    if "Logo Design" in skills or "Graphic Design" in skills: votes["تصميم"] += 3
    if "Video Editing" in skills: votes["تحرير"] += 4
    if "Translation" in skills: votes["ترجمة"] += 4
    programming = {"React", "Django", "JavaScript", "HTML", "CSS", "React Native"}
    if any(skill in skills for skill in programming): votes["برمجة"] += 2
    # Teaching intent wins in requests to teach programming, not build it.
    if votes["شرح دروس"] and any(x in skills for x in ("Python", "Algorithms", "Java", "Data Structures")):
        votes["شرح دروس"] += 3
    top = sorted(votes, key=lambda k: (-votes[k], k))
    winner = top[0] if votes[top[0]] > 0 else "أخرى"
    second = votes[top[1]] if len(top) > 1 else 0
    ambiguous = votes[top[0]] == 0 or (second > 0 and votes[top[0]] <= second + 2)
    return {"suggested_category": winner, "suggested_skills": skills,
            "needs_category_review": ambiguous,
            "category_method": "intent-rules-v1", "skills_method": "curated-skill-lexicon-v1"}
