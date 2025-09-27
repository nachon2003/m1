import requests
import pandas as pd
import pandas_ta as ta
import os
import json
import argparse

# --- Configuration ---
BACKEND_URL = "http://localhost:3001"
OUTPUT_DIR = "ai_model/data/processed"

def prepare_features(df):
    """
    คำนวณ Technical Indicators และสร้าง Features ที่จำเป็นสำหรับการเทรนโมเดล
    """
    # This function is now part of the new structure but the logic remains the same.
    # The main change is how the data is obtained and saved in the main() function.

    if df.empty:
        return None

    print("กำลังคำนวณ Technical Indicators และสร้าง Features...")
    
    # --- คำนวณ Indicators ด้วย Pandas TA ---
    df.ta.rsi(length=14, append=True)
    df.ta.macd(fast=12, slow=26, signal=9, append=True)
    df.ta.bbands(length=20, std=2, append=True)
    df.ta.atr(length=14, append=True)
    stoch = df.ta.stoch(k=14, d=3, smooth_k=3, append=True)

    # --- (ใหม่) เพิ่ม Indicators จาก Kaning Signal ---
    df['ma_9'] = ta.sma(df['close'], length=9)
    df['ma_18'] = ta.sma(df['close'], length=18)
    df['ma_50'] = ta.sma(df['close'], length=50)

    # --- (ใหม่) เพิ่ม Features จาก Multi-Divergence ---
    # คำนวณ Divergence แบบง่ายๆ โดยดูการตัดกันของเส้น Indicator กับเส้นค่าเฉลี่ยของมัน
    df['rsi_divergence'] = (df['RSI_14'] > df['RSI_14'].rolling(window=14).mean()).astype(int)
    df['macd_divergence'] = (df['MACD_12_26_9'] > df['MACDs_12_26_9']).astype(int)

    # --- (ใหม่) เพิ่ม Feature วิเคราะห์ Trend โดยตรง ---
    # กำหนดเงื่อนไขของ Trend
    uptrend_condition = (df['ma_9'] > df['ma_18']) & (df['ma_18'] > df['ma_50'])
    downtrend_condition = (df['ma_9'] < df['ma_18']) & (df['ma_18'] < df['ma_50'])

    # สร้างคอลัมน์ trend_status: 1 = Uptrend, -1 = Downtrend, 0 = Sideways
    df['trend_status'] = 0 # ค่าเริ่มต้นเป็น Sideways
    df.loc[uptrend_condition, 'trend_status'] = 1
    df.loc[downtrend_condition, 'trend_status'] = -1
    df['is_trending'] = df['trend_status'].abs() # จะได้ค่า 1 ถ้าเป็น Uptrend/Downtrend, 0 ถ้าเป็น Sideways

    # --- (ปรับปรุง) สร้าง Features จาก Pivot Points ---
    # ใช้ข้อมูลของแท่งก่อนหน้าในการคำนวณเพื่อป้องกัน Lookahead Bias
    prev_high = df['high'].shift(1)
    prev_low = df['low'].shift(1)
    prev_close = df['close'].shift(1)

    # คำนวณ Pivot Points
    df['pp'] = (prev_high + prev_low + prev_close) / 3
    df['r1'] = (2 * df['pp']) - prev_low
    df['s1'] = (2 * df['pp']) - prev_high
    df['r2'] = df['pp'] + (prev_high - prev_low)
    df['s2'] = df['pp'] - (prev_high - prev_low)
    
    # คำนวณระยะห่างจากราคาปิดปัจจุบันไปยัง Pivot Points
    # (ใช้ .abs() เพื่อให้ได้ระยะห่างเป็นบวกเสมอ)
    df['dist_to_pp'] = (df['close'] - df['pp']).abs()
    df['dist_to_r1'] = (df['close'] - df['r1']).abs()
    df['dist_to_s1'] = (df['close'] - df['s1']).abs()
    df['dist_to_r2'] = (df['close'] - df['r2']).abs()
    df['dist_to_s2'] = (df['close'] - df['s2']).abs()

    # (ลบออก) ลบ Features แนวรับ-แนวต้านแบบเก่าที่ไม่ใช้ออก
    # df['support'] = df['low'].rolling(window=20).min()
    # df['resistance'] = df['high'].rolling(window=20).max()
    # df['dist_to_support'] = df['close'] - df['support']
    # df['dist_to_resistance'] = df['resistance'] - df['close']

    # ลบแถวที่มีค่าว่าง (NaN) ซึ่งจะเกิดในช่วงแรกๆ ของการคำนวณ Indicator
    df.dropna(inplace=True)
    
    print("สร้าง Features สำเร็จ!")
    return df

def fetch_ohlc_data(symbol, timeframe):
    """Fetches OHLC data from the backend API."""
    print(f"Fetching data for {symbol} on {timeframe} from {BACKEND_URL}...")
    api_url = f"{BACKEND_URL}/api/training/ohlc-data"
    try:
        # (ใหม่) เพิ่มพารามิเตอร์ limit=10000 เพื่อร้องขอข้อมูล 10,000 แท่ง
        params = {'symbol': symbol, 'timeframe': timeframe, 'limit': 10000}
        response = requests.get(api_url, params=params)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        data = response.json()
        if not data or not data.get('ohlcData'):
            print("Error: No 'ohlcData' key in response.")
            return None
        
        df = pd.DataFrame(data['ohlcData'])
        df['datetime'] = pd.to_datetime(df['time'])
        df.set_index('datetime', inplace=True)
        print(f"Successfully fetched {len(df)} data points.")
        return df
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from backend: {e}")
        return None

def main(symbol, timeframe):
    """Main function to prepare features for a specific symbol and timeframe."""
    df = fetch_ohlc_data(symbol, timeframe)
    if df is None:
        exit(1) # Exit with error code if data fetching fails

    # (FIX) ตรวจสอบและลบ index ที่ซ้ำกัน ซึ่งเป็นสาเหตุของข้อผิดพลาด
    if df.index.has_duplicates:
        print(f"Warning: พบข้อมูลเวลาซ้ำกัน {df.index.duplicated().sum()} รายการ กำลังลบรายการที่ซ้ำ...")
        df = df[~df.index.duplicated(keep='first')]

    # --- สร้าง Features ---
    df_features = prepare_features(df) # No need for copy() as df is new

    # --- บันทึกไฟล์ Features ---
    if df_features is not None and not df_features.empty:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        symbol_filename = symbol.replace('/', '_')
        output_filename = f"{symbol_filename}_{timeframe}_features.csv"
        output_filepath = os.path.join(OUTPUT_DIR, output_filename)
        df_features.to_csv(output_filepath)
        print(f"ข้อมูล Features ถูกบันทึกเรียบร้อยแล้วในไฟล์: {output_filepath}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare data by calculating features for a specific symbol and timeframe.")
    parser.add_argument('--symbol', type=str, required=True, help="The trading symbol, e.g., 'EUR/USD'")
    parser.add_argument('--timeframe', type=str, required=True, help="The timeframe, e.g., '4h'")
    args = parser.parse_args()
    main(args.symbol, args.timeframe)