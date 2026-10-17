"""Feature-specific API routers."""

import importlib.util
import sys
from pathlib import Path

from . import github, slack

# Dynamically import dignity-score.py to allow standard Python attribute and module access
_dignity_score_path = Path(__file__).parent / "dignity-score.py"
if _dignity_score_path.exists():
    _spec = importlib.util.spec_from_file_location("routers.dignity_score", _dignity_score_path)
    if _spec and _spec.loader:
        _dignity_mod = importlib.util.module_from_spec(_spec)
        sys.modules["routers.dignity_score"] = _dignity_mod
        _spec.loader.exec_module(_dignity_mod)
        dignity_score = _dignity_mod
    else:
        dignity_score = None
else:
    dignity_score = None

__all__ = ["dignity_score", "github", "slack"]
