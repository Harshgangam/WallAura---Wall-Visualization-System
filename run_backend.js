const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const aiServiceDir = path.join(__dirname, "ai-service");
const venvPython = path.join(aiServiceDir, "venv", "Scripts", "python.exe");

// Detect best working Python command
function getPythonCommand() {
  const candidates = [
    "python",
    venvPython,
    "py -3.14",
    "py -3.12",
    "py",
  ];

  for (const cmd of candidates) {
    try {
      if (cmd === venvPython && !fs.existsSync(venvPython)) {
        continue;
      }
      const testCmd = `${cmd} -c "import fastapi, torch, transformers; print('OK')"`;
      const out = execSync(testCmd, {
        cwd: aiServiceDir,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf-8",
        timeout: 10000,
      });
      if (out && out.includes("OK")) {
        return cmd;
      }
    } catch (e) {
      // Continue to next candidate
    }
  }

  return "python";
}

const pyCmd = getPythonCommand();
let exe = "python";
let args = ["app.py"];

if (pyCmd.startsWith("py ")) {
  exe = "py";
  args = [...pyCmd.split(" ").slice(1), "app.py"];
} else if (pyCmd !== "python") {
  exe = pyCmd;
  args = ["app.py"];
}

console.log("\n" + "=".repeat(62));
console.log("  🚀 WallAura AI System is running!");
console.log("  👉 Open in your Browser:   http://localhost:3000");
console.log("  👉 AI Backend API:         http://localhost:8000");
console.log("  👉 Interactive API Docs:   http://localhost:8000/docs");
console.log("=".repeat(62) + "\n");

const proc = spawn(exe, args, {
  cwd: aiServiceDir,
  stdio: "inherit",
});

proc.on("error", (err) => {
  console.error("[WallAura Backend Error]:", err);
});

proc.on("exit", (code) => {
  console.log(`[WallAura Backend] Exited with code ${code}`);
});

function cleanup() {
  if (proc && proc.pid) {
    try {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
    } catch (e) {
      try {
        proc.kill();
      } catch (e2) {}
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

process.on("exit", () => {
  cleanup();
});
