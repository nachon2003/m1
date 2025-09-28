import sys
import json
import numpy as np
import pandas as pd
import joblib
import os
import pandas_ta as ta

def calculate_features(df):
    """Calculates all necessary technical indicators using pandas-ta."""
    df.ta.rsi(length=14, append=True)
    df.ta.macd(fast=12, slow=26, signal=9, append=True)
    df.ta.bbands(length=20, std=2, append=True)
    df.ta.atr(length=14, append=True)
    df.ta.stoch(k=14, d=3, smooth_k=3, append=True)
    return df

def main():
    try:
        # 1. อ่าน Arguments จาก Node.js
        symbol = sys.argv[1]
        ohlc_json = sys.argv[2]
        model_filename = sys.argv[3]

        # 2. สร้าง DataFrame จากข้อมูล OHLC ที่ได้รับ
        ohlc_data = json.loads(ohlc_json)
        df = pd.DataFrame(ohlc_data)
        # ตรวจสอบว่ามีข้อมูลหรือไม่
        if df.empty:
            raise ValueError("Received empty OHLC data.")

        # แปลง 'time' เป็น index
        df['time'] = pd.to_datetime(df['time'])
        df.set_index('time', inplace=True)

        # 3. คำนวณ Features
        df = calculate_features(df)

        # 4. เตรียมข้อมูลล่าสุดสำหรับทำนาย
        features_list = [
            'RSI_14', 'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9',
            'BBL_20_2.0', 'BBM_20_2.0', 'BBU_20_2.0', 'BBB_20_2.0', 'BBP_20_2.0',
            'ATRr_14', 'STOCHk_14_3_3', 'STOCHd_14_3_3'
        ]
        
        # ตรวจสอบว่ามีคอลัมน์ feature ครบหรือไม่
        if not all(feature in df.columns for feature in features_list):
            # บางครั้ง pandas-ta อาจสร้างคอลัมน์ไม่ครบถ้าข้อมูลไม่พอ
            # เราจะเติมค่าที่ขาดไปด้วย 0 เพื่อให้โมเดลยังทำงานได้
            for feature in features_list:
                if feature not in df.columns:
                    df[feature] = 0
            # raise ValueError(f"Missing feature columns after calculation: {missing}")

        last_row_features = df.iloc[-1][features_list]
        last_row = last_row_features.values.reshape(1, -1)
        # 5. โหลดโมเดล
        model_path = os.path.join(os.path.dirname(__file__), 'models', model_filename)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}")
        
        model = joblib.load(model_path)

        # 6. ทำนายผล
        prediction = model.predict(last_row)[0]
        probabilities = model.predict_proba(last_row)[0]

        # แปลงผลลัพธ์
        signal_map = {1: 'BUY', -1: 'SELL', 0: 'HOLD'}
        signal = signal_map.get(int(prediction), 'HOLD')
        
        # คำนวณ Buyer Percentage (แก้ไขให้ปลอดภัยขึ้น)
        class_labels = model.classes_.tolist()
        buy_prob = 0
        sell_prob = 0
        if 1 in class_labels:
            buy_prob = probabilities[class_labels.index(1)]
        if -1 in class_labels:
            sell_prob = probabilities[class_labels.index(-1)]
        buyer_percentage = (buy_prob / (buy_prob + sell_prob)) * 100 if (buy_prob + sell_prob) > 0 else 50

        # 7. สร้างผลลัพธ์และ Print เป็น JSON
        result = {
            "signal": signal,
            "buyer_percentage": round(buyer_percentage, 2),
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()