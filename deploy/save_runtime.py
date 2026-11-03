"""Save only public connection settings for image rollback, never session secrets."""
import json
from pathlib import Path
import subprocess
import sys


KEYS = ("CMP_ODOO_UPSTREAM", "CMP_ODOO_DB", "CMP_ODOO_HOST", "CMP_ODOO_URL", "CMP_APP_URL")


def main():
    # Docker's template prints only these whitelisted variables; other environment
    # values, cookies, credentials and runtime files are never exported.
    condition = " ".join(f'(eq (index $parts 0) "{key}")' for key in KEYS)
    template = '{{range .Config.Env}}{{$parts := split . "="}}{{if or ' + condition + '}}{{println (json .)}}{{end}}{{end}}'
    output = subprocess.check_output(["docker", "inspect", "--format", template, sys.argv[1]], text=True)
    values = dict(json.loads(line).split("=", 1) for line in output.splitlines() if line.strip())
    if not (values.get("CMP_ODOO_UPSTREAM") or values.get("CMP_ODOO_URL")) or not values.get("CMP_ODOO_DB"):
        raise SystemExit("Cannot preserve the previous Odoo connection settings")
    folder = Path(__file__).resolve().parent.parent / ".deploy-state"
    folder.mkdir(exist_ok=True)
    text = "services:\n  web:\n    environment:\n" + "".join(f"      {key}: {json.dumps(values[key])}\n" for key in KEYS if key in values)
    temporary = folder / "previous-runtime.tmp"
    temporary.write_text(text)
    temporary.replace(folder / "previous-runtime.yaml")


if __name__ == "__main__":
    main()
