"""Golden examples for intent separation and multilingual skill extraction."""
import pytest
from ml.service.market_intelligence import classify_request, extract_skills

@pytest.mark.parametrize('title,description,expected', [
    ('بدي شخص يشرحلي خوارزميات الفرز', 'عندي امتحان وبدي أفهم Merge Sort وQuick Sort في Python بالتفصيل', 'شرح دروس'),
    ('محتاج إصلاح موقع React', 'صفحة تسجيل الدخول فيها bug والـ API لا يعمل وأحتاج تطوير إصلاح', 'برمجة'),
    ('تصميم لوجو لنادي طلابي', 'أحتاج تصميم شعار جميل لمشروع التخرج بألوان بسيطة', 'تصميم'),
    ('ترجمة مستند للغة العربية', 'الملف باللغة الإنجليزية وأحتاج ترجمة واضحة بدون أخطاء', 'ترجمة'),
    ('أحتاج مساعدة في موضوع ما', 'عندي مشكلة ولا أعرف ما الحل المطلوب بالضبط', 'أخرى'),
])
def test_category_intent(title, description, expected):
    assert classify_request(title, description)['suggested_category'] == expected


def test_skills_arabic_english_normalized():
    assert extract_skills('شرح خورازميات BFS و Dijkstra بلغة بايثون') == ['Python', 'Algorithms', 'Graph Algorithms']


def test_safe_no_invention():
    assert extract_skills('أحتاج مساعدة في واجب صغير') == []


def test_ambiguous_user_review():
    assert classify_request('مطلوب مساعدة بموضوع معين', 'أحتاج من يساعدني في موضوع غير واضح')['needs_category_review']
