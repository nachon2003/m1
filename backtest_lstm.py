import pandas as pd
import numpy as np
import os
import joblib
from backtesting import Backtest, Strategy # type: ignore
from sklearn.model_selection import train_test_split # type: ignore
from tensorflow.keras.models import load_model # type: ignore

# --- ส่วนที่ 1: สร้างคลาสกลยุทธ์สำหรับ LSTM ---
class LSTMStrategy(Strategy):
    symbol = None
    model = None
    scaler = None
    look_back = 10 # ต้องตรงกับตอนเทรน

    # (ปรับปรุง) อัปเดตรายชื่อ Features ทั้งหมดให้ตรงกับตอนเทรนโมเดล
    feature_cols = [
        'open', 'high', 'low', 'close',
        'returns', 'ma_5', 'ma_20',
        'RSI_14',
        'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9'
    ]
    close_price_index = feature_cols.index('close')

    position_size = 100
    tp_pips = 100
    sl_pips = 100
    pip_size = 0.0001

    def init(self):
        if self.model is None or self.scaler is None:
            raise Exception("LSTM Model or Scaler is not loaded!")
        print(f"LSTM Strategy สำหรับ {self.symbol} เริ่มต้นทำงานเรียบร้อย")

    def next(self):
        # ตรวจสอบว่ามีข้อมูลย้อนหลังเพียงพอหรือไม่
        if len(self.data.df) < self.look_back:
            return

        # --- เตรียมข้อมูล Features สำหรับ look_back แท่งล่าสุด ---
        latest_data = self.data.df.iloc[-self.look_back:][self.feature_cols].values
        current_price = self.data.Close[-1]

        # --- Scale ข้อมูล ---
        scaled_input = self.scaler.transform(latest_data)

        # --- Reshape ข้อมูลสำหรับ LSTM [samples, time_steps, features] ---
        X_pred = np.reshape(scaled_input, (1, self.look_back, len(self.feature_cols)))

        # --- ทำนายราคาปิดของแท่งถัดไป ---
        predicted_price_scaled = self.model.predict(X_pred, verbose=0)[0][0]

        # --- Inverse Transform เพื่อให้ได้ราคาจริง ---
        # สร้าง array หลอกสำหรับ inverse_transform
        dummy_array = np.zeros((1, len(self.feature_cols)))
        dummy_array[0, self.close_price_index] = predicted_price_scaled
        predicted_price = self.scaler.inverse_transform(dummy_array)[0, self.close_price_index]

        # --- สร้างสัญญาณจากราคาที่ทำนาย ---
        signal = 0 # HOLD
        if predicted_price > current_price * 1.001: # Threshold 0.1%
            signal = 1 # BUY
        elif predicted_price < current_price * 0.999: # Threshold 0.1%
            signal = -1 # SELL

        # --- ตรรกะการเข้าเทรด ---
        price = self.data.Close[-1]
        long_tp = price + self.tp_pips * self.pip_size
        long_sl = price - self.sl_pips * self.pip_size
        short_tp = price - self.tp_pips * self.pip_size
        short_sl = price + self.sl_pips * self.pip_size

        if signal == 1 and not self.position:
            self.buy(size=self.position_size, sl=long_sl, tp=long_tp)
        elif signal == -1 and not self.position:
            self.sell(size=self.position_size, sl=short_sl, tp=short_tp)

def main():
    data_dir = "ai_model/data/processed"
    model_dir = "ai_model/models"
    results_dir = "ai_model/results/backtests"

    # --- (ใหม่) สร้างโฟลเดอร์สำหรับเก็บผลลัพธ์ หากยังไม่มี ---
    os.makedirs(results_dir, exist_ok=True)

    # --- หาไฟล์โมเดลและไฟล์ข้อมูลที่คู่กัน ---
    files_map = {}
    for f in os.listdir(data_dir):
        if f.endswith('_labeled.csv'):
            symbol_key = f.replace('_4h_labeled.csv', '')
            if symbol_key not in files_map:
                files_map[symbol_key] = {}
            files_map[symbol_key]['data'] = f

    for f in os.listdir(model_dir):
        if f.endswith('_lstm_model.h5'):
            symbol_key = f.replace('_lstm_model.h5', '')
            if symbol_key not in files_map:
                files_map[symbol_key] = {}
            files_map[symbol_key]['model'] = f
            files_map[symbol_key]['scaler'] = f.replace('_lstm_model.h5', '_lstm_scaler.joblib')

    print("Backtesting LSTM Models...")
    # --- วนลูปเพื่อ Backtest ทุก Symbol ที่มีไฟล์ครบ ---
    for symbol_key, file_paths in files_map.items():
        if 'data' in file_paths and 'model' in file_paths and 'scaler' in file_paths:
            symbol_name = symbol_key.replace('_', '/')
            print(f"\n{'='*25} Backtesting for {symbol_name} {'='*25}")

            # --- โหลดข้อมูล, โมเดล, และ Scaler ---
            data_filepath = os.path.join(data_dir, file_paths['data'])
            model_filepath = os.path.join(model_dir, file_paths['model'])
            scaler_filepath = os.path.join(model_dir, file_paths['scaler'])

            df = pd.read_csv(data_filepath, index_col='datetime', parse_dates=True)
            model = load_model(model_filepath)
            scaler = joblib.load(scaler_filepath)

            _, test_df = train_test_split(df, test_size=0.2, shuffle=False)

            test_df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'}, inplace=True)

            # --- รัน Backtest ---
            LSTMStrategy.symbol = symbol_name
            if 'XAU' in symbol_name:
                LSTMStrategy.pip_size = 0.01
            else:
                LSTMStrategy.pip_size = 0.0001
            LSTMStrategy.model = model
            LSTMStrategy.scaler = scaler

            bt = Backtest(test_df, LSTMStrategy, cash=10000, commission=.002)
            stats = bt.run()

            print("\n--- Backtest Statistics (LSTM) ---")
            print(stats)

            plot_filename = f"ai_model/results/backtests/{symbol_key}_lstm_backtest.html"
            bt.plot(filename=plot_filename, open_browser=False)

            stats_to_save = {
                'symbol': symbol_name,
                'model_type': 'LSTM',
                'start_date': str(stats.Start),
                'end_date': str(stats.End),
                'duration_days': stats.Duration.days,
                'return_pct': stats['Return [%]'],
                'buy_and_hold_return_pct': stats['Buy & Hold Return [%]'],
                'max_drawdown_pct': stats['Max. Drawdown [%]'],
                'win_rate_pct': stats['Win Rate [%]'],
                'total_trades': stats['# Trades'],
                'sharpe_ratio': stats['Sharpe Ratio'],
                'profit_factor': stats['Profit Factor'],
                'sqn': stats['SQN']
            }

            stats_filename = f"ai_model/results/backtests/{symbol_key}_lstm_backtest_stats.json"
            with open(stats_filename, 'w') as f:
                pd.Series(stats_to_save).to_json(f, indent=4)

            print(f"\nกราฟ Backtest (LSTM) ถูกบันทึกในไฟล์: {plot_filename}")
        else:
            print(f"\nข้าม {symbol_key} เนื่องจากไม่มีไฟล์ LSTM หรือ Scaler ครบถ้วน")

if __name__ == "__main__":
    main()