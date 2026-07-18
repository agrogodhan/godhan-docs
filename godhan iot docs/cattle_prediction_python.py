"""
Cattle IoT — Prediction & Learning Module (Python)

This script provides a foundation for:
- Feature extraction from cattle IoT sensor data.
- Heat detection (estrus) prediction.
- Calving prediction based on insemination date + signals.
- ML training pipeline (RandomForest as baseline).
- MongoDB integration for pulling data and storing predictions.
- Periodic retraining from newly labeled events.
- Scheduler (cron-like) for automatic retraining.
- Real-time prediction loop for continuous scoring.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from pymongo import MongoClient
import datetime
import joblib
import os
import schedule
import time

MODEL_PATH = "heat_detection_model.pkl"

# ----------------------
# 1. MongoDB Integration
# ----------------------

def get_mongo_client(uri="mongodb://localhost:27017"):
    return MongoClient(uri)

def load_data_from_mongo(client, db_name="cattle_iot", collection="sensor_data", days=30):
    db = client[db_name]
    coll = db[collection]

    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    cursor = coll.find({"timestamp": {"$gte": since}})
    df = pd.DataFrame(list(cursor))

    if not df.empty:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df

def save_predictions_to_mongo(client, db_name, collection, predictions):
    db = client[db_name]
    coll = db[collection]
    if isinstance(predictions, list):
        coll.insert_many(predictions)
    else:
        coll.insert_one(predictions)

# ----------------------
# 2. Feature Engineering
# ----------------------

def feature_engineering(df: pd.DataFrame):
    df = df.sort_values(['cattle_id', 'timestamp'])
    window = 288  # ~24h if 5-min interval
    features = []

    for cattle_id, group in df.groupby('cattle_id'):
        group = group.set_index('timestamp')

        group['activity_mag'] = np.sqrt(group['accX']**2 + group['accY']**2 + group['accZ']**2)

        group['temp_mean_24h'] = group['temp'].rolling(window).mean()
        group['temp_delta'] = group['temp'] - group['temp_mean_24h']

        group['rumination_mean_24h'] = group['rumination_events'].rolling(window).mean()
        group['rumination_delta'] = group['rumination_events'] - group['rumination_mean_24h']

        group['activity_mean_24h'] = group['activity_mag'].rolling(window).mean()
        group['activity_delta'] = group['activity_mag'] - group['activity_mean_24h']

        features.append(group)

    return pd.concat(features).dropna()

# ----------------------
# 3. Model Training & Retraining
# ----------------------

def train_heat_detection(df: pd.DataFrame, save_model=True):
    X = df[['temp_delta', 'rumination_delta', 'activity_delta']]
    y = df['label']  # 1 = in heat, 0 = not in heat

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    if save_model:
        joblib.dump(model, MODEL_PATH)
        print(f"Model saved to {MODEL_PATH}")

    return model

def load_or_train_model(df: pd.DataFrame):
    if os.path.exists(MODEL_PATH):
        print("Loading existing model...")
        return joblib.load(MODEL_PATH)
    else:
        print("No model found. Training new one...")
        return train_heat_detection(df)

# ----------------------
# 4. Calving Prediction
# ----------------------

def predict_calving_signals(df: pd.DataFrame, insemination_date: pd.Timestamp):
    expected_calving_date = insemination_date + pd.Timedelta(days=283)

    recent = df.iloc[-288:]
    
    temp_drop = recent['temp_delta'].mean() < -0.4
    rum_drop = recent['rumination_delta'].mean() < -0.3 * recent['rumination_mean_24h'].mean()
    activity_spike = recent['activity_delta'].mean() > 0.5 * recent['activity_mean_24h'].mean()

    imminent = bool(temp_drop and rum_drop and activity_spike)

    return {
        "expected_calving_date": expected_calving_date,
        "imminent_calving": imminent,
        "evaluated_at": datetime.datetime.utcnow()
    }

# ----------------------
# 5. Periodic Retraining Pipeline
# ----------------------

def retrain_model_from_db(client, db_name="cattle_iot", collection="sensor_data", days=90):
    df = load_data_from_mongo(client, db_name, collection, days)
    if df.empty or 'label' not in df.columns:
        print("No labeled data available for retraining.")
        return None
    
    df_feat = feature_engineering(df)
    return train_heat_detection(df_feat, save_model=True)

# ----------------------
# 6. Scheduler (Automatic Retraining)
# ----------------------

def schedule_retraining(client, interval_days=7):
    def job():
        print(f"Running scheduled retraining at {datetime.datetime.utcnow()}...")
        retrain_model_from_db(client, "cattle_iot", "sensor_data", days=90)

    schedule.every(interval_days).days.do(job)

    while True:
        schedule.run_pending()
        time.sleep(60)

# ----------------------
# 7. Real-Time Prediction Loop
# ----------------------

def real_time_prediction_loop(client, interval_minutes=5):
    db = client["cattle_iot"]
    coll = db["sensor_data"]

    while True:
        since = datetime.datetime.utcnow() - datetime.timedelta(minutes=interval_minutes)
        cursor = coll.find({"timestamp": {"$gte": since}})
        df = pd.DataFrame(list(cursor))

        if not df.empty:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df_feat = feature_engineering(df)

            if os.path.exists(MODEL_PATH):
                model = joblib.load(MODEL_PATH)
                X = df_feat[['temp_delta', 'rumination_delta', 'activity_delta']]
                preds = model.predict(X)

                results = []
                for i, row in df_feat.iterrows():
                    results.append({
                        "cattle_id": row['cattle_id'],
                        "timestamp": row.name,
                        "heat_prediction": int(preds[i]) if i < len(preds) else None,
                        "evaluated_at": datetime.datetime.utcnow()
                    })

                save_predictions_to_mongo(client, "cattle_iot", "heat_predictions", results)
                print(f"Saved {len(results)} predictions to MongoDB.")

        time.sleep(interval_minutes * 60)

# ----------------------
# Example Usage
# ----------------------
if __name__ == "__main__":
    client = get_mongo_client("mongodb://localhost:27017")
    df = load_data_from_mongo(client, db_name="cattle_iot", collection="sensor_data", days=30)

    if df.empty:
        print("No data found in MongoDB.")
    else:
        df_feat = feature_engineering(df)

        if 'label' in df_feat.columns:
            model = load_or_train_model(df_feat)

        # Retraining pipeline example
        retrain_model_from_db(client, "cattle_iot", "sensor_data", days=90)

        # Scheduled retraining (weekly)
        # schedule_retraining(client, interval_days=7)

        # Real-time prediction loop (every 5 min)
        # real_time_prediction_loop(client, interval_minutes=5)

        # Example: calving prediction
        sample_cattle = df_feat[df_feat['cattle_id'] == 'C123']
        if not sample_cattle.empty:
            result = predict_calving_signals(sample_cattle, pd.Timestamp("2025-01-01"))
            print(result)
            save_predictions_to_mongo(client, "cattle_iot", "calving_predictions", result)

# ----------------------
# 8. Real-time Alerting (SMS / WhatsApp / Push)
# ----------------------
# This section provides helper functions and a reference flow for sending alerts when
# heat or imminent calving is detected. Implementation options:
#  - SMS / WhatsApp via Twilio
#  - Push notifications via FCM (Firebase Cloud Messaging)
#  - Webhook to Godhan backend which then notifies via preferred channel

import requests
from twilio.rest import Client as TwilioClient

# --- Example: create alert document in MongoDB ---

def create_alert(client, cattle_id, alert_type, severity, message):
    db = client["cattle_iot"]
    alerts = db["alerts"]
    alert_doc = {
        "cattle_id": cattle_id,
        "timestamp": datetime.datetime.utcnow(),
        "type": alert_type,
        "severity": severity,
        "message": message,
        "delivered": False
    }
    res = alerts.insert_one(alert_doc)
    return str(res.inserted_id)

# --- Option A: SMS / WhatsApp using Twilio ---
# Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

def send_sms_via_twilio(to_number, body, account_sid, auth_token, from_number):
    twilio = TwilioClient(account_sid, auth_token)
    message = twilio.messages.create(
        body=body,
        from_=from_number,
        to=to_number
    )
    return message.sid

def send_whatsapp_via_twilio(to_number, body, account_sid, auth_token, from_whatsapp_number):
    twilio = TwilioClient(account_sid, auth_token)
    message = twilio.messages.create(
        body=body,
        from_=f'whatsapp:{from_whatsapp_number}',
        to=f'whatsapp:{to_number}'
    )
    return message.sid

# --- Option B: Push notifications via FCM ---
# Requires: FCM server key and device tokens stored per user

def send_push_via_fcm(server_key, device_token, title, body):
    url = "https://fcm.googleapis.com/fcm/send"
    headers = {
        'Authorization': 'key=' + server_key,
        'Content-Type': 'application/json'
    }
    payload = {
        'to': device_token,
        'notification': {
            'title': title,
            'body': body
        },
        'data': {
            'click_action': 'FLUTTER_NOTIFICATION_CLICK',
            'sound': 'default'
        }
    }
    resp = requests.post(url, json=payload, headers=headers)
    return resp.status_code, resp.text

# --- Option C: Webhook to backend ---
# Call a backend endpoint so backend handles routing to channels and retries

def send_alert_webhook(webhook_url, api_key, payload):
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    resp = requests.post(webhook_url, json=payload, headers=headers)
    return resp.status_code, resp.text

# --- Orchestrator: when model flags an event ---

def handle_detection_and_alert(client, cattle_id, detection_type, confidence, contact_info, settings):
    # contact_info example: {"phone": "+91...", "device_token": "..."}
    # settings: contains Twilio creds, FCM key, webhook URL

    # 1) create DB alert
    message = f"{detection_type} detected for {cattle_id} (confidence={confidence})"
    alert_id = create_alert(client, cattle_id, detection_type, 'critical', message)

    # 2) notify via channels
    try:
        if settings.get('use_webhook'):
            payload = {"alert_id": alert_id, "cattle_id": cattle_id, "message": message}
            send_alert_webhook(settings['webhook_url'], settings['api_key'], payload)

        if settings.get('use_twilio') and 'phone' in contact_info:
            send_sms_via_twilio(contact_info['phone'], message, settings['twilio_sid'], settings['twilio_token'], settings['twilio_from'])

        if settings.get('use_whatsapp') and 'phone' in contact_info:
            send_whatsapp_via_twilio(contact_info['phone'], message, settings['twilio_sid'], settings['twilio_token'], settings['twilio_whatsapp_from'])

        if settings.get('use_fcm') and 'device_token' in contact_info:
            send_push_via_fcm(settings['fcm_key'], contact_info['device_token'], "Alert: " + detection_type, message)

        # mark delivered
        db = client["cattle_iot"]
        db["alerts"].update_one({"_id": alert_id}, {"$set": {"delivered": True}})
    except Exception as e:
        print("Error sending alert:", e)

# --- Example orchestration usage ---
# settings = {
#   'use_twilio': True, 'twilio_sid': 'ACxxx', 'twilio_token': 'xxx', 'twilio_from': '+12345',
#   'use_whatsapp': True, 'twilio_whatsapp_from': '+12345',
#   'use_fcm': True, 'fcm_key': 'AAA...'
# }
# contact_info = {'phone': '+919876543210', 'device_token': 'token123'}
# handle_detection_and_alert(client, 'C123', 'IMMINENT_CALVING', 0.92, contact_info, settings)

# ----------------------
# Notes & Best Practices
# ----------------------
# - Use webhook approach for centralized retry, audit, and templating.
# - For WhatsApp, use Twilio or Meta Business API (requires approval for templates).
# - Keep messages short and actionable (e.g., "C123 likely to calve within 12 hours. Prepare pen.").
# - Implement rate-limiting / deduplication to avoid spamming farmers on noisy signals.
# - Store alert history and delivery status for audit and model improvements.

# ----------------------
# 9. Deployment Guide
# ----------------------

## Requirements
- Python 3.9+
- MongoDB running (local or Atlas)
- Access to MQTT broker for data ingestion (handled separately)
- Virtual environment recommended

## Steps

1. **Clone Repository**
```bash
git clone https://github.com/your-org/cattle-iot-prediction.git
cd cattle-iot-prediction
```

2. **Setup Environment**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Sample `requirements.txt`:
```
pandas
numpy
scikit-learn
pymongo
schedule
joblib
twilio
requests
```

3. **Environment Variables**
Create `.env` file:
```
MONGO_URI=mongodb://localhost:27017
DB_NAME=cattle_iot
TWILIO_SID=ACxxxx
TWILIO_TOKEN=xxxx
TWILIO_FROM=+123456789
TWILIO_WHATSAPP_FROM=+123456789
FCM_KEY=AAAA....
WEBHOOK_URL=https://backend.example.com/alerts
API_KEY=xyz123
```

Load env vars in Python using `python-dotenv` or OS environment.

4. **Run the Service**
```bash
python cattle_prediction.py
```
- Options inside script:
  - `real_time_prediction_loop(client, interval_minutes=5)` → enable real-time predictions.
  - `schedule_retraining(client, interval_days=7)` → enable auto-retraining.

5. **Background Service Setup**
- Use **systemd** service on Linux:
```
[Unit]
Description=Cattle IoT Prediction Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/cattle-iot-prediction
ExecStart=/home/ubuntu/cattle-iot-prediction/venv/bin/python cattle_prediction.py
Restart=always
EnvironmentFile=/home/ubuntu/cattle-iot-prediction/.env

[Install]
WantedBy=multi-user.target
```
Save as `/etc/systemd/system/cattle-iot.service`.
```bash
sudo systemctl daemon-reload
sudo systemctl enable cattle-iot.service
sudo systemctl start cattle-iot.service
```

- Or run inside **Docker**:
`Dockerfile`
```
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "cattle_prediction.py"]
```
Build & run:
```bash
docker build -t cattle-iot-prediction .
docker run -d --name cattle-iot --env-file .env cattle-iot-prediction
```

6. **Monitoring & Logs**
- View logs:
```bash
journalctl -u cattle-iot.service -f
```
- Or inside Docker:
```bash
docker logs -f cattle-iot
```

7. **Scaling**
- Use **Docker Compose** or **Kubernetes** for multiple services (prediction, ingestion, backend).
- Expose metrics endpoint (e.g., Prometheus) for health monitoring.

---

# End of file
