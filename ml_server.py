import os
import pickle
import json
import uuid
import re
from flask import Flask, request, jsonify
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import datetime
import requests

app = Flask(__name__)

# ==================== TRAFFIC ML MODEL TRAINING ====================
print('[ML Helper] Training dynamic Traffic Density Model (Random Forest)...')
X_train = []
y_train = []

for hour in range(24):
    for day in range(7):
        is_weekday = 1 if day < 5 else 0
        
        # Motorway (3)
        if is_weekday and (8 <= hour <= 10 or 17 <= hour <= 19):
            density = 2  # High
        elif is_weekday and (7 <= hour <= 21):
            density = 1  # Medium
        else:
            density = 0  # Low
        X_train.append([hour, day, 3])
        y_train.append(density)
        
        # Primary (2)
        if is_weekday and (8 <= hour <= 10 or 17 <= hour <= 19):
            density = 2
        elif 7 <= hour <= 22:
            density = 1
        else:
            density = 0
        X_train.append([hour, day, 2])
        y_train.append(density)
        
        # Secondary (1)
        if (8 <= hour <= 11 or 17 <= hour <= 20):
            density = 1
        else:
            density = 0
        X_train.append([hour, day, 1])
        y_train.append(density)
        
        # Residential (0)
        density = 0
        X_train.append([hour, day, 0])
        y_train.append(density)

traffic_model = RandomForestClassifier(n_estimators=50, random_state=42)
traffic_model.fit(X_train, y_train)
print('[ML Helper] Traffic Density Model trained successfully.')

# ==================== ML MODEL LOADING ====================
ML_MODEL = None
ML_SYMPTOM_COLUMNS = None
ML_DISEASE_SPEC_MAP = {}
ML_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ml')

try:
    with open(os.path.join(ML_DIR, 'model.pkl'), 'rb') as f:
        ML_MODEL = pickle.load(f)
    with open(os.path.join(ML_DIR, 'symptom_columns.pkl'), 'rb') as f:
        ML_SYMPTOM_COLUMNS = pickle.load(f)
    with open(os.path.join(ML_DIR, 'disease_spec_map.json'), 'r') as f:
        ML_DISEASE_SPEC_MAP = json.load(f)
    print(f'[ML Helper] Loaded: {len(ML_SYMPTOM_COLUMNS)} symptoms, {len(ML_DISEASE_SPEC_MAP)} diseases')
except Exception as e:
    print(f'[ML Helper] Model loading failed: {e}')

# Diseases considered severe/emergency
SEVERE_DISEASES = {'Heart Attack', 'Pneumonia', 'Tuberculosis', 'Paralysis', 'Epilepsy', 'Dengue', 'Malaria'}
# Diseases considered mild
MILD_DISEASES = {'Common Cold', 'Flu', 'Acne', 'Fungal Infection', 'GERD', 'Insomnia'}

