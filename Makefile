.PHONY: help test test-unit test-integration test-coverage install clean lint format

# Variables
PYTHON := python
PIP := pip
PYTEST := pytest

help:
	@echo "📋 Spark Graph Viewer - Test Commands"
	@echo ""
	@echo "Usage: make [command]"
	@echo ""
	@echo "Available commands:"
	@echo "  install          Install test dependencies"
	@echo "  test             Run all tests"
	@echo "  test-unit        Run unit tests only"
	@echo "  test-integration Run integration tests only"
	@echo "  test-coverage    Run tests with coverage and generate report"
	@echo "  test-verbose     Run tests with verbose output"
	@echo "  test-debug       Run tests in debug mode"
	@echo "  test-spark       Run tests that require Spark only"
	@echo "  test-nospark     Skip tests that require Spark"
	@echo "  lint             Run code quality checks"
	@echo "  format           Format code with Black/isort"
	@echo "  clean            Remove temporary files"
	@echo ""

install:
	$(PIP) install -r requirements.txt
	@echo "✅ Dependencies installed successfully!"

test:
	$(PYTEST)

test-unit:
	$(PYTEST) -m unit -v

test-integration:
	$(PYTEST) -m integration -v

test-coverage:
	$(PYTEST) --cov=app --cov-report=html --cov-report=term-missing
	@echo "📊 Coverage report generated at htmlcov/index.html"

test-verbose:
	$(PYTEST) -v

test-debug:
	$(PYTEST) --pdb -s

test-spark:
	$(PYTEST) -m spark -v

test-nospark:
	$(PYTEST) -m "not spark" -v

lint:
	$(PYTHON) -m flake8 app.py tests/ --max-line-length=120 --ignore=E203,W503
	@echo "✅ Code quality check completed!"

format:
	$(PYTHON) -m black app.py tests/
	$(PYTHON) -m isort app.py tests/
	@echo "✅ Code formatted successfully!"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache htmlcov .coverage
	@echo "🧹 Temporary files removed!"

.DEFAULT_GOAL := help
