import pandas as pd
import os
import argparse # (ใหม่) เพิ่ม Argument Parser
import joblib
from backtesting import Backtest, Strategy # type: ignore
from sklearn.model_selection import train_test_split # type: ignore

# (ใหม่) Import ฟังก์ชันคำนวณ Volatility และค่า Factor จาก create_labels (อัปเดต Path)
from create_labels import get_daily_volatility, TP_FACTOR, SL_FACTOR

# --- ส่วนที่ 1: สร้างคลาสกลยุทธ์ (Strategy) ---
class MLStrategy(Strategy):
    # --- ตั้งค่าตัวแปรสำหรับกลยุทธ์ ---
    symbol = None  # จะถูกกำหนดค่าจากภายนอก
    model = None   # จะถูกโหลดเข้ามาจากภายนอก
    
    # (ปรับปรุง) อัปเดตรายชื่อ Features ทั้งหมดให้ตรงกับตอนเทรนโมเดล
    # (ใหม่) เพิ่ม Features ที่เกี่ยวกับ Pivot Points
    feature_cols = [
        'RSI_14', 'MACD_12_26_9', 'MACDh_12_26_9', 'MACDs_12_26_9',
        'BBL_20_2.0',
        'BBU_20_2.0',
        'BBB_20_2.0', 
        'BBP_20_2.0',
        'ATRr_14', 'STOCHk_14_3_3', 'STOCHd_14_3_3',
        'dist_to_pp', 'dist_to_r1', 'dist_to_s1',
        'dist_to_r2', 'dist_to_s2',
        'trend_status', 'is_trending', 's1', 'r1' # (แก้ไข) จัดลำดับให้ตรงกับตอนเทรน
    ]

    # (ปรับปรุง) กำหนดขนาดของ Position เป็น 0.01 Lot (Fixed Lot Size)
    # 0.01 Lot = 1,000 units
    # Library backtesting.py จะใช้ค่า size ที่ > 1 เป็นจำนวน units
    position_size = 100
    # --- (ปรับปรุง) กำหนดค่า TP/SL แบบจุดคงที่ ---
    # ค่า 1 pip/point สำหรับคู่เงินส่วนใหญ่คือ 0.0001, สำหรับ XAU/USD คือ 0.01
    # คุณสามารถปรับค่า pip_size ให้ตรงกับ Symbol ที่กำลังทดสอบได้
    tp_pips = 100  # ตั้งเป้าหมายกำไร 1000 จุด
    sl_pips = 100  # (ปรับปรุง) ตั้งเป้าหมายขาดทุน 1000 จุด (ทำให้ R:R = 1:1)
    pip_size = 0.0001 # สำหรับ EUR/USD, GBP/USD etc.

    def init(self):
        # init() จะถูกเรียกแค่ครั้งเดียวตอนเริ่มต้น
        print("กำลังเริ่มต้น Strategy...")
        if self.model is None:
            raise Exception("Model is not loaded!")
        print(f"Strategy สำหรับ {self.symbol} เริ่มต้นทำงานเรียบร้อย")

    def next(self):
        # next() จะถูกเรียกในทุกๆ แท่งเทียน
        
        # --- เตรียมข้อมูล Features สำหรับแท่งเทียนปัจจุบัน ---
        # สร้าง DataFrame ขนาดเล็กสำหรับข้อมูลปัจจุบัน
        current_features = pd.DataFrame([self.data.df.iloc[-1][self.feature_cols]])
        
        # --- ทำนายสัญญาณด้วยโมเดล ---
        # model.predict() จะคืนค่าเป็น array เช่น [1] หรือ [-1] หรือ [0]
        signal = self.model.predict(current_features)[0]

        # (ใหม่) ดึงค่า Trend Status ปัจจุบัน
        current_trend = self.data.df.iloc[-1]['trend_status']

        # (ใหม่) ดึงค่าแนวรับ-แนวต้าน และ ATR ปัจจุบัน
        s1 = self.data.df.iloc[-1]['s1']
        r1 = self.data.df.iloc[-1]['r1']
        atr = self.data.df.iloc[-1]['ATRr_14'] * self.data.Close[-1] / 100 # แปลง ATRr เป็นค่าราคา
        price = self.data.Close[-1]

        # --- (ปรับปรุง) คำนวณระดับราคา TP/SL แบบจุดคงที่ ---
        price = self.data.Close[-1]
        # คำนวณ TP/SL สำหรับฝั่ง Long
        long_tp = price + self.tp_pips * self.pip_size
        long_sl = price - self.sl_pips * self.pip_size
        # คำนวณ TP/SL สำหรับฝั่ง Short
        short_tp = price - self.tp_pips * self.pip_size
        short_sl = price + self.sl_pips * self.pip_size

        # --- (ปรับปรุงครั้งใหญ่) ตรรกะการเข้าเทรดโดยอิงแนวรับ-แนวต้าน ---
        if self.position: # ถ้ามี position อยู่แล้ว ไม่ต้องทำอะไร
            return

        # --- เงื่อนไขการเข้า BUY ---
        # 1. สัญญาณเป็น BUY
        # 2. ตลาดไม่เป็นขาลง (เป็นขาขึ้นหรือ Sideways)
        # 3. ราคาปัจจุบันอยู่ใกล้แนวรับ S1 (ในระยะ 2*ATR)
        is_near_support = (price - s1) < (2 * atr) if atr > 0 else False
        if signal == 1 and current_trend >= 0 and is_near_support:
            self.buy(size=self.position_size, sl=long_sl, tp=long_tp)

        # สัญญาณ BUY
        is_near_resistance = (r1 - price) < (2 * atr) if atr > 0 else False
        if signal == -1 and current_trend <= 0 and is_near_resistance:
            self.sell(size=self.position_size, sl=short_sl, tp=short_tp)

