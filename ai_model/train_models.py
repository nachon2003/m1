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


def get_forex_data(symbol, interval="1day", output_size=5000):
    """
    (ใหม่) ฟังก์ชันสำหรับดึงข้อมูลราคา Forex ย้อนหลังจาก Twelvedata
    """
    # !!! สำคัญ: คุณสามารถเปลี่ยน API Key ได้ที่นี่ หากจำเป็น !!!
    API_KEY = "0f92aba424b54109a21f7bded3d06417" 
    
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

def prepare_features_and_labels(df):
    """(ใหม่) ฟังก์ชันสำหรับสร้าง Features และ Labels จาก DataFrame ดิบ"""
    if df is None or df.empty:
        return None
    
    print("กำลังสร้าง Features และ Labels...")
    # (ปรับปรุง) เพิ่ม RSI และ MACD เป็น Features
    df['returns'] = df['close'].pct_change()
    df['ma_5'] = df['close'].rolling(window=5).mean()
    df['ma_20'] = df['close'].rolling(window=20).mean()
    # ใช้ pandas_ta เพื่อเพิ่ม RSI และ MACD
    df.ta.rsi(length=14, append=True)
    df.ta.macd(fast=12, slow=26, signal=9, append=True)
    
    # Create labels: 1 for BUY (price goes up), -1 for SELL (price goes down), 0 for HOLD
    df['label'] = 0
    df.loc[df['close'].shift(-1) > df['close'], 'label'] = 1
    df.loc[df['close'].shift(-1) < df['close'], 'label'] = -1
    
    df.dropna(inplace=True)
    print("สร้าง Features (MA, Returns, RSI, MACD) และ Labels สำเร็จ")
    return df

def train_random_forest(df, symbol):
    """Trains and saves a Random Forest model."""
    print("\n--- Training Random Forest Model ---")
    # (ปรับปรุง) เพิ่ม Features ใหม่เข้าไปในลิสต์สำหรับเทรนโมเดล
    features = [
        'open', 'high', 'low', 'close', 
        'returns', 'ma_5', 'ma_20',
        'RSI_14', 
        'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9' # MACD ให้ค่ามา 3 เส้น
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
    model_filename = os.path.join(os.path.dirname(__file__), f"{symbol.replace('/', '_')}_random_forest.joblib")
    joblib.dump(model, model_filename)
    print(f"Random Forest model saved to {model_filename}")

def create_lstm_dataset(dataset, look_back=10, target_index=3):
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

def train_lstm(df, symbol):
    """Trains and saves an LSTM model."""
    print("\n--- Training LSTM Model ---")
    
    # (ปรับปรุง) ใช้ Features ชุดเดียวกับ Random Forest
    features = [
        'open', 'high', 'low', 'close', 
        'returns', 'ma_5', 'ma_20',
        'RSI_14', 
        'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9'
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
    model_filename = os.path.join(os.path.dirname(__file__), f"{symbol.replace('/', '_')}_lstm_model.h5")
    model.save(model_filename)
    print(f"LSTM model saved to {model_filename}")

    # Save scaler for prediction
    scaler_filename = os.path.join(os.path.dirname(__file__), f"{symbol.replace('/', '_')}_lstm_scaler.joblib")
    joblib.dump(scaler, scaler_filename)
    print(f"LSTM scaler saved to {scaler_filename}")


def main():
    """Main function to run the training process."""
    # (ปรับปรุง) กำหนดรายชื่อ 6 คู่เงินที่ต้องการเทรนโมเดล
    supported_symbols = [
        'EUR/USD', 
        'GBP/USD', 
        'USD/JPY', 
        'USD/CAD', 
        'USD/CHF', 
        'XAU/USD'
    ]

    # วนลูปเพื่อดึงข้อมูลและเทรนโมเดลสำหรับแต่ละคู่เงิน
    for symbol in supported_symbols:
        print(f"\n{'='*25} Processing {symbol} {'='*25}")
        try:
            # 1. ดึงข้อมูลดิบ
            raw_df = get_forex_data(symbol, interval="1day", output_size=5000)
            if raw_df is None:
                continue

            # 2. สร้าง Features และ Labels
            df = prepare_features_and_labels(raw_df)
            if df is None:
                continue
            
            # 3. เทรนโมเดล Random Forest
            train_random_forest(df.copy(), symbol)
            
            # 4. เทรนโมเดล LSTM
            train_lstm(df.copy(), symbol)

        except Exception as e:
            print(f"เกิดข้อผิดพลาดระหว่างประมวลผล {symbol}: {e}")
            continue

if __name__ == "__main__":
    # Create directories if they don't exist
    if not os.path.exists('ai_model'):
        os.makedirs('ai_model')
    
    main()