SYMPTOM_SYNONYMS = {
    'fever': ['fever', 'temperature', 'feverish', 'hot body', 'warm body', 'pyrexia'],
    'high_fever': ['high fever', 'burning up', 'very high temperature', 'high temperature'],
    'mild_fever': ['mild fever', 'low grade fever', 'slight temperature', 'low temp'],
    'chills': ['chills', 'shivery', 'shivering', 'cold shivers'],
    'sweating': ['sweating', 'sweat', 'excessive sweat'],
    'fatigue': ['fatigue', 'tired', 'exhausted', 'weary', 'lethargic', 'energy loss', 'sleepy'],
    'weakness': ['weakness', 'weak', 'feeling weak', 'no strength'],
    'weight_loss': ['weight loss', 'losing weight', 'lost weight', 'slimming down'],
    'weight_gain': ['weight gain', 'gained weight', 'putting on weight'],
    'body_ache': ['body ache', 'body hurts', 'aching all over', 'body aches'],
    'loss_of_appetite': ['loss of appetite', 'not hungry', 'unable to eat', 'poor appetite'],
    'dehydration': ['dehydration', 'dehydrated', 'very thirsty', 'dry mouth'],
    'headache': ['headache', 'head ache', 'pain in head', 'head hurts', 'head pain'],
    'severe_headache': ['severe headache', 'migraine', 'splitting headache', 'throbbing headache'],
    'dizziness': ['dizziness', 'dizzy', 'giddy', 'lightheaded', 'spinning head', 'vertigo'],
    'fainting': ['fainting', 'fainted', 'passed out', 'blackout', 'loss of consciousness'],
    'confusion': ['confusion', 'confused', 'disoriented', 'brain fog'],
    'seizures': ['seizures', 'seizure', 'fits', 'convulsions'],
    'tremors': ['tremors', 'tremor', 'shaking hands', 'shaky'],
    'numbness': ['numbness', 'numb', 'loss of sensation', 'cannot feel'],
    'tingling': ['tingling', 'pins and needles', 'prickly sensation'],
    'blurred_vision': ['blurred vision', 'blurry eyes', 'cannot see clearly'],
    'sensitivity_to_light': ['light sensitivity', 'sensitive to light', 'photophobia'],
    'cough': ['cough', 'coughing', 'coughs'],
    'dry_cough': ['dry cough', 'tickling cough'],
    'productive_cough': ['productive cough', 'cough with phlegm', 'cough with mucus', 'wet cough'],
    'sneezing': ['sneezing', 'sneeze', 'sneezed'],
    'runny_nose': ['runny nose', 'nose running', 'rhinorrhea'],
    'nasal_congestion': ['nasal congestion', 'blocked nose', 'stuffy nose', 'nose block'],
    'shortness_of_breath': ['short of breath', 'breathless', 'shortness of breath', 'difficulty breathing', 'gasping', 'dyspnea'],
    'wheezing': ['wheezing', 'wheeze', 'whistling breath'],
    'chest_tightness': ['chest tightness', 'tight chest', 'heavy chest'],
    'rapid_breathing': ['rapid breathing', 'breathing fast', 'hyperventilating'],
    'chest_pain': ['chest pain', 'pain in chest', 'chest hurts', 'sharp pain in chest', 'angina'],
    'palpitations': ['palpitations', 'racing heart', 'heart racing', 'pounding heart', 'fluttering heart'],
    'high_blood_pressure': ['high blood pressure', 'hypertension', 'bp is high'],
    'irregular_heartbeat': ['irregular heartbeat', 'arrhythmia', 'heart skipped a beat'],
    'swollen_legs': ['swollen legs', 'swelling in legs', 'swollen ankles', 'leg swelling'],
    'nausea': ['nausea', 'nauseous', 'sick to stomach', 'queasy', 'feeling sick'],
    'vomiting': ['vomiting', 'throw up', 'vomit', 'puke', 'throwing up', 'threw up'],
    'diarrhea': ['diarrhea', 'loose motion', 'loose stools', 'watery stools'],
    'constipation': ['constipation', 'constipated', 'hard stools', 'difficulty passing stool'],
    'stomach_pain': ['stomach pain', 'tummy ache', 'belly pain', 'pain in stomach', 'abdominal pain'],
    'abdominal_cramps': ['abdominal cramps', 'stomach cramps', 'cramps in belly'],
    'bloating': ['bloating', 'bloated', 'gassy', 'gas in stomach'],
    'acidity': ['acidity', 'acidic stomach', 'acid reflux'],
    'heartburn': ['heartburn', 'burning in chest', 'indigestion'],
    'blood_in_stool': ['blood in stool', 'bloody stool', 'rectal bleeding'],
    'loss_of_taste': ['loss of taste', 'cannot taste', 'no taste'],
    'excessive_hunger': ['excessive hunger', 'always hungry', 'increased appetite', 'polyphagia'],
    'excessive_thirst': ['excessive thirst', 'always thirsty', 'polydipsia'],
    'skin_rash': ['rash', 'skin rash', 'spots on skin', 'breakout'],
    'itching': ['itching', 'itchy', 'scratchy', 'pruritus'],
    'redness': ['redness', 'red skin', 'inflamed skin'],
    'dry_skin': ['dry skin', 'flaky skin', 'chapped skin'],
    'pimples': ['pimples', 'pimple', 'acne', 'zits'],
    'blisters': ['blisters', 'blister', 'watery bumps'],
    'skin_peeling': ['skin peeling', 'peeling skin', 'flaking skin'],
    'dark_patches': ['dark patches', 'pigmentation', 'dark spots'],
    'swelling': ['swelling', 'swollen', 'edema'],
    'bruising': ['bruising', 'bruise', 'bruises', 'black and blue'],
    'yellowish_skin': ['yellow skin', 'yellowish skin', 'yellow eyes', 'jaundice'],
    'joint_pain': ['joint pain', 'pain in joints', 'aching joints', 'sore joints'],
    'muscle_pain': ['muscle pain', 'myalgia', 'sore muscles', 'muscle aches'],
    'back_pain': ['back pain', 'backache', 'pain in back', 'lower back pain'],
    'neck_pain': ['neck pain', 'stiff neck', 'pain in neck'],
    'knee_pain': ['knee_pain', 'pain in knee', 'knee hurts'],
    'stiffness': ['stiffness', 'stiff joints', 'stiff body'],
    'swollen_joints': ['swollen joints', 'joint swelling'],
    'difficulty_walking': ['difficulty walking', 'unable to walk', 'limping', 'trouble walking'],
    'bone_pain': ['bone pain', 'aching bones'],
    'painful_urination': ['painful urination', 'burning urination', 'dysuria'],
    'frequent_urination': ['frequent urination', 'peeing a lot', 'urinating often'],
    'blood_in_urine': ['blood in urine', 'bloody urine', 'hematuria'],
    'dark_urine': ['dark urine', 'brown urine'],
    'lower_back_pain_kidney': ['kidney pain', 'flank pain', 'lower back pain kidney'],
    'eye_pain': ['eye pain', 'sore eyes', 'pain in eyes'],
    'red_eyes': ['red eyes', 'bloodshot eyes', 'pink eye'],
    'watery_eyes': ['watery eyes', 'tearing eyes', 'excessive tears'],
    'eye_discharge': ['eye discharge', 'discharge from eyes', 'crusty eyes'],
    'vision_problems': ['vision problems', 'blurred vision', 'double vision'],
    'sore_throat': ['sore throat', 'throat pain', 'throat hurts', 'pharyngitis'],
    'difficulty_swallowing': ['difficulty swallowing', 'painful swallowing', 'dysphagia'],
    'ear_pain': ['ear pain', 'earache', 'pain in ear'],
    'hearing_loss': ['hearing loss', 'deafness', 'cannot hear'],
    'sinus_pressure': ['sinus pressure', 'congestion in face', 'forehead pain'],
    'snoring': ['snoring', 'snore'],
    'anxiety': ['anxiety', 'anxious', 'nervous', 'panic'],
    'depression_mood': ['depression', 'depressed', 'feeling down', 'sadness', 'sad'],
    'mood_swings': ['mood swings', 'moody', 'emotional swings'],
    'insomnia_symptom': ['insomnia', 'cannot sleep', 'trouble sleeping', 'sleeplessness'],
    'irritability': ['irritability', 'irritable', 'easily annoyed'],
    'panic_attacks': ['panic attacks', 'panic attack', 'sudden fear'],
    'loss_of_interest': ['loss of interest', 'no motivation', 'anhedonia'],
    'difficulty_concentrating': ['difficulty concentrating', 'cannot focus', 'trouble concentrating'],
    'irregular_periods': ['irregular periods', 'missed periods', 'periods late'],
    'excessive_hair_growth': ['excessive hair growth', 'hirsutism'],
    'hair_loss': ['hair loss', 'balding', 'hair thinning', 'alopecia'],
    'hot_flashes': ['hot flashes', 'hot flushes'],
    'cold_intolerance': ['cold intolerance', 'always feeling cold'],
    'swollen_lymph_nodes': ['swollen lymph nodes', 'swollen glands', 'nodes in neck'],
    'night_sweats': ['night sweats', 'sweating at night'],
    'muscle_cramps': ['muscle cramps', 'spasms', 'charley horse'],
    'pale_skin': ['pale skin', 'pallor', 'white skin'],
    'brittle_nails': ['brittle nails', 'cracked nails'],
    'mouth_ulcers': ['mouth ulcers', 'canker sores', 'sores in mouth'],
    'bad_breath': ['bad breath', 'halitosis']
}

