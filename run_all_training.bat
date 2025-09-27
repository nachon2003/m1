@echo off
setlocal

REM --- Configuration ---
REM กำหนด Path ไปยัง Python executable ของคุณ (ถ้าจำเป็น)
set PYTHON_EXEC=python

REM กำหนด Path ไปยัง Node.js executable (ถ้าจำเป็น)
set NODE_EXEC=node

REM (สำคัญ) แก้ไขรายการให้ตรงกับคู่เงินและ Timeframe ที่คุณต้องการฝึกโมเดล
set SYMBOLS="EUR/USD" "GBP/USD" "USD/JPY" "USD/CAD" "USD/CHF" "XAU/USD"
set TIMEFRAMES="1m" "5m" "15m" "30m" "1h" "4h" "1d"

echo ======================================================
echo Starting training pipeline for all symbols and timeframes...
echo ======================================================

REM (แก้ไข) เปลี่ยนมาเรียกใช้สคริปต์ Python ที่ควบคุมกระบวนการเทรนทั้งหมด
"%PYTHON_EXEC%" "run_training_pipeline.py"

echo.
echo ======================================================
echo All training pipelines completed!
echo You can now run the backtest script again.
echo ======================================================

endlocal
pause
