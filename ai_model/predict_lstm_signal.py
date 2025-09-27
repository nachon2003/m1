import sys
import json
import numpy as np
import os
import pandas as pd
import pandas_ta as ta
from tensorflow.keras.models import load_model # type: ignore
import joblib

def predict_lstm_signal(symbol, prices_json, model_filename):
    try:
        prices = json.loads(prices_json)
        
        if len(prices) < 50: # ต้องการข้อมูลอย่างน้อย 50 แท่งเพื่อคำนวณ Indicators
            return {"error": f"Not enough data for LSTM prediction, got {len(prices)}, need 50."}

        # (ใหม่) สร้าง DataFrame และ Features ให้เหมือนตอนเทรน
        df = pd.DataFrame(prices)
        df['returns'] = df['close'].pct_change()
        df['ma_5'] = df['close'].rolling(window=5).mean()
        df['ma_20'] = df['close'].rolling(window=20).mean()
        df.ta.rsi(length=14, append=True)
        df.ta.macd(fast=12, slow=26, signal=9, append=True)
        df.dropna(inplace=True)

        features = [
            'open', 'high', 'low', 'close', 
            'returns', 'ma_5', 'ma_20',
            'RSI_14', 
            'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9'
        ]
        
        # ใช้ข้อมูลล่าสุด 10 แท่งเพื่อทำนาย
        data_for_lstm = df[features].tail(10).values
        
        current_price = data_for_lstm[-1, features.index('close')]

        # Load scaler
        scaler_filename = model_filename.replace('_lstm_model.h5', '_lstm_scaler.joblib')
        scaler_path = os.path.join(os.path.dirname(__file__), scaler_filename)
        if not os.path.exists(scaler_path):
            return {"error": f"Scaler file not found at {scaler_path}"}
        scaler = joblib.load(scaler_path)

        # Load model
        model_path = os.path.join(os.path.dirname(__file__), model_filename)
        if not os.path.exists(model_path):
            return {"error": f"Model file not found at {model_path}"}
        model = load_model(model_path)

        # Prepare input data (Scale ข้อมูล)
        scaled_input = scaler.transform(data_for_lstm)
        
        # Reshape ข้อมูลให้เป็น [1, look_back, num_features]
        X_pred = np.array([scaled_input])
        X_pred = np.reshape(X_pred, (X_pred.shape[0], X_pred.shape[1], 1))

        # Predict
        predicted_price_scaled = model.predict(X_pred)

        # สร้าง array หลอกสำหรับ inverse_transform (เพราะ scaler ถูก fit ด้วยหลาย features)
        dummy_array = np.zeros((1, len(features)))
        dummy_array[0, features.index('close')] = predicted_price_scaled[0, 0]
        predicted_price = scaler.inverse_transform(predicted_price_scaled)[0][0]

        # Determine signal
        signal = 'HOLD'
        if predicted_price > current_price * 1.0005: # Threshold to avoid noise
            signal = 'BUY'
        elif predicted_price < current_price * 0.9995:
            signal = 'SELL'

        return {"signal": signal, "predictedPrice": float(predicted_price)}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Incorrect number of arguments provided to predict_lstm_signal.py"}))
        sys.exit(1)

    symbol_arg = sys.argv[1]
    prices_arg = sys.argv[2]
    model_file_arg = sys.argv[3]
    result = predict_lstm_signal(symbol_arg, prices_arg, model_file_arg)
    print(json.dumps(result))
