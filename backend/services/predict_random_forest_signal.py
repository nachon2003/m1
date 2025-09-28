import sys
import json
import numpy as np
import pandas as pd
import joblib
import os
import pandas_ta as ta

def calculate_features(df):
    """คำนวณ Technical Indicators และ Features ที่จำเป็น"""
    df.ta.rsi(length=14, append=True)
    df.ta.macd(fast=12, slow=26, signal=9, append=True)
    df.ta.bbands(length=20, std=2, append=True)
    df.ta.atr(length=14, append=True)
    df.ta.stoch(k=14, d=3, smooth_k=3, append=True)
    
    # (ใหม่) คำนวณ MAs สำหรับวิเคราะห์ Trend
    df['ma_9'] = ta.sma(df['close'], length=9)
    df['ma_18'] = ta.sma(df['close'], length=18)
    df['ma_50'] = ta.sma(df['close'], length=50)

    df.dropna(inplace=True)
    return df

def analyze_trend(df):
    """วิเคราะห์แนวโน้มตลาดจากเส้นค่าเฉลี่ย"""
    if df.empty or 'ma_9' not in df.columns or 'ma_18' not in df.columns or 'ma_50' not in df.columns:
        return 'N/A'
        
    last_row = df.iloc[-1]
    ma9 = last_row['ma_9']
    ma18 = last_row['ma_18']
    ma50 = last_row['ma_50']

    if ma9 > ma18 and ma18 > ma50:
        return 'Uptrend'
    elif ma9 < ma18 and ma18 < ma50:
        return 'Downtrend'
    else:
        return 'Sideways'

def analyze_volume(df):
    """วิเคราะห์ Volume โดยเปรียบเทียบกับค่าเฉลี่ย"""
    if df.empty or 'volume' not in df.columns or df['volume'].sum() == 0:
        return 'N/A'
    
    last_row = df.iloc[-1]
    current_volume = last_row['volume']
    avg_volume = df['volume'].rolling(window=20).mean().iloc[-1]

    if current_volume > avg_volume * 1.5:
        return 'High'
    elif current_volume < avg_volume * 0.7:
        return 'Low'
    else:
        return 'Normal'



def main():
    try:
        # 1. รับข้อมูลจาก Node.js
        symbol = sys.argv[1]
        ohlc_json = sys.argv[2]
        model_filename = sys.argv[3]

        df = pd.DataFrame(json.loads(ohlc_json))
        
        # Ensure 'time' column is parsed correctly if it exists
        if 'time' in df.columns:
            df['time'] = pd.to_datetime(df['time'])
            df.set_index('time', inplace=True)

        # (ใหม่) ตรวจสอบว่ามีคอลัมน์ volume หรือไม่ ถ้าไม่มีให้สร้างขึ้นมาเป็น 0
        if 'volume' not in df.columns:
            df['volume'] = 0

        # 2. คำนวณ Features
        df_features = calculate_features(df.copy())

        if df_features.empty:
            raise ValueError("Not enough data to calculate features.")

        # 3. โหลดโมเดล
        model_path = os.path.join(os.path.dirname(__file__), 'models', model_filename)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}")
        
        model = joblib.load(model_path)

        # 4. เตรียมข้อมูลสำหรับทำนาย
        # (แก้ไข) ทำให้รายการ Feature ตรงกับที่ใช้ใน train_model.py
        feature_cols = [
            'RSI_14', 
            'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9',
            'BBL_20_2.0', 'BBM_20_2.0', 'BBU_20_2.0', 'BBB_20_2.0', 'BBP_20_2.0',
            'ATRr_14', 
            'STOCHk_14_3_3', 'STOCHd_14_3_3'
        ]

        # Handle cases where pandas-ta might not create all columns due to insufficient data
        for col in feature_cols:
            if col not in df_features.columns:
                df_features[col] = 0 # Fill missing features with 0

        current_features = df_features.iloc[-1:][feature_cols]

        # 5. ทำนายสัญญาณ
        prediction = model.predict(current_features)[0]
        signal_map = {1: 'BUY', -1: 'SELL', 0: 'HOLD'}
        signal = signal_map.get(prediction, 'HOLD')

        # 6. วิเคราะห์ Trend
        trend = analyze_trend(df_features) # ใช้ df_features ที่มี MAs แล้ว

        # (ใหม่) 7. วิเคราะห์ Volume
        volume_status = analyze_volume(df_features)

        # (ใหม่) 8. คำนวณ Buyer Percentage จาก RSI
        # ใช้ค่า RSI ล่าสุดเป็นตัวแทนแรงซื้อ (0-100)
        buyer_percentage = round(df_features.iloc[-1]['RSI_14']) if 'RSI_14' in df_features.columns else 50
        
        # 7. สร้างผลลัพธ์เพื่อส่งกลับ
        result = {
            "signal": signal,
            "trend": trend,
            "volume": volume_status,
            "buyer_percentage": buyer_percentage,
            "reasoning": f"AI model predicted {signal} based on current market conditions. Market trend is {trend} and volume is {volume_status}."
            # สามารถเพิ่มค่าอื่นๆ ได้ในอนาคต เช่น confidence
        }
        print(json.dumps(result))

    except Exception as e:
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()