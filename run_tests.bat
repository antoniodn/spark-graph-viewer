@echo off
REM Script to run automated tests - Spark Graph Viewer
REM Usage: run_tests.bat [option]
REM Options:
REM   all              - Run all tests (default)
REM   unit             - Unit tests only
REM   integration      - Integration tests only
REM   coverage         - Run tests with coverage
REM   verbose          - Verbose output
REM   debug            - Debug mode with breakpoint

setlocal enabledelayedexpansion

if "%~1"=="" (
    echo.
    echo === Running all tests ===
    pytest
) else if "%~1"=="all" (
    echo.
    echo === Running all tests ===
    pytest
) else if "%~1"=="unit" (
    echo.
    echo === Running unit tests ===
    pytest -m unit -v
) else if "%~1"=="integration" (
    echo.
    echo === Running integration tests ===
    pytest -m integration -v
) else if "%~1"=="coverage" (
    echo.
    echo === Running tests with coverage ===
    pytest --cov=app --cov-report=html --cov-report=term-missing
    echo.
    echo === Opening coverage report ===
    start "" htmlcov\index.html
) else if "%~1"=="verbose" (
    echo.
    echo === Running tests with verbose output ===
    pytest -v
) else if "%~1"=="debug" (
    echo.
    echo === Running tests in debug mode ===
    pytest --pdb -s
) else if "%~1"=="help" (
    echo.
    echo Usage: run_tests.bat [option]
    echo.
    echo Available options:
    echo   all          - Run all tests (default)
    echo   unit         - Unit tests only
    echo   integration  - Integration tests only
    echo   coverage     - Run tests with coverage and generate report
    echo   verbose      - Verbose output with details
    echo   debug        - Debug mode with breakpoint
    echo   help         - Show this message
) else (
    echo Unknown option: %~1
    echo Use: run_tests.bat help
)

REM Mostrar resumo
echo.
echo ===================================
echo Tests completed!
echo ===================================
