# Split Gate Lab — Semi-infinite Gates

Offline self-consistent electrostatics for a grounded 2D semiconductor above a split gate.

## Launch

Double-click **Start-Simulation.bat**. The app starts a loopback-only local server and opens your default browser. Python 3 and a modern browser are sufficient; no extra packages or online services are required. Repeated launches reuse the local server. Double-click **Stop-Simulation.bat** to stop it.

## Geometry

- Left gate: **x < −L/2**. Right gate: **x > L/2**. Both occupy **−d ≤ z ≤ 0** and have the same voltage.
- Gates are **semi-infinite along x**. The structure is uniform along y, perpendicular to the x–z cross-section. There is **no physical gate-width parameter W**.
- The sample is flat at z = D, with hBN at 0 < z < D and an optional top hBN cap.
- D is measured from the metal top to the sheet. H is the SiO₂ thickness from the metal bottom to a grounded Si plane.
- The gap below hBN can contain air, hBN or SiO₂.

The numerical box is finite, but metal extends to its outer boundary: there is no artificial outer metal edge. A zero-x-flux boundary approximates the laterally uniform far-field MOS stack. **Domain extension factor** controls numerical truncation, not gate width. Increase it to check convergence toward the semi-infinite limit.

## Voltage

Any finite **Vg − VFB** may be entered for profiles and sweeps, including values above 30 V. The old ±30 V limit was an arbitrary interface restriction and has been removed. The solver does not clip voltage.

Numerical convergence and the assumptions of the electrostatic band model still apply. The model does not include leakage, dielectric breakdown, or high-density changes in band structure. Accepting an input is not a physical validation of that operating point.

## Use

1. Set L, D, d, bias, substrate boundary and material parameters.
2. Select **Calculate profile**; switch among **Chemical potential μ**, **EF − EC** and **Carrier density**. Move the pointer to inspect local values.
3. Set start/end voltages and point count, then select **Run sweep**. Each point is self-consistent.
4. Export CSV/PNG or save/load parameter JSON.

### Overlay different gate voltages

In **Lateral profile**, enter a comma-separated voltage list under **Overlay gate voltages** (for example `0, 10, 20, 50`) and select **Compute stack**. All curves use the geometry and material parameters currently in the form. Each voltage is solved self-consistently; the curves share the same axes without a vertical offset.

Use **Single bias / Stacked biases** to change the display, and switch between chemical potential, EF − EC and carrier density for the entire set. The colored legend is included in saved PNGs. **Export stack CSV** exports all curves with a `Vg_V` column. The center metrics and cross-section continue to refer to the current Common bias field.

**Run sweep** also stores and overlays the full lateral profiles at every sweep voltage. Stacks are restored with completed results. Changing geometry or material parameters and recalculating a single profile disables a stack that no longer matches.

The browser remembers completed results. Changed parameters are clearly marked until recalculation. Old finite-width cached results are not restored. Older parameter files containing W can be loaded; W is ignored.

## Physics

The equilibrium electrochemical potential EF is uniform. The plotted **μ(x) = EF − Emid(x)** is relative to the local midgap; **EF − EC(x) = μ(x) − Eg/2**. Check **n + p**, rather than only n − p or dμ/dVg, when discussing depletion.

Defaults are illustrative: L = 2 μm, D = d = 40 nm, Vg = 10 V, monolayer WSe₂, Eg = 2 eV, T = 4 K, μ₀ = 0, VFB = 0, air in the metal gap, and 285 nm SiO₂ / grounded Si. Match these assumptions to the device.

See [README.txt](README.txt) for equations, material parameters, boundaries and references. `examples/` contains regenerated semi-infinite-gate CSVs, figures and numerical checks.

## Files

- `solver.js`: anisotropic finite-volume Poisson–Thomas–Fermi solver.
- `solver-worker.js`: background profile and sweep jobs.
- `index.html`, `app.js`, `styles.css`: English offline interface.
- `baseline.js`: precomputed results for the corrected geometry.
- `server.py`: standard-library local server and launcher.
- `test-worker.cjs`: integration checks, including a 40–60 V sweep.
- `profile-data.js`, `test-profile-data.cjs`: overlay transforms, voltage parsing and multi-bias CSV checks.

The server normally uses port 8765 and selects another available local port if needed. Logs are in `logs/server.log`.
