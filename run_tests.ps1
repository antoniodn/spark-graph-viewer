# Script to run automated tests - Spark Graph Viewer
# Usage: .\run_tests.ps1 -Option [option]
# 
# Options:
#   All          - Run all tests (default)
#   Unit         - Unit tests only
#   Integration  - Integration tests only
#   Coverage     - Run tests with coverage
#   Verbose      - Verbose output
#   Debug        - Debug mode with breakpoint

param(
    [string]$Option = "All"
)

Write-Host "`n" -ForegroundColor White

switch ($Option.ToLower()) {
    "all" {
        Write-Host "=== Running all tests ===" -ForegroundColor Green
        pytest
    }
    "unit" {
        Write-Host "=== Running unit tests ===" -ForegroundColor Green
        pytest -m unit -v
    }
    "integration" {
        Write-Host "=== Running integration tests ===" -ForegroundColor Green
        pytest -m integration -v
    }
    "coverage" {
        Write-Host "=== Running tests with coverage ===" -ForegroundColor Green
        pytest --cov=app --cov-report=html --cov-report=term-missing
        Write-Host "`n=== Opening coverage report ===" -ForegroundColor Green
        Start-Process "htmlcov\index.html"
    }
    "verbose" {
        Write-Host "=== Running tests with verbose output ===" -ForegroundColor Green
        pytest -v
    }
    "debug" {
        Write-Host "=== Running tests in debug mode ===" -ForegroundColor Green
        pytest --pdb -s
    }
    "spark" {
        Write-Host "=== Running only tests that require Spark ===" -ForegroundColor Green
        pytest -m spark -v
    }
    "nospark" {
        Write-Host "=== Running tests (excluding Spark) ===" -ForegroundColor Green
        pytest -m "not spark" -v
    }
    "help" {
        Write-Host @"
Usage: .\run_tests.ps1 -Option [option]

Available options:
  All          - Run all tests (default)
  Unit         - Unit tests only
  Integration  - Integration tests only
  Coverage     - Run tests with coverage and generate report
  Verbose      - Verbose output with details
  Debug        - Debug mode with breakpoint
  Spark        - Only tests that require Spark
  NoSpark      - Skip tests that require Spark
  Help         - Show this message

Examples:
  .\run_tests.ps1                    # Run all tests
  .\run_tests.ps1 -Option unit       # Unit tests only
  .\run_tests.ps1 -Option coverage   # With coverage
"@ -ForegroundColor Cyan
    }
    default {
        Write-Host "Unknown option: $Option" -ForegroundColor Red
        Write-Host "Use: .\run_tests.ps1 -Option help" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`n===================================" -ForegroundColor White
Write-Host "Tests completed!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor White
