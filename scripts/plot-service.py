"""Plot verify-service.ts CSVs; optional validation dependencies: numpy, matplotlib."""
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parents[1]
fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True, layout="constrained")
for ax, tone in zip(axes, (0, 10)):
    data = np.genfromtxt(root / f"simulation/evidence/service-tone-{tone}.csv", delimiter=",", names=True)
    ax.plot((data["time_s"] - 0.08) * 1000, data["output_V"], linewidth=1, color="#1c614a")
    ax.set(title=f"TONE {tone} / GAIN 10 / LEVEL 10 / effect ON", ylabel="Output (V)", ylim=(-3, 3))
    ax.set_xticks(range(16))
    ax.set_yticks(range(-3, 4))
    ax.grid(alpha=0.25)
axes[-1].set_xlabel("Time from 80 ms (ms)")
fig.suptitle("BD-2 research model / 200 Hz, 5 mV p-p square / no normalization")
target = root / "simulation/evidence/service-endpoints.svg"
fig.savefig(target)
target.write_text("\n".join(line.rstrip() for line in target.read_text().splitlines()) + "\n")