def parse_symptoms_from_text(text):
    text_lower = text.lower()
    matched = []
    for symptom_id, synonyms in SYMPTOM_SYNONYMS.items():
        for syn in synonyms:
            pattern = r'\b' + re.escape(syn) + r'\b'
            if re.search(pattern, text_lower):
                matched.append(symptom_id)
                break
    return matched

@app.route('/api/ml-symptoms', methods=['GET'])
def api_ml_symptoms():
    if not ML_SYMPTOM_COLUMNS:
        return jsonify({'symptoms': []})
    symptoms = []
    for s in ML_SYMPTOM_COLUMNS:
        display = s.replace('_', ' ').title()
        symptoms.append({'id': s, 'name': display})
    return jsonify({'symptoms': symptoms})

@app.route('/api/ml-parse-text', methods=['POST'])
def api_ml_parse_text():
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    if not text:
        return jsonify({'symptoms': []})
    matched = parse_symptoms_from_text(text)
    return jsonify({'symptoms': matched})

@app.route('/api/ml-predict', methods=['POST'])
def api_ml_predict():
    if not ML_MODEL or not ML_SYMPTOM_COLUMNS:
        return jsonify({'error': 'ML model not loaded on helper server'}), 500

    data = request.get_json()
    if not data or 'symptoms' not in data:
        return jsonify({'error': 'No symptoms provided'}), 400

    selected_symptoms = data['symptoms']
    if not isinstance(selected_symptoms, list) or len(selected_symptoms) < 1:
        return jsonify({'error': 'Please select at least 1 symptom'}), 400

    # Build feature vector using pandas
    import pandas as pd
    feature_vector = pd.DataFrame([[0] * len(ML_SYMPTOM_COLUMNS)], columns=ML_SYMPTOM_COLUMNS)
    valid_count = 0
    for symptom in selected_symptoms:
        s_id = symptom.lower().replace(' ', '_')
        if s_id in ML_SYMPTOM_COLUMNS:
            feature_vector[s_id] = 1
            valid_count += 1

    if valid_count == 0:
        return jsonify({'error': 'None of the selected symptoms match our model'}), 400

    # Prediction calculations
    prediction = ML_MODEL.predict(feature_vector)[0]
    probabilities = ML_MODEL.predict_proba(feature_vector)[0]
    classes = ML_MODEL.classes_

    max_prob_idx = probabilities.argmax()
    confidence = float(round(probabilities[max_prob_idx] * 100, 1))

    top_indices = probabilities.argsort()[::-1][:3]
    all_predictions = []
    for idx in top_indices:
        if probabilities[idx] > 0.01:
            all_predictions.append({
                'disease': str(classes[idx]),
                'probability': float(round(probabilities[idx] * 100, 1)),
                'specialization': ML_DISEASE_SPEC_MAP.get(str(classes[idx]), 'General Physician')
            })

    # Determine risk level
    disease = prediction
    is_emergency = False
    if disease in SEVERE_DISEASES and confidence > 40:
        risk_level = 'High'
        risk_color = '#ef4444'
        is_emergency = True
    elif disease in MILD_DISEASES or confidence < 35:
        risk_level = 'Low'
        risk_color = '#22c55e'
    else:
        risk_level = 'Medium'
        risk_color = '#f59e0b'

    return jsonify({
        'disease': disease,
        'confidence': confidence,
        'all_predictions': all_predictions,
        'risk_level': risk_level,
        'risk_color': risk_color,
        'is_emergency': is_emergency,
        'specialization': ML_DISEASE_SPEC_MAP.get(disease, 'General Physician')
    })

