import pandas as pd
import numpy as np
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import classification_report, accuracy_score
from tensorflow.keras.models import Sequential # type: ignore
from tensorflow.keras.layers import LSTM, Dense, Dropout # type: ignore
from tensorflow.keras.callbacks import EarlyStopping # type: ignore
import joblib
from twelvedata import TDClient # (ใหม่) Import library สำหรับดึงข้อมูล
import pandas_ta as ta # (ใหม่) Import library สำหรับ Technical Indicators

# --- (ใหม่) ค่าคงที่สำหรับ Triple Barrier Method ---
TP_FACTOR = 2.0  # Take Profit ที่ 2.0 เท่าของความผันผวน
SL_FACTOR = 1.0  # Stop Loss ที่ 1.0 เท่าของความผันผวน
LOOK_FORWARD = 20 # มองไปข้างหน้า 20 แท่งเทียน

def map_timeframe_to_api(tf):
    """(ใหม่) แปลง Timeframe จากรูปแบบที่ใช้ในโปรเจกต์เป็นรูปแบบที่ Twelve Data API เข้าใจ"""
    mapping = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        # ไม่ต้องแปลง '1h', '4h' เพราะ API ใช้รูปแบบนี้อยู่แล้ว
        '1d': '1day',
    }
    # คืนค่าที่แปลงแล้ว หรือคืนค่าเดิมถ้าไม่พบใน mapping (เช่น '1h', '4h' จะถูกคืนค่าเดิมซึ่งถูกต้องอยู่แล้ว)
    return mapping.get(tf, tf)

def get_forex_data(symbol, interval="1day", output_size=5000):
    """
    (ใหม่) ฟังก์ชันสำหรับดึงข้อมูลราคา Forex ย้อนหลังจาก Twelvedata
    """
    # !!! สำคัญ: คุณสามารถเปลี่ยน API Key ได้ที่นี่ หากจำเป็น !!!
    API_KEY = "aacd8f885b874127a09198c5e71e02a7" 
    
    if API_KEY == "YOUR_API_KEY_HERE":
        print("!!! กรุณาใส่ Twelvedata API Key ของคุณใน train_models.py ก่อนใช้งาน !!!")
        return None

    td = TDClient(apikey=API_KEY)
    print(f"กำลังดึงข้อมูลสำหรับ: {symbol} (interval: {interval}, outputsize: {output_size})...")
    
    ts = td.time_series(symbol=symbol, interval=interval, outputsize=output_size).as_pandas()

    if ts is None or ts.empty:
        print(f"ไม่พบข้อมูลสำหรับ {symbol}. อาจเป็นเพราะ API Key ไม่ถูกต้องหรือหมดโควต้า")
        return None
        
    print("ดึงข้อมูลสำเร็จ!")
    return ts.sort_index() # เรียงข้อมูลจากเก่าไปใหม่

def get_daily_volatility(close, lookback=20):
    """
    (ใหม่) คำนวณความผันผวน (Volatility) โดยใช้ standard deviation ของ returns
    """
    returns = close.pct_change()
    volatility = returns.rolling(window=lookback).std().shift(1)
    return volatility

def apply_triple_barrier(df, tp_factor, sl_factor, look_forward_period):
    """
    (ใหม่) ใช้ Triple Barrier Method เพื่อสร้าง Labels (1: Buy, -1: Sell, 0: Hold)
    """
    print(f"กำลังสร้าง Labels ด้วย Triple Barrier (TP: {tp_factor}x, SL: {sl_factor}x, Look Forward: {look_forward_period} bars)...")
    volatility = get_daily_volatility(df['close'])
    labels = pd.Series(np.nan, index=df.index)
    
    for i in range(len(df) - look_forward_period):
        entry_price = df['close'].iloc[i]
        vol = volatility.iloc[i]

        if pd.isna(vol) or vol == 0:
            continue

        # กำหนด Barriers
        upper_barrier = entry_price + (entry_price * vol * tp_factor)
        lower_barrier = entry_price - (entry_price * vol * sl_factor)
        
        # ตรวจสอบราคาในอนาคต
        for j in range(1, look_forward_period + 1):
            future_high = df['high'].iloc[i + j]
            future_low = df['low'].iloc[i + j]
            
            if future_high >= upper_barrier:
                labels.iloc[i] = 1  # Hit Take Profit (BUY)
                break
            
            if future_low <= lower_barrier:
                labels.iloc[i] = -1 # Hit Stop Loss (SELL)
                break
        
        if pd.isna(labels.iloc[i]):
            labels.iloc[i] = 0 # Hit Vertical Barrier (HOLD)

    df['label'] = labels
    return df

