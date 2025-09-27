@echo off
setlocal

REM --- Configuration ---
set PYTHON_EXEC=python

echo ======================================================
echo Starting to fetch all raw market data...
echo This will take some time.
echo ======================================================

"%PYTHON_EXEC%" "fetch_all_data.py"

echo.
echo ======================================================
echo All raw data has been fetched and saved to CSV files.
echo You can now run the training pipeline.
echo ======================================================

endlocal
pause