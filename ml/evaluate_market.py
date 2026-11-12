"""Offline evaluation on independently reviewed Nashmi requests.

Usage: python -m ml.evaluate_market --gold path/to/human_labeled_requests.csv
Columns: title,description,category,skills (skills separated by semicolons).
No synthetic benchmark is presented as a production accuracy measurement.
"""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from ml.service.market_intelligence import classify_request

CATEGORIES=['برمجة','تصميم','ترجمة','شرح دروس','تحرير','أبحاث','أخرى']


def category_metrics(gold:list[str],pred:list[str])->dict:
    if not gold or len(gold)!=len(pred):raise ValueError('Gold predictions must be aligned and nonempty')
    result={}
    for label in CATEGORIES:
        tp=sum(a==label and b==label for a,b in zip(gold,pred))
        fp=sum(a!=label and b==label for a,b in zip(gold,pred))
        fn=sum(a==label and b!=label for a,b in zip(gold,pred))
        precision=tp/(tp+fp) if tp+fp else 0
        recall=tp/(tp+fn) if tp+fn else 0
        result[label]={'support':sum(a==label for a in gold),'precision':round(precision,4),
                       'recall':round(recall,4),'f1':round(2*precision*recall/(precision+recall),4) if precision+recall else 0}
    active=[x for x in result.values() if x['support']>0]
    return {'accuracy':round(sum(a==b for a,b in zip(gold,pred))/len(gold),4),
            'macro_f1_observed_classes':round(sum(x['f1'] for x in active)/len(active),4),
            'per_class':result,'evaluated_examples':len(gold),
            'warning':'Scores are only as representative as the independently labeled holdout set'}


def extraction_metrics(true:list[set[str]],pred:list[set[str]])->dict:
    tp=sum(len(a&b) for a,b in zip(true,pred))
    fp=sum(len(b-a) for a,b in zip(true,pred))
    fn=sum(len(a-b) for a,b in zip(true,pred))
    precision=tp/(tp+fp) if tp+fp else 0
    recall=tp/(tp+fn) if tp+fn else 0
    return {'precision':round(precision,4),'recall':round(recall,4),
            'micro_f1':round(2*precision*recall/(precision+recall),4) if precision+recall else 0,
            'true_positive':tp,'false_positive':fp,'false_negative':fn}


def evaluate(path:Path)->dict:
    gold_cat,pred_cat,gold_skills,pred_skills=[],[],[],[]
    with path.open(encoding='utf-8-sig',newline='') as f:
        rows=csv.DictReader(f)
        required={'title','description','category','skills'}
        if not required.issubset(set(rows.fieldnames or [])):raise ValueError('CSV missing columns: '+', '.join(sorted(required)))
        for row in rows:
            if row['category'] not in CATEGORIES:raise ValueError('Unknown reference category')
            result=classify_request(row['title'],row['description'])
            gold_cat.append(row['category']);pred_cat.append(result['suggested_category'])
            gold_skills.append({x.strip().casefold() for x in row['skills'].split(';') if x.strip()})
            pred_skills.append({x.casefold() for x in result['suggested_skills']})
    if len(gold_cat)<1:raise ValueError('Empty evaluation file')
    return {'classification':category_metrics(gold_cat,pred_cat),
            'skill_extraction':extraction_metrics(gold_skills,pred_skills),
            'benchmark_source':str(path),'quality_note':'Do not claim independent validation unless labels were created independently'}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--gold',type=Path,required=True)
    args=parser.parse_args();print(json.dumps(evaluate(args.gold),ensure_ascii=False,indent=2))
