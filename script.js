class MetodoGrafico {
  constructor(coefX1, coefX2, objectiveType, constraints) {
    this.coefX1 = coefX1;
    this.coefX2 = coefX2;
    this.objectiveType = objectiveType; // "max" o "min"
    this.constraints = constraints;     // array de objetos {c1,c2,rhs,ineq}
  }

  getIntersection(c1, c2) {
    let det = c1.c1 * c2.c2 - c2.c1 * c1.c2;
    if (Math.abs(det) < 1e-9) return null;
    let x = (c1.rhs * c2.c2 - c2.rhs * c1.c2) / det;
    let y = (c1.c1 * c2.rhs - c2.c1 * c1.rhs) / det;
    return { x, y };
  }

  isFeasible(p) {
    if (!p || p.x < -1e-6 || p.y < -1e-6) return false;
    return this.constraints.every(c => {
      let val = c.c1 * p.x + c.c2 * p.y;
      if (c.ineq === "max") return val <= c.rhs + 1e-6;
      if (c.ineq === "min") return val >= c.rhs - 1e-6;
      if (c.ineq === "equal") return Math.abs(val - c.rhs) < 1e-6;
      return false;
    });
  }

  evaluateObjective(p) {
    return this.coefX1 * p.x + this.coefX2 * p.y;
  }

  solve() {
    let points = [];

    // intersecciones entre restricciones
    for (let i = 0; i < this.constraints.length; i++) {
      for (let j = i + 1; j < this.constraints.length; j++) {
        let p = this.getIntersection(this.constraints[i], this.constraints[j]);
        if (this.isFeasible(p)) points.push(p);
      }
    }

    // intersecciones con ejes
    this.constraints.forEach(c => {
      if (c.c1 !== 0) {
        let p = { x: c.rhs / c.c1, y: 0 };
        if (this.isFeasible(p)) points.push(p);
      }
      if (c.c2 !== 0) {
        let p = { x: 0, y: c.rhs / c.c2 };
        if (this.isFeasible(p)) points.push(p);
      }
    });

    // incluir origen si es factible
    if (this.isFeasible({ x: 0, y: 0 })) points.push({ x: 0, y: 0 });

    // eliminar duplicados
    points = points.filter(
      (p, i, self) => i === self.findIndex(q => Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6)
    );

    // ordenar puntos alrededor del centro (para dibujar polígono bien)
    if (points.length > 2) {
      const center = {
        x: points.reduce((s, p) => s + p.x, 0) / points.length,
        y: points.reduce((s, p) => s + p.y, 0) / points.length
      };
      points.sort((a, b) =>
        Math.atan2(a.y - center.y, a.x - center.x) -
        Math.atan2(b.y - center.y, b.x - center.x)
      );
    }

    // evaluar FO
    let bestPoint = null;
    let bestValue = (this.objectiveType === "max") ? -Infinity : Infinity;
    let evaluations = [];

    points.forEach(p => {
      let val = this.evaluateObjective(p);
      evaluations.push({ ...p, Z: val });
      if (this.objectiveType === "max" && val > bestValue) {
        bestValue = val; bestPoint = p;
      }
      if (this.objectiveType === "min" && val < bestValue) {
        bestValue = val; bestPoint = p;
      }
    });

    return { evaluations, bestPoint, bestValue, feasiblePolygon: points };
  }
}

// ------------------- UI -------------------
const constraintsDiv = document.getElementById("constraints");
const addConstraintBtn = document.getElementById("addConstraint");
const solveBtn = document.getElementById("solveBtn");
const tableBody = document.querySelector("#resultsTable tbody");
const optimoBox = document.getElementById("optimo");
const chartCanvas = document.getElementById("chart");
let chart;

function addConstraintRow() {
  const row = document.createElement("div");
  row.className = "inputs-row constraint-row";
  row.innerHTML = `
    <input type="number" placeholder="Coef x1" step="any" class="coefX1" style="text-align:center;">
    <span>x1 +</span>
    <input type="number" placeholder="Coef x2" step="any" class="coefX2" style="text-align:center;">
    <span>x2</span>
    <select class="ineq">
      <option value="max"><=</option>
      <option value="min">>=</option>
      <option value="equal">=</option>
    </select>
    <input type="number" placeholder="Valor" step="any" class="rhs" style="text-align:center;">
  `;
  constraintsDiv.appendChild(row);
}

// Al iniciar, agregamos una fila por defecto
addConstraintRow();

addConstraintBtn.addEventListener("click", addConstraintRow);