@app.route('/api/ml-transcribe-audio', methods=['POST'])
def api_ml_transcribe_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Empty file'}), 400

    temp_path = f"temp_{uuid.uuid4().hex}.wav"
    file.save(temp_path)

    try:
        import speech_recognition as sr
        r = sr.Recognizer()
        with sr.AudioFile(temp_path) as source:
            audio_data = r.record(source)
            text = r.recognize_google(audio_data)

        os.remove(temp_path)
        return jsonify({'text': text})
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': f'Transcription failed: {str(e)}'}), 500

@app.route('/api/ml-traffic-predict', methods=['POST'])
def api_ml_traffic_predict():
    data = request.get_json() or {}
    user_lat = data.get('user_lat')
    user_lng = data.get('user_lng')
    dest_lat = data.get('dest_lat')
    dest_lng = data.get('dest_lng')

    if not all([user_lat, user_lng, dest_lat, dest_lng]):
        return jsonify({'error': 'Missing coordinates'}), 400

    min_lat = min(user_lat, dest_lat) - 0.01
    max_lat = max(user_lat, dest_lat) + 0.01
    min_lng = min(user_lng, dest_lng) - 0.01
    max_lng = max(user_lng, dest_lng) + 0.01

    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json][timeout:15];
    way({min_lat},{min_lng},{max_lat},{max_lng})[highway~"motorway|primary|secondary|tertiary|residential"];
    out geom;
    """
    
    try:
        response = requests.post(overpass_url, data={'data': overpass_query}, timeout=10)
        osm_data = response.json()
    except Exception as e:
        print(f"[Traffic ML] Overpass API failed: {e}")
        osm_data = {'elements': []}

    roads = []
    now = datetime.datetime.now()
    hour = now.hour
    day = now.weekday()

    road_type_mapping = {
        'motorway': 3, 'motorway_link': 3,
        'primary': 2, 'primary_link': 2,
        'secondary': 1, 'secondary_link': 1,
        'tertiary': 1, 'tertiary_link': 1,
        'residential': 0, 'living_street': 0
    }

    elements = osm_data.get('elements', [])
    if not elements:
        # Fallback simulated Pune streets connecting the coordinates
        fallback_streets = [
            {"name": "Senapati Bapat Road", "type": "primary", "coords": [[user_lat, user_lng], [user_lat - 0.003, user_lng - 0.006], [dest_lat, dest_lng]]},
            {"name": "Ganeshkhind Road", "type": "motorway", "coords": [[user_lat, user_lng], [user_lat + 0.005, user_lng - 0.003], [dest_lat, dest_lng]]},
            {"name": "Karve Road", "type": "secondary", "coords": [[user_lat, user_lng], [user_lat - 0.001, user_lng - 0.008], [dest_lat, dest_lng]]},
            {"name": "FC Road", "type": "residential", "coords": [[user_lat, user_lng], [user_lat - 0.004, user_lng - 0.001], [dest_lat, dest_lng]]}
        ]
        for idx, street in enumerate(fallback_streets):
            r_type = street["type"]
            r_type_encoded = road_type_mapping.get(r_type, 0)
            
            density_class = int(traffic_model.predict([[hour, day, r_type_encoded]])[0])
            density_probs = traffic_model.predict_proba([[hour, day, r_type_encoded]])[0]
            density_pct = float(round(density_probs[density_class] * 100, 1))

            density_labels = {0: "Low", 1: "Medium", 2: "High"}
            density_colors = {0: "#22c55e", 1: "#f59e0b", 2: "#ef4444"}

            roads.append({
                'id': f"sim_{idx}",
                'name': street["name"],
                'type': r_type,
                'coordinates': street["coords"],
                'density': density_labels[density_class],
                'density_score': float(density_class + (100 - density_pct)/200.0),
                'density_color': density_colors[density_class],
                'confidence': density_pct
            })
    else:
        processed_count = 0
        for element in elements:
            if 'geometry' in element and element.get('tags', {}).get('name'):
                tags = element.get('tags', {})
                name = tags.get('name')
                r_type = tags.get('highway', 'residential')
                r_type_encoded = road_type_mapping.get(r_type, 0)

                geom = [[pt['lat'], pt['lon']] for pt in element['geometry']]
                
                density_class = int(traffic_model.predict([[hour, day, r_type_encoded]])[0])
                density_probs = traffic_model.predict_proba([[hour, day, r_type_encoded]])[0]
                density_pct = float(round(density_probs[density_class] * 100, 1))

                density_labels = {0: "Low", 1: "Medium", 2: "High"}
                density_colors = {0: "#22c55e", 1: "#f59e0b", 2: "#ef4444"}

                roads.append({
                    'id': str(element['id']),
                    'name': name,
                    'type': r_type,
                    'coordinates': geom,
                    'density': density_labels[density_class],
                    'density_score': float(density_class + (100 - density_pct)/200.0),
                    'density_color': density_colors[density_class],
                    'confidence': density_pct
                })
                processed_count += 1
                if processed_count >= 10:
                    break

    best_road = None
    if roads:
        best_road = min(roads, key=lambda r: r['density_score'])

    return jsonify({
        'ok': True,
        'roads': roads,
        'best_route_suggested': best_road,
        'current_time_factors': {
            'hour': hour,
            'weekday_index': day,
            'is_rush_hour': bool((8 <= hour <= 10) or (17 <= hour <= 19))
        }
    })

if __name__ == '__main__':
    # Listen on port 5001 internally
    app.run(port=5001, host='0.0.0.0')
