## Run aiws CLI

```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws "$@"
elif command -v aiws >/dev/null 2>&1; then
  aiws "$@"
else
  npx @aipper/aiws "$@"
fi
```
