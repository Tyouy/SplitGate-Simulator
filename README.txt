Split Gate Lab — Semi-infinite Split Gates
=========================================

START
Double-click Start-Simulation.bat for the English offline GUI.
Double-click Stop-Simulation.bat to stop the local service.
Python 3 and a modern browser are sufficient. See README.md for usage.

GEOMETRY
The electrodes occupy x < -L/2 and x > L/2, with -d <= z <= 0.
They are semi-infinite along x and uniform along y. There is no physical
electrode width W. W in legacy parameter files is ignored.
The flat sample is at z=D; hBN occupies 0<z<D. Optional top hBN has thickness cap.
H is measured from the metal bottom to grounded Si through SiO2.
back=false replaces grounded Si by a finite-box approximation to a SiO2
half-space. The gap at -d<z<0 contains air (gap=0), hBN (1), or SiO2 (2).

NUMERICAL DOMAIN
Only x>=0 is solved, with mirror symmetry at x=0.
X=L/2+box*max(L,500 nm). Metal occupies every node at x>=L/2 and -d<=z<=0,
including the outermost x column. There is no physical outer metal edge.
Zero x flux at X approximates the laterally uniform far-field MOS stack.
The upper boundary is D+cap+box*max(L,500 nm), with zero normal flux.
The lower boundary is -d-H with a backgate, or -d-box*max(L,500 nm) without it.
Grounded Si has phi=0; without it, the lower boundary has zero normal flux.
The split gates have phi=Vg-VFB. Increase box and mesh resolution to check
numerical truncation and mesh errors in the approximation to infinity.
Domain extension factor is a numerical parameter, not a gate width.

VOLTAGE
Vg means Vg-VFB; assume VFB=0 unless accounted for in the supplied bias.
There is no +/-30 V limit or voltage clipping in the GUI, sweeps or solver.
Any finite voltage may be entered, subject to numerical convergence.
Leakage, breakdown and high-density band reconstruction are not modeled.

ENERGY AND SELF-CONSISTENCY
Ground fixes the equilibrium electrochemical potential EF, not phi_s(x).
Set EF=0. In eV, mu(x)=mu0+phi_s(x)=EF-Emid(x).
EF-EC(x)=mu(x)-Eg/2. EF itself is uniform.

div(epsilon grad(phi)) = -sigma(x) delta(z-D)
sigma = e [p(mu)-n(mu)+Nfixed]
n = sum_j DOS_j kT log[1+exp((mu-Ec_j)/kT)]
p = DOS_h kT log[1+exp((-mu-Eg/2)/kT)]
DOS_j = g_j m_j/(2 pi hbar^2)

Sheet charge supplies a flux jump in the finite-volume equations.
Its nonlinear derivative includes quantum capacitance in Newton iterations.
There is no imposed zero-potential boundary in the metal-free gap.
For nonzero mu0, Nfixed=n(mu0)-p(mu0) defines a uniformly doped reference
state compensated to give phi=0 at zero applied voltage.
Check n+p, rather than just n-p or dmu/dVg, when discussing depletion.

MATERIAL MODEL
Illustrative quasiparticle gap Eg=2 eV, T=4 K, both adjustable.
Do not substitute an exciton optical transition directly for Eg.
Representative K-valley parabolic DOS for monolayer WSe2:
lower conduction branch m=0.40m0, g=2;
upper conduction branch m=0.29m0, g=2, 30 meV higher;
valence branch m=0.36m0, g=2.
hBN: epsilon_x=6.9, epsilon_z=3.4; SiO2=3.9; air=1.
Additional valleys, nonparabolicity, exchange/correlation, traps, nonuniform
background charge, contact pinning, hBN sagging and nonequilibrium transport
are outside this model. Equilibration with a grounded reservoir is assumed.
Extremely small thermal densities may underflow to zero; the GUI shows <1 cm^-2.

METHOD AND VALIDATION
Nonuniform anisotropic finite volumes, damped Newton, and IC(0)-preconditioned
conjugate gradients. residual is max |r_i|/A_ii in volts, not a global error bound.
examples/validation.json compares with an independent SciPy sparse-direct
Newton solution and the far-field self-consistent parallel-plate MOS equation.
examples/numerical-checks.json includes mesh/domain checks, negative and high
voltage, metal reaching the outer boundary, and legacy W removal checks.

REFERENCES
Chaves et al., Gate Tunable Lateral 2D pn Junctions: An Analytical Study
of Its Electrostatics. https://arxiv.org/abs/2302.02794
Its main analytic limit neglects the metal gap; this solver retains L.
Pierret et al., Dielectric permittivity, conductivity and breakdown field
of hexagonal boron nitride. https://arxiv.org/abs/2201.05826
Laturia et al., Dielectric properties of hexagonal boron nitride and
transition metal dichalcogenides. https://doi.org/10.1038/s41699-018-0050-x
Ten-valley excitonic complexes in charge-tunable monolayer WSe2.
https://www.nature.com/articles/s41467-025-65731-x
Kormanyos et al., k.p theory for two-dimensional transition metal
dichalcogenide semiconductors. https://arxiv.org/abs/1410.6666
