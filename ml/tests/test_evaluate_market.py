from ml.evaluate_market import category_metrics,extraction_metrics

def test_metrics_perfect():
    data=category_metrics(['برمجة','شرح دروس'],['برمجة','شرح دروس'])
    assert data['accuracy']==1
    assert data['macro_f1_observed_classes']==1

def test_metrics_detect_errors():
    data=category_metrics(['برمجة','شرح دروس'],['شرح دروس','شرح دروس'])
    assert data['accuracy']==.5
    skill=extraction_metrics([{'python','react'}],[{'python','java'}])
    assert skill['true_positive']==1
    assert skill['false_positive']==1
    assert skill['false_negative']==1
