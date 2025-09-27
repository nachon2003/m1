import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os
import argparse

# --- ค่าคงที่และตัวแปรตั้งค่า ---
MODEL_DIR = "ai_model/models"
DATA_DIR = "ai_model/data/processed"

# (ใหม่) กำหนดรายชื่อ Symbols และ Timeframes ที่ต้องการเทรนทั้งหมด
SUPPORTED_SYMBOLS = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'USD/CHF', 'XAU/USD'
]
SUPPORTED_TIMEFRAMES = [
    '1m', '5m', '15m', '30m', '1h', '4h', '1d'
]

# (ใหม่) กำหนดค่าเริ่มต้นสำหรับ n_estimators
N_ESTIMATORS = 100


# --- ฟังก์ชันหลัก ---
def train_and_evaluate(df):
    """
    เทรนโมเดล Random Forest และประเมินผล
    """
    if df.empty:
        print("DataFrame is empty, cannot train model.")
        return None

    # 1. (แก้ไข) ไม่ต้องสร้าง Features ซ้ำ
    # เนื่องจากข้อมูล Indicators ถูกสร้างและบันทึกไว้ในไฟล์ CSV เรียบร้อยแล้ว
    # จากขั้นตอน create_labels.py

    # (แก้ไข) ไม่สร้าง Label ใหม่ แต่ใช้ Label ที่มีอยู่แล้วจากไฟล์
    df.dropna(inplace=True)

    # (แก้ไข) กำหนดรายการ Features ใหม่ให้ตรงกับที่คำนวณ
    features = [
        'RSI_14', 
        'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9',
        'BBL_20_2.0', 'BBM_20_2.0', 'BBU_20_2.0', 'BBB_20_2.0', 'BBP_20_2.0',
        'ATRr_14', 
        'STOCHk_14_3_3', 'STOCHd_14_3_3'
    ]
    target = 'label'

    # ตรวจสอบว่า features ทั้งหมดมีอยู่ใน DataFrame หรือไม่
    missing_features = [f for f in features if f not in df.columns]
    if missing_features:
        print(f"Error: Missing features in DataFrame: {missing_features}")
        return None

    X = df[features]
    y = df[target]

    # 2. แบ่งข้อมูลเป็นชุด Train และ Test
    # ใช้ shuffle=False เพื่อป้องกัน Lookahead Bias ในข้อมูล Time Series
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, shuffle=False, random_state=42)

    if len(X_train) == 0 or len(X_test) == 0:
        print("Not enough data to split into training and testing sets.")
        return None

    print(f"Training data size: {len(X_train)}")
    print(f"Testing data size: {len(X_test)}")

    # 3. สร้างและเทรนโมเดล
    print("Training Random Forest model...")
    model = RandomForestClassifier(n_estimators=N_ESTIMATORS, random_state=42, n_jobs=-1, class_weight='balanced')
    model.fit(X_train, y_train)

    # 4. ประเมินผลโมเดล
    print("\n--- Model Evaluation ---")
    y_pred = model.predict(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {accuracy:.4f}")
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))
    # (ใหม่) แสดง Feature Importances
    print("\n--- Feature Importances ---")
    importances = model.feature_importances_
    feature_importance_df = pd.DataFrame({
        'feature': features,
        'importance': importances
    }).sort_values('importance', ascending=False)
    print(feature_importance_df)

    return model

def main(symbol, timeframe):
    """
    ฟังก์ชันหลักสำหรับควบคุมกระบวนการเทรนโมเดล
    """
    print(f"\n{'='*20} Training for {symbol} ({timeframe}) {'='*20}")

    # --- กำหนด Path ---
    symbol_filename = symbol.replace('/', '_')
    input_filename = f"{symbol_filename}_{timeframe}_labeled.csv"
    input_filepath = os.path.join(DATA_DIR, input_filename)

    model_filename = f"{symbol_filename}_{timeframe}_random_forest.joblib"
    model_filepath = os.path.join(MODEL_DIR, model_filename)

    # สร้างโฟลเดอร์สำหรับเก็บโมเดล หากยังไม่มี
    os.makedirs(MODEL_DIR, exist_ok=True)

    # --- โหลดข้อมูล ---
    if not os.path.exists(input_filepath):
        print(f"Error: Labeled data file not found at {input_filepath}")
        print("Please run 'prepare_data.py' and 'create_labels.py' first.")
        return # (แก้ไข) เปลี่ยนเป็น return เพื่อให้ loop ทำงานต่อ

    print(f"Loading labeled data from: {input_filepath}")
    df = pd.read_csv(input_filepath, index_col='datetime', parse_dates=True)

    # --- เทรนและประเมินผลโมเดล ---
    model = train_and_evaluate(df)

    # --- บันทึกโมเดล ---
    if model:
        print(f"\nSaving model to: {model_filepath}")
        joblib.dump(model, model_filepath)
        print("Model saved successfully!")

# --- ส่วนหลักของการทำงาน (Main Execution) ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train a Random Forest model for a specific symbol and timeframe.")
    # (แก้ไข) ทำให้ Argument ไม่บังคับ (optional)
    parser.add_argument('--symbol', type=str, help="The trading symbol, e.g., 'EUR/USD'")
    parser.add_argument('--timeframe', type=str, help="The timeframe, e.g., '4h'")
    
    args = parser.parse_args()
    
    if args.symbol and args.timeframe:
        # ถ้ามีการระบุ symbol และ timeframe, ให้เทรนเฉพาะตัวนั้น
        main(args.symbol, args.timeframe)
    else:
        # ถ้าไม่ระบุ, ให้วนลูปเทรนทั้งหมด
        print("No specific symbol/timeframe provided. Starting batch training for all supported pairs and timeframes...")
        for symbol in SUPPORTED_SYMBOLS:
            for timeframe in SUPPORTED_TIMEFRAMES:
                try:
                    main(symbol, timeframe)
                except Exception as e:
                    print(f"An error occurred during training for {symbol} ({timeframe}): {e}")
        print("\nBatch training finished!")
