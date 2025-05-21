# Visualisation UI

The `ui_visualization` directory contains a small D3-based web page used to inspect the dependency graph of a paper. Data files are loaded from `ui_visualization/data/<paper-id>.json`.

To view the graph simply open `index.html` in a browser. Enter the paper ID (e.g. `2411.08218`) and click "Load Graph".

Data files can be produced with `generate_data.py` (see below).

## Generating visualisation data

```
python ui_visualization/generate_data.py \
    --project_path data/processed/source/projects_with_proofs/2411/2411.08218 \
    --project_proofs_dir data/proofs/2411/2411.08218 \
    --output ui_visualization/data/2411.08218.json
```

The resulting JSON file can then be loaded in the UI.
