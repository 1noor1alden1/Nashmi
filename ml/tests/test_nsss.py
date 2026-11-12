from ml.service.nsss import Draft, analyze_draft, concepts, garbage, normalize


def test_known_misspellings():
    assert 'CS_ALGORITHMS' in concepts('بدي شرح algorthm')
    assert 'CS_ALGORITHMS' in concepts('شرح القورثم')
    assert 'DESIGN_LOGO' in concepts('بدي لوغو للمشروع')


def test_garbage_and_technical_words():
    assert garbage('asdjkhqwe')
    assert garbage('!!!!!!!!!!!!')
    assert not garbage('شرح C++ والـ Node.js')


def test_conflict_with_stubbed_models(monkeypatch):
    import ml.service.nsss as nsss
    monkeypatch.setattr(nsss,'toxicity_result',lambda _:0.01)
    monkeypatch.setattr(nsss,'semantic_similarity',lambda _a,_b:0.3)
    result=analyze_draft(Draft(title='تصميم شعار',description='أحتاج شرح SQL وقواعد البيانات'))
    assert not result['publishable']
    assert any(x['code']=='CATEGORY_CONFLICT' for x in result['issues'])


def test_good_example_with_stubbed_models(monkeypatch):
    import ml.service.nsss as nsss
    monkeypatch.setattr(nsss,'toxicity_result',lambda _:0.01)
    monkeypatch.setattr(nsss,'semantic_similarity',lambda _a,_b:0.8)
    result=analyze_draft(Draft(title='بدي شرح algorthm',description='بدي افهم ال sorting و big o مع أمثلة بسيطة'))
    assert result['publishable']
    assert 'CS_ALGORITHMS' in result['canonical_concepts']


def test_models_fail_closed(monkeypatch):
    import pytest
    import ml.service.nsss as nsss
    from fastapi import HTTPException
    def fail(_): raise OSError('offline')
    monkeypatch.setattr(nsss,'toxicity_result',fail)
    with pytest.raises(HTTPException) as exc:
        analyze_draft(Draft(title='شرح بايثون',description='أحتاج شرح أساسيات Python من الصفر'))
    assert exc.value.status_code==503
