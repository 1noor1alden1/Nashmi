from fastapi.testclient import TestClient
from ml.service.app import app
client=TestClient(app)

def test_health_no_pricing():
    result=client.get('/health')
    assert result.status_code==200
    assert result.json()['pricing_authority'] is False
    assert client.post('/v1/price/predict',json={}).status_code==404

def test_profile_skills_need_confirmation():
    result=client.post('/v1/skills/extract',json={'bio':'أستطيع شرح Algorithms وPython لطلاب الجامعة'})
    assert result.status_code==200
    assert result.json()['requires_user_confirmation'] is True
    assert 'Python' in result.json()['skills']
