import subprocess
import sys
import time

# --- Configuration ---
# เพิ่มคู่เงินและ Timeframe ที่คุณต้องการเทรนโมเดลที่นี่
SYMBOLS_TO_TRAIN = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'USD/CHF', 'XAU/USD']
TIMEFRAMES_TO_TRAIN = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

def run_script(script_name, args=[]):
    """Helper function to run a python script and check for errors."""
    command = [sys.executable, script_name] + args
    print(f"\n{'='*20} Running: {' '.join(command)} {'='*20}")
    process = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    
    if process.returncode != 0:
        print(f"--- ERROR running {script_name} ---")
        print("Stdout:")
        print(process.stdout)
        print("Stderr:")
        print(process.stderr)
        return False
    else:
        print(process.stdout)
        return True

def main():
    """
    Orchestrates the entire training pipeline:
    1. Prepare Data (Fetch from backend, calculate features)
    2. Create Labels (Apply triple-barrier method)
    3. Train Model (Train and save the model file)
    """
    for symbol in SYMBOLS_TO_TRAIN:
        for timeframe in TIMEFRAMES_TO_TRAIN:
            print(f"\n{'#'*50}")
            print(f"### Starting pipeline for {symbol} on {timeframe} timeframe ###")
            print(f"{'#'*50}\n")
            
            symbol_arg = symbol.replace('/', '_') # Convert 'EUR/USD' to 'EUR_USD' for filenames

            # Step 1: Prepare Data
            if not run_script('prepare_data.py', ['--symbol', symbol, '--timeframe', timeframe]):
                print(f"--- SKIPPING {symbol} {timeframe} due to data preparation error. ---")
                continue

            # Step 2: Create Labels
            if not run_script('create_labels.py', ['--symbol', symbol_arg, '--timeframe', timeframe]):
                print(f"--- SKIPPING {symbol} {timeframe} due to label creation error. ---")
                continue

            # Step 3: Train Model
            if not run_script('train_model.py', ['--symbol', symbol_arg, '--timeframe', timeframe]):
                print(f"--- SKIPPING {symbol} {timeframe} due to model training error. ---")
                continue

            print(f"\n{'*'*20} Successfully completed pipeline for {symbol} {timeframe} {'*'*20}")

        print(f"\nFinished all timeframes for {symbol}. Waiting 8 seconds before next symbol...")
        time.sleep(8)

if __name__ == "__main__":
    main()