solveBtn.addEventListener("click", () => {
  const coefX1 = parseFloat(document.getElementById("coefX1").value) || 0;
  const coefX2 = parseFloat(document.getElementById("coefX2").value) || 0;
  const objectiveType = document.getElementById("objectiveType").value;

  const rows = constraintsDiv.querySelectorAll(".constraint-row");
  const constraints = [];

  rows.forEach(r => {
    const c1 = parseFloat(r.querySelector(".coefX1").value);
    const c2 = parseFloat(r.querySelector(".coefX2").value);
    const rhs = parseFloat(r.querySelector(".rhs").value);

    // ignorar restricciones vacías
    if (!isNaN(c1) && !isNaN(c2) && !isNaN(rhs)) {
      constraints.push({
        c1, c2, rhs,
        ineq: r.querySelector(".ineq").value
      });
    }
  });

  // Restricciones automáticas x1>=0, x2>=0
  constraints.push({ c1: 1, c2: 0, rhs: 0, ineq: "min" });
  constraints.push({ c1: 0, c2: 1, rhs: 0, ineq: "min" });

  const metodo = new MetodoGrafico(coefX1, coefX2, objectiveType, constraints);
  const solucion = metodo.solve();

  // llenar tabla con vértices A,B,C...
  tableBody.innerHTML = "";
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  solucion.evaluations.forEach((p, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${letras[index]}</td>
      <td>${p.x.toFixed(2)}</td>
      <td>${p.y.toFixed(2)}</td>
      <td>${p.Z.toFixed(2)}</td>
    `;
    tableBody.appendChild(row);
  });

  // mostrar óptimo
  if (solucion.bestPoint) {
    optimoBox.textContent =
      `Óptimo: x1=${solucion.bestPoint.x.toFixed(2)}, ` +
      `x2=${solucion.bestPoint.y.toFixed(2)}, ` +
      `Z=${solucion.bestValue.toFixed(2)}`;
  } else {
    optimoBox.textContent = "No se encontró solución factible.";
  }

  drawChart(constraints, solucion, letras);
});

function drawChart(constraints, solucion, letras) {
  if (chart) chart.destroy();

  const datasets = [];

  // Región factible sombreada
  if (solucion.feasiblePolygon.length > 2) {
    datasets.push({
      label: "Región factible",
      data: [...solucion.feasiblePolygon, solucion.feasiblePolygon[0]], // cerrar polígono
      backgroundColor: "rgba(0, 200, 0, 0.2)",
      borderColor: "rgba(0, 200, 0, 0.6)",
      type: "line",
      fill: true,
      pointRadius: 0
    });
  }

  // Líneas de restricciones
  const colors = ["#FF5733", "#33A1FF", "#28A745", "#FFC300", "#8E44AD"];
  const allPoints = [...solucion.feasiblePolygon];
  if (solucion.bestPoint) allPoints.push(solucion.bestPoint);

  // Determinar máximos dinámicos
  const maxX = Math.ceil(Math.max(...allPoints.map(p => p.x), 1) * 1.1);
  const maxY = Math.ceil(Math.max(...allPoints.map(p => p.y), 1) * 1.1);

  constraints.forEach((c, i) => {
    const lineData = [];
    for (let x = 0; x <= maxX; x += maxX/200) {
      if (c.c2 !== 0) {
        let y = (c.rhs - c.c1 * x) / c.c2;
        if (y >= 0 && y <= maxY) lineData.push({ x, y });
      }
    }
    if (lineData.length > 0) {
      datasets.push({
        label: `Restricción ${i + 1}`,
        data: lineData,
        type: "line",
        borderColor: colors[i % colors.length],
        borderWidth: 2,
        fill: false,
        pointRadius: 0
      });
    }
  });

  // Vértices
  datasets.push({
    label: "Vértices",
    data: solucion.evaluations.map((p, i) => ({ x: p.x, y: p.y, label: letras[i] })),
    backgroundColor: "blue",
    pointRadius: 6
  });

  // Punto óptimo
  if (solucion.bestPoint) {
    datasets.push({
      label: "Óptimo",
      data: [{ x: solucion.bestPoint.x, y: solucion.bestPoint.y }],
      backgroundColor: "red",
      pointRadius: 8
    });
  }

  chart = new Chart(chartCanvas, {
    type: "scatter",
    data: { datasets: datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const label = ctx.raw.label ? ctx.raw.label : "";
              return `${label} (x=${ctx.raw.x.toFixed(2)}, y=${ctx.raw.y.toFixed(2)})`;
            }
          }
        }
      },
      scales: {
        x: { beginAtZero: true, max: maxX },
        y: { beginAtZero: true, max: maxY }
      }
    }
  });
}