def prepare_features_and_labels(df):
    """(ใหม่) ฟังก์ชันสำหรับสร้าง Features และ Labels จาก DataFrame ดิบ"""
    if df is None or df.empty:
        return None
    
    print("กำลังสร้าง Features...")
    # --- สร้าง Technical Indicators ---
    df.ta.rsi(length=14, append=True)
    df.ta.macd(fast=12, slow=26, signal=9, append=True)
    df.ta.bbands(length=20, std=2, append=True)
    df.ta.atr(length=14, append=True)
    df.ta.stoch(k=14, d=3, smooth_k=3, append=True)
    
    # --- (แก้ไข) เปลี่ยนมาใช้ Triple-Barrier Method ในการสร้าง Label ---
    df = apply_triple_barrier(df, tp_factor=TP_FACTOR, sl_factor=SL_FACTOR, look_forward_period=LOOK_FORWARD)
    
    df.dropna(inplace=True)
    
    # ตรวจสอบว่ามีข้อมูลพอที่จะเทรนหรือไม่
    if df.empty:
        print("ข้อมูลไม่เพียงพอหลังจากการสร้าง Features และ Labels")
        return None

    # แปลง label เป็น integer
    df['label'] = df['label'].astype(int)

    print("สร้าง Features และ Labels สำเร็จ!")
    print("\n--- การกระจายตัวของ Label ---")
    print(df['label'].value_counts(normalize=True))

    return df

