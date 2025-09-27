import requests
import pandas as pd
import os
import time
import sys

# --- Configuration ---
BACKEND_URL = "http://localhost:3001"
OUTPUT_DIR = "ai_model/data/raw"
SYMBOLS_TO_FETCH = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'USD/CHF', 'XAU/USD']
TIMEFRAMES_TO_FETCH = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
DATA_LIMIT = 10000

def fetch_and_save_data(symbol, timeframe):
    """Fetches OHLC data from the backend API and saves it to a raw CSV file."""
    print(f"Fetching data for {symbol} on {timeframe} from {BACKEND_URL}...")
    api_url = f"{BACKEND_URL}/api/training/ohlc-data"
    
    try:
        params = {'symbol': symbol, 'timeframe': timeframe, 'limit': DATA_LIMIT}
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        data = response.json()

        if not data or not data.get('ohlcData'):
            print(f"Error: No 'ohlcData' key in response for {symbol} {timeframe}.")
            return False
        
        df = pd.DataFrame(data['ohlcData'])
        df['datetime'] = pd.to_datetime(df['time'])
        df.set_index('datetime', inplace=True)
        df.drop(columns=['time'], inplace=True) # Drop original time column

        # Save to file
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        symbol_filename = symbol.replace('/', '_')
        output_filepath = os.path.join(OUTPUT_DIR, f"{symbol_filename}_{timeframe}.csv")
        df.to_csv(output_filepath)
        
        print(f"Successfully fetched {len(df)} data points and saved to: {output_filepath}")
        return True

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data for {symbol} {timeframe}: {e}")
        return False

def main():
    """Main function to fetch and save all required data."""
    for symbol in SYMBOLS_TO_FETCH:
        for timeframe in TIMEFRAMES_TO_FETCH:
            if not fetch_and_save_data(symbol, timeframe):
                print(f"--- FAILED to fetch data for {symbol} {timeframe}. Skipping. ---")
            time.sleep(2) # Add a small delay between requests
        print(f"\nFinished all timeframes for {symbol}. Waiting 5 seconds before next symbol...")
        time.sleep(5)

if __name__ == "__main__":
    main()