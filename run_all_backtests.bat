@echo off
setlocal

REM --- Configuration ---
REM (แก้ไข) กำหนด Path ไปยัง Python executable ของคุณ (ถ้าจำเป็น)
set PYTHON_EXEC=python

REM (แก้ไข) เพิ่มหรือลดคู่เงินและ Timeframe ที่คุณมีโมเดลฝึกไว้
set SYMBOLS="EUR/USD" "GBP/USD" "USD/JPY" "USD/CAD" "USD/CHF" "XAU/USD"
set TIMEFRAMES="1m" "5m" "15m" "30m" "1h" "4h" "1d"

echo ======================================================
echo Starting backtest for all symbols and timeframes...
echo ======================================================

REM วนลูปสำหรับทุก Timeframe
for %%t in (%TIMEFRAMES%) do (
    REM วนลูปสำหรับทุก Symbol
    for %%s in (%SYMBOLS%) do (
        echo.
        echo --- Running Backtest for %%~s on %%~t timeframe ---
        "%PYTHON_EXEC%" "backtest.py" --model_type random_forest --symbol %%~s --timeframe %%~t
    )
)

echo.
echo ======================================================
echo All backtests completed!
echo You can now view the results on the dashboard.
echo ======================================================

endlocal
pause