def train_random_forest(df, symbol, timeframe):
    """Trains and saves a Random Forest model."""
    print("\n--- Training Random Forest Model ---")
    # (แก้ไข) อัปเดตรายการ Features ให้ตรงกับที่สร้างใน prepare_features_and_labels
    features = [
        'RSI_14', 
        'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9',
        'BBL_20_2.0', 'BBM_20_2.0', 'BBU_20_2.0', 'BBB_20_2.0', 'BBP_20_2.0',
        'ATRr_14', 
        'STOCHk_14_3_3', 'STOCHd_14_3_3'
    ]
    
    print(f"Features ที่ใช้เทรน: {features}")

    X = df[features]
    y = df['label']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

    if len(X_train) == 0:
        print("Not enough data to train Random Forest model.")
        return

    model = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    print(f"Random Forest Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(classification_report(y_test, y_pred, labels=[-1, 0, 1], zero_division=0))

    # Save model
    model_filename = os.path.join(os.path.dirname(__file__), 'models', f"{symbol.replace('/', '_')}_{timeframe}_random_forest.joblib")
    joblib.dump(model, model_filename)
    print(f"Random Forest model saved to {model_filename}")

def create_lstm_dataset(dataset, look_back=10, target_index=3): # target_index=3 คือ 'close'
    """
    (ปรับปรุง) Creates sequences for LSTM with multiple features.
    The target (y) is the value from the target_index column (e.g., 'close' price).
    """
    dataX, dataY = [], []
    for i in range(len(dataset) - look_back - 1):
        a = dataset[i:(i + look_back), :] # Use all feature columns
        dataX.append(a)
        dataY.append(dataset[i + look_back, target_index]) # Predict the target column
    return np.array(dataX), np.array(dataY)

def train_lstm(df, symbol, timeframe):
    """Trains and saves an LSTM model."""
    print("\n--- Training LSTM Model ---")

    # (แก้ไข) เพิ่ม 'open', 'high', 'low', 'close' กลับเข้าไปใน features สำหรับ LSTM
    # เพราะโมเดล LSTM ถูกสร้างมาเพื่อทำนาย 'close' price
    features = [
        'open', 'high', 'low', 'close', # เพิ่ม 4 คอลัมน์นี้กลับเข้ามา
        'RSI_14', 
        'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9',
        'BBL_20_2.0', 'BBM_20_2.0', 'BBU_20_2.0', 'BBB_20_2.0', 'BBP_20_2.0',
        'ATRr_14', 
        'STOCHk_14_3_3', 'STOCHd_14_3_3'
    ]
    
    # ดึงข้อมูลเฉพาะ Features ที่ต้องการ
    data_for_lstm = df[features].values
    
    # Prepare data for LSTM with multiple features
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(data_for_lstm)

    num_features = len(features)
    close_price_index = features.index('close') # หา index ของ 'close' เพื่อใช้เป็นเป้าหมาย (y)

    train_size = int(len(scaled_data) * 0.8)
    train_data = scaled_data[0:train_size, :]
    test_data = scaled_data[train_size - 10:, :]

    look_back = 10
    X_train, y_train = create_lstm_dataset(train_data, look_back, target_index=close_price_index)
    X_test, y_test = create_lstm_dataset(test_data, look_back, target_index=close_price_index)

    if len(X_train) == 0:
        print("Not enough data to train LSTM model.")
        return

    # Reshape input to be [samples, time steps, features]
    X_train = np.reshape(X_train, (X_train.shape[0], X_train.shape[1], num_features))
    X_test = np.reshape(X_test, (X_test.shape[0], X_test.shape[1], num_features))

    # Build LSTM model
    model = Sequential()
    model.add(LSTM(50, return_sequences=True, input_shape=(look_back, num_features)))
    model.add(Dropout(0.2))
    model.add(LSTM(50, return_sequences=False))
    model.add(Dropout(0.2))
    model.add(Dense(25))
    model.add(Dense(1))

    model.compile(optimizer='adam', loss='mean_squared_error')

    # Early stopping to prevent overfitting
    early_stopping = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)

    # Train model
    model.fit(
        X_train, 
        y_train, 
        batch_size=32, 
        epochs=100, 
        validation_data=(X_test, y_test),
        callbacks=[early_stopping],
        verbose=1
    )

    # Save model
    model_filename = os.path.join(os.path.dirname(__file__), 'models', f"{symbol.replace('/', '_')}_{timeframe}_lstm_model.h5")
    model.save(model_filename)
    print(f"LSTM model saved to {model_filename}")

    # Save scaler for prediction
    scaler_filename = os.path.join(os.path.dirname(__file__), 'models', f"{symbol.replace('/', '_')}_{timeframe}_lstm_scaler.joblib")
    joblib.dump(scaler, scaler_filename)
    print(f"LSTM scaler saved to {scaler_filename}")


def main():
    """Main function to run the training process."""
    # (แก้ไข) กำหนดรายชื่อ Symbols และ Timeframes ที่ต้องการเทรนทั้งหมด
    supported_symbols = [
        'EUR/USD', 
        'GBP/USD', 
        'USD/JPY', 
        'USD/CAD', 
        'USD/CHF', 
        'XAU/USD'
    ]
    supported_timeframes = [
        '1m', '5m', '15m', '30m', '1h', '4h', '1d'
    ]

    # วนลูปเพื่อดึงข้อมูลและเทรนโมเดลสำหรับแต่ละคู่เงินและแต่ละ Timeframe
    for symbol in supported_symbols:
        for timeframe in supported_timeframes:
            print(f"\n{'='*25} Processing {symbol} ({timeframe}) {'='*25}")
            try:
                # 1. ดึงข้อมูลดิบตาม Timeframe ที่กำหนด
                api_interval = map_timeframe_to_api(timeframe)
                raw_df = get_forex_data(symbol, interval=api_interval, output_size=5000)
                if raw_df is None:
                    continue

                # 2. สร้าง Features และ Labels
                df = prepare_features_and_labels(raw_df)
                if df is None:
                    continue
                
                # 3. เทรนโมเดล Random Forest
                train_random_forest(df.copy(), symbol, timeframe)
                
                # 4. เทรนโมเดล LSTM
                train_lstm(df.copy(), symbol, timeframe)

            except Exception as e:
                print(f"เกิดข้อผิดพลาดระหว่างประมวลผล {symbol} ({timeframe}): {e}")
                continue

if __name__ == "__main__":
    # Create directories if they don't exist
    model_dir = os.path.join(os.path.dirname(__file__), 'models')
    if not os.path.exists(model_dir):
        os.makedirs(model_dir)
    
    main()
