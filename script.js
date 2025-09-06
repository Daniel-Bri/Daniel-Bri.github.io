class MetodoGrafico {
  constructor(coefX1, coefX2, objectiveType, constraints) {
    this.coefX1 = coefX1;
    this.coefX2 = coefX2;
    this.objectiveType = objectiveType; // "max" o "min"
    this.constraints = constraints;     // array de objetos {c1,c2,rhs,ineq}
  }

  getLineFromConstraint(c) {
    let xIntercept = c.c1 !== 0 ? c.rhs / c.c1 : null;
    let yIntercept = c.c2 !== 0 ? c.rhs / c.c2 : null;
    return { xIntercept, yIntercept };
  }

  getIntersection(c1, c2) {
    let det = c1.c1 * c2.c2 - c2.c1 * c1.c2;
    if (Math.abs(det) < 1e-9) return null; // paralelas
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
    points.push({ x: 0, y: 0 });
    this.constraints.forEach(c => {
      let line = this.getLineFromConstraint(c);
      if (line.xIntercept !== null) {
        let p = { x: line.xIntercept, y: 0 };
        if (this.isFeasible(p)) points.push(p);
      }
      if (line.yIntercept !== null) {
        let p = { x: 0, y: line.yIntercept };
        if (this.isFeasible(p)) points.push(p);
      }
    });

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

    return { evaluations, bestPoint, bestValue };
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
  row.className = "inputs-row";
  row.innerHTML = `
    <input type="number" placeholder="Coef x1" step="any" class="coefX1">
    <span>x1 +</span>
    <input type="number" placeholder="Coef x2" step="any" class="coefX2">
    <span>x2</span>
    <select class="ineq">
      <option value="max"><=</option>
      <option value="min">>=</option>
      <option value="equal">=</option>
    </select>
    <input type="number" placeholder="Valor" step="any" class="rhs">
  `;
  constraintsDiv.appendChild(row);
}

addConstraintBtn.addEventListener("click", addConstraintRow);

solveBtn.addEventListener("click", () => {
  const coefX1 = parseFloat(document.getElementById("coefX1").value) || 0;
  const coefX2 = parseFloat(document.getElementById("coefX2").value) || 0;
  const objectiveType = document.getElementById("objectiveType").value;

  const rows = constraintsDiv.querySelectorAll(".inputs-row");
  const constraints = [];
  rows.forEach(r => {
    constraints.push({
      c1: parseFloat(r.querySelector(".coefX1").value) || 0,
      c2: parseFloat(r.querySelector(".coefX2").value) || 0,
      rhs: parseFloat(r.querySelector(".rhs").value) || 0,
      ineq: r.querySelector(".ineq").value
    });
  });

  const metodo = new MetodoGrafico(coefX1, coefX2, objectiveType, constraints);
  const solucion = metodo.solve();

  // llenar tabla
  tableBody.innerHTML = "";
  solucion.evaluations.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${p.x.toFixed(2)}</td><td>${p.y.toFixed(2)}</td><td>${p.Z.toFixed(2)}</td>`;
    tableBody.appendChild(row);
  });

  // mostrar óptimo
  if (solucion.bestPoint) {
    optimoBox.textContent = `Óptimo: x1=${solucion.bestPoint.x.toFixed(2)}, x2=${solucion.bestPoint.y.toFixed(2)}, Z=${solucion.bestValue.toFixed(2)}`;
  } else {
    optimoBox.textContent = "No se encontró solución factible.";
  }

  // graficar
  drawChart(constraints, solucion);
});

function drawChart(constraints, solucion) {
  if (chart) chart.destroy();
  const datasets = [];
  const xs = Array.from({length: 200}, (_,i)=> i);

  constraints.forEach((c,i) => {
    if (c.c2 !== 0) {
      const ys = xs.map(x => (c.rhs - c.c1*x)/c.c2);
      datasets.push({
        label: `Restricción ${i+1}`,
        data: xs.map((x,j)=>({x,y:ys[j]})),
        borderColor: `hsl(${i*60},70%,50%)`,
        fill: false,
        showLine: true,
        pointRadius: 0
      });
    }
  });

  if (solucion.bestPoint) {
    datasets.push({
      label: "Óptimo",
      data: [{x: solucion.bestPoint.x, y: solucion.bestPoint.y}],
      backgroundColor: "red",
      pointRadius: 6
    });
  }

  chart = new Chart(chartCanvas, {
    type: "scatter",
    data: { datasets: datasets },
    options: {
      scales: {
        x: { beginAtZero: true },
        y: { beginAtZero: true }
      }
    }
  });
}

// iniciar con una restricción vacía
addConstraintRow();
