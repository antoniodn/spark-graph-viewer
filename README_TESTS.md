## 🚀 Quick Start - Spark Graph Viewer Testing Structure

### ⚡ Get Started in 30 Seconds

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run tests
pytest

# 3. See coverage
pytest --cov=app --cov-report=term-missing
```

### 📁 Created Files

| File | Purpose |
|---------|-----------|
| `tests/` | Directory with all tests |
| `tests/conftest.py` | Global configurations and fixtures |
| `tests/test_app.py` | Endpoint tests (integration) |
| `tests/test_functions.py` | Function tests (unit) |
| `pytest.ini` | Pytest configuration |
| `requirements.txt` | Dependencies (updated) |
| `TESTING.md` | Complete testing guide |
| `TEST_ARCHITECTURE.md` | Architecture and best practices |
| `EXEMPLOS_TESTES.py` | Examples of different test types |
| `run_tests.bat` | Windows script to run tests |
| `run_tests.ps1` | PowerShell script to run tests |
| `Makefile` | Make commands for any OS |
| `.github/workflows/tests.yml` | CI/CD with GitHub Actions |

### 🎯 Main Commands

```bash
# Run all tests
pytest

# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# With detailed output
pytest -v

# With code coverage
pytest --cov=app --cov-report=html

# Skip tests that require Spark
pytest -m "not spark"

# Open coverage report (Windows)
pytest --cov=app --cov-report=html && start htmlcov/index.html

# Open coverage report (Linux/Mac)
pytest --cov=app --cov-report=html && open htmlcov/index.html
```

### 🪟 Windows (Convenient Commands)

```batch
# Using batch script
run_tests.bat                    # Run all
run_tests.bat unit              # Unit tests only
run_tests.bat coverage          # With coverage
run_tests.bat help              # See help

# Or using PowerShell
.\run_tests.ps1                 # Run all
.\run_tests.ps1 -Option unit    # Unit tests only
.\run_tests.ps1 -Option help    # See help
```

### 🐧 Linux/Mac (Make Commands)

```bash
make test                       # Run all
make test-unit                  # Unit tests only
make test-integration           # Integration tests only
make test-coverage              # With coverage
make lint                       # Check quality
make format                     # Format code
make clean                      # Clean temporary files
make help                       # See all commands
```

### 📚 Test Structure

```python
@pytest.mark.unit
class TestMyComponent:
    """Tests for my component."""
    
    def test_case_of_success(self):
        """Tests the happy path."""
        # Arrange (prepare)
        entrada = "data"
        
        # Act (execute)
        resultado = my_function(entrada)
        
        # Assert (verify)
        assert resultado == "expected"
    
    def test_case_of_error(self):
        """Tests error handling."""
        with pytest.raises(ValueError):
            my_function("invalid input")
```

### ✅ Checklist - Next Steps

- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Run tests: `pytest`
- [ ] Check coverage: `pytest --cov=app --cov-report=term-missing`
- [ ] Read `TESTING.md` for complete guide
- [ ] Read `TEST_ARCHITECTURE.md` to understand architecture
- [ ] See `EXEMPLOS_TESTES.py` for practical examples
- [ ] Add new tests as you develop

### 📊 Complete Folder Structure

```
c:\Dev\graphapp/
├── app.py                          # Main application
├── requirements.txt                # Dependencies (UPDATED)
├── pytest.ini                      # Pytest configuration
├── Makefile                        # Make commands
├── run_tests.bat                   # Windows batch script
├── run_tests.ps1                   # Windows PowerShell script
├── TESTING.md                      # Testing guide
├── TEST_ARCHITECTURE.md            # Test architecture
├── EXEMPLOS_TESTES.py              # Test examples
├── .github/
│   └── workflows/
│       └── tests.yml               # CI/CD GitHub Actions
└── tests/                          # All tests here
    ├── __init__.py
    ├── conftest.py                 # Fixtures and configuration
    ├── test_app.py                 # Endpoint tests
    └── test_functions.py           # Function tests
```

### 🎓 Next Steps to Learn

1. **Read TESTING.md** - Practical guide on how to execute
2. **Read TEST_ARCHITECTURE.md** - Understand the philosophy
3. **Study EXEMPLOS_TESTES.py** - See different patterns
4. **Execute tests** - Run any command above
5. **Add your own tests** - Use templates as base

### 💡 Quick Tips

- Use `@pytest.mark.unit` for fast tests
- Use `@pytest.mark.integration` for endpoint tests
- Use `@pytest.mark.spark` for tests that need Spark
- Use fixtures in conftest.py for reusable data
- Mock external dependencies with `@patch`
- Always test behavior, not implementation

### 🚨 Troubleshooting

**Error: "pytest: command not found"**
```bash
pip install pytest pytest-asyncio pytest-cov pytest-mock httpx
```

**Error: "module 'app' not found"**
- Make sure conftest.py is in `tests/conftest.py`
- That conftest.py adds the root directory to the path

**Spark not available**
```bash
# Skip tests that require Spark
pytest -m "not spark"
```

### 📞 Resources

- [Pytest Official Docs](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [Python unittest.mock](https://docs.python.org/3/library/unittest.mock.html)

---

**All set! Start writing tests! 🧪**
