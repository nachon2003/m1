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

# --- ฟังก์ชันหลัก ---
def train_and_evaluate(df):
    """
    เทรนโมเดล Random Forest และประเมินผล
    """
    if df.empty:
        print("DataFrame is empty, cannot train model.")
        return None

    # 1. เลือก Features และ Target
    # เราจะใช้ Indicators ทั้งหมดเป็น Features และไม่ใช้ข้อมูลราคาดิบ (open, high, low, close) โดยตรง
    # (ปรับปรุง) กำหนดรายชื่อ Features ให้ตรงกับที่ backtest.py และ predict.py ใช้
    features = [
        'RSI_14', 'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9',
        'BBL_20_2.0', 'BBU_20_2.0', 'BBB_20_2.0', 'BBP_20_2.0',
        'ATRr_14', 'STOCHk_14_3_3', 'STOCHd_14_3_3',
        'dist_to_pp', 'dist_to_r1', 'dist_to_s1',
        'dist_to_r2', 'dist_to_s2',
        'trend_status', 'is_trending', 's1', 'r1' # (ใหม่) เพิ่ม s1, r1 เข้าไปใน features
    ]
    target = 'label'

    # ตรวจสอบว่า features ทั้งหมดมีอยู่ใน DataFrame หรือไม่
    X = df[features]
    
    X = df[features]
    y = df[target]

    # 2. แบ่งข้อมูลเป็นชุด Train และ Test
    # ใช้ shuffle=False เพื่อป้องกัน Lookahead Bias ในข้อมูล Time Series
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False, random_state=42)

    if len(X_train) == 0 or len(X_test) == 0:
        print("Not enough data to split into training and testing sets.")
        return None

    print(f"Training data size: {len(X_train)}")
    print(f"Testing data size: {len(X_test)}")

    # 3. สร้างและเทรนโมเดล
    print("Training Random Forest model...")
    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1, class_weight='balanced')
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
        exit(1)

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
    # (สำคัญ) เพิ่ม Argument Parser เพื่อรับค่าจากภายนอก
    parser.add_argument('--symbol', type=str, required=True, help="The trading symbol, e.g., 'EUR_USD'")
    parser.add_argument('--timeframe', type=str, required=True, help="The timeframe, e.g., '4h'")
    
    args = parser.parse_args()
    
    main(args.symbol, args.timeframe)
