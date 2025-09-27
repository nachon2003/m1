import pandas as pd
import numpy as np
import os
import argparse

# --- ค่าคงที่สำหรับ Triple Barrier Method ---
TP_FACTOR = 2.0  # (แก้ไข) เพิ่มเป้าหมายทำกำไรให้กว้างขึ้นเป็น 2.0 เท่าของ ATR
SL_FACTOR = 1.0  # (แก้ไข) ลดระยะตัดขาดทุนให้แคบลงเป็น 1.0 เท่าของ ATR
LOOK_FORWARD = 20         # มองไปข้างหน้า 20 แท่ง (4h * 20 = 80 ชั่วโมง)

def get_daily_volatility(close, lookback=20):
    """
    คำนวณความผันผวน (Volatility) โดยใช้ standard deviation ของ returns
    """
    # คำนวณ daily returns
    returns = close.pct_change()
    # คำนวณ rolling standard deviation และ shift(1) เพื่อป้องกัน lookahead bias
    volatility = returns.rolling(window=lookback).std().shift(1)
    return volatility

def apply_triple_barrier(df, tp_factor=1.5, sl_factor=1.5, look_forward_period=10):
    """
    ใช้ Triple Barrier Method เพื่อสร้าง Labels (1: Buy, -1: Sell, 0: Hold)
    
    Parameters:
    - df: DataFrame ที่มีข้อมูลราคา 'high', 'low', 'close'
    - tp_factor: ตัวคูณสำหรับ Take Profit (TP) จาก Volatility
    - sl_factor: ตัวคูณสำหรับ Stop Loss (SL) จาก Volatility
    - look_forward_period: จำนวนแท่งเทียนที่จะมองไปข้างหน้า (Vertical Barrier)
    """
    
    # 1. คำนวณ Volatility
    volatility = get_daily_volatility(df['close'])
    
    # สร้างคอลัมน์สำหรับเก็บผลลัพธ์
    labels = pd.Series(np.nan, index=df.index)
    
    # 2. วนลูปเพื่อหา Label ของแต่ละแท่งเทียน
    for i in range(len(df) - look_forward_period):
        entry_price = df['close'].iloc[i]
        vol = volatility.iloc[i]

        # ถ้าไม่มีค่า volatility (ช่วงแรกๆ ของข้อมูล) ให้ข้ามไป
        if pd.isna(vol) or vol == 0:
            continue

        # 3. กำหนดกำแพง (Barriers)
        upper_barrier = entry_price + (entry_price * vol * tp_factor)
        lower_barrier = entry_price - (entry_price * vol * sl_factor)
        
        # 4. ตรวจสอบราคาในอนาคต
        for j in range(1, look_forward_period + 1):
            future_high = df['high'].iloc[i + j]
            future_low = df['low'].iloc[i + j]
            
            # ตรวจสอบว่าชน Upper Barrier ก่อนหรือไม่
            if future_high >= upper_barrier:
                labels.iloc[i] = 1  # Buy signal
                break
            
            # ตรวจสอบว่าชน Lower Barrier ก่อนหรือไม่
            if future_low <= lower_barrier:
                labels.iloc[i] = -1 # Sell signal
                break
        
        # 5. ถ้าไม่ชนกำแพงไหนเลย (ชน Vertical Barrier)
        if pd.isna(labels.iloc[i]):
            labels.iloc[i] = 0 # Hold signal

    df['label'] = labels
    return df

def main(symbol, timeframe):
    """Main function to create labels for a specific symbol and timeframe."""
    input_dir = "ai_model/data/processed"
    input_filename = f"{symbol}_{timeframe}_features.csv"
    input_filepath = os.path.join(input_dir, input_filename)

    if not os.path.exists(input_filepath):
        print(f"Error: Input file not found at {input_filepath}")
        print("Please run 'prepare_data.py' first.")
        return

    # --- Step 1: Load Features Data ---
    df = pd.read_csv(input_filepath, index_col='datetime', parse_dates=True)
    
    # --- Step 2: Create Labels with Triple Barrier Method ---
    print(f"Creating labels (TP: {TP_FACTOR}x, SL: {SL_FACTOR}x, Look Forward: {LOOK_FORWARD} bars)...")
    df_labeled = apply_triple_barrier(df, tp_factor=TP_FACTOR, sl_factor=SL_FACTOR, look_forward_period=LOOK_FORWARD)
    
    df_labeled.dropna(subset=['label'], inplace=True)
    df_labeled['label'] = df_labeled['label'].astype(int)

    print("Labels created successfully!")
    print("\n--- Label Distribution ---")
    print(df_labeled['label'].value_counts(normalize=True))

    # --- Step 3: Save the new file ---
    output_filename = input_filename.replace('_features.csv', '_labeled.csv')
    output_filepath = os.path.join(input_dir, output_filename)
    df_labeled.to_csv(output_filepath)
    print(f"\nLabeled data saved successfully to: {output_filepath}")

# --- ส่วนหลักของการทำงาน (Main Execution) ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create labels for AI model training.")
    parser.add_argument('--symbol', type=str, required=True, help="The trading symbol, e.g., 'EUR_USD'")
    parser.add_argument('--timeframe', type=str, required=True, help="The timeframe, e.g., '4h'")
    args = parser.parse_args()
    main(args.symbol, args.timeframe)