def main(model_type, symbol, timeframe):
    data_dir = "ai_model/data/processed" # (แก้ไข) Path สำหรับข้อมูล
    model_dir = "ai_model/models"       # (แก้ไข) Path สำหรับโมเดล
    results_dir = "ai_model/results/backtests"

    # --- (ใหม่) สร้างโฟลเดอร์สำหรับเก็บผลลัพธ์ หากยังไม่มี ---
    os.makedirs(results_dir, exist_ok=True)
    # --- (ใหม่) ตรวจสอบว่าโฟลเดอร์ที่จำเป็นมีอยู่หรือไม่ ---
    if not os.path.isdir(data_dir):
        print(f"Error: ไม่พบโฟลเดอร์ข้อมูล '{data_dir}'")
        print("กรุณารันสคริปต์ 'prepare_data.py' และ 'create_labels.py' ก่อนทำการ backtest")
        return

    if not os.path.isdir(model_dir):
        print(f"Error: ไม่พบโฟลเดอร์โมเดล '{model_dir}'")
        print("กรุณารันสคริปต์ 'train_model.py' ก่อนทำการ backtest")
        return
    # ---------------------------------------------------------
    symbol_filename_base = symbol.replace('/', '_')
    data_filename = f"{symbol_filename_base}_{timeframe}_labeled.csv"
    model_filename = f"{symbol_filename_base}_{timeframe}_{model_type}.joblib"

    data_filepath = os.path.join(data_dir, data_filename)
    model_filepath = os.path.join(model_dir, model_filename)

    if not os.path.exists(data_filepath) or not os.path.exists(model_filepath):
        print(f"Skipping {symbol} ({timeframe}): Data or model file not found.")
        return

    print(f"\n{'='*25} Backtesting for {symbol} ({timeframe}) {'='*25}")

    # --- ขั้นตอนที่ 1: โหลดข้อมูลและโมเดล ---
    df = pd.read_csv(data_filepath, index_col='datetime', parse_dates=True)
    model = joblib.load(model_filepath)
    
    # --- ขั้นตอนที่ 2: แบ่งข้อมูล Test Set ---
    _, test_df = train_test_split(df, test_size=0.2, shuffle=False)
    
    # --- แก้ไขชื่อคอลัมน์ให้ตรงตามที่ backtesting.py ต้องการ ---
    test_df.rename(columns={
        'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'
    }, inplace=True)
    
    # --- ขั้นตอนที่ 3: รัน Backtest ---
    MLStrategy.symbol = symbol
    if 'XAU' in symbol: # (แก้ไข) XAU ใช้ 0.1
        MLStrategy.pip_size = 0.1
    elif 'JPY' in symbol: # (แก้ไข) JPY ใช้ 0.01
        MLStrategy.pip_size = 0.01
    else:
        MLStrategy.pip_size = 0.0001
    MLStrategy.model = model
    
    bt = Backtest(test_df, MLStrategy, cash=10000, commission=.002)
    stats = bt.run()
    
    # --- ขั้นตอนที่ 4: แสดงผลลัพธ์และบันทึกไฟล์ ---
    print("\n--- Backtest Statistics ---")
    print(stats)
    
    plot_filename = os.path.join(results_dir, f"{symbol_filename_base}_{timeframe}_{model_type}_backtest.html")
    bt.plot(filename=plot_filename, open_browser=False)

    stats_to_save = {
        'symbol': symbol,
        'return_pct': stats['Return [%]'],
        'buy_and_hold_return_pct': stats['Buy & Hold Return [%]'],
        'max_drawdown_pct': stats['Max. Drawdown [%]'],
        'win_rate_pct': stats['Win Rate [%]'],
        'total_trades': stats['# Trades'],
        'profit_factor': stats['Profit Factor'],
        'sharpe_ratio': stats['Sharpe Ratio'],
        'duration_days': stats.Duration.days,
    }
    
    stats_filename = os.path.join(results_dir, f"{symbol_filename_base}_{timeframe}_{model_type}_backtest_stats.json")
    with open(stats_filename, 'w') as f:
        pd.Series(stats_to_save).to_json(f, indent=4)

    print(f"\nกราฟ Backtest ถูกบันทึกในไฟล์: {plot_filename}")

# --- ส่วนหลักของการทำงาน (Main Execution) ---
if __name__ == "__main__":
    # (ใหม่) เพิ่มการรับ Argument จาก Command Line
    parser = argparse.ArgumentParser(description="Backtest a machine learning trading strategy.")
    parser.add_argument(
        '--model_type', 
        type=str, 
        default='random_forest', 
        help="Type of model to backtest (e.g., 'random_forest')."
    )
    parser.add_argument('--symbol', type=str, required=True, help="The trading symbol, e.g., 'EUR/USD'")
    parser.add_argument('--timeframe', type=str, required=True, help="The timeframe, e.g., '4h'")
    args = parser.parse_args()
    main(args.model_type, args.symbol, args.timeframe)
