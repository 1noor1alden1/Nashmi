"""Nashmi language intelligence (no pricing authority, no pricing model)."""
from fastapi import FastAPI
from pydantic import BaseModel, Field
from ml.service.nsss import Draft, analyze_draft, semantic_model
from ml.service.market_intelligence import extract_skills

app=FastAPI(title='Nashmi Language Intelligence',version='0.2.0')

@app.get('/health')
def health():
    return {'ok':True,'module':'nsss-search-skills','pricing_authority':False}

@app.post('/v1/semantic-services/analyze')
def analyze_semantic_service(item:Draft):
    return analyze_draft(item)

class ProfileExtractRequest(BaseModel):
    bio:str=Field(min_length=10,max_length=2000)

@app.post('/v1/skills/extract')
def extract_profile_skills(request:ProfileExtractRequest):
    return {'skills':extract_skills(request.bio),'method':'curated-skill-lexicon-v1',
            'requires_user_confirmation':True}

class SemanticRankRequest(BaseModel):
    query:str=Field(min_length=2,max_length=500)
    documents:list[str]=Field(min_length=1,max_length=150)

@app.post('/v1/semantic-search/rank')
def semantic_rank(request:SemanticRankRequest):
    model=semantic_model()
    vectors=model.encode(['query: '+request.query]+['passage: '+s[:1500] for s in request.documents],normalize_embeddings=True)
    return {'scores':[float(vectors[0]@v) for v in vectors[1:]],'method':'multilingual-e5-small'}
